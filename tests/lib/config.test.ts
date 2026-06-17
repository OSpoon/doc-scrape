import { describe, expect, it } from 'vitest'
import { applyTemplate, defaultConfig, normalizeProfiles, resolveMarkdownProfile } from '../../src/lib/config'

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

describe('markdown profiles', () => {
  it('migrates legacy heading and code block options into the default profile', () => {
    const profiles = normalizeProfiles(undefined, {
      headingStyle: 'setext',
      codeBlockStyle: 'indented',
    })
    expect(profiles[0].headingStyle).toBe('setext')
    expect(profiles[0].codeBlockStyle).toBe('indented')
  })

  it('selects the first profile matching the page URL regex', () => {
    const profile = resolveMarkdownProfile({
      ...defaultConfig,
      profiles: [
        { ...defaultConfig.profiles[0], id: 'default', name: '通用', urlPattern: '' },
        { ...defaultConfig.profiles[0], id: 'zhihu', name: '知乎', urlPattern: 'zhihu\\.com', bulletListMarker: '*' },
      ],
    }, 'https://www.zhihu.com/question/1')

    expect(profile.id).toBe('zhihu')
    expect(profile.bulletListMarker).toBe('*')
  })

  it('falls back to the default profile when regex is invalid or unmatched', () => {
    const profile = resolveMarkdownProfile({
      ...defaultConfig,
      profiles: [
        { ...defaultConfig.profiles[0], id: 'bad', name: '坏规则', urlPattern: '[' },
        { ...defaultConfig.profiles[0], id: 'default', name: '通用', urlPattern: '' },
      ],
    }, 'https://example.com')

    expect(profile.id).toBe('default')
  })
})
