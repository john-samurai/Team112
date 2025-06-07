import boto3
import urllib.parse
from urllib.parse import urlparse
import os
import json

s3 = boto3.client('s3')
dynamodb = boto3.client('dynamodb')

def lambda_handler(event, context):
    try:
        # Parse the incoming request
        body = event.get('body', '{}')
        if isinstance(body, str):
            body = json.loads(body)
        print(body)
        # Check for 'links' in the request body 
        urls = body.get('links', [])
        
        if not urls:
            return {
                'statusCode': 400,
                'body': json.dumps({'message': 'No URLs provided in the request'})
            }
        
        bucket_name = 'mbb-112'
        dynamodb_table = os.environ['TABLE_NAME']
        
        results = {
            'success': [],
            'failures': []
        }
        
        for url in urls:
            try:
                # Process S3 deletion
                parsed_url = urlparse(url)
                s3_key = parsed_url.path.lstrip('/')
                
                # Debug print
                print(f"Processing URL: {url}")
                print(f"Extracted S3 key: {s3_key}")
                
                # Delete main file from S3
                s3.delete_object(Bucket=bucket_name, Key=s3_key)
                
                # If image, delete thumbnail
                if s3_key.lower().endswith(('.jpg', '.jpeg', '.png')):
                    dir_path = os.path.dirname(s3_key)
                    file_name = os.path.basename(s3_key)
                    thumb_key = os.path.join(dir_path, f'thumb_{file_name}')
                    try:
                        print(f"Attempting to delete thumbnail: {thumb_key}")
                        s3.delete_object(Bucket=bucket_name, Key=thumb_key)
                    except Exception as thumb_ex:
                        print(f"Error deleting thumbnail {thumb_key}: {str(thumb_ex)}")
                
                # DynamoDB deletion using Scan
                scan_response = dynamodb.scan(
                    TableName=dynamodb_table,
                    FilterExpression='file_url = :url OR thumb_url = :url',
                    ExpressionAttributeValues={
                        ':url': {'S': url}
                    }
                )
                
                print(f"Found {len(scan_response.get('Items', []))} matching DynamoDB records")
                
                # Delete all matching items
                for item in scan_response.get('Items', []):
                    try:
                        dynamodb.delete_item(
                            TableName=dynamodb_table,
                            Key={
                                'user_id': item['user_id'],
                                'id': item['id']
                            }
                        )
                        print(f"Deleted DynamoDB record: {item['id']}")
                    except Exception as e:
                        print(f"Error deleting DynamoDB item {item['id']}: {str(e)}")
                        raise
                
                results['success'].append(url)
                
            except Exception as e:
                print(f"Error processing URL {url}: {str(e)}")
                results['failures'].append({
                    'url': url,
                    'error': str(e)
                })
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Deletion process completed'
                # ,'results': results
            })
        }
        
    except Exception as e:
        print(f"Global error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Internal server error',
                'details': str(e)
            })
        }