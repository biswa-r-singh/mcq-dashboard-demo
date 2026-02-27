# MCQ Dashboard — Quality Center Dashboard (QCD)

A serverless Quality Center Dashboard for monitoring Kubernetes deployment pipelines, test results, scorecards, and service health across clusters. Data flows through an EventBridge-based ingestion pipeline into DynamoDB, served to a vanilla JS frontend via API Gateway + CloudFront.

**Live URL**: `https://dev.dashboard.mcq.infosight.cloud`

---

## Architecture

```
Data Sources                     AWS Account (326869539878)
┌─────────────────────┐         ┌──────────────────────────────────────────┐
│  push-data.sh       │──curl──▶│  API Gateway (Ingestion)                 │
│  (or any CI/CD)     │  POST   │    POST /v1/ingest/{type}                │
│                     │  x-api  │    ↓                                     │
└─────────────────────┘  -key   │  Lambda (ingestion-handler)              │
                                │    validates API key → publishes event   │
                                │    ↓                                     │
                                │  EventBridge (dev-mcq-dashboard-bus)     │
                                │    ├─▶ Lambda (qcd-processor) → DynamoDB │
                                │    └─▶ Firehose → S3 (audit trail)      │
                                │                                          │
                                │  API Gateway (Dashboard)                 │
                                │    GET /v1/qcd/*                         │
                                │    ↓                                     │
                                │  Lambda (dashboard-api)                  │
                                │    reads DynamoDB → returns JSON         │
                                │    ↓                                     │
                                │  CloudFront + S3                         │
                                │    dev.dashboard.mcq.infosight.cloud     │
                                └──────────────────────────────────────────┘
```

### Data Flow

1. **Ingestion**: `curl POST /v1/ingest/{type}` with `x-api-key` header → ingestion-handler Lambda validates key → publishes to EventBridge
2. **Processing**: EventBridge rules route events by `detail-type` → qcd-processor Lambda writes to DynamoDB
3. **Serving**: Frontend calls `/v1/qcd/*` → CloudFront proxies to Dashboard API Gateway → dashboard-api Lambda reads DynamoDB → returns JSON

---

## Project Structure

```
mcq-dashboard-demo/
├── frontend/                           # Vanilla JS SPA (no build step)
│   ├── index.html                      #   Entry point
│   └── src/
│       ├── app.js                      #   App shell + navigation
│       ├── data.js                     #   Data loader (API → fallback to JSON)
│       ├── router.js                   #   Client-side routing
│       ├── ui.js                       #   Shared UI components
│       └── pages/                      #   Dashboard pages
│           ├── overview.js             #     Main overview
│           ├── cluster.js              #     Cluster detail
│           ├── service.js              #     Service detail
│           ├── build.js                #     Build/deployment view
│           ├── reliability.js          #     Test reliability view
│           ├── scorecard.js            #     Scorecard view
│           ├── versions.js             #     Version comparison
│           ├── analytics.js            #     Analytics
│           └── architecture.js         #     Architecture diagram
│
├── sample-data/                        # Sample JSON data files
│   ├── service-health/
│   │   ├── clusters.json               #   Clusters + regions + roles
│   │   ├── services.json               #   Service definitions
│   │   ├── current-running.json        #   Running versions per cluster-region
│   │   ├── deployments.json            #   Deployment attempts (370 records)
│   │   ├── test-runs.json              #   Per-attempt test runs (859 records)
│   │   ├── cluster-test-runs.json      #   Cluster-level test runs (40 records)
│   │   └── promotions.json             #   Cross-cluster promotions
│   ├── version-compare/
│   │   └── jira-tickets.json           #   Jira tickets by service
│   ├── scorecard/
│   │   └── scorecards.json             #   Weights + per-service scores
│   └── common/
│       └── metadata.json               #   Suite + status metadata
│
├── scripts/
│   ├── push-data.sh                    #   Build payloads + push via curl
│   └── generate-api-key.sh             #   Generate API key + register in DynamoDB
│
└── infrastructure/
    ├── lambdas/                        # Python 3.12 Lambda source code
    │   ├── ingestion-handler/          #   Validates API key, publishes to EventBridge
    │   ├── qcd-processor/              #   Processes QCD events → DynamoDB
    │   └── dashboard-api/              #   GET endpoints for frontend
    │
    ├── terraform/modules/              # Reusable Terraform modules
    │   ├── api-gateway/                #   HTTP API Gateway v2
    │   ├── cloudfront/                 #   CDN + S3 origin + API origin
    │   ├── dynamodb/                   #   DynamoDB tables
    │   ├── eventbridge/                #   Event bus + rules + archive
    │   ├── lambda/                     #   Lambda + IAM + CloudWatch
    │   ├── s3-website/                 #   S3 bucket for frontend
    │   └── waf/                        #   WAF v2 rules
    │
    └── terragrunt/dev/us-east-1/       # Environment config (DRY)
        ├── root.hcl                    #   Provider, backend, tags
        ├── dynamodb/                   #   5 tables: api-keys, platform,
        │   ├── api-keys/               #     deployments, test-results, scorecards
        │   ├── platform/
        │   ├── deployments/
        │   ├── test-results/
        │   └── scorecards/
        ├── lambda/                     #   3 Lambdas
        │   ├── ingestion-handler/
        │   ├── qcd-processor/
        │   └── dashboard-api/
        ├── api-gateway/
        │   ├── ingestion/              #   POST /v1/ingest/*
        │   └── dashboard/              #   GET /v1/qcd/*
        ├── eventbridge/                #   Bus + 5 rules
        ├── cloudfront/                 #   CDN (S3 + API origins)
        ├── s3-website/                 #   Frontend bucket
        └── waf/                        #   WAF for CloudFront
```

---

## Infrastructure Details

### AWS Resources (dev environment)

| Resource | Name / ID | Details |
|----------|-----------|---------|
| **Account** | 326869539878 | IAM Role: `HOP-ADMIN` |
| **Domain** | dev.dashboard.mcq.infosight.cloud | Route53 + ACM |
| **S3 Bucket** | dev-mcq-dashboard-frontend | Frontend static files |
| **CloudFront** | E13KSBNMCBAU8H | S3 origin + `/v1/*` → API Gateway |
| **EventBridge** | dev-mcq-dashboard-bus | 5 rules, archive enabled |
| **State Bucket** | mcq-dashboard-dev-us-east-1-tfstate-326869539878 | Terraform remote state |

### DynamoDB Tables

| Table | Partition Key | Sort Key | GSIs | Purpose |
|-------|--------------|----------|------|---------|
| dev-mcq-api-keys | `apiKeyHash` | — | — | API key auth for ingestion |
| dev-mcq-platform | `pk` | `sk` | `itemType-index` | Clusters, services, config, promotions, metadata |
| dev-mcq-deployments | `pk` | `sk` | `clusterId-index`, `serviceId-index` | Deployment attempts |
| dev-mcq-test-results | `pk` | `sk` | `suiteType-index` | Per-attempt + cluster-level test runs |
| dev-mcq-scorecards | `pk` | `sk` | — | Weights, per-service scores, Jira tickets |

### API Endpoints

**Ingestion API** (`https://53z7ui61r0.execute-api.us-east-1.amazonaws.com`):

| Method | Path | Body Key | EventBridge Detail-Type |
|--------|------|----------|------------------------|
| POST | `/v1/ingest/platform-config` | accountId + clusters, services, etc. | `dashboard.platform.config.updated` |
| POST | `/v1/ingest/deployments` | accountId, deploymentAttempts[] | `dashboard.deployments.reported` |
| POST | `/v1/ingest/test-results` | accountId, testRuns[] | `dashboard.test-results.reported` |
| POST | `/v1/ingest/cluster-test-results` | accountId, clusterTestRuns[] | `dashboard.cluster-test-results.reported` |
| POST | `/v1/ingest/scorecards` | accountId, scorecardWeights, scorecards, jiraTickets | `dashboard.scorecards.updated` |

**Dashboard API** (`https://dm2zdhmob2.execute-api.us-east-1.amazonaws.com`, proxied via CloudFront at `/v1/*`):

| Method | Path | Returns |
|--------|------|---------|
| GET | `/v1/health` | Health check |
| GET | `/v1/qcd/clusters` | clusters, clusterRegions, clusterRegionRoles, currentRunning |
| GET | `/v1/qcd/services` | services list |
| GET | `/v1/qcd/deployments` | deploymentAttempts (filterable: `?clusterId=`, `?serviceId=`) |
| GET | `/v1/qcd/test-runs` | testRuns (filterable: `?attemptId=`, `?suiteType=`) |
| GET | `/v1/qcd/cluster-test-runs` | clusterTestRuns (filterable: `?clusterId=`, `?suiteType=`) |
| GET | `/v1/qcd/scorecards` | scorecardWeights + scorecards |
| GET | `/v1/qcd/promotions` | promotions list |
| GET | `/v1/qcd/jira-tickets` | jiraTickets grouped by service |
| GET | `/v1/qcd/metadata` | suiteMeta + statusMeta |

### Lambda Functions

| Function | Runtime | Purpose |
|----------|---------|---------|
| `dev-mcq-dashboard-ingestion-handler` | Python 3.12 | Validates `x-api-key`, validates payload schema, publishes to EventBridge |
| `dev-mcq-dashboard-qcd-processor` | Python 3.12 | Routes events by `detail-type`, writes to 4 DynamoDB tables |
| `dev-mcq-dashboard-api` | Python 3.12 | Reads DynamoDB, returns JSON for 10 QCD GET routes |

---

## Frontend

The frontend is a vanilla JS SPA — **no build step, no Node.js, no npm**. Just HTML + JS files served directly from S3 via CloudFront.

### data.js — Data Loading

`data.js` loads data from the Dashboard API at runtime:

1. **Primary**: Calls `/v1/qcd/*` endpoints (proxied through CloudFront)
2. **Fallback**: If API is unavailable, loads from `./sample-data/` JSON files

Set `window.MCQ_API_BASE` to override the API URL (defaults to `''` = same origin via CloudFront).

### Exported Data

| Export | Source API | Description |
|--------|-----------|-------------|
| `clusters` | `/v1/qcd/clusters` | Base cluster definitions (mira, pavo, aquila) |
| `clusterRegions` | `/v1/qcd/clusters` | Cluster-region combinations (e.g., mira-us-west-2) |
| `clusterRegionRoles` | `/v1/qcd/clusters` | Active/hot-standby roles per cluster |
| `currentRunning` | `/v1/qcd/clusters` | Running version per service per cluster-region |
| `services` | `/v1/qcd/services` | Service definitions (15 services) |
| `deploymentAttempts` | `/v1/qcd/deployments` | Deployment records with status, version, timing |
| `testRuns` | `/v1/qcd/test-runs` | Per-attempt test results (functional, scale, perf, etc.) |
| `clusterTestRuns` | `/v1/qcd/cluster-test-runs` | Cluster-level nightly regressions |
| `promotions` | `/v1/qcd/promotions` | Cross-cluster promotion records |
| `jiraTickets` | `/v1/qcd/jira-tickets` | Jira tickets grouped by service |
| `scorecardWeights` | `/v1/qcd/scorecards` | Category weights for scoring |
| `scorecards` | `/v1/qcd/scorecards` | Per-service quality scores |
| `suiteMeta` | `/v1/qcd/metadata` | Test suite display names + colors |
| `statusMeta` | `/v1/qcd/metadata` | Deployment status display config |
| `appIdToServiceId` | Derived | Maps appId → serviceId |

### Helper Functions

- `getBaseCluster(baseId)` — Find a cluster by ID
- `getClusterRegion(clusterRegionId)` — Get enriched cluster-region object with name, type, role
- `init()` — Must be called once before rendering; loads all data

### Deploying Frontend

```bash
# Assume HOP-ADMIN role first, then:
aws s3 sync frontend/ s3://dev-mcq-dashboard-frontend/ --delete --region us-east-1
aws cloudfront create-invalidation --distribution-id E13KSBNMCBAU8H --paths "/*"
```

---

## Sample Data

The `sample-data/` directory contains 10 JSON files with realistic test data:

- **3 clusters**: Mira (QA) → Pavo (Stage) → Aquila (Production)
- **6 cluster-regions**: Each cluster in us-west-2 + us-east-2
- **15 services**: AuthN, AuthZ, Account-management, Frontend, etc.
- **370 deployment attempts** across all cluster-regions and services
- **859 test runs** (functional, scale, perf, security, soak, chaos)
- **40 cluster test runs** (nightly regressions)
- **Scorecards** with weighted quality scores per service
- **Jira tickets** linked to services

---

## Scripts

### push-data.sh — Push Data to Ingestion API

Builds ingestion payloads on-the-fly from `sample-data/` files (adds `accountId`, merges related files) and pushes them via curl.

```bash
# Set required env vars
export INGEST_ENDPOINT="https://53z7ui61r0.execute-api.us-east-1.amazonaws.com"
export API_KEY="dsh_k8s_<your-key>"

# Push all 5 data types
./scripts/push-data.sh

# Push specific type
./scripts/push-data.sh platform-config
./scripts/push-data.sh deployments
./scripts/push-data.sh test-results
./scripts/push-data.sh cluster-test-results
./scripts/push-data.sh scorecards
```

**Payload mapping** (what `push-data.sh` builds internally):

| Ingest Type | Source Files | Merged Into |
|-------------|-------------|-------------|
| `platform-config` | clusters.json + services.json + current-running.json + promotions.json + metadata.json | Single payload with accountId |
| `deployments` | deployments.json | + accountId |
| `test-results` | test-runs.json | + accountId |
| `cluster-test-results` | cluster-test-runs.json | + accountId |
| `scorecards` | scorecards.json + jira-tickets.json | + accountId |

### generate-api-key.sh — Create API Key

```bash
./scripts/generate-api-key.sh --account-id 326869539878 --cluster-name qcd-data-loader
```

Outputs an API key + SHA-256 hash + DynamoDB item JSON. Register the item in `dev-mcq-api-keys` table, then use the API key in `push-data.sh`.

---

## Quick Start (from scratch)

```bash
# 1. Authenticate
okta-aws-cli web --profile default

# 2. Deploy infrastructure
cd infrastructure/terragrunt/dev/us-east-1
terragrunt run-all apply --terragrunt-non-interactive

# 3. Generate an API key
cd ../../../..
./scripts/generate-api-key.sh --account-id 326869539878 --cluster-name qcd-data-loader
# → Copy the DynamoDB item JSON and put it in the api-keys table

# 4. Push sample data
export INGEST_ENDPOINT="https://53z7ui61r0.execute-api.us-east-1.amazonaws.com"
export API_KEY="dsh_k8s_<your-key>"
./scripts/push-data.sh

# 5. Deploy frontend
aws s3 sync frontend/ s3://dev-mcq-dashboard-frontend/ --delete --region us-east-1
aws cloudfront create-invalidation --distribution-id E13KSBNMCBAU8H --paths "/*"

# 6. Open dashboard
open https://dev.dashboard.mcq.infosight.cloud
```

---

## Terraform / Terragrunt

- **Terraform** >= 1.10.0
- **Terragrunt** for DRY config, dependency management, remote state
- **State**: S3 bucket `mcq-dashboard-dev-us-east-1-tfstate-326869539878` with DynamoDB lock
- **Format**: Run `terraform fmt -recursive infrastructure/terraform/` and `terragrunt hclfmt --terragrunt-working-dir infrastructure/terragrunt`

### Deploy a single module

```bash
cd infrastructure/terragrunt/dev/us-east-1/lambda/dashboard-api
terragrunt apply
```

### Deploy everything

```bash
cd infrastructure/terragrunt/dev/us-east-1
terragrunt run-all apply --terragrunt-non-interactive
```
