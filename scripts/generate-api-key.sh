#!/usr/bin/env bash
###############################################################################
# generate-api-key.sh — Generate API key + key pair for collector onboarding
#
# Usage:
#   ./scripts/generate-api-key.sh --account-id 111111111111 --cluster-name eks-prod-01
#
# Outputs:
#   - API key (to be stored as k8s secret)
#   - RSA private key file (for JWT signing)
#   - API key hash (to be stored in DynamoDB)
###############################################################################

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ACCOUNT_ID=""
CLUSTER_NAME=""
OUTPUT_DIR="./generated-keys"

while [[ $# -gt 0 ]]; do
  case $1 in
    --account-id)   ACCOUNT_ID="$2"; shift 2 ;;
    --cluster-name) CLUSTER_NAME="$2"; shift 2 ;;
    --output-dir)   OUTPUT_DIR="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "${ACCOUNT_ID}" || -z "${CLUSTER_NAME}" ]]; then
  echo "Usage: $0 --account-id <AWS_ACCOUNT_ID> --cluster-name <CLUSTER_NAME>"
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"

# Generate API key
API_KEY="dsh_k8s_$(openssl rand -hex 24)"

# Generate RSA key pair
PRIVATE_KEY_FILE="${OUTPUT_DIR}/${ACCOUNT_ID}-${CLUSTER_NAME}-private.pem"
PUBLIC_KEY_FILE="${OUTPUT_DIR}/${ACCOUNT_ID}-${CLUSTER_NAME}-public.pem"

openssl genrsa -out "${PRIVATE_KEY_FILE}" 2048 2>/dev/null
openssl rsa -in "${PRIVATE_KEY_FILE}" -pubout -out "${PUBLIC_KEY_FILE}" 2>/dev/null
chmod 600 "${PRIVATE_KEY_FILE}"

# Hash the API key
API_KEY_HASH=$(echo -n "${API_KEY}" | shasum -a 256 | awk '{print $1}')

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  API Key Generated Successfully${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}Account ID:${NC}    ${ACCOUNT_ID}"
echo -e "${CYAN}Cluster Name:${NC}  ${CLUSTER_NAME}"
echo ""
echo -e "${CYAN}API Key:${NC}       ${API_KEY}"
echo -e "${CYAN}API Key Hash:${NC}  ${API_KEY_HASH}"
echo ""
echo -e "${CYAN}Private Key:${NC}   ${PRIVATE_KEY_FILE}"
echo -e "${CYAN}Public Key:${NC}    ${PUBLIC_KEY_FILE}"
echo ""
echo -e "${YELLOW}── DynamoDB Item (for mcq-api-keys table) ──${NC}"
echo ""
cat <<EOF
{
  "apiKeyHash": { "S": "${API_KEY_HASH}" },
  "accountId": { "S": "${ACCOUNT_ID}" },
  "clusterName": { "S": "${CLUSTER_NAME}" },
  "status": { "S": "active" },
  "createdAt": { "S": "$(date -u +%Y-%m-%dT%H:%M:%SZ)" },
  "expiresAt": { "N": "$(date -v+365d +%s 2>/dev/null || date -d '+365 days' +%s)" },
  "scopes": { "L": [
    { "S": "k8s-services" },
    { "S": "eks-clusters" },
    { "S": "aws-services" },
    { "S": "platform-config" },
    { "S": "deployments" },
    { "S": "test-results" },
    { "S": "cluster-test-results" },
    { "S": "scorecards" }
  ]}
}
EOF
echo ""
echo -e "${YELLOW}── Helm install command for EKS team ──${NC}"
echo ""
echo "  kubectl create secret generic dashboard-creds \\"
echo "    --namespace=dashboard-system \\"
echo "    --from-literal=api-key='${API_KEY}' \\"
echo "    --from-file=private-key='${PRIVATE_KEY_FILE}'"
echo ""
echo -e "${GREEN}Done!${NC}"
