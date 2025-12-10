import { extractDate, isValidDate } from '../../../backend/scripts/lib/date-parser.js'

describe('date parser', () => {
  describe('extractDate', () => {
    it('should parse abbreviated month format with periods (Feb. 10. 2016)', () => {
      const content = '---\ntitle: Test\n---\n\nFeb. 10. 2016\n\nDear Family,'
      expect(extractDate(content)).toBe('2016-02-10')
    })

    it('should parse full month name format (February 10, 2016)', () => {
      const content = '---\ntitle: Test\n---\n\nFebruary 10, 2016\n\nDear Family,'
      expect(extractDate(content)).toBe('2016-02-10')
    })

    it('should parse numeric format (2/10/2016)', () => {
      const content = '---\ntitle: Test\n---\n\n2/10/2016\n\nDear Family,'
      expect(extractDate(content)).toBe('2016-02-10')
    })

    it('should parse numeric format with leading zeros (02/10/2016)', () => {
      const content = '---\ntitle: Test\n---\n\n02/10/2016\n\nDear Family,'
      expect(extractDate(content)).toBe('2016-02-10')
    })

    it('should parse European style (10 February 2016)', () => {
      const content = '---\ntitle: Test\n---\n\n10 February 2016\n\nDear Family,'
      expect(extractDate(content)).toBe('2016-02-10')
    })

    it('should parse date without frontmatter', () => {
      const content = 'February 10, 2016\n\nDear Family,'
      expect(extractDate(content)).toBe('2016-02-10')
    })

    it('should return null for missing dates', () => {
      const content = '---\ntitle: Test\n---\n\nDear Family,'
      expect(extractDate(content)).toBeNull()
    })

    it('should return null for invalid dates', () => {
      const content = '---\ntitle: Test\n---\n\nFeb. 32. 2016\n\nDear Family,'
      expect(extractDate(content)).toBeNull()
    })

    it('should use first date when multiple dates exist', () => {
      const content = '---\ntitle: Test\n---\n\nFebruary 10, 2016\n\nAs I mentioned on March 5, 2016...'
      expect(extractDate(content)).toBe('2016-02-10')
    })

    it('should handle date ranges (use start date)', () => {
      const content = '---\ntitle: Test\n---\n\nFebruary 10-15, 2016\n\nDear Family,'
      expect(extractDate(content)).toBe('2016-02-10')
    })

    it('should parse abbreviated month without period (Feb 10, 2016)', () => {
      const content = '---\ntitle: Test\n---\n\nFeb 10, 2016\n\nDear Family,'
      expect(extractDate(content)).toBe('2016-02-10')
    })

    it('should search first 10 lines only', () => {
      // After frontmatter is stripped, leading blank lines are trimmed
      // We need 10+ non-blank lines of body content before the date
      const bodyLines = [
        'Line 1 of content',
        'Line 2 of content',
        'Line 3 of content',
        'Line 4 of content',
        'Line 5 of content',
        'Line 6 of content',
        'Line 7 of content',
        'Line 8 of content',
        'Line 9 of content',
        'Line 10 of content',
        'February 10, 2016',
        'Dear Family,'
      ]
      const content = '---\ntitle: Test\n---\n' + bodyLines.join('\n')
      // February 10, 2016 is on line 11 of body (0-indexed: 10), beyond first 10 lines
      expect(extractDate(content)).toBeNull()
    })

    it('should handle December correctly', () => {
      const content = 'December 25, 2015\n\nMerry Christmas!'
      expect(extractDate(content)).toBe('2015-12-25')
    })

    it('should handle ISO format dates in content', () => {
      const content = '2016-02-10\n\nDear Family,'
      expect(extractDate(content)).toBe('2016-02-10')
    })
  })

  describe('isValidDate', () => {
    it('should accept dates in valid range (1950-2025)', () => {
      expect(isValidDate('2016-02-10')).toBe(true)
      expect(isValidDate('1950-01-01')).toBe(true)
      expect(isValidDate('2025-12-31')).toBe(true)
    })

    it('should reject dates outside valid range', () => {
      expect(isValidDate('1949-12-31')).toBe(false)
      expect(isValidDate('2026-01-01')).toBe(false)
    })

    it('should reject invalid date strings', () => {
      expect(isValidDate('invalid')).toBe(false)
      expect(isValidDate('')).toBe(false)
      expect(isValidDate(null)).toBe(false)
    })
  })
})
