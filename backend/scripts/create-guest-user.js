#!/usr/bin/env node

import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  CreateGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { config } from 'dotenv'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../frontend/.env') })

const USER_POOL_ID = process.env.PUBLIC_COGNITO_USER_POOL_ID
const AWS_REGION = process.env.PUBLIC_AWS_REGION || 'us-east-1'

const GUEST_EMAIL = process.argv[2] || 'guest@showcase.demo'
const GUEST_PASSWORD = process.argv[3] || 'GuestDemo@123'

if (!USER_POOL_ID) {
  console.error('Error: PUBLIC_COGNITO_USER_POOL_ID environment variable is required')
  process.exit(1)
}

const client = new CognitoIdentityProviderClient({ region: AWS_REGION })

async function createGuestUser() {
  // Create user
  await client.send(new AdminCreateUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: GUEST_EMAIL,
    UserAttributes: [
      { Name: 'email', Value: GUEST_EMAIL },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'name', Value: 'Guest User' },
    ],
    MessageAction: 'SUPPRESS',
  }))

  // Set permanent password
  await client.send(new AdminSetUserPasswordCommand({
    UserPoolId: USER_POOL_ID,
    Username: GUEST_EMAIL,
    Password: GUEST_PASSWORD,
    Permanent: true,
  }))

  // Create ApprovedUsers group if it doesn't exist
  try {
    await client.send(new CreateGroupCommand({
      UserPoolId: USER_POOL_ID,
      GroupName: 'ApprovedUsers',
      Description: 'Users approved to access the application',
    }))
  } catch (error) {
    if (error.name !== 'GroupExistsException') throw error
  }

  // Add to ApprovedUsers group
  await client.send(new AdminAddUserToGroupCommand({
    UserPoolId: USER_POOL_ID,
    Username: GUEST_EMAIL,
    GroupName: 'ApprovedUsers',
  }))

  console.log('Guest user created successfully')
  console.log(`Email: ${GUEST_EMAIL}`)
  console.log(`Password: ${GUEST_PASSWORD}`)
  console.log('\nAdd these to your .env:')
  console.log(`PUBLIC_GUEST_EMAIL=${GUEST_EMAIL}`)
  console.log(`PUBLIC_GUEST_PASSWORD=${GUEST_PASSWORD}`)
}

async function ensureGroupAndMembership() {
  // Create ApprovedUsers group if it doesn't exist
  try {
    await client.send(new CreateGroupCommand({
      UserPoolId: USER_POOL_ID,
      GroupName: 'ApprovedUsers',
      Description: 'Users approved to access the application',
    }))
  } catch (error) {
    if (error.name !== 'GroupExistsException') throw error
  }

  // Add to ApprovedUsers group
  await client.send(new AdminAddUserToGroupCommand({
    UserPoolId: USER_POOL_ID,
    Username: GUEST_EMAIL,
    GroupName: 'ApprovedUsers',
  }))
}

createGuestUser().catch(async (error) => {
  if (error.name === 'UsernameExistsException') {
    console.log('Guest user already exists, ensuring group membership...')
    await ensureGroupAndMembership()
    console.log(`Email: ${GUEST_EMAIL}`)
    console.log(`Password: ${GUEST_PASSWORD}`)
  }
  else {
    console.error('Error:', error.message)
    process.exit(1)
  }
})
