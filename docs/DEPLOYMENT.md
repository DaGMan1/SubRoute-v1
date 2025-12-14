# SubRoute Deployment Guide

This guide outlines how to deploy the SubRoute application to a production environment.

**Current Architecture Status:**
The app is currently a **Single Page Application (SPA)**.
- **Frontend:** React (Vite-style structure).
- **Data:** LocalStorage (Client-side only).
- **Backend:** The `server/` directory exists but is not currently required for the Sandbox version to function.

---

## Option 1: Vercel (Recommended for GitHub)

Vercel is the easiest way to deploy this application. It automatically detects the React framework and optimizes the delivery network.

### Prerequisites
- A [GitHub](https://github.com/) account.
- A [Vercel](https://vercel.com/) account.

### Steps
1.  **Push to GitHub**: Ensure your project is pushed to a repository on GitHub.
2.  **Import Project**:
    *   Go to your Vercel Dashboard.
    *   Click **"Add New..."** > **"Project"**.
    *   Select your `SubRoute` repository.
3.  **Configure Project**:
    *   **Framework Preset**: Vercel should auto-detect `Vite` or `Create React App`. If not, select **Vite**.
    *   **Root Directory**: `./` (default).
    *   **Build Command**: `npm run build` (or `tsc && vite build`).
    *   **Output Directory**: `dist` (standard for Vite) or `build` (standard for CRA).
4.  **Deploy**: Click **Deploy**.

Vercel will build the app and provide you with a live URL (e.g., `subroute.vercel.app`).

---

## Option 2: Google Cloud Run (Docker Container)

To deploy to Cloud Run, you must containerize the application. Since this is a Client-Side app, we will use a multi-stage Docker build to compile the React code and then serve it using **Nginx**.

### Prerequisites
- [Google Cloud CLI (gcloud)](https://cloud.google.com/sdk/docs/install) installed.
- A Google Cloud Project with billing enabled.

### 1. Create a `Dockerfile`
Create a file named `Dockerfile` in the root of your project:

```dockerfile
# Stage 1: Build the React Application
FROM node:18-alpine as builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the app (produces 'dist' folder)
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx config (optional, see step 2)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8080 (Cloud Run requirement)
EXPOSE 8080

# Configure Nginx to listen on 8080
CMD ["nginx", "-g", "daemon off;"]
```

### 2. Configure Nginx (Important for SPAs)
Because this is a Single Page App, we need Nginx to redirect all requests to `index.html` so React Router works.

Create a file named `nginx.conf` in the root (if you want to use the optional copy step above), or simply use this logic. 

*For a quick start without a custom config file, you can modify the Dockerfile `CMD` to specific port, but Cloud Run injects the PORT env var. The simplest way for Cloud Run is to add a basic config:*

**Create `nginx.conf` in your root:**

```nginx
server {
    listen 8080;
    server_name localhost;

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

*Update your Dockerfile to copy this config:*
`COPY nginx.conf /etc/nginx/conf.d/default.conf`

### 3. Build & Deploy

Run the following commands in your terminal:

**1. Authenticate with Google Cloud**
```bash
gcloud auth login
gcloud config set project [YOUR_PROJECT_ID]
```

**2. Build and Submit the Image**
```bash
gcloud builds submit --tag gcr.io/[YOUR_PROJECT_ID]/subroute-app
```

**3. Deploy to Cloud Run**
```bash
gcloud run deploy subroute-service \
  --image gcr.io/[YOUR_PROJECT_ID]/subroute-app \
  --platform managed \
  --region australia-southeast1 \
  --allow-unauthenticated
```

### 4. Result
Google Cloud will provide a Service URL (e.g., `https://subroute-service-xyz-ts.a.run.app`).

---

## Summary of Differences

| Feature | Vercel | Google Cloud Run |
| :--- | :--- | :--- |
| **Setup** | Extremely Easy (Zero Config) | Moderate (Requires Docker) |
| **Cost** | Free tier available | Pay-per-use (Free tier available) |
| **Control** | Optimized for Frontend | Full control over container environment |
| **Best For** | Static sites, SPAs, Next.js | Enterprise compliance, Custom Backends |
