# ── Stage: dev ────────────────────────────────────────────────────────────────
# Runs ts-node-dev for hot-reload in local development.
# Source is volume-mounted at runtime so edits are reflected without rebuild.
FROM node:20-alpine AS dev

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

# src/ is volume-mounted at runtime
EXPOSE 3001

CMD ["npm", "run", "dev"]

# ── Stage: builder ─────────────────────────────────────────────────────────────
# Compiles TypeScript to dist/ for the production image.
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage: prod ────────────────────────────────────────────────────────────────
# Minimal runtime — only production dependencies and compiled JS.
FROM node:20-alpine AS prod

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/server.js"]
