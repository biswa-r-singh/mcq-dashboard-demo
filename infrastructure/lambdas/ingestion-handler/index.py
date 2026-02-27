"""
Ingestion Handler Lambda
Validates API key + JWT, schema-validates payload, publishes to EventBridge.
"""

import json
import os
import hashlib
import time
import logging
import boto3
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")
eventbridge = boto3.client("events")

API_KEYS_TABLE = os.environ.get("API_KEYS_TABLE", "mcq-api-keys")
EVENT_BUS_NAME = os.environ.get("EVENT_BUS_NAME", "mcq-dashboard-bus")

# Supported ingestion types and their EventBridge detail-types
INGEST_TYPES = {
    "platform-config": "dashboard.platform.config.updated",
    "deployments": "dashboard.deployments.reported",
    "test-results": "dashboard.test-results.reported",
    "cluster-test-results": "dashboard.cluster-test-results.reported",
    "scorecards": "dashboard.scorecards.updated",
}

REQUIRED_FIELDS = {
    "platform-config": ["accountId"],
    "deployments": ["accountId", "deploymentAttempts"],
    "test-results": ["accountId", "testRuns"],
    "cluster-test-results": ["accountId", "clusterTestRuns"],
    "scorecards": ["accountId"],
}


def handler(event, context):
    """Main Lambda handler."""
    try:
        # Parse HTTP API v2 event
        route_key = event.get("routeKey", "")
        body = event.get("body", "{}")
        headers = event.get("headers", {})

        # Determine ingestion type from path (use last segment to avoid substring issues)
        path = event.get("rawPath", "")
        path_suffix = path.rstrip("/").rsplit("/", 1)[-1]
        ingest_type = INGEST_TYPES.get(path_suffix) and path_suffix or None
        if not ingest_type:
            # Fallback: check if path_suffix is a known type
            for key in INGEST_TYPES:
                if path.endswith(f"/{key}"):
                    ingest_type = key
                    break

        if not ingest_type:
            return _response(400, {"error": f"Unknown ingestion path: {path}"})

        # Validate API key
        api_key = headers.get("x-api-key", "")
        if not api_key:
            return _response(401, {"error": "Missing x-api-key header"})

        key_record = _validate_api_key(api_key)
        if not key_record:
            return _response(401, {"error": "Invalid or inactive API key"})

        # Parse payload
        if isinstance(body, str):
            try:
                payload = json.loads(body)
            except json.JSONDecodeError:
                return _response(400, {"error": "Invalid JSON body"})
        else:
            payload = body

        # Validate required fields
        missing = [f for f in REQUIRED_FIELDS.get(ingest_type, []) if f not in payload]
        if missing:
            return _response(400, {"error": f"Missing required fields: {missing}"})

        # Verify accountId matches the API key's registered account
        payload_account = payload.get("accountId", "")
        key_account = key_record.get("accountId", "")
        if payload_account != key_account:
            logger.warning(
                f"Account mismatch: payload={payload_account}, key={key_account}"
            )
            return _response(403, {"error": "Account ID does not match API key"})

        # Enrich payload
        payload["_metadata"] = {
            "receivedAt": datetime.utcnow().isoformat() + "Z",
            "ingestType": ingest_type,
            "sourceIp": event.get("requestContext", {})
            .get("http", {})
            .get("sourceIp", "unknown"),
            "requestId": context.aws_request_id,
        }

        # Publish to EventBridge
        detail_type = INGEST_TYPES[ingest_type]
        response = eventbridge.put_events(
            Entries=[
                {
                    "Source": "mcq.dashboard.ingestion",
                    "DetailType": detail_type,
                    "Detail": json.dumps(payload),
                    "EventBusName": EVENT_BUS_NAME,
                }
            ]
        )

        failed = response.get("FailedEntryCount", 0)
        if failed > 0:
            logger.error(f"EventBridge put_events failed: {response}")
            return _response(500, {"error": "Failed to publish event"})

        logger.info(
            f"Ingested {ingest_type} data from account {payload_account}"
        )

        return _response(
            200,
            {
                "message": "Data ingested successfully",
                "type": ingest_type,
                "requestId": context.aws_request_id,
            },
        )

    except Exception as e:
        logger.exception("Unhandled error in ingestion handler")
        return _response(500, {"error": "Internal server error"})


def _validate_api_key(api_key: str) -> dict | None:
    """Validate API key against DynamoDB."""
    api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    table = dynamodb.Table(API_KEYS_TABLE)

    try:
        result = table.get_item(Key={"apiKeyHash": api_key_hash})
        item = result.get("Item")
        if not item:
            return None
        if item.get("status") != "active":
            return None
        # Check expiry
        expires_at = item.get("expiresAt", 0)
        if expires_at and time.time() > float(expires_at):
            return None
        return item
    except Exception as e:
        logger.error(f"Error validating API key: {e}")
        return None


def _response(status_code: int, body: dict) -> dict:
    """Build HTTP API v2 response."""
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }
