import boto3
import json
import os

dynamodb = boto3.client('dynamodb')
cognito = boto3.client('cognito-idp')
ses = boto3.client('ses')

TABLE_NAME = os.environ['TABLE_NAME']         # e.g., 'FILE'
USER_POOL_ID = os.environ['USER_POOL_ID']
SENDER_EMAIL = os.environ['SENDER_EMAIL']

def extract_species_dict(image):
    tags = image.get('tags', {}).get('L', [])
    species_dict = {}
    for tag in tags:
        species = tag['M']['species']['S']
        count = int(tag['M']['count']['N'])
        species_dict[species] = count
    return species_dict

def get_user_email(user_id):
    try:
        response = cognito.admin_get_user(
            UserPoolId=USER_POOL_ID,
            Username=user_id
        )
        for attr in response['UserAttributes']:
            if attr['Name'] == 'email':
                return attr['Value']
    except Exception as e:
        print(f"Error fetching email for {user_id}: {e}")
    return None

def send_email(recipient, species_list, file_url):
    subject = "New Bird Species Uploaded!"
    species_str = ", ".join(species_list)
    body = f"New upload contains bird(s) you're interested in: {species_str}.\n Please login to Monash Bird Buddies to check it out.\n\nRegards,\nYour Bird Buddy"

    try:
        ses.send_email(
            Source=SENDER_EMAIL,
            Destination={'ToAddresses': [recipient]},
            Message={
                'Subject': {'Data': subject},
                'Body': {'Text': {'Data': body}}
            }
        )
        print(f"Sent to {recipient}")
    except Exception as e:
        print(f"Error sending to {recipient}: {e}")

def get_matching_users(target_species, uploader_id):
    matching_user_ids = set()

    paginator = dynamodb.get_paginator('scan')
    for page in paginator.paginate(TableName=TABLE_NAME):
        for item in page['Items']:
            user_id = item['user_id']['S']
            if user_id == uploader_id:
                continue  # skip uploader

            tags = item.get('tags', {}).get('L', [])
            for tag in tags:
                species = tag['M']['species']['S']
                if species in target_species:
                    matching_user_ids.add(user_id)
                    break  # one match is enough per user

    return matching_user_ids

def get_user_species(user_id):
    species_set = set()

    paginator = dynamodb.get_paginator('scan')
    for page in paginator.paginate(
        TableName=TABLE_NAME,
        FilterExpression="#uid = :uid",
        ExpressionAttributeNames={"#uid": "user_id"},
        ExpressionAttributeValues={":uid": {"S": user_id}}
    ):
        for item in page.get('Items', []):
            tags = item.get('tags', {}).get('L', [])
            for tag in tags:
                species = tag.get('M', {}).get('species', {}).get('S')
                if species:
                    species_set.add(species)

    return species_set


def lambda_handler(event, context):
    for record in event['Records']:
        event_name = record['eventName']
        new_image = record['dynamodb'].get('NewImage', {})
        old_image = record['dynamodb'].get('OldImage', {})

        uploader_id = new_image.get('user_id', {}).get('S')
        file_url = new_image.get('file_url', {}).get('S', '')

        if not uploader_id:
            print("Missing uploader ID")
            continue

        # Get new species for INSERT or MODIFY
        new_species_dict = extract_species_dict(new_image)
        new_species_set = set(new_species_dict.keys())

        if event_name == 'INSERT':
            added_species = new_species_set

        elif event_name == 'MODIFY':
            old_species_dict = extract_species_dict(old_image)
            old_species_set = set(old_species_dict.keys())
            added_species = new_species_set - old_species_set

            if not added_species:
                print("MODIFY: no new species added. Skipping.")
                continue

        else:
            continue  # skip REMOVE or unknown

        # Lookup users interested in these species (excluding uploader)
        interested_user_ids = get_matching_users(added_species, uploader_id)

        for uid in interested_user_ids:
            email = get_user_email(uid)
            if email:
                # Get the user's known species
                user_species = get_user_species(uid)
                matched_species = added_species & user_species
                if matched_species:
                    send_email(email, matched_species, file_url)
            else:
                print(f"No email found for user {uid}")


    return {'statusCode': 200, 'body': json.dumps('Processing complete')}
