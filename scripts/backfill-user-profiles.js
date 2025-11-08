#!/usr/bin/env node

/**
 * Backfill User Profiles Script
 *
 * This script migrates existing users from Cognito User Pool to the UserProfiles DynamoDB table.
 * It's idempotent - safe to run multiple times.
 *
 * Usage:
 *   node scripts/backfill-user-profiles.js
 *
 * Environment variables required:
 *   - USER_POOL_ID: Cognito User Pool ID
 *   - USER_PROFILES_TABLE: DynamoDB table name (default: hold-that-thought-user-profiles)
 *   - AWS_REGION: AWS region (default: us-east-1)
 */

const {
  CognitoIdentityProviderClient,
  ListUsersCommand
} = require('@aws-sdk/client-cognito-identity-provider')
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand
} = require('@aws-sdk/lib-dynamodb')

// Configuration
const USER_POOL_ID = process.env.USER_POOL_ID
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE || 'hold-that-thought-user-profiles'
const AWS_REGION = process.env.AWS_REGION || 'us-east-1'

// Validate required environment variables
if (!USER_POOL_ID) {
  console.error('Error: USER_POOL_ID environment variable is required')
  process.exit(1)
}

// Initialize AWS clients
const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION })
const ddbClient = new DynamoDBClient({ region: AWS_REGION })
const docClient = DynamoDBDocumentClient.from(ddbClient)

/**
 * Get attribute value from Cognito user attributes
 */
function getAttribute(user, attributeName) {
  const attr = user.Attributes?.find(a => a.Name === attributeName)
  return attr?.Value || null
}

/**
 * Fetch all users from Cognito (with pagination support)
 */
async function fetchAllCognitoUsers() {
  const users = []
  let paginationToken = undefined

  do {
    const command = new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Limit: 60, // Max limit per request
      PaginationToken: paginationToken
    })

    const response = await cognitoClient.send(command)
    users.push(...(response.Users || []))
    paginationToken = response.PaginationToken

    console.log(`Fetched ${response.Users?.length || 0} users (total: ${users.length})`)
  } while (paginationToken)

  return users
}

/**
 * Check if user profile already exists in DynamoDB
 */
async function profileExists(userId) {
  try {
    const command = new GetCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { userId }
    })

    const response = await docClient.send(command)
    return !!response.Item
  } catch (error) {
    console.error(`Error checking profile existence for ${userId}:`, error.message)
    return false
  }
}

/**
 * Create user profile in DynamoDB
 */
async function createUserProfile(cognitoUser) {
  const userId = getAttribute(cognitoUser, 'sub')
  const email = getAttribute(cognitoUser, 'email')
  const name = getAttribute(cognitoUser, 'name')
  const picture = getAttribute(cognitoUser, 'picture')

  if (!userId || !email) {
    console.warn(`Skipping user - missing required attributes (sub or email)`)
    return false
  }

  // Check if profile already exists
  if (await profileExists(userId)) {
    console.log(`Profile already exists for ${email} (${userId})`)
    return false
  }

  // Create display name from name attribute or email
  let displayName = name || email.split('@')[0]

  // Capitalize first letter if it's from email
  if (!name) {
    displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1)
  }

  const profile = {
    userId,
    email,
    displayName,
    profilePhotoUrl: picture || undefined,
    bio: undefined,
    familyRelationship: undefined,
    generation: undefined,
    familyBranch: undefined,
    joinedDate: cognitoUser.UserCreateDate?.toISOString() || new Date().toISOString(),
    isProfilePrivate: false,
    commentCount: 0,
    mediaUploadCount: 0,
    lastActive: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  try {
    const command = new PutCommand({
      TableName: USER_PROFILES_TABLE,
      Item: profile,
      ConditionExpression: 'attribute_not_exists(userId)' // Prevent overwriting existing profiles
    })

    await docClient.send(command)
    console.log(`✓ Created profile for ${email} (${userId})`)
    return true
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      console.log(`Profile already exists for ${email} (${userId})`)
      return false
    }

    console.error(`✗ Failed to create profile for ${email}:`, error.message)
    return false
  }
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(60))
  console.log('User Profile Backfill Script')
  console.log('='.repeat(60))
  console.log(`User Pool ID: ${USER_POOL_ID}`)
  console.log(`DynamoDB Table: ${USER_PROFILES_TABLE}`)
  console.log(`AWS Region: ${AWS_REGION}`)
  console.log('='.repeat(60))
  console.log()

  try {
    // Fetch all Cognito users
    console.log('Fetching users from Cognito...')
    const cognitoUsers = await fetchAllCognitoUsers()
    console.log(`Found ${cognitoUsers.length} users in Cognito\n`)

    if (cognitoUsers.length === 0) {
      console.log('No users found in Cognito User Pool')
      return
    }

    // Process each user
    console.log('Creating user profiles...\n')
    let created = 0
    let existing = 0
    let errors = 0

    for (const user of cognitoUsers) {
      const result = await createUserProfile(user)
      if (result === true) {
        created++
      } else if (result === false) {
        existing++
      } else {
        errors++
      }
    }

    // Summary
    console.log()
    console.log('='.repeat(60))
    console.log('Summary')
    console.log('='.repeat(60))
    console.log(`Total users: ${cognitoUsers.length}`)
    console.log(`Created: ${created}`)
    console.log(`Already existed: ${existing}`)
    console.log(`Errors: ${errors}`)
    console.log('='.repeat(60))

  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

// Run the script
main()
  .then(() => {
    console.log('\nBackfill completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\nBackfill failed:', error)
    process.exit(1)
  })
