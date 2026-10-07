# Monitoring & Scaling Guide — Student Task Manager + Prometheus on Minikube

This document explains `prometheus.yaml`, the `monitoring` namespace, every command used to deploy / expose / scale / observe the app, and how to demo scale-up in Prometheus.

Related files:
- `prometheus.yaml` — full monitoring stack definition
- `MINIKUBE_COMMANDS.md` — app deploy commands
- `Jenkinsfile:3-5` — `pollSCM('H/2 * * * *')` = check Git every ~2 min, build only on change
- `server.js`, `Dockerfile`, `package.json`

---

## 1. What is the `monitoring` Namespace?

In Kubernetes, a Namespace is a logical isolation boundary inside the cluster. It separates resources (Pods, Services, ConfigMaps, Deployments) so monitoring tools don't clash with app workloads.

Why we use `monitoring`:
- Keeps Prometheus + kube-state-metrics separate from `default` (where `student-task-manager` runs).
- Lets you do `kubectl get all -n monitoring` vs `kubectl get all -n default`.
- RBAC can be scoped: Prometheus ServiceAccount lives in `monitoring` but has Cluster-wide read via ClusterRoleBinding.

### How was it made?

Declaratively, in `prometheus.yaml:1-4`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: monitoring
```

Applied with:

```bash
kubectl apply -f prometheus.yaml
```

This creates it if missing. Equivalent imperative command (not used here, but same result):

```bash
kubectl create namespace monitoring
```

Verify:

```bash
kubectl get namespaces
kubectl get all -n monitoring
# expected: pod/prometheus-xxx, pod/kube-state-metrics-xxx, svc/prometheus, svc/kube-state-metrics
```

Everything else in `prometheus.yaml` has `namespace: monitoring`, so it all lands inside it.

---

## 2. `prometheus.yaml` — Section by Section

File has 7 documents separated by `---`, applied in one `kubectl apply`.

### 2.1 RBAC for Prometheus (`prometheus.yaml:8-36`)

```yaml
ServiceAccount: prometheus / monitoring
ClusterRole: prometheus
ClusterRoleBinding: prometheus -> ServiceAccount
```

- `ServiceAccount`: identity for Prometheus Pods (`spec.serviceAccountName: prometheus` in `prometheus.yaml:153`).
- `ClusterRole` rules:
  - `["", apps]` / `nodes, nodes/metrics, services, endpoints, pods, deployments, replicasets, statefulsets, daemonsets` / `get,list,watch`
- Purpose: allows `kubernetes_sd_configs: role: pod` discovery (job `kubernetes-pods`) to list/watch pods cluster-wide.
- Without this: Prometheus gets `403 Forbidden` on Kubernetes API.

Check:

```bash
kubectl get sa,clusterrole,clusterrolebinding -l app=prometheus -A
# or by name:
kubectl get sa prometheus -n monitoring
kubectl get clusterrole prometheus
kubectl get clusterrolebinding prometheus
```

### 2.2 Prometheus Scrape Config (`prometheus.yaml:38-61`)

`ConfigMap: prometheus-config / monitoring` with key `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
  - job_name: 'kube-state-metrics'
    static_configs:
      - targets: ['kube-state-metrics.monitoring.svc.cluster.local:8080']
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
```

Meaning:
- `scrape_interval: 15s`: pull metrics from every target every 15 seconds. This is why scale-up shows in ~15-30s.
- `prometheus`: self-monitoring.
- `kube-state-metrics`: source of `kube_deployment_spec_replicas`, `kube_deployment_status_replicas_available`, `kube_pod_info`, etc. DNS form is `<svc>.<ns>.svc.cluster.local:<port>`.
- `kubernetes-pods`: dynamic discovery. Only scrapes Pods annotated `prometheus.io/scrape: "true"`. Your Node app (`server.js`) currently exposes no `/metrics`, so this job finds nothing unless you add a client library + annotation. Scaling demo uses `kube-state-metrics` job, not this one.

Verify:

```bash
kubectl get cm prometheus-config -n monitoring -o yaml
```

### 2.3 kube-state-metrics (`prometheus.yaml:64-136`)

Exporter that converts Kubernetes object state into Prometheus metrics.

- Own `ServiceAccount + ClusterRole + ClusterRoleBinding` (`list,watch` on nodes, pods, services, deployments, etc.).
- `Deployment: kube-state-metrics / monitoring`, `replicas: 1`, image `registry.k8s.io/kube-state-metrics/kube-state-metrics:v2.12.0`, port `8080`, small requests/limits.
- `Service: kube-state-metrics / monitoring`, port `8080 -> 8080` (ClusterIP, internal only).

Key metrics it produces for scaling demo:
- `kube_deployment_spec_replicas{deployment="student-task-manager"}`
- `kube_deployment_status_replicas{...}`
- `kube_deployment_status_replicas_available{...}`
- `kube_pod_info{namespace="default", created_by_name=~"student-task-manager-.*"}`
- `kube_replicaset_spec_replicas`, `kube_namespace_info`, etc.

### 2.4 Prometheus Server (`prometheus.yaml:137-183`)

- `Deployment: prometheus / monitoring`, `replicas: 1`, image `prom/prometheus:v2.52.0`
- Args: `--config.file=/etc/prometheus/prometheus.yml --storage.tsdb.path=/prometheus --web.enable-lifecycle`
- `volumeMount: config -> /etc/prometheus` from `ConfigMap: prometheus-config`. No PVC — data is ephemeral (resets on Pod restart, fine for demo).
- `Service: prometheus / monitoring`, `type: NodePort`, `9090 -> 9090`, `nodePort: 30090`.

Access methods (pick one):
```bash
# 1. port-forward (recommended, works everywhere)
kubectl port-forward svc/prometheus -n monitoring 9090:9090
# -> http://localhost:9090

# 2. NodePort via minikube
minikube service prometheus -n monitoring --url
# -> e.g. http://192.168.49.2:30090
```

---

## 3. Every Command Explained

### 3.1 Cluster

```bash
minikube start --driver=docker
```
Creates/starts single-node Kubernetes cluster in Docker. Downloads kubelet, apiserver, etcd.

```bash
minikube status
```
Confirms `kubelet`, `apiserver` running. Debug if `Stopped`.

### 3.2 Image

```bash
docker build -t student-task-manager:local .
```
Builds from `Dockerfile:1-8` (`node:20-alpine`, `npm install`, `EXPOSE 3000`, `CMD npm start`). Tag `local` = no registry push.

```bash
docker images | grep student-task
```
Verify image exists locally.

```bash
minikube image load student-task-manager:local
```
Copies image from host Docker into minikube's internal Docker/containerd so Kubelet can pull it without DockerHub. Required because tag is local.

```bash
minikube image ls | grep student-task
```
Verify inside minikube.

### 3.3 App Deploy

```bash
kubectl create deployment student-task-manager --image=student-task-manager:local --port=3000 --replicas=2
```
- Creates `Deployment` in `default` namespace.
- `--port=3000` documents container port (matches `server.js:5` `PORT=3000`).
- `--replicas=2` starts 2 Pods. This is your baseline for scaling demo.

```bash
kubectl get deployments
kubectl get pods -w
```
- Check desired vs ready. `-w` watches live Pod creation.

```bash
kubectl expose deployment student-task-manager --type=NodePort --port=80 --target-port=3000 --name=student-task-manager-service
```
- Creates `Service`: internal port `80` -> container `3000`.
- `NodePort` allocates random high port (e.g. `3xxxx`) for external access.
- Name must be `student-task-manager-service` (note: `MINIKUBE_COMMANDS.md:49` has a backtick typo).

```bash
kubectl get svc
kubectl get pods,svc
```
Verify Service `CLUSTER-IP` + `PORT(S)`.

### 3.4 Access App

```bash
minikube service student-task-manager-service --url
```
Prints NodePort URL, e.g. `http://192.168.49.2:31234`.

```bash
curl $(minikube service student-task-manager-service --url)/api/tasks
```
Hits `GET /api/tasks` (`server.js:28-30`), returns JSON tasks. Proves app works.

```bash
kubectl port-forward svc/student-task-manager-service 3000:80
# open http://localhost:3000
```
Alternative: forwards `localhost:3000 -> svc:80 -> pod:3000`. Keep terminal open; `Ctrl+C` stops.

### 3.5 Monitoring Deploy

```bash
kubectl apply -f prometheus.yaml
```
Creates all 7 resources: Namespace, 2x SA, 2x ClusterRole, 2x Binding, ConfigMap, 2x Deployment, 2x Service. Idempotent — safe to re-run.

```bash
kubectl get all -n monitoring
kubectl get cm prometheus-config -n monitoring -o yaml
```
Confirm stack + config loaded.

```bash
kubectl port-forward svc/prometheus -n monitoring 9090:9090
```
View UI at `http://localhost:9090`. Check `Status > Targets`: `prometheus (1/1 up)`, `kube-state-metrics (1/1 up)`, `kubernetes-pods (0 targets if no annotations — normal)`.

### 3.6 Scale-Up (the demo)

```bash
kubectl scale deployment student-task-manager --replicas=5
```
Changes `.spec.replicas` from `2 -> 5`. Deployment controller creates 3 more ReplicaSet Pods. No image rebuild needed.

Other useful variants:
```bash
kubectl get deployment student-task-manager
kubectl get pods -l app=student-task-manager -w
kubectl describe deployment student-task-manager
kubectl rollout status deployment/student-task-manager
```

Scale down after demo:
```bash
kubectl scale deployment student-task-manager --replicas=2
```

Cleanup:
```bash
kubectl delete service student-task-manager-service
kubectl delete deployment student-task-manager
kubectl delete -f prometheus.yaml
# or just namespace (deletes everything inside):
kubectl delete namespace monitoring
```

---

## 4. Showing Scale-Up in Prometheus (Step-by-Step)

1. Baseline with `replicas=2`, Prometheus forwarding on.
2. In Prometheus UI `Graph` tab, run:
   ```promql
   kube_deployment_spec_replicas{deployment="student-task-manager"}
   ```
   Should show flat line at `2`. Switch to `Graph` + range `15m` for visual.
3. Extra queries to show side-by-side:
   ```promql
   kube_deployment_status_replicas_available{deployment="student-task-manager"}
   count(kube_pod_info{namespace="default"} == 1)
   up{job="kube-state-metrics"}
   ```
4. Run `kubectl scale deployment student-task-manager --replicas=5`.
5. Wait 15-30s (one-two `scrape_interval`s). Graph steps `2 -> 5`. `kubectl get pods` shows 5 running.
6. Screenshot: Prometheus graph spike + terminal `kubectl get deployment`.
7. Optional: set `replicas=1` then `replicas=5` to show down/up in same graph.

Why this works: `kube-state-metrics` watches API server, exposes replica counts; Prometheus scrapes it every 15s; PromQL plots over time. No app code change needed because we observe Kubernetes state, not app `/metrics`.

> Note: `server.js` has no Prometheus client (`/metrics` endpoint). If you want per-pod CPU / request latency, add `prom-client`, expose `/metrics`, annotate Deployment with `prometheus.io/scrape: "true"`, and the `kubernetes-pods` job will pick it up.

---

## 5. Jenkins Trigger Interval (for reference)

`Jenkinsfile:3-5`:
```groovy
triggers { pollSCM('H/2 * * * *') }
```
- Cron format `MIN HOUR DOM MONTH DOW` = `H/2 * * * *` = every 2 minutes (hashed `H` spreads load on Jenkins master).
- `pollSCM` polls Git; triggers `Checkout -> Install -> Build -> Test` only if new commit found. No change = no build.
- Different from `cron('H/2 * * * *')` which would build blindly every 2 min.

---

## 6. Quick Cheat Sheet

```bash
minikube start --driver=docker
docker build -t student-task-manager:local . && minikube image load student-task-manager:local
kubectl create deployment student-task-manager --image=student-task-manager:local --port=3000 --replicas=2
kubectl expose deployment student-task-manager --type=NodePort --port=80 --target-port=3000 --name=student-task-manager-service
kubectl apply -f prometheus.yaml
kubectl port-forward svc/prometheus -n monitoring 9090:9090 &
kubectl scale deployment student-task-manager --replicas=5
# query in http://localhost:9090 : kube_deployment_spec_replicas{deployment="student-task-manager"}
```
