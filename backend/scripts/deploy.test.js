import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  generateSamConfig,
  loadOrPromptConfig,
  question,
} from './deploy.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEPLOY_CONFIG_PATH = path.join(__dirname, '..', '.deploy-config.json')

vi.mock('fs')
vi.mock('child_process')

describe('deploy.js', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(fs.existsSync).mockReturnValue(false)
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('loadOrPromptConfig', () => {
    it('should load existing config file', async () => {
      const existingConfig = {
        region: 'us-west-2',
        stackName: 'test-stack',
        allowedOrigins: '*',
        userProfilesTable: 'TestProfiles',
        commentsTable: 'TestComments',
        messagesTable: 'TestMessages',
        conversationMembersTable: 'TestConversationMembers',
        reactionsTable: 'TestReactions',
        rateLimitTable: 'TestRateLimit',
        mediaBucket: 'test-media',
        profilePhotosBucket: 'test-photos',
      }

      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingConfig))

      const mockRl = {
        question: vi.fn(),
        close: vi.fn(),
      }

      const config = await loadOrPromptConfig(mockRl)

      expect(config.region).toBe('us-west-2')
      expect(config.stackName).toBe('test-stack')
      expect(fs.writeFileSync).toHaveBeenCalled()
    })

    it('should use defaults when config is empty', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      let questionIndex = 0
      const mockRl = {
        question: vi.fn((query, callback) => {
          callback('')
          questionIndex++
        }),
        close: vi.fn(),
      }

      const config = await loadOrPromptConfig(mockRl)

      expect(config.region).toBe('us-east-1')
      expect(config.stackName).toBe('hold-that-thought')
      expect(config.allowedOrigins).toBe('*')
    })

    it('should prompt for missing values', async () => {
      const partialConfig = {
        region: 'eu-west-1',
      }

      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(partialConfig))

      const mockRl = {
        question: vi.fn((query, callback) => {
          callback('')
        }),
        close: vi.fn(),
      }

      const config = await loadOrPromptConfig(mockRl)

      expect(config.region).toBe('eu-west-1')
      expect(config.stackName).toBe('hold-that-thought')
    })
  })

  describe('generateSamConfig', () => {
    it('should generate valid TOML', () => {
      const config = {
        region: 'us-east-1',
        stackName: 'hold-that-thought',
        allowedOrigins: '*',
        userProfilesTable: 'Profiles',
        commentsTable: 'Comments',
        messagesTable: 'Messages',
        conversationMembersTable: 'ConvMembers',
        reactionsTable: 'Reactions',
        rateLimitTable: 'RateLimit',
        mediaBucket: 'media',
        profilePhotosBucket: 'photos',
      }

      const result = generateSamConfig(config)

      expect(result).toContain('version = 0.1')
      expect(result).toContain('stack_name = "hold-that-thought"')
      expect(result).toContain('region = "us-east-1"')
      expect(result).toContain('capabilities = "CAPABILITY_IAM"')
      expect(result).toContain('AllowedOrigins=*')
      expect(result).toContain('UserProfilesTable=Profiles')
      expect(result).toContain('resolve_s3 = true')
    })

    it('should include all parameter overrides', () => {
      const config = {
        region: 'us-west-2',
        stackName: 'test-stack',
        allowedOrigins: 'https://example.com',
        userProfilesTable: 'Profiles',
        commentsTable: 'Comments',
        messagesTable: 'Messages',
        conversationMembersTable: 'ConvMembers',
        reactionsTable: 'Reactions',
        rateLimitTable: 'RateLimit',
        mediaBucket: 'media-bucket',
        profilePhotosBucket: 'photos-bucket',
      }

      const result = generateSamConfig(config)

      expect(result).toContain('CommentsTable=Comments')
      expect(result).toContain('MessagesTable=Messages')
      expect(result).toContain('ReactionsTable=Reactions')
      expect(result).toContain('MediaBucket=media-bucket')
      expect(result).toContain('ProfilePhotosBucket=photos-bucket')
    })
  })

  describe('question helper', () => {
    it('should return user input via promise', async () => {
      const mockRl = {
        question: vi.fn((query, callback) => {
          callback('user-input')
        }),
      }

      const result = await question(mockRl, 'Enter value: ')

      expect(result).toBe('user-input')
      expect(mockRl.question).toHaveBeenCalledWith('Enter value: ', expect.any(Function))
    })
  })
})
