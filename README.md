# Student Task Manager

A simple Node.js (Express) web app for students to manage homework assignments and deadlines.

## Features

- Add, edit, delete tasks
- Mark tasks complete / incomplete
- Filter by status (pending, in progress, completed, overdue)
- Search by title or subject
- Dashboard stats (total, pending, due soon, overdue)

## Run

```bash
npm install
npm start
```

Open http://localhost:3000 in your browser.

## Build (Jenkins)

The `build.sh` script installs dependencies, syntax-checks the server, starts the app in the background, and verifies the API is responding. In a Jenkins Freestyle job, add an Execute shell step:

```bash
bash build.sh
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List all tasks |
| POST | `/api/tasks` | Create a task |
| PUT | `/api/tasks/:id` | Update a task |
| DELETE | `/api/tasks/:id` | Delete a task |

Tasks are stored in memory, so data resets when the server restarts.
