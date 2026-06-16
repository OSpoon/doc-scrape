import { describe, expect, it } from 'vitest'
import { applyTemplate, defaultConfig } from '../../src/lib/config'

describe('applyTemplate', () => {
  it('replaces placeholders with values', () => {
    const result = applyTemplate('{{greeting}}, {{name}}!', {
      greeting: 'Hello',
      name: 'World',
    })
    expect(result).toBe('Hello, World!')
  })

  it('replaces missing values with empty string', () => {
    const result = applyTemplate('{{a}}{{b}}{{c}}', { a: '1' })
    expect(result).toBe('1')
  })

  it('handles empty template', () => {
    expect(applyTemplate('', { x: 'y' })).toBe('')
  })

  it('handles no placeholders', () => {
    expect(applyTemplate('plain text', { x: 'y' })).toBe('plain text')
  })

  it('replaces multiple occurrences of the same key', () => {
    const result = applyTemplate('{{x}}-{{x}}', { x: 'dup' })
    expect(result).toBe('dup-dup')
  })

  it('handles the default filename template', () => {
    const result = applyTemplate(defaultConfig.filenameTemplate, {
      title: 'My Page',
      date: '2025-01-15',
      selector: 'body',
    })
    expect(result).toBe('My Page.md')
  })

  it('handles the default frontmatter template', () => {
    const result = applyTemplate(defaultConfig.frontmatterTemplate, {
      title: 'Test',
      url: 'https://example.com',
      date: '2025-06-16',
      selector: '#main',
    })
    expect(result).toContain('title: Test')
    expect(result).toContain('url: https://example.com')
    expect(result).toContain('date: 2025-06-16')
  })
})
