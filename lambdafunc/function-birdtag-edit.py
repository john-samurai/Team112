import json
import boto3
import os
from datetime import datetime

# Connect to DynamoDB table
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ.get('TABLE_NAME', 'FILE'))

def lambda_handler(event, context):
    print("Event received:", json.dumps(event))

    try:
        body = json.loads(event.get("body", "{}"))
    except Exception as e:
        return response(400, f"Invalid JSON: {str(e)}")

    urls = body.get("url")
    op = body.get("operation")
    tags = body.get("tags")

    if not urls or not tags or op not in [0, 1]:
        return response(400, "Missing or invalid url/operation/tags")

    # Parse tags into structured format
    normalized = []
    for t in tags:
        try:
            species, count = t.split(",")
            normalized.append({
                "species": species.strip().lower(),
                "count": int(count.strip())
            })
        except:
            return response(400, f"Invalid tag format: {t}")

    try:
        scan_result = table.scan()
        items = scan_result.get("Items", [])
        print(f"Scanned {len(items)} items.")

        updated = 0

        for item in items:
            if item.get("thumb_url", "").lower() in [u.lower() for u in urls] or item.get("file_url", "").lower() in [u.lower() for u in urls]:
                item_tags = item.get("tags", [])
                if not isinstance(item_tags, list):
                    continue

                original_tags = item_tags.copy()

                if op == 1:  # Add
                    for new_tag in normalized:
                        exists = False
                        for t in item_tags:
                            if isinstance(t, dict) and t.get("species") == new_tag["species"]:
                                t["count"] = new_tag["count"]  # Replace count if exists
                                exists = True
        
                        if not exists:
                            item_tags.append(new_tag)
                else:  # Remove
                    new_tags = []
                    for t in item_tags:
                        match = next(
                            (x for x in normalized if x["species"] == t.get("species") and x["count"] == int(t.get("count", 0))),
                            None
                        )
                        if not match:
                            new_tags.append(t)
                    item_tags = new_tags

                # Only update if tags actually changed
                if item_tags != original_tags:
                    # Provide both partition key and sort key
                    table.update_item(
                        Key={
                            "user_id": item.get("user_id"),
                            "id": item.get("id")
                        },
                        UpdateExpression="SET tags = :tags, #ts = :ts",
                        ExpressionAttributeNames={
                            "#ts": "timestamp"
                        },
                        ExpressionAttributeValues={
                            ":tags": item_tags,
                            ":ts": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                            }
                    )
                    updated += 1

        return {
            "statusCode": 200,
            "body": json.dumps({"message": f"{updated} item(s) updated"})
        }

    except Exception as e:
        print("Unexpected error:", str(e))
        return response(500, "Internal server error")

def response(code, msg):
    return {
        "statusCode": code,
        "body": json.dumps({"message": msg})
    }
