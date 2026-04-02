#!/bin/bash
# render-deploy.sh — Helper script for Render API operations via GitLab CI
#
# Usage:
#   ./scripts/render-deploy.sh trigger-deploy <branch> [service-id]
#   ./scripts/render-deploy.sh get-service-status <service-id>
#   ./scripts/render-deploy.sh delete-service <service-id>
#
# Environment Variables:
#   RENDER_API_KEY       — API key from Render dashboard
#   RENDER_BASE_URL      — Default: https://api.render.com/v1
#   RENDER_ACCOUNT_ID    — Your Render account ID (for API calls)

set -euo pipefail

RENDER_BASE_URL="${RENDER_BASE_URL:-https://api.render.com/v1}"
API_KEY="${RENDER_API_KEY:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${GREEN}ℹ️  $1${NC}"
}

log_warn() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

# Validate API key
if [ -z "$API_KEY" ]; then
  log_error "RENDER_API_KEY is not set"
  exit 1
fi

# Command: trigger-deploy
trigger_deploy() {
  local branch="$1"
  local service_id="${2:-}"

  log_info "Triggering deploy for branch: $branch"

  if [ -z "$service_id" ]; then
    log_warn "No service ID provided. Using deploy hook if RENDER_DEPLOY_HOOK_URL is set."
    if [ -z "${RENDER_DEPLOY_HOOK_URL:-}" ]; then
      log_error "RENDER_DEPLOY_HOOK_URL not set and no service ID provided"
      exit 1
    fi

    curl -X POST "$RENDER_DEPLOY_HOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{\"branch\": \"$branch\"}" \
      -w "\nStatus: %{http_code}\n"
  else
    # Alternative: Use API to get service and trigger deploy
    log_info "Triggering deploy via API for service: $service_id"

    curl -X POST "$RENDER_BASE_URL/services/$service_id/deploys" \
      -H "Authorization: Bearer $API_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"gitBranch\": \"$branch\"}" \
      -w "\nStatus: %{http_code}\n"
  fi
}

# Command: get-service-status
get_service_status() {
  local service_id="$1"

  log_info "Fetching status for service: $service_id"

  curl -s -X GET "$RENDER_BASE_URL/services/$service_id" \
    -H "Authorization: Bearer $API_KEY" \
    | jq '{
        id: .id,
        name: .name,
        status: .status,
        notificationEmail: .notificationEmail,
        createdAt: .createdAt,
        updatedAt: .updatedAt
      }'
}

# Command: delete-service
delete_service() {
  local service_id="$1"

  log_warn "Deleting service: $service_id"
  read -p "Are you sure? (yes/no): " -r confirmation
  echo

  if [[ $confirmation != "yes" ]]; then
    log_info "Deletion cancelled"
    exit 0
  fi

  curl -X DELETE "$RENDER_BASE_URL/services/$service_id" \
    -H "Authorization: Bearer $API_KEY" \
    -w "\nStatus: %{http_code}\n"

  log_info "Service deleted"
}

# Command: list-services
list_services() {
  log_info "Listing all services..."

  curl -s -X GET "$RENDER_BASE_URL/services" \
    -H "Authorization: Bearer $API_KEY" \
    | jq '.[] | {
        id: .id,
        name: .name,
        type: .type,
        status: .status
      }'
}

# Main
main() {
  if [ $# -lt 1 ]; then
    echo "Usage: $0 <command> [args]"
    echo ""
    echo "Commands:"
    echo "  trigger-deploy <branch> [service-id]  — Trigger deploy from branch"
    echo "  get-service-status <service-id>       — Get service status"
    echo "  delete-service <service-id>           — Delete a service"
    echo "  list-services                         — List all services"
    exit 1
  fi

  local cmd="$1"
  shift

  case "$cmd" in
    trigger-deploy)
      trigger_deploy "$@"
      ;;
    get-service-status)
      get_service_status "$@"
      ;;
    delete-service)
      delete_service "$@"
      ;;
    list-services)
      list_services
      ;;
    *)
      log_error "Unknown command: $cmd"
      exit 1
      ;;
  esac
}

main "$@"
