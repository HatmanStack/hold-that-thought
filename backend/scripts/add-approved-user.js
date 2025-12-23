#!/usr/bin/env node

import { AdminAddUserToGroupCommand, AdminGetUserCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider'
import { config } from 'dotenv'

// Load environment variables
config()

const USER_POOL_ID = process.env.PUBLIC_COGNITO_USER_POOL_ID
const AWS_REGION = process.env.PUBLIC_AWS_REGION || 'us-east-1'
const GROUP_NAME = 'ApprovedUsers'

if (!USER_POOL_ID) {
  console.error('❌ Error: PUBLIC_COGNITO_USER_POOL_ID environment variable is required')
  process.exit(1)
}

const usernames = process.argv.slice(2)

if (usernames.length === 0) {
  console.error('❌ Error: Please provide at least one username/email')
  process.exit(1)
}

const client = new CognitoIdentityProviderClient({ region: AWS_REGION })

async function addUserToGroup(username) {
  try {
    // First, check if user exists
    await client.send(new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
    }))

    // Add user to ApprovedUsers group
    await client.send(new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      GroupName: GROUP_NAME,
    }))

    return true
  }
  catch (error) {
    if (error.name === 'UserNotFoundException') {
      console.error(`❌ User ${username} not found in user pool`)
    }
    else if (error.name === 'ResourceNotFoundException') {
      console.error(`❌ Group ${GROUP_NAME} not found. Make sure to deploy the Cognito infrastructure first.`)
    }
    else {
      console.error(`❌ Error adding ${username} to group:`, error.message)
    }
    return false
  }
}

async function main() {

  let successCount = 0

  for (const username of usernames) {
    const success = await addUserToGroup(username)
    if (success)
      successCount++
  }
  if (successCount < usernames.length) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error)
  process.exit(1)
})
