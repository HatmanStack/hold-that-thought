#!/usr/bin/env node

const {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} = require('@aws-sdk/client-cognito-identity-provider')
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} = require('@aws-sdk/lib-dynamodb')

// Configuration
const USER_POOL_ID = process.env.USER_POOL_ID
const TABLE_NAME = process.env.TABLE_NAME || 'HoldThatThought'
const AWS_REGION = process.env.AWS_REGION || 'us-west-2'

// Validate required environment variables
if (!USER_POOL_ID) {
  console.error('Error: USER_POOL_ID environment variable is required')
  process.exit(1)
}

// Initialize AWS clients
const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION })
const ddbClient = new DynamoDBClient({ region: AWS_REGION })
const docClient = DynamoDBDocumentClient.from(ddbClient)

function getAttribute(user, attributeName) {
  const attr = user.Attributes?.find(a => a.Name === attributeName)
  return attr?.Value || null
}

async function fetchAllCognitoUsers() {
  const users = []
  let paginationToken

  do {
    const command = new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Limit: 60, // Max limit per request
      PaginationToken: paginationToken,
    })

    const response = await cognitoClient.send(command)
    users.push(...(response.Users || []))
    paginationToken = response.PaginationToken

  } while (paginationToken)

  return users
}

async function profileExists(userId) {
  try {
    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
      },
    })

    const response = await docClient.send(command)
    return !!response.Item
  }
  catch (error) {
    console.error(`Error checking profile existence for ${userId}:`, error.message)
    return false
  }
}

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
    return false
  }

  // Create display name from name attribute or email
  let displayName = name || email.split('@')[0]

  // Capitalize first letter if it's from email
  if (!name) {
    displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1)
  }

  const profile = {
    PK: `USER#${userId}`,
    SK: 'PROFILE',
    entityType: 'USER_PROFILE',
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
    updatedAt: new Date().toISOString(),
  }

  try {
    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: profile,
      ConditionExpression: 'attribute_not_exists(PK)', // Prevent overwriting existing profiles
    })

    await docClient.send(command)
    return true
  }
  catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return false
    }

    console.error(`✗ Failed to create profile for ${email}:`, error.message)
    return false
  }
}

async function main() {

  try {
    // Fetch all Cognito users
    const cognitoUsers = await fetchAllCognitoUsers()

    if (cognitoUsers.length === 0) {
      return
    }

    // Process each user
    let created = 0
    let existing = 0
    let errors = 0

    for (const user of cognitoUsers) {
      const result = await createUserProfile(user)
      if (result === true) {
        created++
      }
      else if (result === false) {
        existing++
      }
      else {
        errors++
      }
    }

    // Summary
  }
  catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

// Run the script
main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('\nBackfill failed:', error)
    process.exit(1)
  })
