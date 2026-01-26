#!/usr/bin/env node
/**
 * Backfill GSI1 keys for user profiles
 *
 * This script adds GSI1PK='USERS' and GSI1SK='USER#<userId>' to all
 * existing user profiles that don't have these attributes set.
 *
 * Usage:
 *   TABLE_NAME=HoldThatThought DRY_RUN=true node backend/scripts/backfill-user-gsi1.js
 *   TABLE_NAME=HoldThatThought node backend/scripts/backfill-user-gsi1.js
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb')

const TABLE_NAME = process.env.TABLE_NAME || 'HoldThatThought'
const AWS_REGION = process.env.AWS_REGION || 'us-west-2'
const DRY_RUN = process.env.DRY_RUN === 'true'

const ddbClient = new DynamoDBClient({ region: AWS_REGION })
const docClient = DynamoDBDocumentClient.from(ddbClient)

async function backfillUserGSI1() {
  console.log(`Backfilling GSI1 keys for user profiles in table: ${TABLE_NAME}`)
  console.log(`Region: ${AWS_REGION}`)
  console.log(`Dry run: ${DRY_RUN}`)
  console.log('')

  let lastEvaluatedKey
  let updated = 0
  let skipped = 0
  let alreadyHasGSI1 = 0

  do {
    const scanResult = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'entityType = :type',
      ExpressionAttributeValues: { ':type': 'USER_PROFILE' },
      ExclusiveStartKey: lastEvaluatedKey,
    }))

    for (const item of scanResult.Items || []) {
      const userId = item.userId

      if (!userId) {
        console.warn(`Skipping item without userId: ${item.PK}`)
        skipped++
        continue
      }

      // Check if already has GSI1 keys
      if (item.GSI1PK && item.GSI1SK) {
        alreadyHasGSI1++
        continue
      }

      if (DRY_RUN) {
        console.log(`[DRY RUN] Would update: ${userId}`)
        updated++
        continue
      }

      try {
        await docClient.send(new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: item.PK, SK: item.SK },
          UpdateExpression: 'SET GSI1PK = :gsi1pk, GSI1SK = :gsi1sk',
          ExpressionAttributeValues: {
            ':gsi1pk': 'USERS',
            ':gsi1sk': `USER#${userId}`,
          },
        }))
        updated++
        console.log(`Updated: ${userId}`)
      } catch (error) {
        console.error(`Failed to update ${userId}:`, error.message)
        skipped++
      }
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey
  } while (lastEvaluatedKey)

  console.log('')
  console.log('=== Summary ===')
  console.log(`Updated: ${updated}`)
  console.log(`Already had GSI1: ${alreadyHasGSI1}`)
  console.log(`Skipped (errors): ${skipped}`)
}

backfillUserGSI1().catch(error => {
  console.error('Migration failed:', error)
  process.exit(1)
})
