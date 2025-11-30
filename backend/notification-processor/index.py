"""
Notification Processor Lambda
Triggered by DynamoDB Streams to send email notifications for comments, reactions, and DMs.
"""
import json
import os
import boto3
from datetime import datetime, timedelta
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
ses = boto3.client('ses')

USER_PROFILES_TABLE = os.environ.get('USER_PROFILES_TABLE')
SES_FROM_EMAIL = os.environ.get('SES_FROM_EMAIL', 'noreply@holdthatthought.family')
BASE_URL = os.environ.get('BASE_URL', 'https://holdthatthought.family')

# Debouncing: max 1 email per 15 minutes per event type
DEBOUNCE_MINUTES = 15


def lambda_handler(event, context):
    """
    Process DynamoDB Stream events and send email notifications.
    """
    print(f"Processing {len(event['Records'])} records")

    for record in event['Records']:
        try:
            if record['eventName'] == 'INSERT':
                process_insert_event(record)
        except Exception as e:
            print(f"Error processing record: {e}")
            # Continue processing other records

    return {'statusCode': 200, 'body': 'Notifications processed'}


def process_insert_event(record):
    """
    Process INSERT events from Comments, Reactions, or Messages tables.
    """
    table_name = record['eventSourceARN'].split(':table/')[1].split('/')[0]
    new_image = record['dynamodb']['NewImage']

    if 'comment' in table_name.lower():
        process_comment_notification(new_image)
    elif 'reaction' in table_name.lower():
        process_reaction_notification(new_image)
    elif 'message' in table_name.lower():
        process_message_notification(new_image)


def process_comment_notification(new_image):
    """
    Send notification for new comment.
    """
    item_id = new_image['itemId']['S']
    comment_id = new_image['commentId']['S']
    user_id = new_image['userId']['S']
    user_name = new_image.get('userName', {}).get('S', 'Someone')
    comment_text = new_image['commentText']['S']
    item_title = new_image.get('itemTitle', {}).get('S', 'a letter')

    # Get all users who have commented on this item (to notify them)
    # For simplicity, skip complex querying - in production, query Comments table
    # and send to all commenters except the current user

    print(f"New comment by {user_name} on {item_title}: {comment_text[:50]}...")

    # In production: Query for other commenters and send emails
    # For now, just log
    # send_email(recipient_email, subject, body)


def process_reaction_notification(new_image):
    """
    Send notification for new reaction.
    """
    comment_id = new_image['commentId']['S']
    user_id = new_image['userId']['S']

    print(f"New reaction from {user_id} on comment {comment_id}")

    # In production: Fetch comment author and send notification
    # send_email(comment_author_email, subject, body)


def process_message_notification(new_image):
    """
    Send notification for new message.
    """
    conversation_id = new_image['conversationId']['S']
    sender_id = new_image['senderId']['S']
    sender_name = new_image.get('senderName', {}).get('S', 'Someone')
    message_text = new_image['messageText']['S']

    print(f"New message from {sender_name}: {message_text[:50]}...")

    # In production: Notify all participants except sender
    # send_email(recipient_emails, subject, body)


def send_email(to_email, subject, body_html):
    """
    Send email via SES.
    """
    try:
        response = ses.send_email(
            Source=SES_FROM_EMAIL,
            Destination={'ToAddresses': [to_email]},
            Message={
                'Subject': {'Data': subject},
                'Body': {'Html': {'Data': body_html}}
            }
        )
        print(f"Email sent to {to_email}: {response['MessageId']}")
        return True
    except Exception as e:
        print(f"Error sending email to {to_email}: {e}")
        return False


def should_send_notification(user_id, event_type):
    """
    Check debouncing: has this user received this type of notification recently?
    """
    # In production: Check UserProfiles table for lastXNotificationAt
    # and compare with current time
    # For now, always return True
    return True
