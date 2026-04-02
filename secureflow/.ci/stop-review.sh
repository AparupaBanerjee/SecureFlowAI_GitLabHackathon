#!/bin/bash
set -euo pipefail

echo "Stopping Render preview environment for MR ${CI_MERGE_REQUEST_IID}"

if [ -z "${RENDER_API_KEY:-}" ] || [ -z "${RENDER_OWNER_ID:-}" ]; then
  echo "RENDER_API_KEY or RENDER_OWNER_ID missing, skipping cleanup"
  exit 0
fi

RENDER_BASE_URL="https://api.render.com/v1"
RENDER_PREVIEW_ID="mr-${CI_MERGE_REQUEST_IID}"
RENDER_BACKEND_SERVICE_NAME="securevault-backend-${RENDER_PREVIEW_ID}"
RENDER_FRONTEND_SERVICE_NAME="securevault-frontend-${RENDER_PREVIEW_ID}"

for svc_name in "${RENDER_FRONTEND_SERVICE_NAME}" "${RENDER_BACKEND_SERVICE_NAME}"; do
  svc_id=$(curl -sS "${RENDER_BASE_URL}/services?ownerId=${RENDER_OWNER_ID}&name=${svc_name}" \
    -H "Authorization: Bearer ${RENDER_API_KEY}" \
    | jq -r '.[0].service.id // empty')

  if [ -n "$svc_id" ]; then
    echo "Deleting ${svc_name} (${svc_id})"
    curl -sS -X DELETE "${RENDER_BASE_URL}/services/${svc_id}" \
      -H "Authorization: Bearer ${RENDER_API_KEY}" >/dev/null
  else
    echo "Service not found, skipping: ${svc_name}"
  fi
done
