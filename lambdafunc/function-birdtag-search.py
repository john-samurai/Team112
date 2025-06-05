import json
import boto3
import os

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ.get('TABLE_NAME', 'FILE'))

def lambda_handler(event, context):
    print("Event received:", json.dumps(event))

    query_params = event.get('queryStringParameters') or {}
    if not query_params:
        return response(400, "Missing query parameters")

    # Parse multiple tag queries like tag1=crow&count1=3&tag2=pigeon&count2=2
    tags_required = {}
    i = 1
    while True:
        species_key = f"tag{i}"
        count_key = f"count{i}"
        species = query_params.get(species_key)
        count = query_params.get(count_key)

        if not species:
            break  # stop if no more tagN is provided

        if not count or not count.isdigit():
            return response(400, f"Missing or invalid count for {species_key}")

        tags_required[species.lower()] = int(count)
        i += 1

    if not tags_required:
        return response(400, "At least one tag with count is required")

    try:
        scan_result = table.scan()
        items = scan_result.get("Items", [])
        print(f"Scanned {len(items)} items.")

        matched_links = []

        for item in items:
            item_tags = item.get("tags", [])
            matched = True

            for req_species, req_count in tags_required.items():
                found = False
                for tag in item_tags:
                    # Tag format: {'species': 'crow', 'count': 4}
                    if (
                        isinstance(tag, dict)
                        and tag.get("species", "").lower() == req_species
                        and int(tag.get("count", 0)) >= req_count
                    ):
                        found = True
                        break
                if not found:
                    matched = False
                    break

            if matched:
                file_type = item.get("file_type", "").lower()
                if file_type == "image":
                    matched_links.append(item.get("thumb_url"))
                elif file_type == "video":
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
