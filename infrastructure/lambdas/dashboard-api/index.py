"""
Dashboard API Lambda
GET endpoints for the QCD frontend — reads from DynamoDB.

Routes:
  GET /v1/health
  GET /v1/qcd/clusters        → clusters, clusterRegions, clusterRegionRoles, currentRunning
  GET /v1/qcd/services        → services list
  GET /v1/qcd/deployments     → deployment attempts
  GET /v1/qcd/test-runs       → per-attempt test runs
  GET /v1/qcd/cluster-test-runs → cluster-level test runs
  GET /v1/qcd/scorecards      → weights + per-service scores
  GET /v1/qcd/promotions      → promotion records
  GET /v1/qcd/jira-tickets    → jira tickets per service
  GET /v1/qcd/metadata        → suiteMeta + statusMeta
"""

import json
import os
import logging
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key, Attr

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")

PLATFORM_TABLE = os.environ.get("PLATFORM_TABLE", "mcq-platform")
DEPLOYMENTS_TABLE = os.environ.get("DEPLOYMENTS_TABLE", "mcq-deployments")
TEST_RESULTS_TABLE = os.environ.get("TEST_RESULTS_TABLE", "mcq-test-results")
SCORECARDS_TABLE = os.environ.get("SCORECARDS_TABLE", "mcq-scorecards")


class DecimalEncoder(json.JSONEncoder):
    """Handle DynamoDB Decimal types."""

    def default(self, obj):
        if isinstance(obj, Decimal):
            if obj % 1 == 0:
                return int(obj)
            return float(obj)
        return super().default(obj)


def handler(event, context):
    """Main API handler — routes based on path."""
    try:
        path = event.get("rawPath", "")
        query = event.get("queryStringParameters") or {}

        # QCD routes
        if path == "/v1/health":
            return _response(200, {"status": "healthy", "service": "mcq-dashboard"})

        elif path == "/v1/qcd/clusters":
            return _qcd_clusters(query)

        elif path == "/v1/qcd/services":
            return _qcd_services(query)

        elif path == "/v1/qcd/deployments":
            return _qcd_deployments(query)

        elif path == "/v1/qcd/test-runs":
            return _qcd_test_runs(query)

        elif path == "/v1/qcd/cluster-test-runs":
            return _qcd_cluster_test_runs(query)

        elif path == "/v1/qcd/scorecards":
            return _qcd_scorecards(query)

        elif path == "/v1/qcd/promotions":
            return _qcd_promotions(query)

        elif path == "/v1/qcd/jira-tickets":
            return _qcd_jira_tickets(query)

        elif path == "/v1/qcd/metadata":
            return _qcd_metadata(query)

        else:
            return _response(404, {"error": f"Route not found: {path}"})

    except Exception as e:
        logger.exception("Unhandled error in dashboard API")
        return _response(500, {"error": "Internal server error"})


# ── QCD Routes ───────────────────────────────────────────────


def _scan_all(table, **kwargs):
    """Paginated scan that returns all items."""
    items = []
    response = table.scan(**kwargs)
    items.extend(response.get("Items", []))
    while "LastEvaluatedKey" in response:
        kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]
        response = table.scan(**kwargs)
        items.extend(response.get("Items", []))
    return items


def _query_all(table, **kwargs):
    """Paginated query that returns all items."""
    items = []
    response = table.query(**kwargs)
    items.extend(response.get("Items", []))
    while "LastEvaluatedKey" in response:
        kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]
        response = table.query(**kwargs)
        items.extend(response.get("Items", []))
    return items


def _strip_keys(item):
    """Remove DynamoDB pk/sk/itemType from response items."""
    return {k: v for k, v in item.items() if k not in ("pk", "sk", "itemType")}


def _qcd_clusters(query):
    """Return clusters, clusterRegions, clusterRegionRoles, currentRunning."""
    table = dynamodb.Table(PLATFORM_TABLE)

    # Use itemType-index GSI to fetch by type
    clusters = []
    for item in _query_all(
        table, IndexName="itemType-index",
        KeyConditionExpression=Key("itemType").eq("CLUSTER"),
    ):
        clusters.append(_strip_keys(item))

    cluster_regions = []
    for item in _query_all(
        table, IndexName="itemType-index",
        KeyConditionExpression=Key("itemType").eq("CLUSTER_REGION"),
    ):
        cluster_regions.append(_strip_keys(item))

    # Cluster region roles from config item
    roles_item = table.get_item(
        Key={"pk": "CONFIG#clusterRegionRoles", "sk": "META"}
    ).get("Item", {})
    cluster_region_roles = roles_item.get("roles", {})

    # Current running versions
    current_running = {}
    for item in _query_all(
        table, IndexName="itemType-index",
        KeyConditionExpression=Key("itemType").eq("RUNNING"),
    ):
        cr_id = item.get("clusterRegionId", "")
        current_running[cr_id] = item.get("versions", {})

    return _response(200, {
        "clusters": clusters,
        "clusterRegions": cluster_regions,
        "clusterRegionRoles": cluster_region_roles,
        "currentRunning": current_running,
    })


def _qcd_services(query):
    """Return services list."""
    table = dynamodb.Table(PLATFORM_TABLE)

    services = []
    for item in _query_all(
        table, IndexName="itemType-index",
        KeyConditionExpression=Key("itemType").eq("SERVICE"),
    ):
        services.append(_strip_keys(item))

    return _response(200, {"services": services})


def _qcd_deployments(query):
    """Return deployment attempts. Optional filters: clusterId, serviceId."""
    table = dynamodb.Table(DEPLOYMENTS_TABLE)
    cluster_id = query.get("clusterId")
    service_id = query.get("serviceId")

    if cluster_id and service_id:
        # Direct pk query
        pk = f"{cluster_id}#{service_id}"
        items = _query_all(
            table,
            KeyConditionExpression=Key("pk").eq(pk),
            ScanIndexForward=False,
        )
    elif cluster_id:
        items = _query_all(
            table, IndexName="clusterId-index",
            KeyConditionExpression=Key("clusterId").eq(cluster_id),
            ScanIndexForward=False,
        )
    elif service_id:
        items = _query_all(
            table, IndexName="serviceId-index",
            KeyConditionExpression=Key("serviceId").eq(service_id),
            ScanIndexForward=False,
        )
    else:
        items = _scan_all(table)

    attempts = [_strip_keys(i) for i in items]
    return _response(200, {"deploymentAttempts": attempts})


def _qcd_test_runs(query):
    """Return per-attempt test runs. Optional filter: attemptId, suiteType."""
    table = dynamodb.Table(TEST_RESULTS_TABLE)
    attempt_id = query.get("attemptId")
    suite_type = query.get("suiteType")

    if attempt_id:
        pk = f"ATTEMPT#{attempt_id}"
        if suite_type:
            items = _query_all(
                table,
                KeyConditionExpression=Key("pk").eq(pk) & Key("sk").begins_with(f"{suite_type}#"),
            )
        else:
            items = _query_all(
                table,
                KeyConditionExpression=Key("pk").eq(pk),
            )
    elif suite_type:
        items = _query_all(
            table, IndexName="suiteType-index",
            KeyConditionExpression=Key("suiteType").eq(suite_type),
        )
    else:
        # All test runs (ATTEMPT# prefix only)
        items = _scan_all(
            table,
            FilterExpression=Attr("pk").begins_with("ATTEMPT#"),
        )

    runs = [_strip_keys(i) for i in items]
    return _response(200, {"testRuns": runs})


def _qcd_cluster_test_runs(query):
    """Return cluster-level test runs. Optional filter: clusterId."""
    table = dynamodb.Table(TEST_RESULTS_TABLE)
    cluster_id = query.get("clusterId")

    if cluster_id:
        pk = f"CLUSTER#{cluster_id}"
        items = _query_all(
            table,
            KeyConditionExpression=Key("pk").eq(pk),
        )
    else:
        items = _scan_all(
            table,
            FilterExpression=Attr("pk").begins_with("CLUSTER#"),
        )

    runs = [_strip_keys(i) for i in items]
    return _response(200, {"clusterTestRuns": runs})


def _qcd_scorecards(query):
    """Return scorecard weights and per-service scores."""
    table = dynamodb.Table(SCORECARDS_TABLE)

    # Weights
    weights_item = table.get_item(
        Key={"pk": "WEIGHTS", "sk": "CURRENT"}
    ).get("Item", {})
    weights = {k: v for k, v in weights_item.items() if k not in ("pk", "sk")}

    # Per-service scorecards
    scorecards = {}
    items = _scan_all(
        table,
        FilterExpression=Attr("pk").begins_with("SERVICE#") & Attr("sk").eq("CURRENT"),
    )
    for item in items:
        svc_id = item.get("serviceId", item["pk"].replace("SERVICE#", ""))
        scorecards[svc_id] = {k: v for k, v in item.items()
                              if k not in ("pk", "sk", "serviceId")}

    return _response(200, {
        "scorecardWeights": weights,
        "scorecards": scorecards,
    })


def _qcd_promotions(query):
    """Return promotion records."""
    table = dynamodb.Table(PLATFORM_TABLE)

    items = _query_all(
        table, IndexName="itemType-index",
        KeyConditionExpression=Key("itemType").eq("PROMOTION"),
    )

    promotions = [_strip_keys(i) for i in items]
    return _response(200, {"promotions": promotions})


def _qcd_jira_tickets(query):
    """Return jira tickets grouped by service."""
    table = dynamodb.Table(SCORECARDS_TABLE)
    service_id = query.get("serviceId")

    if service_id:
        items = _query_all(
            table,
            KeyConditionExpression=Key("pk").eq(f"SERVICE#{service_id}")
                                   & Key("sk").begins_with("JIRA#"),
        )
    else:
        items = _scan_all(
            table,
            FilterExpression=Attr("sk").begins_with("JIRA#"),
        )

    # Group by service
    tickets = {}
    for item in items:
        svc = item.get("serviceId", item["pk"].replace("SERVICE#", ""))
        if svc not in tickets:
            tickets[svc] = []
        tickets[svc].append({k: v for k, v in item.items()
                             if k not in ("pk", "sk", "serviceId")})

    return _response(200, {"jiraTickets": tickets})


def _qcd_metadata(query):
    """Return suiteMeta and statusMeta."""
    table = dynamodb.Table(PLATFORM_TABLE)

    suite_item = table.get_item(
        Key={"pk": "CONFIG#suiteMeta", "sk": "META"}
    ).get("Item", {})

    status_item = table.get_item(
        Key={"pk": "CONFIG#statusMeta", "sk": "META"}
    ).get("Item", {})

    return _response(200, {
        "suiteMeta": suite_item.get("data", {}),
        "statusMeta": status_item.get("data", {}),
    })


# ── Helpers ──────────────────────────────────────────────────


def _response(status_code, body):
    """Build HTTP API v2 response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": json.dumps(body, cls=DecimalEncoder),
    }
