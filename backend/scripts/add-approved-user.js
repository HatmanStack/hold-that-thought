#!/usr/bin/env node

import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load from frontend/.env (where Cognito config lives)
config({ path: resolve(__dirname, '../../frontend/.env') })

const USER_POOL_ID = process.env.PUBLIC_COGNITO_USER_POOL_ID
const AWS_REGION = process.env.PUBLIC_AWS_REGION || 'us-east-1'
const GROUP_NAME = 'ApprovedUsers'

if (!USER_POOL_ID) {
  console.error('Error: PUBLIC_COGNITO_USER_POOL_ID environment variable is required')
  process.exit(1)
}

const emails = process.argv.slice(2)

if (emails.length === 0) {
  console.error('Usage: node add-approved-user.js <email> [email2] [email3] ...')
  console.error('Creates users with temp password (sent via email) and adds to ApprovedUsers group')
  process.exit(1)
}

const client = new CognitoIdentityProviderClient({ region: AWS_REGION })

async function userExists(email) {
  try {
    await client.send(new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
    }))
    return true
  }
  catch (error) {
    if (error.name === 'UserNotFoundException') {
      return false
    }
    throw error
  }
}

async function createUser(email) {
  await client.send(new AdminCreateUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: email,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' },
    ],
    DesiredDeliveryMediums: ['EMAIL'],
  }))
}

async function addToGroup(email) {
  await client.send(new AdminAddUserToGroupCommand({
    UserPoolId: USER_POOL_ID,
    Username: email,
    GroupName: GROUP_NAME,
  }))
}

async function addApprovedUser(email) {
  try {
    const exists = await userExists(email)

    if (exists) {
      console.log(`User ${email} already exists, adding to ${GROUP_NAME}...`)
    }
    else {
      console.log(`Creating user ${email}...`)
      await createUser(email)
      console.log(`Temp password sent to ${email}`)
    }

    await addToGroup(email)
    console.log(`Added ${email} to ${GROUP_NAME}`)
    return true
  }
  catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.error(`Group ${GROUP_NAME} not found. Deploy Cognito infrastructure first.`)
    }
    else if (error.name === 'UsernameExistsException') {
      console.error(`User ${email} already exists with different identifier`)
    }
    else {
      console.error(`Error processing ${email}:`, error.message)
    }
    return false
  }
}

async function main() {
  let successCount = 0

  for (const email of emails) {
    if (await addApprovedUser(email)) {
      successCount++
    }
  }

  console.log(`\nProcessed ${successCount}/${emails.length} users`)

  if (successCount < emails.length) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
