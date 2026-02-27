###############################################################################
# DynamoDB Module — Single Table
###############################################################################

resource "aws_dynamodb_table" "this" {
  name             = var.table_name
  billing_mode     = var.billing_mode
  hash_key         = var.hash_key
  range_key        = var.range_key
  stream_enabled   = var.enable_global_table ? true : var.stream_enabled
  stream_view_type = var.enable_global_table ? "NEW_AND_OLD_IMAGES" : var.stream_view_type

  dynamic "attribute" {
    for_each = var.attributes
    content {
      name = attribute.value.name
      type = attribute.value.type
    }
  }

  dynamic "global_secondary_index" {
    for_each = var.global_secondary_indexes
    content {
      name            = global_secondary_index.value.name
      hash_key        = global_secondary_index.value.hash_key
      range_key       = lookup(global_secondary_index.value, "range_key", null)
      projection_type = lookup(global_secondary_index.value, "projection_type", "ALL")
    }
  }

  point_in_time_recovery {
    enabled = var.point_in_time_recovery
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = var.kms_key_arn
  }

  dynamic "replica" {
    for_each = var.enable_global_table ? var.replica_regions : []
    content {
      region_name            = replica.value
      point_in_time_recovery = var.point_in_time_recovery
    }
  }

  ttl {
    attribute_name = var.ttl_attribute
    enabled        = var.ttl_attribute != "" ? true : false
  }

  tags = merge(var.tags, {
    Module = "dynamodb"
  })

  lifecycle {
    prevent_destroy = false
  }
}
