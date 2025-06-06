import boto3
import os
import io
import uuid
from PIL import Image
from datetime import datetime

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['DYNAMODB_TABLE'])

THUMBNAIL_SIZE = (128, 128)

def lambda_handler(event, context):
    for record in event['Records']:
        bucket = record['s3']['bucket']['name']
        key = record['s3']['object']['key']
        
        # Ignore non-image files
        if not key.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp')):
            print(f"Skipped non-image file: {key}")
            continue

        # Ignore thumbnail files
        if 'thumb' in key.lower():
            print(f"Skipped thumbnail file: {key}")
            continue

        try:
            # Download image
            response = s3.get_object(Bucket=bucket, Key=key)
            img_data = response['Body'].read()

            # Create thumbnail
            image = Image.open(io.BytesIO(img_data))
            image.thumbnail(THUMBNAIL_SIZE)
            
            # Save thumbnail to memory
            thumb_buffer = io.BytesIO()
            image_format = image.format if image.format else "JPEG"
            image.save(thumb_buffer, format=image_format)
            thumb_buffer.seek(0)

            # Prepare thumbnail path
            user_id = 'temp-user-123'       # temporary hardcoded
            filename = os.path.basename(key)
            thumb_key = f"{user_id}/thumb_{filename}"

            # Upload thumbnail to S3
            s3.put_object(
                Bucket=bucket,
                Key=thumb_key,
                Body=thumb_buffer,
                ContentType=f"image/{image_format.lower()}"
            )

            # Generate public URL (assumes bucket allows access or is using presigned URLs)
            thumbnail_url = f"https://{bucket}.s3.amazonaws.com/{thumb_key}"

            # Write metadata to DynamoDB
            # item = {
            #     'id': str(uuid.uuid4()),
            #     'user_id': str(uuid.uuid4()),
            #     'file_url': key,
            #     'file_type' : 'image',
            #     'thumbnail_url': thumbnail_url,
            #     'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            # }
            # table.put_item(Item=item)
            print(f"Thumbnail created and saved: {thumbnail_url}")

        except Exception as e:
            print(f"Error processing {key}: {str(e)}")

    return {"statusCode": 200, "body": "Done"}
