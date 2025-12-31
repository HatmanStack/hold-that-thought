// @ts-check
/**
 * Base repository with common DynamoDB operations
 * @module repositories/base-repository
 */
const { GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand, BatchGetCommand } = require('@aws-sdk/lib-dynamodb')
const { docClient, TABLE_NAME } = require('../lib/database')

/**
 * @typedef {Object} QueryOptions
 * @property {number} [limit] - Maximum items to return
 * @property {string} [lastEvaluatedKey] - Pagination cursor (base64 encoded)
 * @property {boolean} [scanIndexForward] - Sort direction (true = ascending)
 * @property {string} [indexName] - GSI name if querying an index
 */

/**
 * @typedef {Object} PaginatedResult
 * @property {any[]} items - The items returned
 * @property {string|null} lastEvaluatedKey - Cursor for next page (base64 encoded)
 * @property {number} count - Number of items returned
 */

class BaseRepository {
  /**
   * @param {string} tableName - DynamoDB table name (defaults to env var)
   */
  constructor(tableName = TABLE_NAME) {
    this.tableName = tableName
    this.docClient = docClient
  }

  /**
   * Get a single item by primary key
   * @param {Object} key - Primary key (PK and SK)
   * @returns {Promise<any|null>}
   */
  async getItem(key) {
    const result = await this.docClient.send(new GetCommand({
      TableName: this.tableName,
      Key: key,
    }))
    return result.Item || null
  }

  /**
   * Put an item (create or replace)
   * @param {Object} item - The item to store
   * @param {Object} [options] - Additional options
   * @param {string} [options.conditionExpression] - Condition for the put
   * @param {Object} [options.expressionAttributeValues] - Values for condition
   * @returns {Promise<void>}
   */
  async putItem(item, options = {}) {
    const params = {
      TableName: this.tableName,
      Item: item,
    }

    if (options.conditionExpression) {
      params.ConditionExpression = options.conditionExpression
      params.ExpressionAttributeValues = options.expressionAttributeValues
    }

    await this.docClient.send(new PutCommand(params))
  }

  /**
   * Update an item with an update expression
   * @param {Object} key - Primary key
   * @param {string} updateExpression - DynamoDB update expression
   * @param {Object} expressionAttributeValues - Values for the expression
   * @param {Object} [options] - Additional options
   * @returns {Promise<any>} - Updated item
   */
  async updateItem(key, updateExpression, expressionAttributeValues, options = {}) {
    const params = {
      TableName: this.tableName,
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: options.returnValues || 'ALL_NEW',
    }

    if (options.conditionExpression) {
      params.ConditionExpression = options.conditionExpression
    }

    if (options.expressionAttributeNames) {
      params.ExpressionAttributeNames = options.expressionAttributeNames
    }

    const result = await this.docClient.send(new UpdateCommand(params))
    return result.Attributes
  }

  /**
   * Delete an item
   * @param {Object} key - Primary key
   * @returns {Promise<void>}
   */
  async deleteItem(key) {
    await this.docClient.send(new DeleteCommand({
      TableName: this.tableName,
      Key: key,
    }))
  }

  /**
   * Query items by partition key
   * @param {string} pkValue - Partition key value
   * @param {Object} [options] - Query options
   * @returns {Promise<PaginatedResult>}
   */
  async queryByPK(pkValue, options = {}) {
    return this.query({
      keyConditionExpression: 'PK = :pk',
      expressionAttributeValues: { ':pk': pkValue },
      ...options,
    })
  }

  /**
   * Query items with sort key prefix
   * @param {string} pkValue - Partition key value
   * @param {string} skPrefix - Sort key prefix for begins_with
   * @param {Object} [options] - Query options
   * @returns {Promise<PaginatedResult>}
   */
  async queryByPKAndSKPrefix(pkValue, skPrefix, options = {}) {
    return this.query({
      keyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      expressionAttributeValues: { ':pk': pkValue, ':skPrefix': skPrefix },
      ...options,
    })
  }

  /**
   * Execute a query with full options
   * @param {Object} params - Query parameters
   * @returns {Promise<PaginatedResult>}
   */
  async query(params) {
    const {
      keyConditionExpression,
      expressionAttributeValues,
      expressionAttributeNames,
      filterExpression,
      limit = 50,
      lastEvaluatedKey,
      scanIndexForward = true,
      indexName,
    } = params

    const queryParams = {
      TableName: this.tableName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: limit,
      ScanIndexForward: scanIndexForward,
    }

    if (indexName) {
      queryParams.IndexName = indexName
    }

    if (expressionAttributeNames) {
      queryParams.ExpressionAttributeNames = expressionAttributeNames
    }

    if (filterExpression) {
      queryParams.FilterExpression = filterExpression
    }

    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(lastEvaluatedKey, 'base64').toString())
    }

    const result = await this.docClient.send(new QueryCommand(queryParams))

    return {
      items: result.Items || [],
      lastEvaluatedKey: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : null,
      count: result.Count || 0,
    }
  }

  /**
   * Batch get multiple items
   * @param {Object[]} keys - Array of primary keys
   * @returns {Promise<any[]>}
   */
  async batchGetItems(keys) {
    if (keys.length === 0) return []

    // DynamoDB batch limit is 100 items
    const chunks = []
    for (let i = 0; i < keys.length; i += 100) {
      chunks.push(keys.slice(i, i + 100))
    }

    const results = []
    for (const chunk of chunks) {
      const result = await this.docClient.send(new BatchGetCommand({
        RequestItems: {
          [this.tableName]: {
            Keys: chunk,
          },
        },
      }))

      if (result.Responses?.[this.tableName]) {
        results.push(...result.Responses[this.tableName])
      }
    }

    return results
  }
}

module.exports = { BaseRepository }
