# Full-Stack Minikube Demo

This project runs a React frontend, Express backend, and MySQL database on Minikube.

## Structure

```text
frontend/   React + Vite UI
backend/    Express API
database/   Standalone SQL init file
k8s/        Kubernetes manifests for Minikube
```

## Run On Minikube

Start Minikube:

```bash
minikube start
```

Build the images inside Minikube's Docker environment:

```bash
eval $(minikube docker-env)
docker build -t demo-backend:1.0 ./backend
docker build -t demo-frontend:1.0 ./frontend
```

Deploy everything:

```bash
kubectl apply -f k8s/
```

Wait for pods:

```bash
kubectl get pods
```

Open the frontend:

```bash
minikube service frontend-service
```

Or open this URL if your Minikube IP is reachable:

```bash
http://$(minikube ip):30080
```

## API

The backend exposes:

```text
GET /api/users
GET /health
```

Inside Kubernetes:

```text
browser -> frontend-service:80 -> frontend nginx -> backend-service:5000 -> mysql-service:3306
```

## Run Frontend Manually

When running the frontend with Vite on your machine, start the backend locally on port `5000` first. The Vite dev server proxies `/api` to `http://localhost:5000`.

```bash
cd backend
npm install
DB_HOST=localhost DB_PORT=3306 DB_NAME=demo_app DB_USER=demo_user DB_PASSWORD=demo_password npm start
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Then open:

```text
http://localhost:5173
```

To point Vite to a different backend:

```bash
VITE_BACKEND_URL=http://localhost:5000 npm run dev
```

## Notes

The MySQL credentials are demo values in `k8s/mysql-secret.yaml`. For real projects, replace them before deploying.
