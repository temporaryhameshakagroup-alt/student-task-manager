# Student Task Manager — Minikube + kubectl (no YAML, custom tag)

## 1. Start minikube
```bash
minikube start --driver=docker
minikube status
```

## 2. Build image with Docker
```bash
docker build -t student-task-manager:local .
docker images | grep student-task
```

## 3. Load image into minikube
```bash
minikube image load student-task-manager:local
minikube image ls | grep student-task
```

## 4. Create Deployment (imperative, no YAML)
```bash
kubectl create deployment student-task-manager --image=student-task-manager:local --port=3000 --replicas=2
kubectl get deployments
kubectl get pods -w
```

## 5. Expose with a Service
```bash
kubectl expose deployment student-task-manager --type=NodePort --port=80 --target-port=3000 --name=student-task-manager-service
kubectl get svc
kubectl get pods,svc
```

## 6. Access the app
```bash
minikube service student-task-manager-service --url
curl $(minikube service student-task-manager-service --url)/api/tasks
```

Optional — open on `localhost:3000` via port-forward (keep terminal open):
```bash
kubectl port-forward svc/student-task-manager-service 3000:80
# open http://localhost:3000
```

## 7. Stop the Service
```bash
kubectl delete service student-task-manager-service
kubectl delete deployment student-task-manager
kubectl get pods,svc
```
