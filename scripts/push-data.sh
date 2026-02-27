#!/usr/bin/env bash
###############################################################################
# push-data.sh — Build ingestion payloads from sample-data/ and push them
#                to the MCQ Dashboard ingestion API via curl.
#
# Usage:
#   ./scripts/push-data.sh                        # push all QCD sample data
#   ./scripts/push-data.sh platform-config        # push only platform config
#   ./scripts/push-data.sh deployments             # push only deployments
#   ./scripts/push-data.sh test-results            # push only test results
#   ./scripts/push-data.sh cluster-test-results    # push only cluster test results
#   ./scripts/push-data.sh scorecards              # push only scorecards
#
# Environment variables:
#   INGEST_ENDPOINT  — API Gateway ingestion URL (required)
#   API_KEY          — API key for authentication (required)
#   ACCOUNT_ID       — AWS account ID (default: 326869539878)
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SAMPLE_DIR="${SCRIPT_DIR}/../sample-data"
ACCOUNT_ID="${ACCOUNT_ID:-326869539878}"

# Defaults — override with env vars
INGEST_ENDPOINT="${INGEST_ENDPOINT:-}"
API_KEY="${API_KEY:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# -------------------------------------------------------------------------
# Validate prerequisites
# -------------------------------------------------------------------------
if [[ -z "${INGEST_ENDPOINT}" ]]; then
  log_error "INGEST_ENDPOINT is not set."
  echo "  Export it:  export INGEST_ENDPOINT=https://<api-id>.execute-api.<region>.amazonaws.com"
  exit 1
fi

if [[ -z "${API_KEY}" ]]; then
  log_error "API_KEY is not set."
  echo "  Export it:  export API_KEY=dsh_k8s_abc123..."
  exit 1
fi

if ! command -v curl &>/dev/null; then
  log_error "curl is required but not installed."
  exit 1
fi

if ! command -v python3 &>/dev/null; then
  log_error "python3 is required to build payloads."
  exit 1
fi

# -------------------------------------------------------------------------
# Build ingestion payload for a given type
#
# Merges the raw sample-data JSON files and adds accountId.
# Returns the path to a temp file containing the payload.
# -------------------------------------------------------------------------
build_payload() {
  local data_type="$1"
  local tmp_file
  tmp_file=$(mktemp /tmp/mcq-payload-XXXXXX.json)

  case "${data_type}" in
    platform-config)
      python3 -c "
import json, sys
data = {'accountId': '${ACCOUNT_ID}'}
for f in ['service-health/clusters.json','service-health/services.json',
          'service-health/current-running.json','service-health/promotions.json',
          'common/metadata.json']:
    with open('${SAMPLE_DIR}/' + f) as fh:
        data.update(json.load(fh))
json.dump(data, sys.stdout)
" > "${tmp_file}"
      ;;
    deployments)
      python3 -c "
import json, sys
with open('${SAMPLE_DIR}/service-health/deployments.json') as f:
    data = json.load(f)
data['accountId'] = '${ACCOUNT_ID}'
json.dump(data, sys.stdout)
" > "${tmp_file}"
      ;;
    test-results)
      python3 -c "
import json, sys
with open('${SAMPLE_DIR}/service-health/test-runs.json') as f:
    data = json.load(f)
data['accountId'] = '${ACCOUNT_ID}'
json.dump(data, sys.stdout)
" > "${tmp_file}"
      ;;
    cluster-test-results)
      python3 -c "
import json, sys
with open('${SAMPLE_DIR}/service-health/cluster-test-runs.json') as f:
    data = json.load(f)
data['accountId'] = '${ACCOUNT_ID}'
json.dump(data, sys.stdout)
" > "${tmp_file}"
      ;;
    scorecards)
      python3 -c "
import json, sys
data = {'accountId': '${ACCOUNT_ID}'}
with open('${SAMPLE_DIR}/scorecard/scorecards.json') as f:
    data.update(json.load(f))
with open('${SAMPLE_DIR}/version-compare/jira-tickets.json') as f:
    data.update(json.load(f))
json.dump(data, sys.stdout)
" > "${tmp_file}"
      ;;
    *)
      log_error "No payload builder for type: ${data_type}"
      rm -f "${tmp_file}"
      return 1
      ;;
  esac

  echo "${tmp_file}"
}

# -------------------------------------------------------------------------
# Push a single data type to the ingestion API
# -------------------------------------------------------------------------
push_data() {
  local data_type="$1"

  # Build the payload on-the-fly
  local payload_file
  payload_file=$(build_payload "${data_type}")

  if [[ ! -f "${payload_file}" ]]; then
    log_error "Failed to build payload for ${data_type}"
    return 1
  fi

  local url="${INGEST_ENDPOINT}/v1/ingest/${data_type}"
  log_info "Pushing ${data_type} → ${url}"

  local http_code
  http_code=$(curl -s -o /tmp/mcq-push-response.json -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${API_KEY}" \
    -d @"${payload_file}" \
    "${url}")

  rm -f "${payload_file}"

  if [[ "${http_code}" -ge 200 && "${http_code}" -lt 300 ]]; then
    log_info "  ✓ ${data_type} — HTTP ${http_code}"
    python3 -m json.tool /tmp/mcq-push-response.json 2>/dev/null || cat /tmp/mcq-push-response.json
    echo ""
  else
    log_error "  ✗ ${data_type} — HTTP ${http_code}"
    cat /tmp/mcq-push-response.json 2>/dev/null
    echo ""
    return 1
  fi
}

# -------------------------------------------------------------------------
# Main
# -------------------------------------------------------------------------
DATA_TYPES=("platform-config" "deployments" "test-results" "cluster-test-results" "scorecards")

if [[ $# -gt 0 ]]; then
  for dtype in "$@"; do
    if [[ ! " ${DATA_TYPES[*]} " =~ " ${dtype} " ]]; then
      log_error "Unknown data type: ${dtype}"
      log_info "Valid types: ${DATA_TYPES[*]}"
      exit 1
    fi
    push_data "${dtype}"
  done
else
  log_info "Pushing all QCD sample data to ${INGEST_ENDPOINT}"
  echo ""
  for dtype in "${DATA_TYPES[@]}"; do
    push_data "${dtype}"
  done
fi

log_info "Done! Check the dashboard at https://dev.dashboard.mcq.infosight.cloud"
