import json
import boto3
import os

# Create DynamoDB resource and connect to FILE table
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ.get('TABLE_NAME', 'FILE'))

def lambda_handler(event, context):
    print("Event received:", json.dumps(event))

    # Read query parameters. Return 400 if empty.
    query_params = event.get('queryStringParameters') or {}
    if not query_params:
        return response(400, "Missing query parameters")

    # Parse multiple tag queries like turl1=xxxx&turl2=xxxxx
    turl_required = []
    i = 1
    while True:
        thumbnail_url_key = f"turl{i}"
        thumbnail_url = query_params.get(thumbnail_url_key)
        

        if not thumbnail_url:
            break  # stop if no more tagN is provided

        # Default all species count to 1
        turl_required.append(thumbnail_url.lower())
        i += 1

    if not turl_required:
        return response(400, "At least one thumbnail url is required")

    try:
        scan_result = table.scan()
        items = scan_result.get("Items", [])
        print(f"Scanned {len(items)} items.")

        matched_links = []

        for item in items:
            item_thumb_url = item.get("thumb_url", "").lower()

            matched = any(
                t_url == item_thumb_url
                for t_url in turl_required
            )

            if matched:
                file_type = item.get("file_type", "").lower()
                if file_type == "image":
                    matched_links.append(item.get("file_url"))
                else:
                    print(f"Skipping unsupported file_type: {file_type}")


        return {
            "statusCode": 200,
            "body": json.dumps({ "links": matched_links })
        }

    except Exception as e:
        print("Unexpected error:", str(e))
        return response(500, "Internal server error")


def response(code, msg):
    return {
        "statusCode": code,
        "body": json.dumps({ "message": msg })
    }
