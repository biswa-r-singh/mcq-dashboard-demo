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
    Sources -->|"curl / Melody SDK<br/>API Key Auth"| WAF_IN
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
