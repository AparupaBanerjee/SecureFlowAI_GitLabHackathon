#!/bin/bash
set -euo pipefail

echo "Creating Render preview environment for MR ${CI_MERGE_REQUEST_IID}"

if [ -z "${RENDER_API_KEY:-}" ]; then
  echo "ERROR: RENDER_API_KEY is not set"
  exit 1
fi
if [ -z "${RENDER_OWNER_ID:-}" ]; then
  echo "ERROR: RENDER_OWNER_ID is not set"
  exit 1
fi
if [ -z "${RENDER_PREVIEW_DATABASE_URL:-}" ]; then
  echo "ERROR: RENDER_PREVIEW_DATABASE_URL is not set"
  exit 1
fi

REPO_URL="${CI_PROJECT_URL}.git"
RENDER_BASE_URL="https://api.render.com/v1"
RENDER_PREVIEW_ID="mr-${CI_MERGE_REQUEST_IID}"
RENDER_BACKEND_SERVICE_NAME="securevault-backend-${RENDER_PREVIEW_ID}"
RENDER_FRONTEND_SERVICE_NAME="securevault-frontend-${RENDER_PREVIEW_ID}"
RENDER_REGION="oregon"

# Remove stale services with the same names to keep retries idempotent.
for svc_name in "${RENDER_BACKEND_SERVICE_NAME}" "${RENDER_FRONTEND_SERVICE_NAME}"; do
  existing_id=$(curl -sS "${RENDER_BASE_URL}/services?ownerId=${RENDER_OWNER_ID}&name=${svc_name}" \
    -H "Authorization: Bearer ${RENDER_API_KEY}" \
    | jq -r '.[0].service.id // empty')
  if [ -n "$existing_id" ]; then
    echo "Deleting stale service ${svc_name} (${existing_id})"
    curl -sS -X DELETE "${RENDER_BASE_URL}/services/${existing_id}" \
      -H "Authorization: Bearer ${RENDER_API_KEY}" >/dev/null || true
  fi
done

cat > backend-create.json <<JSON
{
  "type": "web_service",
  "name": "${RENDER_BACKEND_SERVICE_NAME}",
  "ownerId": "${RENDER_OWNER_ID}",
  "repo": "${REPO_URL}",
  "branch": "${CI_COMMIT_REF_NAME}",
  "rootDir": "backend",
  "autoDeploy": "yes",
  "envVars": [
    { "key": "NODE_ENV", "value": "production" },
    { "key": "DATABASE_URL", "value": "${RENDER_PREVIEW_DATABASE_URL}" },
    { "key": "CORS_ORIGINS", "value": "https://${RENDER_FRONTEND_SERVICE_NAME}.onrender.com" }
  ],
  "serviceDetails": {
    "runtime": "node",
    "region": "${RENDER_REGION}",
    "plan": "free",
    "healthCheckPath": "/health",
    "numInstances": 1,
    "envSpecificDetails": {
      "buildCommand": "npm install --include=dev && npm run build",
      "startCommand": "npm start"
    }
  }
}
JSON

backend_resp=$(curl -sS -X POST "${RENDER_BASE_URL}/services" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  --data @backend-create.json)

backend_id=$(echo "$backend_resp" | jq -r '.service.id // empty')
backend_url=$(echo "$backend_resp" | jq -r '.service.serviceDetails.url // empty')
if [ -z "$backend_id" ]; then
  echo "Failed to create backend service"
  echo "$backend_resp"
  exit 1
fi
if [ -z "$backend_url" ] || [ "$backend_url" = "null" ]; then
  backend_url="https://${RENDER_BACKEND_SERVICE_NAME}.onrender.com"
fi

cat > frontend-create.json <<JSON
{
  "type": "static_site",
  "name": "${RENDER_FRONTEND_SERVICE_NAME}",
  "ownerId": "${RENDER_OWNER_ID}",
  "repo": "${REPO_URL}",
  "branch": "${CI_COMMIT_REF_NAME}",
  "rootDir": "frontend",
  "autoDeploy": "yes",
  "envVars": [
    { "key": "VITE_API_URL", "value": "${backend_url}" }
  ],
  "serviceDetails": {
    "buildCommand": "npm install && npm run build",
    "publishPath": "dist",
    "routes": [
      { "type": "rewrite", "source": "/*", "destination": "/index.html" }
    ],
    "headers": [
      { "path": "/*", "name": "X-Frame-Options", "value": "SAMEORIGIN" }
    ]
  }
}
JSON

frontend_resp=$(curl -sS -X POST "${RENDER_BASE_URL}/services" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  --data @frontend-create.json)

frontend_id=$(echo "$frontend_resp" | jq -r '.service.id // empty')
frontend_url=$(echo "$frontend_resp" | jq -r '.service.serviceDetails.url // empty')
if [ -z "$frontend_id" ]; then
  echo "Failed to create frontend service"
  echo "$frontend_resp"
  exit 1
fi
if [ -z "$frontend_url" ] || [ "$frontend_url" = "null" ]; then
  frontend_url="https://${RENDER_FRONTEND_SERVICE_NAME}.onrender.com"
fi

echo "BACKEND_SERVICE_ID=${backend_id}" > deploy.env
echo "FRONTEND_SERVICE_ID=${frontend_id}" >> deploy.env
echo "PREVIEW_BACKEND_URL=${backend_url}" >> deploy.env
echo "PREVIEW_FRONTEND_URL=${frontend_url}" >> deploy.env
echo "DAST_WEBSITE=${backend_url}" >> deploy.env

echo "Preview backend: ${backend_url}"
echo "Preview frontend: ${frontend_url}"
