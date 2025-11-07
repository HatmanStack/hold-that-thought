"""
Unit tests for activity-aggregator Lambda function
"""
import json
import pytest
from moto import mock_aws
import boto3
from unittest.mock import patch, MagicMock
import os
from datetime import datetime

# Set environment variables before importing handler
os.environ['USER_PROFILES_TABLE'] = 'test-user-profiles'

from index import lambda_handler, increment_comment_count, update_last_active


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
                        'commentText': {'S': 'Great letter!'}
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
def dynamodb_stream_event_message():
    """Sample DynamoDB Stream event for message insertion"""
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
                        'conversationId': {'S': 'user-1#user-2'},
                        'messageId': {'S': '2025-01-15T10:00:00.000Z#xyz'}
                    },
                    'NewImage': {
                        'conversationId': {'S': 'user-1#user-2'},
                        'messageId': {'S': '2025-01-15T10:00:00.000Z#xyz'},
                        'senderId': {'S': 'user-456'},
                        'messageText': {'S': 'Hello!'}
                    },
                    'SequenceNumber': '222',
                    'SizeBytes': 26,
                    'StreamViewType': 'NEW_AND_OLD_IMAGES'
                },
                'eventSourceARN': 'arn:aws:dynamodb:us-east-1:123456789012:table/hold-that-thought-messages/stream/2024-01-01T00:00:00.000'
            }
        ]
    }


@pytest.fixture
def dynamodb_stream_event_reaction():
    """Sample DynamoDB Stream event for reaction insertion"""
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
                        'commentId': {'S': '2025-01-15T10:00:00.000Z#abc'},
                        'userId': {'S': 'user-789'}
                    },
                    'NewImage': {
                        'commentId': {'S': '2025-01-15T10:00:00.000Z#abc'},
                        'userId': {'S': 'user-789'},
                        'reactionType': {'S': 'like'}
                    },
                    'SequenceNumber': '333',
                    'SizeBytes': 26,
                    'StreamViewType': 'NEW_AND_OLD_IMAGES'
                },
                'eventSourceARN': 'arn:aws:dynamodb:us-east-1:123456789012:table/hold-that-thought-comment-reactions/stream/2024-01-01T00:00:00.000'
            }
        ]
    }


@mock_aws
def test_lambda_handler_processes_comment_event(dynamodb_stream_event_comment):
    """Test handler processes comment insertion events"""
    # Create mock DynamoDB table
    dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
    table = dynamodb.create_table(
        TableName='test-user-profiles',
        KeySchema=[{'AttributeName': 'userId', 'KeyType': 'HASH'}],
        AttributeDefinitions=[{'AttributeName': 'userId', 'AttributeType': 'S'}],
        BillingMode='PAY_PER_REQUEST'
    )

    # Put test user
    table.put_item(Item={'userId': 'user-123', 'commentCount': 0})

    response = lambda_handler(dynamodb_stream_event_comment, {})

    assert response['statusCode'] == 200
    assert response['body'] == 'Activity stats updated'

    # Verify commentCount was incremented
    user = table.get_item(Key={'userId': 'user-123'})
    assert user['Item']['commentCount'] == 1


@mock_aws
def test_lambda_handler_processes_message_event(dynamodb_stream_event_message):
    """Test handler processes message insertion events"""
    # Create mock DynamoDB table
    dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
    table = dynamodb.create_table(
        TableName='test-user-profiles',
        KeySchema=[{'AttributeName': 'userId', 'KeyType': 'HASH'}],
        AttributeDefinitions=[{'AttributeName': 'userId', 'AttributeType': 'S'}],
        BillingMode='PAY_PER_REQUEST'
    )

    table.put_item(Item={'userId': 'user-456'})

    response = lambda_handler(dynamodb_stream_event_message, {})

    assert response['statusCode'] == 200

    # Verify lastActive was updated
    user = table.get_item(Key={'userId': 'user-456'})
    assert 'lastActive' in user['Item']


@mock_aws
def test_lambda_handler_processes_reaction_event(dynamodb_stream_event_reaction):
    """Test handler processes reaction insertion events"""
    # Create mock DynamoDB table
    dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
    table = dynamodb.create_table(
        TableName='test-user-profiles',
        KeySchema=[{'AttributeName': 'userId', 'KeyType': 'HASH'}],
        AttributeDefinitions=[{'AttributeName': 'userId', 'AttributeType': 'S'}],
        BillingMode='PAY_PER_REQUEST'
    )

    table.put_item(Item={'userId': 'user-789'})

    response = lambda_handler(dynamodb_stream_event_reaction, {})

    assert response['statusCode'] == 200

    # Verify lastActive was updated
    user = table.get_item(Key={'userId': 'user-789'})
    assert 'lastActive' in user['Item']


@mock_aws
def test_lambda_handler_handles_multiple_records():
    """Test handler processes multiple records in a single event"""
    # Create mock DynamoDB table
    dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
    table = dynamodb.create_table(
        TableName='test-user-profiles',
        KeySchema=[{'AttributeName': 'userId', 'KeyType': 'HASH'}],
        AttributeDefinitions=[{'AttributeName': 'userId', 'AttributeType': 'S'}],
        BillingMode='PAY_PER_REQUEST'
    )

    table.put_item(Item={'userId': 'user-1', 'commentCount': 0})
    table.put_item(Item={'userId': 'user-2', 'commentCount': 0})

    event = {
        'Records': [
            {
                'eventName': 'INSERT',
                'dynamodb': {
                    'NewImage': {
                        'userId': {'S': 'user-1'},
                        'commentText': {'S': 'Comment 1'}
                    }
                },
                'eventSourceARN': 'arn:aws:dynamodb:us-east-1:123456789012:table/hold-that-thought-comments/stream/2024-01-01T00:00:00.000'
            },
            {
                'eventName': 'INSERT',
                'dynamodb': {
                    'NewImage': {
                        'userId': {'S': 'user-2'},
                        'commentText': {'S': 'Comment 2'}
                    }
                },
                'eventSourceARN': 'arn:aws:dynamodb:us-east-1:123456789012:table/hold-that-thought-comments/stream/2024-01-01T00:00:00.000'
            }
        ]
    }

    response = lambda_handler(event, {})

    assert response['statusCode'] == 200

    # Verify both users were updated
    user1 = table.get_item(Key={'userId': 'user-1'})
    user2 = table.get_item(Key={'userId': 'user-2'})
    assert user1['Item']['commentCount'] == 1
    assert user2['Item']['commentCount'] == 1


@mock_aws
def test_lambda_handler_skips_non_insert_events():
    """Test handler skips MODIFY and REMOVE events"""
    dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
    table = dynamodb.create_table(
        TableName='test-user-profiles',
        KeySchema=[{'AttributeName': 'userId', 'KeyType': 'HASH'}],
        AttributeDefinitions=[{'AttributeName': 'userId', 'AttributeType': 'S'}],
        BillingMode='PAY_PER_REQUEST'
    )

    event = {
        'Records': [
            {
                'eventName': 'MODIFY',
                'dynamodb': {
                    'NewImage': {
                        'userId': {'S': 'user-1'}
                    }
                },
                'eventSourceARN': 'arn:aws:dynamodb:us-east-1:123456789012:table/hold-that-thought-comments/stream/2024-01-01T00:00:00.000'
            }
        ]
    }

    response = lambda_handler(event, {})

    # Should succeed but not process
    assert response['statusCode'] == 200


@mock_aws
def test_lambda_handler_continues_on_error():
    """Test handler continues processing even if one record fails"""
    dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
    table = dynamodb.create_table(
        TableName='test-user-profiles',
        KeySchema=[{'AttributeName': 'userId', 'KeyType': 'HASH'}],
        AttributeDefinitions=[{'AttributeName': 'userId', 'AttributeType': 'S'}],
        BillingMode='PAY_PER_REQUEST'
    )

    table.put_item(Item={'userId': 'user-1', 'commentCount': 0})

    event = {
        'Records': [
            {
                'eventName': 'INSERT',
                'dynamodb': {
                    'NewImage': {
                        'userId': {'S': 'user-invalid'}  # Will fail
                    }
                },
                'eventSourceARN': 'arn:aws:dynamodb:us-east-1:123456789012:table/hold-that-thought-comments/stream/2024-01-01T00:00:00.000'
            },
            {
                'eventName': 'INSERT',
                'dynamodb': {
                    'NewImage': {
                        'userId': {'S': 'user-1'},
                        'commentText': {'S': 'Valid comment'}
                    }
                },
                'eventSourceARN': 'arn:aws:dynamodb:us-east-1:123456789012:table/hold-that-thought-comments/stream/2024-01-01T00:00:00.000'
            }
        ]
    }

    response = lambda_handler(event, {})

    # Should complete successfully
    assert response['statusCode'] == 200

    # Second record should have been processed
    user = table.get_item(Key={'userId': 'user-1'})
    assert user['Item']['commentCount'] == 1


@mock_aws
def test_increment_comment_count():
    """Test atomic comment count increment"""
    dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
    table = dynamodb.create_table(
        TableName='test-user-profiles',
        KeySchema=[{'AttributeName': 'userId', 'KeyType': 'HASH'}],
        AttributeDefinitions=[{'AttributeName': 'userId', 'AttributeType': 'S'}],
        BillingMode='PAY_PER_REQUEST'
    )

    table.put_item(Item={'userId': 'user-123', 'commentCount': 5})

    increment_comment_count('user-123')

    user = table.get_item(Key={'userId': 'user-123'})
    assert user['Item']['commentCount'] == 6


@mock_aws
def test_update_last_active():
    """Test lastActive timestamp update"""
    dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
    table = dynamodb.create_table(
        TableName='test-user-profiles',
        KeySchema=[{'AttributeName': 'userId', 'KeyType': 'HASH'}],
        AttributeDefinitions=[{'AttributeName': 'userId', 'AttributeType': 'S'}],
        BillingMode='PAY_PER_REQUEST'
    )

    table.put_item(Item={'userId': 'user-123'})

    update_last_active('user-123')

    user = table.get_item(Key={'userId': 'user-123'})
    assert 'lastActive' in user['Item']
    # Verify it's a valid ISO timestamp
    assert user['Item']['lastActive'].endswith('Z')


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
