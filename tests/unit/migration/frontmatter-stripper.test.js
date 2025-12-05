import { stripFrontmatter, extractFrontmatter } from '../../../backend/scripts/lib/frontmatter-stripper.js'

describe('frontmatter stripper', () => {
  describe('stripFrontmatter', () => {
    it('should remove frontmatter and preserve content', () => {
      const input = '---\ntitle: "Test"\ndate: 2016-02-10\n---\n\nDear Family,'
      expect(stripFrontmatter(input)).toBe('Dear Family,')
    })

    it('should handle files without frontmatter', () => {
      const input = 'Dear Family,\n\nThis is a letter without frontmatter.'
      expect(stripFrontmatter(input)).toBe(input)
    })

    it('should preserve content after frontmatter', () => {
      const input = '---\ntitle: "Test Letter"\n---\n\n# Heading\n\nParagraph text here.'
      const result = stripFrontmatter(input)
      expect(result).toBe('# Heading\n\nParagraph text here.')
    })

    it('should handle empty frontmatter', () => {
      const input = '---\n---\n\nContent here'
      expect(stripFrontmatter(input)).toBe('Content here')
    })

    it('should handle multiline content', () => {
      const input = '---\ntitle: "Test"\n---\n\nLine 1\nLine 2\nLine 3'
      expect(stripFrontmatter(input)).toBe('Line 1\nLine 2\nLine 3')
    })

    it('should handle frontmatter with special characters', () => {
      const input = '---\ntitle: "Test: Special"\ndate: 2016-02-10\n---\n\nContent'
      expect(stripFrontmatter(input)).toBe('Content')
    })

    it('should handle malformed frontmatter (missing closing)', () => {
      // If no closing ---, return content as-is
      const input = '---\ntitle: "Test"\nContent here'
      expect(stripFrontmatter(input)).toBe(input)
    })

    it('should handle content that looks like frontmatter but is not at start', () => {
      const input = 'Some text\n---\ntitle: "Test"\n---\nMore text'
      expect(stripFrontmatter(input)).toBe(input)
    })

    it('should handle null/undefined input', () => {
      expect(stripFrontmatter(null)).toBe('')
      expect(stripFrontmatter(undefined)).toBe('')
      expect(stripFrontmatter('')).toBe('')
    })

    it('should handle multiple dashes in content after frontmatter', () => {
      const input = '---\ntitle: "Test"\n---\n\nContent with --- dashes in it'
      expect(stripFrontmatter(input)).toBe('Content with --- dashes in it')
    })
  })

  describe('extractFrontmatter', () => {
    it('should extract frontmatter fields', () => {
      const input = '---\ntitle: "Test Letter"\n---\n\nContent'
      expect(extractFrontmatter(input)).toEqual({ title: 'Test Letter' })
    })

    it('should return empty object if no frontmatter', () => {
      const input = 'Content without frontmatter'
      expect(extractFrontmatter(input)).toEqual({})
    })

    it('should handle multiple frontmatter fields', () => {
      const input = '---\ntitle: "Test"\ndate: 2016-02-10\nauthor: John\n---\n\nContent'
      const result = extractFrontmatter(input)
      expect(result.title).toBe('Test')
      expect(result.date).toBe('2016-02-10')
      expect(result.author).toBe('John')
    })

    it('should handle quoted and unquoted values', () => {
      const input = '---\ntitle: "Quoted Value"\nunquoted: plain text\n---\n\nContent'
      const result = extractFrontmatter(input)
      expect(result.title).toBe('Quoted Value')
      expect(result.unquoted).toBe('plain text')
    })

    it('should handle null/undefined input', () => {
      expect(extractFrontmatter(null)).toEqual({})
      expect(extractFrontmatter(undefined)).toEqual({})
      expect(extractFrontmatter('')).toEqual({})
    })

    it('should handle malformed frontmatter gracefully', () => {
      const input = '---\ninvalid yaml\n---\n\nContent'
      // Should return what it can parse or empty object
      const result = extractFrontmatter(input)
      expect(typeof result).toBe('object')
    })
  })
})
