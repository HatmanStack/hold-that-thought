import { generateSlug, generateUniqueFilename } from '../../../backend/scripts/lib/slug-generator.js'

describe('slug generator', () => {
  describe('generateSlug', () => {
    it('should generate slug from title', () => {
      expect(generateSlug('Family Update Letter February 2016')).toBe('family-update-letter')
    })

    it('should use only first N words', () => {
      expect(generateSlug('This Is A Very Long Title', 3)).toBe('this-is-a')
      expect(generateSlug('Short Title', 5)).toBe('short-title')
    })

    it('should handle special characters', () => {
      expect(generateSlug('Hello! World? Test')).toBe('hello-world-test')
    })

    it('should convert to lowercase', () => {
      expect(generateSlug('UPPERCASE TITLE')).toBe('uppercase-title')
    })

    it('should handle multiple spaces', () => {
      expect(generateSlug('Word   Multiple   Spaces')).toBe('word-multiple-spaces')
    })

    it('should remove leading/trailing hyphens', () => {
      expect(generateSlug('  Title  ')).toBe('title')
    })

    it('should handle numbers', () => {
      expect(generateSlug('Letter 2016 Update')).toBe('letter-2016-update')
    })

    it('should handle empty string', () => {
      expect(generateSlug('')).toBe('')
    })

    it('should handle null/undefined', () => {
      expect(generateSlug(null)).toBe('')
      expect(generateSlug(undefined)).toBe('')
    })

    it('should handle apostrophes', () => {
      expect(generateSlug("John's Letter Home")).toBe('johns-letter-home')
    })
  })

  describe('generateUniqueFilename', () => {
    it('should return simple filename if no collision', () => {
      const existing = new Set()
      const result = generateUniqueFilename('2016-02-10', 'Family Update', existing)
      expect(result).toEqual({ md: '2016-02-10.md', pdf: '2016-02-10.pdf' })
    })

    it('should handle collision with slug suffix', () => {
      const existing = new Set(['2016-02-10'])
      const result = generateUniqueFilename('2016-02-10', 'Family Update Letter', existing)
      expect(result).toEqual({
        md: '2016-02-10-family-update-letter.md',
        pdf: '2016-02-10-family-update-letter.pdf'
      })
    })

    it('should handle multiple collisions on same date', () => {
      const existing = new Set(['2016-02-10', '2016-02-10-family-update-letter'])
      const result = generateUniqueFilename('2016-02-10', 'Family Update Letter Two', existing)
      expect(result).toEqual({
        md: '2016-02-10-family-update-letter-1.md',
        pdf: '2016-02-10-family-update-letter-1.pdf'
      })
    })

    it('should add date to existing set after generating', () => {
      const existing = new Set()
      generateUniqueFilename('2016-02-10', 'Test', existing)
      expect(existing.has('2016-02-10')).toBe(true)
    })

    it('should handle empty title', () => {
      const existing = new Set(['2016-02-10'])
      const result = generateUniqueFilename('2016-02-10', '', existing)
      // Should still generate a unique name
      expect(result.md).toContain('2016-02-10')
      expect(result.md).not.toBe('2016-02-10.md')
    })
  })
})
