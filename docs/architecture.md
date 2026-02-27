# MCQ Dashboard — Architecture

## System Architecture

```mermaid
flowchart TB
    subgraph Sources["Data Sources"]
        direction TB
        VTN["VTN Reports<br/>(Cron)"]
        TEST["Test Reports<br/>(CI/CD)"]
        SPIN["Spinnaker<br/>Deployments"]
        GHA["GitHub Actions<br/>Deployments"]
        COST["AWS Cost<br/>Reports"]
    end

    subgraph Ingestion["Ingestion Layer"]
        direction TB
        WAF_IN["WAF"]
        APIGW_IN["API Gateway<br/>(Ingestion)<br/>POST /v1/ingest/*"]
        LAMBDA_IN["ingestion-handler<br/>Lambda (Python 3.12)"]
    end

    subgraph EventDriven["Event-Driven Processing"]
        direction TB
        EB["EventBridge Bus<br/>dev-mcq-dashboard-bus"]
        RULES["5 Event Rules<br/>platform-config | deployments<br/>test-results | cluster-test-results<br/>scorecards"]
        QCD["qcd-processor<br/>Lambda (Python 3.12)"]
    end

    subgraph Storage["Storage Layer"]
        direction TB
        DDB_P["DynamoDB<br/>Platform"]
        DDB_D["DynamoDB<br/>Deployments"]
        DDB_T["DynamoDB<br/>Test Results"]
        DDB_S["DynamoDB<br/>Scorecards"]
        DDB_K["DynamoDB<br/>API Keys"]
    end

    subgraph Dashboard["Dashboard API"]
        direction TB
        APIGW_OUT["API Gateway<br/>(Dashboard)<br/>GET /v1/qcd/*"]
        LAMBDA_OUT["dashboard-api<br/>Lambda (Python 3.12)"]
    end

    subgraph Frontend["Frontend (S3 + CloudFront)"]
        direction TB
        CF["CloudFront<br/>CDN + WAF"]
        S3["S3 Bucket<br/>Static Website"]
        UI["MCQ Dashboard<br/>9 Views"]
    end

    subgraph Scripts["Developer Scripts"]
        direction TB
        PUSH["push-data.sh<br/>(curl payloads)"]
        KEYGEN["generate-api-key.sh"]
    end

    %% Data flow — Ingestion path
    Sources -->|"curl / SDK<br/>API Key Auth"| WAF_IN
    PUSH -->|"curl POST"| WAF_IN
    WAF_IN --> APIGW_IN
    APIGW_IN --> LAMBDA_IN
    LAMBDA_IN -->|"Validate Key"| DDB_K
    LAMBDA_IN -->|"PutEvents"| EB
    EB --> RULES
    RULES -->|"Invoke"| QCD

    %% Data flow — Storage writes
    QCD -->|"BatchWriteItem"| DDB_P
    QCD -->|"BatchWriteItem"| DDB_D
    QCD -->|"BatchWriteItem"| DDB_T
    QCD -->|"BatchWriteItem"| DDB_S

    %% Data flow — Dashboard reads
    DDB_P -->|"Query/Scan"| LAMBDA_OUT
    DDB_D -->|"Query/Scan"| LAMBDA_OUT
    DDB_T -->|"Query/Scan"| LAMBDA_OUT
    DDB_S -->|"Query/Scan"| LAMBDA_OUT
    LAMBDA_OUT --> APIGW_OUT
    APIGW_OUT -->|"REST API"| UI
    CF --> S3
    S3 --> UI

    %% Scripts
    KEYGEN -.->|"Register"| DDB_K

    %% Styling
    classDef aws fill:#FF9900,stroke:#232F3E,color:#232F3E,font-weight:bold
    classDef lambda fill:#D45B07,stroke:#232F3E,color:white,font-weight:bold
    classDef dynamo fill:#4053D6,stroke:#232F3E,color:white,font-weight:bold
    classDef frontend fill:#1B9E77,stroke:#232F3E,color:white,font-weight:bold
    classDef source fill:#2196F3,stroke:#0D47A1,color:white,font-weight:bold
    classDef script fill:#607D8B,stroke:#37474F,color:white,font-weight:bold
    classDef event fill:#E91E63,stroke:#880E4F,color:white,font-weight:bold

    class VTN,TEST,SPIN,GHA,COST source
    class APIGW_IN,APIGW_OUT,WAF_IN aws
    class LAMBDA_IN,QCD,LAMBDA_OUT lambda
    class DDB_P,DDB_D,DDB_T,DDB_S,DDB_K dynamo
    class CF,S3,UI frontend
    class PUSH,KEYGEN script
    class EB,RULES event
```

## Key Design Decisions

| Aspect | Choice | Rationale |
|--------|--------|-----------|
| Compute | AWS Lambda | Zero servers, pay-per-invocation, auto-scaling |
| Storage | DynamoDB (on-demand) | Sub-ms reads, schemaless JSON, zero admin |
| Event routing | EventBridge | Decoupled, rule-based routing, extensible |
| Frontend hosting | S3 + CloudFront | Global CDN, zero-origin servers |
| Security | WAF + API Key auth | Rate limiting, IP filtering, key validation |
| IaC | Terraform + Terragrunt | Modular, DRY, multi-env ready |

## Data Flow Summary

1. **Ingest** — Data sources POST JSON to `/v1/ingest/{type}` with API key
2. **Validate** — `ingestion-handler` checks the API key against DynamoDB
3. **Route** — Valid events are published to EventBridge with a detail-type
4. **Process** — `qcd-processor` receives matched events and writes to DynamoDB
5. **Serve** — `dashboard-api` reads from DynamoDB and returns JSON via REST
6. **Display** — SPA frontend fetches from the Dashboard API and renders views

---

## API Management + Lambda vs Standalone Kubernetes API

An **API management layer** (AWS API Gateway, Apigee, Kong, etc.) provides
cross-cutting concerns — auth, caching, throttling, transformation — as
configuration rather than code. A standalone REST API on Kubernetes must
implement or bolt on every one of these capabilities manually.

### What an API Gateway Gives You Out of the Box

```mermaid
flowchart TB
    subgraph APIMGMT["✅ API Management Layer (API Gateway / Apigee / Kong)"]
        direction TB

        subgraph BuiltIn["Built-in Capabilities — zero application code"]
            direction LR
            AUTH["🔐 Auth / AuthZ<br/>API keys, OAuth2, JWT<br/>IAM, Cognito, OIDC"]
            THROTTLE["⚡ Rate Limiting<br/>per-key quotas<br/>burst throttling"]
            CACHE["📦 Response Caching<br/>TTL-based, per-route<br/>reduces backend calls"]
        end

        subgraph BuiltIn2[""]
            direction LR
            TRANSFORM["🔄 Request / Response<br/>Transformation<br/>header injection, mapping"]
            WAF_FEAT["🛡️ WAF + IP Filtering<br/>SQL injection, XSS<br/>geo-blocking"]
            OBSERVE["📊 Observability<br/>access logs, metrics<br/>request tracing"]
        end

        subgraph BuiltIn3[""]
            direction LR
            VERSIONING["🏷️ API Versioning<br/>stage management<br/>canary deployments"]
            CORS_FEAT["🌐 CORS<br/>preflight handling<br/>origin whitelisting"]
            DOCS["📄 API Documentation<br/>OpenAPI / Swagger<br/>developer portal"]
        end
    end

    subgraph STANDALONE["❌ Standalone REST API on Kubernetes"]
        direction TB

        subgraph DIY["You Must Build / Integrate Each One"]
            direction LR
            DIY_AUTH["Auth middleware<br/>passport.js / Spring Security<br/>+ token validation code"]
            DIY_THROTTLE["Rate limiter<br/>express-rate-limit / Redis<br/>+ config per route"]
            DIY_CACHE["Cache layer<br/>Redis / Memcached<br/>+ cache invalidation logic"]
        end

        subgraph DIY2[""]
            direction LR
            DIY_TRANSFORM["Custom middleware<br/>for header / body<br/>transformation"]
            DIY_WAF["Separate WAF<br/>or nginx ModSecurity<br/>+ rule maintenance"]
            DIY_OBSERVE["Prometheus + Grafana<br/>+ custom metrics<br/>+ log aggregation"]
        end

        subgraph DIY3[""]
            direction LR
            DIY_VERSION["Ingress path routing<br/>+ Helm chart per version<br/>+ manual canary"]
            DIY_CORS["CORS middleware<br/>per framework<br/>+ testing burden"]
            DIY_DOCS["Swagger codegen<br/>+ manual sync<br/>with implementation"]
        end
    end

    style APIMGMT fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
    style STANDALONE fill:#FFEBEE,stroke:#C62828,stroke-width:2px
    style BuiltIn fill:#C8E6C9,stroke:#388E3C
    style BuiltIn2 fill:#C8E6C9,stroke:#388E3C
    style BuiltIn3 fill:#C8E6C9,stroke:#388E3C
    style DIY fill:#FFCDD2,stroke:#D32F2F
    style DIY2 fill:#FFCDD2,stroke:#D32F2F
    style DIY3 fill:#FFCDD2,stroke:#D32F2F
```

### API Gateway + Lambda vs Kubernetes REST API

```mermaid
flowchart LR
    subgraph Serverless["✅ API Gateway + Lambda"]
        direction TB

        subgraph SInfra["Infrastructure"]
            direction LR
            APIGW["API Gateway<br/>managed, auto-scaling"]
            LAMBDA["Lambda<br/>pay-per-request"]
        end

        subgraph SOps["Operations"]
            direction TB
            S_SCALE["Auto-scales to zero<br/>and to 10K+ RPS"]
            S_PATCH["No OS / runtime<br/>patching"]
            S_HA["Built-in HA<br/>multi-AZ by default"]
            S_COST["Pay only when<br/>requests arrive"]
            S_DEPLOY["Deploy in seconds<br/>via Terraform"]
        end

        APIGW --> LAMBDA
    end

    subgraph K8s["❌ Kubernetes REST API"]
        direction TB

        subgraph KInfra["Infrastructure"]
            direction LR
            ING["Ingress Controller<br/>nginx / ALB"]
            SVC["REST API Service<br/>(pods)"]
        end

        subgraph KOps["Operational Overhead"]
            direction TB
            K_CLUSTER["EKS cluster management<br/>~$73/mo control plane"]
            K_NODES["EC2 node groups<br/>min 2 nodes ($140+/mo)"]
            K_PATCH["OS + K8s + container<br/>patching burden"]
            K_HPA["HPA / VPA tuning<br/>manual scaling config"]
            K_HELM["Helm charts +<br/>manifests to maintain"]
            K_MONITOR["Prometheus + Grafana<br/>monitoring stack"]
        end

        ING --> SVC
    end

    style Serverless fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
    style K8s fill:#FFEBEE,stroke:#C62828,stroke-width:2px
    style SInfra fill:#C8E6C9,stroke:#388E3C
    style SOps fill:#C8E6C9,stroke:#388E3C
    style KInfra fill:#FFCDD2,stroke:#D32F2F
    style KOps fill:#FFCDD2,stroke:#D32F2F
```

### Side-by-Side Comparison

```mermaid
block-beta
    columns 3

    block:header:3
        columns 3
        h1["Dimension"]
        h2["API Gateway + Lambda"]
        h3["Kubernetes REST API"]
    end

    block:row1:3
        columns 3
        r1a["Auth / AuthZ"]
        r1b["Built-in\nAPI keys, JWT, IAM"]
        r1c["Custom middleware\n+ libraries"]
    end

    block:row2:3
        columns 3
        r2a["Rate Limiting"]
        r2b["Config-level\nper-key quotas"]
        r2c["Redis +\ncustom code"]
    end

    block:row3:3
        columns 3
        r3a["Caching"]
        r3b["Toggle per route\nTTL-based"]
        r3c["Redis/Memcached +\ninvalidation logic"]
    end

    block:row4:3
        columns 3
        r4a["Request Transform"]
        r4b["Mapping templates\nno code"]
        r4c["Custom middleware\nper framework"]
    end

    block:row5:3
        columns 3
        r5a["WAF / IP Filtering"]
        r5b["AWS WAF\n1-click integration"]
        r5c["ModSecurity /\nseparate WAF"]
    end

    block:row6:3
        columns 3
        r6a["Observability"]
        r6b["CloudWatch\nlogs + metrics free"]
        r6c["Prometheus + Grafana\nstack to manage"]
    end

    block:row7:3
        columns 3
        r7a["Monthly Base Cost"]
        r7b["~$0 at low traffic\nfree-tier eligible"]
        r7c["~$220+/mo minimum\nEKS + 2 nodes"]
    end

    block:row8:3
        columns 3
        r8a["Scale-to-Zero"]
        r8b["Yes\nno cost when idle"]
        r8c["No\nnodes run 24/7"]
    end

    block:row9:3
        columns 3
        r9a["Deploy Time"]
        r9b["~5 min\nterragrunt apply"]
        r9c["~30-45 min\nEKS + Helm"]
    end

    block:row10:3
        columns 3
        r10a["Ops Burden"]
        r10b["Zero\nfully managed"]
        r10c["High\ncluster upgrades, patching"]
    end

    block:row11:3
        columns 3
        r11a["High Availability"]
        r11b["Built-in\nmulti-AZ by default"]
        r11c["Manual\nnode groups + PDBs"]
    end

    block:row12:3
        columns 3
        r12a["Cold Starts"]
        r12b["~200 ms\nmitigated by Provisioned"]
        r12c["None\npods always running"]
    end

    style header fill:#37474F,color:#fff
    style h1 fill:#37474F,color:#fff
    style h2 fill:#2E7D32,color:#fff
    style h3 fill:#C62828,color:#fff
    style r1b fill:#E8F5E9
    style r1c fill:#FFEBEE
    style r2b fill:#E8F5E9
    style r2c fill:#FFEBEE
    style r3b fill:#E8F5E9
    style r3c fill:#FFEBEE
    style r4b fill:#E8F5E9
    style r4c fill:#FFEBEE
    style r5b fill:#E8F5E9
    style r5c fill:#FFEBEE
    style r6b fill:#E8F5E9
    style r6c fill:#FFEBEE
    style r7b fill:#E8F5E9
    style r7c fill:#FFEBEE
    style r8b fill:#E8F5E9
    style r8c fill:#FFEBEE
    style r9b fill:#E8F5E9
    style r9c fill:#FFEBEE
    style r10b fill:#E8F5E9
    style r10c fill:#FFEBEE
    style r11b fill:#E8F5E9
    style r11c fill:#FFEBEE
    style r12b fill:#FFF9C4
    style r12c fill:#FFF9C4
```

### When Kubernetes *Would* Make Sense

| Scenario | Why K8s fits |
|----------|-------------|
| Sustained high throughput (>1 M req/day) | Lambda costs may exceed always-on compute |
| Long-running connections (WebSockets, gRPC streams) | Lambda 15-min timeout is a hard limit |
| GPU / ML inference workloads | Lambda has no GPU support |
| Complex service mesh (50+ microservices) | K8s service discovery + Istio shines |
| Strict latency SLA (<10 ms p99) | Cold starts are unacceptable |

### Why Serverless Wins for This Dashboard

1. **Low, bursty traffic** — data pushed a few times per day, dashboard queried intermittently
2. **Zero ops team** — no dedicated SRE to manage cluster upgrades and node patching
3. **Cost efficiency** — free-tier eligible at current scale vs $220+/mo minimum for EKS
4. **Fast iteration** — deploy in 5 min, not 45; tear down and recreate in minutes
5. **Built-in resilience** — API Gateway and Lambda are multi-AZ by default
6. **Cross-cutting concerns for free** — auth, caching, throttling, WAF, and observability are config, not code

---

## Alternative: API Gateway → ALB → EKS Containers

When services already run on Kubernetes, a single API Gateway can front an
internal ALB that path-routes to different container-backed services. This
combines API management (auth, caching, WAF) with container-based workloads.

```mermaid
flowchart TB
    subgraph External["External Access"]
        BROWSER["Browser / Client"]
    end

    subgraph APIGW_LAYER["API Gateway (single)"]
        direction TB
        APIGW["API Gateway<br/>Auth · Caching · Throttling · WAF · CORS"]
        APIGW_ROUTES["Routes:<br/>ANY /v1/{proxy+}"]
    end

    subgraph VPC["VPC (Private)"]
        direction TB

        VPCLINK["VPC Link<br/>(private tunnel)"]

        subgraph ALB_LAYER["Internal ALB — Path-Based Routing"]
            direction TB
            ALB["Application Load Balancer<br/>(internal, private subnets)"]

            subgraph RULES["Listener Rules"]
                direction LR
                R1["/v1/deployments/*<br/>→ TG: deploy-svc"]
                R2["/v1/scorecards/*<br/>→ TG: scores-svc"]
                R3["/v1/clusters/*<br/>→ TG: platform-svc"]
                R4["/v1/tests/*<br/>→ TG: tests-svc"]
                R5["/v1/ingest/*<br/>→ TG: ingest-svc"]
            end
        end

        subgraph EKS["EKS Cluster"]
            direction TB

            subgraph SERVICES["Container Services"]
                direction LR
                SVC1["deploy-svc<br/>3 pods"]
                SVC2["scores-svc<br/>2 pods"]
                SVC3["platform-svc<br/>2 pods"]
                SVC4["tests-svc<br/>2 pods"]
                SVC5["ingest-svc<br/>2 pods"]
            end

            DASH["dashboard-frontend<br/>2 pods<br/>(serves UI)"]
        end

        subgraph DATA["Data Layer"]
            direction LR
            DDB["DynamoDB<br/>(VPC Endpoint)"]
            RDS["RDS Postgres<br/>(private subnets)"]
        end
    end

    %% Flow
    BROWSER -->|"HTTPS"| APIGW
    APIGW --> APIGW_ROUTES
    APIGW_ROUTES -->|"VPC Link"| VPCLINK
    VPCLINK --> ALB
    ALB --> R1 & R2 & R3 & R4 & R5
    R1 --> SVC1
    R2 --> SVC2
    R3 --> SVC3
    R4 --> SVC4
    R5 --> SVC5

    DASH -->|"private API call<br/>via VPC Endpoint"| APIGW

    SVC1 & SVC2 & SVC3 & SVC4 --> DDB
    SVC5 --> DDB
    SVC1 & SVC3 -.->|"optional"| RDS

    %% Styling
    classDef apigw fill:#FF9900,stroke:#232F3E,color:#232F3E,font-weight:bold
    classDef alb fill:#8C4FFF,stroke:#232F3E,color:white,font-weight:bold
    classDef eks fill:#D45B07,stroke:#232F3E,color:white,font-weight:bold
    classDef data fill:#4053D6,stroke:#232F3E,color:white,font-weight:bold
    classDef rule fill:#607D8B,stroke:#37474F,color:white,font-weight:bold
    classDef client fill:#2196F3,stroke:#0D47A1,color:white,font-weight:bold
    classDef link fill:#E91E63,stroke:#880E4F,color:white,font-weight:bold

    class BROWSER client
    class APIGW,APIGW_ROUTES apigw
    class ALB alb
    class R1,R2,R3,R4,R5 rule
    class SVC1,SVC2,SVC3,SVC4,SVC5,DASH eks
    class DDB,RDS data
    class VPCLINK link
```

### How the Pieces Connect

| Component | Role |
|-----------|------|
| **API Gateway** | Single entry point — handles auth, caching, throttling, WAF, CORS, logging |
| **VPC Link** | Private tunnel from API GW into VPC — no public exposure |
| **ALB (internal)** | Path-based routing to target groups — lives in private subnets |
| **Target Groups** | Each maps to a K8s Service (IP mode via AWS LB Controller) |
| **EKS Services** | Each service runs N pods — independently scalable with HPA |
| **Dashboard Pod** | Calls the API privately via VPC Endpoint — never leaves VPC |

### When to Use This Pattern

- You **already have EKS** and want API management without rewriting as Lambdas
- Services need **long-running processes**, persistent connections, or complex runtimes
- You need **independent scaling** per service (HPA per deployment)
- Teams own separate services and deploy **independently via Helm**

### Request Flow

```
┌─────────────────────────────────────────┐
│          API Gateway (one)               │
│  Auth, Caching, Throttling, WAF          │
│                                          │
│  /v1/deployments/*  ──┐                  │
│  /v1/scorecards/*   ──┤                  │
│  /v1/clusters/*     ──┤── ALL routes     │
│  /v1/tests/*        ──┤   forward to     │
│  /v1/ingest/*       ──┘   VPC Link       │
└──────────┬───────────────────────────────┘
           │
      VPC Link
           │
┌──────────▼───────────────────────────────┐
│              VPC                          │
│                                          │
│  ┌─────────────────────────────────┐     │
│  │     ALB (internal, private)      │     │
│  │                                  │     │
│  │  Path Rules:                     │     │
│  │  /v1/deployments/* → TG-deploy   │     │
│  │  /v1/scorecards/*  → TG-scores   │     │
│  │  /v1/clusters/*    → TG-platform │     │
│  │  /v1/tests/*       → TG-tests    │     │
│  │  /v1/ingest/*      → TG-ingest   │     │
│  │  /*                → TG-default   │     │
│  └──┬────┬────┬────┬────┬───────────┘     │
│     │    │    │    │    │                 │
│     ▼    ▼    ▼    ▼    ▼                 │
│  ┌─────────────────────────────────┐     │
│  │         EKS Cluster              │     │
│  │                                  │     │
│  │  ┌──────────┐  ┌──────────┐     │     │
│  │  │ deploy   │  │ scores   │     │     │
│  │  │ service  │  │ service  │     │     │
│  │  │ (3 pods) │  │ (2 pods) │     │     │
│  │  └──────────┘  └──────────┘     │     │
│  │                                  │     │
│  │  ┌──────────┐  ┌──────────┐     │     │
│  │  │ platform │  │ tests    │     │     │
│  │  │ service  │  │ service  │     │     │
│  │  │ (2 pods) │  │ (2 pods) │     │     │
│  │  └──────────┘  └──────────┘     │     │
│  │                                  │     │
│  │  ┌──────────┐  ┌──────────┐     │     │
│  │  │ ingest   │  │ dashboard│     │     │
│  │  │ service  │  │ frontend │     │     │
│  │  │ (2 pods) │  │ (2 pods) │     │     │
│  │  └──────────┘  └──────────┘     │     │
│  └─────────────────────────────────┘     │
│                                          │
│  ┌──────────┐  ┌──────────┐              │
│  │ DynamoDB │  │ RDS      │              │
│  │ (VPC EP) │  │ Postgres │              │
│  └──────────┘  └──────────┘              │
│                                          │
└──────────────────────────────────────────┘
```
