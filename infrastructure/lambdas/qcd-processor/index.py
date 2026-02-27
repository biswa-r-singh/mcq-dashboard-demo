"""
QCD Processor Lambda
Processes Quality Center Dashboard events from EventBridge and writes to DynamoDB.
Handles: deployments, test-results, cluster-test-results, scorecards, platform-config
"""

import json
import os
import logging
from datetime import datetime
from decimal import Decimal

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")

PLATFORM_TABLE = os.environ.get("PLATFORM_TABLE", "mcq-platform")
DEPLOYMENTS_TABLE = os.environ.get("DEPLOYMENTS_TABLE", "mcq-deployments")
TEST_RESULTS_TABLE = os.environ.get("TEST_RESULTS_TABLE", "mcq-test-results")
SCORECARDS_TABLE = os.environ.get("SCORECARDS_TABLE", "mcq-scorecards")

# Map detail-type → handler function
HANDLERS = {}


def handles(detail_type):
    """Decorator to register a handler for a detail-type."""
    def decorator(fn):
        HANDLERS[detail_type] = fn
        return fn
    return decorator


def handler(event, context):
    """Main Lambda handler — dispatch based on EventBridge detail-type."""
    try:
        detail_type = event.get("detail-type", "")
        detail = event.get("detail", {})

        if isinstance(detail, str):
            detail = json.loads(detail)

        handler_fn = HANDLERS.get(detail_type)
        if not handler_fn:
            logger.warning(f"No handler for detail-type: {detail_type}")
            return {"statusCode": 400, "body": f"Unknown detail-type: {detail_type}"}

        logger.info(f"Processing {detail_type}")
        result = handler_fn(detail)
        logger.info(f"Completed {detail_type}: {result}")
        return {"statusCode": 200, "body": json.dumps(result)}

    except Exception as e:
        logger.exception(f"Error processing event: {e}")
        return {"statusCode": 500, "body": str(e)}


def _to_dynamo(obj):
    """Convert floats/ints for DynamoDB (Decimal)."""
    if isinstance(obj, dict):
        return {k: _to_dynamo(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_dynamo(i) for i in obj]
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, int) and not isinstance(obj, bool):
        return Decimal(str(obj))
    return obj


def _upsert_item(table, key: dict, attributes: dict):
    """
    Merge attributes into an existing item (or create it).
    Uses update_item so only the supplied fields are touched —
    fields not in `attributes` are left unchanged.
    """
    attrs = _to_dynamo(attributes)
    # Build SET expression dynamically
    expr_names = {}
    expr_values = {}
    set_parts = []
    for i, (k, v) in enumerate(attrs.items()):
        if k in key:
            continue  # skip key attributes
        alias = f"#a{i}"
        value_alias = f":v{i}"
        expr_names[alias] = k
        expr_values[value_alias] = v
        set_parts.append(f"{alias} = {value_alias}")

    if not set_parts:
        return

    table.update_item(
        Key=_to_dynamo(key),
        UpdateExpression="SET " + ", ".join(set_parts),
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
    )


# ── Platform Config ──────────────────────────────────────────

@handles("dashboard.platform.config.updated")
def handle_platform_config(detail):
    """
    Upsert clusters, clusterRegions, clusterRegionRoles, services,
    currentRunning, promotions, metadata into the platform table.
    Uses update_item so partial pushes merge with existing data
    (e.g. adding a new cluster without resending all existing ones).
    """
    table = dynamodb.Table(PLATFORM_TABLE)
    counts = {}

    # Clusters
    for c in detail.get("clusters", []):
        _upsert_item(table,
                      key={"pk": f"CLUSTER#{c['id']}", "sk": "META"},
                      attributes={"itemType": "CLUSTER", **c})
    counts["clusters"] = len(detail.get("clusters", []))

    # Cluster regions
    for cr in detail.get("clusterRegions", []):
        _upsert_item(table,
                      key={"pk": f"REGION#{cr['id']}", "sk": "META"},
                      attributes={"itemType": "CLUSTER_REGION", **cr})
    counts["clusterRegions"] = len(detail.get("clusterRegions", []))

    # Cluster region roles
    roles = detail.get("clusterRegionRoles", {})
    if roles:
        _upsert_item(table,
                      key={"pk": "CONFIG#clusterRegionRoles", "sk": "META"},
                      attributes={"itemType": "CONFIG", "roles": roles})
        counts["clusterRegionRoles"] = len(roles)

    # Services
    for s in detail.get("services", []):
        _upsert_item(table,
                      key={"pk": f"SERVICE#{s['id']}", "sk": "META"},
                      attributes={"itemType": "SERVICE", **s})
    counts["services"] = len(detail.get("services", []))

    # Current running versions
    current = detail.get("currentRunning", {})
    for cluster_region_id, svc_versions in current.items():
        _upsert_item(table,
                      key={"pk": f"RUNNING#{cluster_region_id}", "sk": "META"},
                      attributes={"itemType": "RUNNING",
                                  "clusterRegionId": cluster_region_id,
                                  "versions": svc_versions})
    counts["currentRunning"] = len(current)

    # Promotions
    for p in detail.get("promotions", []):
        _upsert_item(table,
                      key={"pk": f"PROMOTION#{p['id']}", "sk": "META"},
                      attributes={"itemType": "PROMOTION", **p})
    counts["promotions"] = len(detail.get("promotions", []))

    # Suite metadata
    suite_meta = detail.get("suiteMeta", {})
    if suite_meta:
        _upsert_item(table,
                      key={"pk": "CONFIG#suiteMeta", "sk": "META"},
                      attributes={"itemType": "CONFIG", "data": suite_meta})
        counts["suiteMeta"] = len(suite_meta)

    # Status metadata
    status_meta = detail.get("statusMeta", {})
    if status_meta:
        _upsert_item(table,
                      key={"pk": "CONFIG#statusMeta", "sk": "META"},
                      attributes={"itemType": "CONFIG", "data": status_meta})
        counts["statusMeta"] = len(status_meta)

    return {"processed": counts}


# ── Deployments ──────────────────────────────────────────────

@handles("dashboard.deployments.reported")
def handle_deployments(detail):
    """
    Write deployment attempts into the deployments table.
    pk: <clusterId>#<serviceId>   sk: <startedAt>#<attemptId>
    """
    table = dynamodb.Table(DEPLOYMENTS_TABLE)
    attempts = detail.get("deploymentAttempts", [])

    with table.batch_writer() as batch:
        for a in attempts:
            item = _to_dynamo({
                "pk": f"{a['clusterId']}#{a['serviceId']}",
                "sk": f"{a['startedAt']}#{a['id']}",
                "clusterId": a["clusterId"],
                "serviceId": a["serviceId"],
                **{k: v for k, v in a.items() if v is not None},
            })
            batch.put_item(Item=item)

    return {"deployments_written": len(attempts)}


# ── Test Results (per-attempt) ───────────────────────────────

@handles("dashboard.test-results.reported")
def handle_test_results(detail):
    """
    Write test runs into the test-results table.
    pk: ATTEMPT#<attemptId>   sk: <suiteType>#<executedAt>
    """
    table = dynamodb.Table(TEST_RESULTS_TABLE)
    runs = detail.get("testRuns", [])

    with table.batch_writer() as batch:
        for r in runs:
            item = _to_dynamo({
                "pk": f"ATTEMPT#{r['attemptId']}",
                "sk": f"{r['suiteType']}#{r['executedAt']}",
                "suiteType": r["suiteType"],
                **{k: v for k, v in r.items() if v is not None},
            })
            batch.put_item(Item=item)

    return {"test_runs_written": len(runs)}


# ── Cluster Test Results ─────────────────────────────────────

@handles("dashboard.cluster-test-results.reported")
def handle_cluster_test_results(detail):
    """
    Write cluster-level test runs into the test-results table.
    pk: CLUSTER#<clusterId>   sk: <suiteType>#<executedAt>
    """
    table = dynamodb.Table(TEST_RESULTS_TABLE)
    runs = detail.get("clusterTestRuns", [])

    with table.batch_writer() as batch:
        for r in runs:
            item = _to_dynamo({
                "pk": f"CLUSTER#{r['clusterId']}",
                "sk": f"{r['suiteType']}#{r['executedAt']}",
                "suiteType": r["suiteType"],
                **{k: v for k, v in r.items() if v is not None},
            })
            batch.put_item(Item=item)

    return {"cluster_test_runs_written": len(runs)}


# ── Scorecards ───────────────────────────────────────────────

@handles("dashboard.scorecards.updated")
def handle_scorecards(detail):
    """
    Write scorecard weights, per-service scores, and jira tickets
    into the scorecards table.
    """
    table = dynamodb.Table(SCORECARDS_TABLE)
    counts = {}

    # Weights
    weights = detail.get("scorecardWeights", {})
    if weights:
        table.put_item(Item=_to_dynamo({
            "pk": "WEIGHTS",
            "sk": "CURRENT",
            **weights,
        }))
        counts["weights"] = 1

    # Per-service scorecards
    scorecards = detail.get("scorecards", {})
    for svc_id, scores in scorecards.items():
        table.put_item(Item=_to_dynamo({
            "pk": f"SERVICE#{svc_id}",
            "sk": "CURRENT",
            "serviceId": svc_id,
            **scores,
        }))
    counts["scorecards"] = len(scorecards)

    # Jira tickets
    jira = detail.get("jiraTickets", {})
    jira_count = 0
    with table.batch_writer() as batch:
        for svc_id, tickets in jira.items():
            for ticket in tickets:
                batch.put_item(Item=_to_dynamo({
                    "pk": f"SERVICE#{svc_id}",
                    "sk": f"JIRA#{ticket['key']}",
                    "serviceId": svc_id,
                    **ticket,
                }))
                jira_count += 1
    counts["jiraTickets"] = jira_count

    return {"processed": counts}
