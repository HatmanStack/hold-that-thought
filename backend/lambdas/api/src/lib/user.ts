/**
 * User profile management utilities
 */
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, TABLE_NAME } from './database'
import { keys } from './keys'
import type { UserProfile } from '../types'

/**
 * Ensure a user profile exists (create if not present)
 */
export async function ensureProfile(
  userId: string,
  email?: string,
  groups?: string
): Promise<UserProfile> {
  const key = keys.userProfile(userId)

  // Try to get existing profile
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: key,
    })
  )

  if (result.Item) {
    return result.Item as UserProfile
  }

  // Create new profile with GSI1 keys for listing all users
  const timestamp = new Date().toISOString()
  const profile: UserProfile = {
    ...key,
    ...keys.userProfileGSI1(userId),
    userId,
    email,
    displayName: email?.split('@')[0] || 'User',
    groups,
    createdAt: timestamp,
    updatedAt: timestamp,
    entityType: 'USER_PROFILE',
  }

  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: profile,
        ConditionExpression: 'attribute_not_exists(PK)',
      })
    )
  } catch (err) {
    // Profile created by concurrent request, fetch it
    if ((err as Error).name === 'ConditionalCheckFailedException') {
      const existing = await docClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: key,
        })
      )
      return existing.Item as UserProfile
    }
    throw err
  }

  return profile
}

/**
 * Get a user profile by ID
 */
export async function getProfile(
  userId: string
): Promise<UserProfile | null> {
  const key = keys.userProfile(userId)

  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: key,
    })
  )

  return (result.Item as UserProfile) || null
}
