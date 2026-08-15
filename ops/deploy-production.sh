#!/usr/bin/env bash
set -Eeuo pipefail

readonly REPO_DIR="/home/ubuntu/fashion-ecommerce-system"
readonly STATE_DIR="/home/ubuntu/.local/state/fashion-ecommerce"
readonly STATE_FILE="${STATE_DIR}/deployed-sha"
readonly LOCK_FILE="/tmp/fashion-ecommerce-deploy.lock"
readonly PUBLIC_URL="https://cdshopfashion.duckdns.org"
readonly CHECK_RUNS_URL="https://api.github.com/repos/bloodthirster2510/fashion-ecommerce-system/commits"

log() {
  printf '[deploy] %s\n' "$*"
}

wait_for_service() {
  local service="$1"
  local container_id status

  for _ in $(seq 1 40); do
    container_id="$(docker compose ps -q "$service")"
    if [[ -n "$container_id" ]]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
      if [[ "$status" == "healthy" || "$status" == "running" ]]; then
        log "$service is $status"
        return 0
      fi
      if [[ "$status" == "unhealthy" || "$status" == "exited" || "$status" == "dead" ]]; then
        log "$service entered state: $status"
        return 1
      fi
    fi
    sleep 5
  done

  log "$service did not become healthy before timeout"
  return 1
}

github_checks_passed() {
  local sha="$1"
  local response_file http_code
  response_file="$(mktemp)"

  http_code="$(curl --silent --show-error \
    --output "$response_file" \
    --write-out '%{http_code}' \
    --header 'Accept: application/vnd.github+json' \
    --header 'User-Agent: fashion-ecommerce-deployer' \
    "$CHECK_RUNS_URL/$sha/check-runs?per_page=100")"

  if [[ "$http_code" != "200" ]]; then
    log "GitHub check-runs API returned HTTP $http_code; deployment will retry"
    rm -f "$response_file"
    return 1
  fi

  if ! python3 - "$response_file" <<'PY'
import json
import sys

required = {
    "backend-ci",
    "web-frontend-ci",
    "mobile-frontend-ci",
    "compose-validation",
}

with open(sys.argv[1], encoding="utf-8") as stream:
    runs = json.load(stream).get("check_runs", [])

latest = {}
for run in runs:
    name = run.get("name")
    if name in required:
        latest[name] = run

missing = sorted(required - latest.keys())
pending = sorted(
    name
    for name, run in latest.items()
    if run.get("status") != "completed" or run.get("conclusion") != "success"
)

if missing or pending:
    print(f"waiting for checks; missing={missing}, not-successful={pending}")
    raise SystemExit(1)
PY
  then
    rm -f "$response_file"
    return 1
  fi

  rm -f "$response_file"
  return 0
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "another deployment is already running"
  exit 1
fi

cd "$REPO_DIR"

if ! git diff --quiet || ! git diff --cached --quiet; then
  log "tracked files on the server have local changes; refusing to overwrite them"
  exit 1
fi

log "fetching origin/main"
git fetch --prune origin main:refs/remotes/origin/main
target_sha="$(git rev-parse origin/main)"
current_sha="$(git rev-parse HEAD)"
mkdir -p "$STATE_DIR"

if [[ -f "$STATE_FILE" ]]; then
  deployed_sha="$(<"$STATE_FILE")"
elif git merge-base --is-ancestor "$current_sha" "$target_sha"; then
  deployed_sha="$current_sha"
else
  deployed_sha="$target_sha"
fi

if [[ "$deployed_sha" == "$target_sha" ]]; then
  log "production is already at $target_sha"
  exit 0
fi

if ! github_checks_passed "$target_sha"; then
  log "production checks have not passed for $target_sha; leaving the current version running"
  exit 0
fi

if ! git cat-file -e "${deployed_sha}^{commit}" 2>/dev/null; then
  log "previous deployment commit is unavailable; rebuilding all services"
  changed_files="compose.yaml"
else
  changed_files="$(git diff --name-only "$deployed_sha" "$target_sha")"
fi

if git show-ref --verify --quiet refs/heads/main; then
  git switch main
  git merge --ff-only origin/main
else
  git switch --create main --track origin/main
fi

declare -a services=()
add_service() {
  local candidate="$1" existing
  for existing in "${services[@]-}"; do
    [[ "$existing" == "$candidate" ]] && return
  done
  services+=("$candidate")
}

while IFS= read -r file; do
  case "$file" in
    backend/*) add_service backend ;;
    web_frontend/*) add_service web ;;
    ai_services/image-validation/*) add_service image-validation ;;
    ai_services/garment-processing/*) add_service garment-processing ;;
    compose.yaml|docker.env.example)
      add_service image-validation
      add_service garment-processing
      add_service backend
      add_service web
      ;;
  esac
done <<< "$changed_files"

if [[ ${#services[@]} -eq 0 ]]; then
  log "no server container changed; recording $target_sha"
  printf '%s\n' "$target_sha" > "$STATE_FILE"
  exit 0
fi

log "services to deploy: ${services[*]}"
declare -A previous_images=()
declare -A image_refs=()

for service in "${services[@]}"; do
  container_id="$(docker compose ps -q "$service")"
  if [[ -n "$container_id" ]]; then
    previous_images["$service"]="$(docker inspect --format '{{.Image}}' "$container_id")"
    image_refs["$service"]="$(docker inspect --format '{{.Config.Image}}' "$container_id")"
  fi
done

log "building replacement images"
docker compose build "${services[@]}"

rollback() {
  log "deployment failed; restoring previous images"
  local service
  for service in "${services[@]}"; do
    if [[ -n "${previous_images[$service]-}" && -n "${image_refs[$service]-}" ]]; then
      docker image tag "${previous_images[$service]}" "${image_refs[$service]}"
    fi
  done
  docker compose up -d --no-deps --force-recreate "${services[@]}" || true
  for service in "${services[@]}"; do
    wait_for_service "$service" || true
  done
}

if ! docker compose up -d --no-deps "${services[@]}"; then
  rollback
  exit 1
fi

for service in "${services[@]}"; do
  if ! wait_for_service "$service"; then
    rollback
    exit 1
  fi
done

if [[ " ${services[*]} " == *" backend "* ]]; then
  curl --fail --silent --show-error --retry 5 --retry-delay 3 "$PUBLIC_URL/health" >/dev/null || {
    rollback
    exit 1
  }
fi

if [[ " ${services[*]} " == *" web "* ]]; then
  curl --fail --silent --show-error --retry 5 --retry-delay 3 "$PUBLIC_URL/" >/dev/null || {
    rollback
    exit 1
  }
fi

printf '%s\n' "$target_sha" > "$STATE_FILE"
log "deployment completed at $target_sha"
