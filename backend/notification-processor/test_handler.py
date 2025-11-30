"""
Unit tests for notification-processor Lambda function
"""
import json
import pytest
from moto import mock_aws
import boto3
from unittest.mock import patch, MagicMock
import os

# Set environment variables before importing handler
os.environ['USER_PROFILES_TABLE'] = 'test-user-profiles'
os.environ['SES_FROM_EMAIL'] = 'test@example.com'
os.environ['BASE_URL'] = 'https://test.com'

from index import lambda_handler, process_comment_notification, process_reaction_notification, process_message_notification


@pytest.fixture
def dynamodb_stream_event_comment():
    """Sample DynamoDB Stream event for comment insertion"""
    return {
        'Records': [
            {
                'eventID': '1',
                'eventName': 'INSERT',
                'eventVersion': '1.1',
                'eventSource': 'aws:dynamodb',
                'awsRegion': 'us-east-1',
                'dynamodb': {
                    'Keys': {
                        'itemId': {'S': '/2015/christmas'},
                        'commentId': {'S': '2025-01-15T10:00:00.000Z#abc'}
                    },
                    'NewImage': {
                        'itemId': {'S': '/2015/christmas'},
                        'commentId': {'S': '2025-01-15T10:00:00.000Z#abc'},
                        'userId': {'S': 'user-123'},
                        'userName': {'S': 'John Doe'},
                        'commentText': {'S': 'Great letter!'},
                        'itemTitle': {'S': 'Christmas Letter 2015'}
                    },
                    'SequenceNumber': '111',
                    'SizeBytes': 26,
                    'StreamViewType': 'NEW_AND_OLD_IMAGES'
                },
                'eventSourceARN': 'arn:aws:dynamodb:us-east-1:123456789012:table/hold-that-thought-comments/stream/2024-01-01T00:00:00.000'
            }
        ]
    }


@pytest.fixture
def dynamodb_stream_event_reaction():
    """Sample DynamoDB Stream event for reaction insertion"""
    return {
        'Records': [
            {
                'eventID': '2',
                'eventName': 'INSERT',
                'eventVersion': '1.1',
                'eventSource': 'aws:dynamodb',
                'awsRegion': 'us-east-1',
                'dynamodb': {
                    'Keys': {
                        'commentId': {'S': '2025-01-15T10:00:00.000Z#abc'},
                        'userId': {'S': 'user-456'}
                    },
                    'NewImage': {
                        'commentId': {'S': '2025-01-15T10:00:00.000Z#abc'},
                        'userId': {'S': 'user-456'},
                        'reactionType': {'S': 'like'},
                        'createdAt': {'S': '2025-01-15T11:00:00.000Z'}
                    },
                    'SequenceNumber': '222',
                    'SizeBytes': 26,
                    'StreamViewType': 'NEW_AND_OLD_IMAGES'
                },
                'eventSourceARN': 'arn:aws:dynamodb:us-east-1:123456789012:table/hold-that-thought-comment-reactions/stream/2024-01-01T00:00:00.000'
            }
        ]
    }


@pytest.fixture
def dynamodb_stream_event_message():
    """Sample DynamoDB Stream event for message insertion"""
    return {
        'Records': [
            {
                'eventID': '3',
                'eventName': 'INSERT',
                'eventVersion': '1.1',
                'eventSource': 'aws:dynamodb',
                'awsRegion': 'us-east-1',
                'dynamodb': {
                    'Keys': {
                        'conversationId': {'S': 'user-1#user-2'},
                        'messageId': {'S': '2025-01-15T10:00:00.000Z#xyz'}
                    },
                    'NewImage': {
                        'conversationId': {'S': 'user-1#user-2'},
                        'messageId': {'S': '2025-01-15T10:00:00.000Z#xyz'},
                        'senderId': {'S': 'user-1'},
                        'senderName': {'S': 'Alice'},
                        'messageText': {'S': 'Hello!'}
                    },
                    'SequenceNumber': '333',
                    'SizeBytes': 26,
                    'StreamViewType': 'NEW_AND_OLD_IMAGES'
                },
                'eventSourceARN': 'arn:aws:dynamodb:us-east-1:123456789012:table/hold-that-thought-messages/stream/2024-01-01T00:00:00.000'
            }
        ]
    }


def test_lambda_handler_processes_comment_event(dynamodb_stream_event_comment):
    """Test handler processes comment insertion events"""
    response = lambda_handler(dynamodb_stream_event_comment, {})

    assert response['statusCode'] == 200
    assert response['body'] == 'Notifications processed'


def test_lambda_handler_processes_reaction_event(dynamodb_stream_event_reaction):
    """Test handler processes reaction insertion events"""
    response = lambda_handler(dynamodb_stream_event_reaction, {})

    assert response['statusCode'] == 200
    assert response['body'] == 'Notifications processed'


def test_lambda_handler_processes_message_event(dynamodb_stream_event_message):
    """Test handler processes message insertion events"""
    response = lambda_handler(dynamodb_stream_event_message, {})

    assert response['statusCode'] == 200
    assert response['body'] == 'Notifications processed'


def test_lambda_handler_handles_multiple_records():
    """Test handler processes multiple records in a single event"""
    event = {
        'Records': [
            {
                'eventName': 'INSERT',
                'dynamodb': {
                    'NewImage': {
                        'itemId': {'S': '/2015/christmas'},
                        'commentId': {'S': '2025-01-15T10:00:00.000Z#abc'},
                        'userId': {'S': 'user-123'},
                        'userName': {'S': 'John'},
                        'commentText': {'S': 'Great!'},
                        'itemTitle': {'S': 'Christmas'}
                    }
                },
                'eventSourceARN': 'arn:aws:dynamodb:us-east-1:123456789012:table/hold-that-thought-comments/stream/2024-01-01T00:00:00.000'
            },
            {
                'eventName': 'INSERT',
                'dynamodb': {
                    'NewImage': {
                        'commentId': {'S': '2025-01-15T10:00:00.000Z#abc'},
                        'userId': {'S': 'user-456'},
                        'reactionType': {'S': 'like'}
                    }
                },
                'eventSourceARN': 'arn:aws:dynamodb:us-east-1:123456789012:table/hold-that-thought-comment-reactions/stream/2024-01-01T00:00:00.000'
            }
        ]
    }

    response = lambda_handler(event, {})

    assert response['statusCode'] == 200
    assert response['body'] == 'Notifications processed'


def test_lambda_handler_skips_non_insert_events():
    """Test handler skips MODIFY and REMOVE events"""
    event = {
        'Records': [
            {
                'eventName': 'MODIFY',
                'dynamodb': {
                    'NewImage': {
                        'itemId': {'S': '/2015/christmas'}
                    }
                },
                'eventSourceARN': 'arn:aws:dynamodb:us-east-1:123456789012:table/hold-that-thought-comments/stream/2024-01-01T00:00:00.000'
            },
            {
                'eventName': 'REMOVE',
                'dynamodb': {
                    'Keys': {
                        'itemId': {'S': '/2015/christmas'}
                    }
                },
                'eventSourceARN': 'arn:aws:dynamodb:us-east-1:123456789012:table/hold-that-thought-comments/stream/2024-01-01T00:00:00.000'
            }
        ]
    }

    response = lambda_handler(event, {})

    # Should still succeed but skip processing
    assert response['statusCode'] == 200


def test_lambda_handler_continues_on_error():
    """Test handler continues processing even if one record fails"""
    event = {
        'Records': [
            {
                'eventName': 'INSERT',
                'dynamodb': {
                    'NewImage': {
                        'itemId': {'S': '/2015/christmas'}
                    }
                },
                'eventSourceARN': 'arn:aws:dynamodb:us-east-1:123456789012:table/hold-that-thought-comments/stream/2024-01-01T00:00:00.000'
            },
            {
                'eventName': 'INSERT',
                'dynamodb': {
                    'NewImage': {
                        'conversationId': {'S': 'conv-1'},
                        'senderId': {'S': 'user-1'},
                        'senderName': {'S': 'Alice'},
                        'messageText': {'S': 'Hello'}
                    }
                },
                'eventSourceARN': 'arn:aws:dynamodb:us-east-1:123456789012:table/hold-that-thought-messages/stream/2024-01-01T00:00:00.000'
            }
        ]
    }

    response = lambda_handler(event, {})

    # Should complete successfully despite potential errors
    assert response['statusCode'] == 200


def test_process_comment_notification():
    """Test comment notification processing"""
    new_image = {
        'itemId': {'S': '/2015/christmas'},
        'commentId': {'S': '2025-01-15T10:00:00.000Z#abc'},
        'userId': {'S': 'user-123'},
        'userName': {'S': 'John Doe'},
        'commentText': {'S': 'Great letter!'},
        'itemTitle': {'S': 'Christmas Letter 2015'}
    }

    # Should not raise exceptions
    process_comment_notification(new_image)


def test_process_reaction_notification():
    """Test reaction notification processing"""
    new_image = {
        'commentId': {'S': '2025-01-15T10:00:00.000Z#abc'},
        'userId': {'S': 'user-456'}
    }

    # Should not raise exceptions
    process_reaction_notification(new_image)


def test_process_message_notification():
    """Test message notification processing"""
    new_image = {
        'conversationId': {'S': 'user-1#user-2'},
        'senderId': {'S': 'user-1'},
        'senderName': {'S': 'Alice'},
        'messageText': {'S': 'Hello!'}
    }

    # Should not raise exceptions
    process_message_notification(new_image)


def test_process_comment_notification_with_missing_fields():
    """Test comment notification handles missing optional fields"""
    new_image = {
        'itemId': {'S': '/2015/christmas'},
        'commentId': {'S': '2025-01-15T10:00:00.000Z#abc'},
        'userId': {'S': 'user-123'},
        'commentText': {'S': 'Great letter!'}
        # Missing userName and itemTitle
    }

    # Should not raise exceptions even with missing fields
    process_comment_notification(new_image)


def test_process_message_notification_with_missing_fields():
    """Test message notification handles missing optional fields"""
    new_image = {
        'conversationId': {'S': 'user-1#user-2'},
        'senderId': {'S': 'user-1'},
        'messageText': {'S': 'Hello!'}
        # Missing senderName
    }

    # Should not raise exceptions even with missing fields
    process_message_notification(new_image)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
