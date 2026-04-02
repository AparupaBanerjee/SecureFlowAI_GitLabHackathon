# ── Stage: dev ────────────────────────────────────────────────────────────────
# Runs Vite's dev server with HMR (hot module replacement).
# Source is volume-mounted so edits are reflected immediately without rebuild.
FROM node:20-alpine AS dev

WORKDIR /app

COPY package*.json ./
RUN npm ci

# src/ and index.html are volume-mounted at runtime
EXPOSE 5173

# --host 0.0.0.0 makes the Vite dev server reachable from the host machine
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ── Stage: builder ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_API_URL controls where axios points in the production build.
# For nginx-served builds, /api is rewritten to the backend upstream.
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# ── Stage: prod ────────────────────────────────────────────────────────────────
# Nginx serves the static build and reverse-proxies /api to the backend.
FROM nginx:1.27-alpine AS prod

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
