"""
Activity Aggregator Lambda
Triggered by DynamoDB Streams to update user activity stats (comment count, last active).
"""
import os
import boto3
from datetime import datetime

dynamodb = boto3.resource('dynamodb')

USER_PROFILES_TABLE = os.environ.get('USER_PROFILES_TABLE')


def lambda_handler(event, context):
    """
    Process DynamoDB Stream events and update user activity stats.
    """
    print(f"Processing {len(event['Records'])} records")

    for record in event['Records']:
        try:
            if record['eventName'] == 'INSERT':
                process_insert_event(record)
        except Exception as e:
            print(f"Error processing record: {e}")
            # Continue processing other records

    return {'statusCode': 200, 'body': 'Activity stats updated'}


def process_insert_event(record):
    """
    Process INSERT events from Comments, Messages, or Reactions tables.
    """
    table_name = record['eventSourceARN'].split(':table/')[1].split('/')[0]
    new_image = record['dynamodb']['NewImage']

    if 'comment' in table_name.lower() and 'reaction' not in table_name.lower():
        # New comment created
        user_id = new_image['userId']['S']
        increment_comment_count(user_id)
        update_last_active(user_id)
    elif 'message' in table_name.lower():
        # New message sent
        sender_id = new_image.get('senderId', {}).get('S')
        if sender_id:
            update_last_active(sender_id)
    elif 'reaction' in table_name.lower():
        # New reaction added
        user_id = new_image['userId']['S']
        update_last_active(user_id)


def increment_comment_count(user_id):
    """
    Atomically increment commentCount for a user.
    """
    try:
        table = dynamodb.Table(USER_PROFILES_TABLE)
        table.update_item(
            Key={'userId': user_id},
            UpdateExpression='ADD commentCount :inc',
            ExpressionAttributeValues={':inc': 1}
        )
        print(f"Incremented commentCount for user {user_id}")
    except Exception as e:
        print(f"Error incrementing comment count for {user_id}: {e}")


def update_last_active(user_id):
    """
    Update lastActive timestamp for a user.
    """
    try:
        table = dynamodb.Table(USER_PROFILES_TABLE)
        table.update_item(
            Key={'userId': user_id},
            UpdateExpression='SET lastActive = :now',
            ExpressionAttributeValues={':now': datetime.utcnow().isoformat() + 'Z'}
        )
        print(f"Updated lastActive for user {user_id}")
    except Exception as e:
        print(f"Error updating lastActive for {user_id}: {e}")
