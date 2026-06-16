import { describe, expect, it } from 'vitest'
import { markUiElement } from '../../../src/content/lib/dom'
import { createMarkdownPayload, normalizeHtmlForMarkdown, sanitizeFilename } from '../../../src/content/lib/markdown'

describe('sanitizeFilename', () => {
  it('replaces angle brackets with underscores', () => {
    expect(sanitizeFilename('a<b>c')).toBe('a_b_c')
  })

  it('replaces colons and quotes', () => {
    expect(sanitizeFilename('a:"b"')).toBe('a_b')
  })

  it('replaces slashes and pipes', () => {
    expect(sanitizeFilename('a/b\\c|d')).toBe('a_b_c_d')
  })

  it('replaces question marks and asterisks', () => {
    expect(sanitizeFilename('a?b*c')).toBe('a_b_c')
  })

  it('collapses whitespace to single underscore', () => {
    expect(sanitizeFilename('hello   world')).toBe('hello_world')
  })

  it('collapses consecutive underscores', () => {
    expect(sanitizeFilename('a<>:"b"')).toBe('a_b')
  })

  it('trims leading and trailing underscores', () => {
    expect(sanitizeFilename('  hello  ')).toBe('hello')
  })

  it('truncates to 80 characters', () => {
    const long = 'a'.repeat(100)
    expect(sanitizeFilename(long).length).toBe(80)
  })

  it('returns "page" for empty/whitespace-only input', () => {
    expect(sanitizeFilename('')).toBe('page')
    expect(sanitizeFilename('   ')).toBe('page')
    expect(sanitizeFilename('___')).toBe('page')
  })
})

describe('normalizeHtmlForMarkdown', () => {
  it('removes script and style tags', () => {
    const html = '<div><script>alert(1)</script><style>a{}</style><p>text</p></div>'
    const result = normalizeHtmlForMarkdown(html)
    expect(result).not.toContain('script')
    expect(result).not.toContain('style')
    expect(result).toContain('<p>text</p>')
  })

  it('removes noscript and template tags', () => {
    const html = '<div><noscript>ns</noscript><template>tmpl</template><p>ok</p></div>'
    const result = normalizeHtmlForMarkdown(html)
    expect(result).not.toContain('noscript')
    expect(result).not.toContain('template')
    expect(result).toContain('<p>ok</p>')
  })

  it('removes docscrape UI elements', () => {
    const uiEl = markUiElement(document.createElement('div'))
    uiEl.textContent = 'ui'
    const wrapper = document.createElement('div')
    wrapper.appendChild(uiEl)
    const p = document.createElement('p')
    p.textContent = 'content'
    wrapper.appendChild(p)
    const result = normalizeHtmlForMarkdown(wrapper.outerHTML)
    expect(result).not.toContain('ui')
    expect(result).toContain('content')
  })

  it('removes extension root elements', () => {
    const root = document.createElement('div')
    root.setAttribute('data-extension-root', 'true')
    root.textContent = 'root'
    const wrapper = document.createElement('div')
    wrapper.appendChild(root)
    const result = normalizeHtmlForMarkdown(wrapper.outerHTML)
    expect(result).not.toContain('root')
  })

  it('converts relative href to absolute', () => {
    const html = '<a href="/relative/path">link</a>'
    const result = normalizeHtmlForMarkdown(html)
    // Should become absolute based on document.baseURI
    expect(result).toContain('href="')
    expect(result).not.toContain('href="/relative/path"')
  })

  it('converts relative src to absolute', () => {
    const html = '<img src="/img/photo.png">'
    const result = normalizeHtmlForMarkdown(html)
    expect(result).not.toContain('src="/img/photo.png"')
  })

  it('converts srcset URLs to absolute', () => {
    const html = '<img srcset="/a.jpg 1x, /b.jpg 2x">'
    const result = normalizeHtmlForMarkdown(html)
    // Relative paths should be resolved to absolute (containing ://)
    expect(result).toContain('://')
    // The srcset value should not have bare relative paths
    expect(result).not.toMatch(/srcset="\/[^/]/)
  })

  it('skips data: and javascript: URLs', () => {
    const html = '<img src="data:image/png,abc">'
    const result = normalizeHtmlForMarkdown(html)
    expect(result).toContain('data:image/png,abc')
  })
})

describe('createMarkdownPayload', () => {
  const baseState = () => ({
    selectionEnabled: false,
    pointerListenersActive: false,
    selectedElement: null,
    selectedItems: [],
    selectedHighlights: [],
    hoveredElement: null,
    highlight: null,
    turndown: null,
    messageListener: null,
    config: null,
    highlightOps: null,
  })

  it('converts basic HTML to markdown', () => {
    const state = baseState()
    const { markdown } = createMarkdownPayload(state, '<h1>Hello</h1><p>World</p>', 'h1')
    expect(markdown).toContain('Hello')
    expect(markdown).toContain('World')
  })

  it('includes frontmatter when config says so', () => {
    const state = {
      ...baseState(),
      config: {
        includeFrontmatter: true,
        frontmatterTemplate: '---\ntitle: {{title}}\n---\n\n',
        downloadImages: false,
        filenameTemplate: '{{title}}.md',
        headingStyle: 'atx' as const,
        codeBlockStyle: 'fenced' as const,
      },
    }
    const { markdown } = createMarkdownPayload(state, '<p>text</p>', 'p')
    expect(markdown).toContain('---')
    expect(markdown).toContain('title:')
  })

  it('skips frontmatter when config says false', () => {
    const state = {
      ...baseState(),
      config: {
        includeFrontmatter: false,
        frontmatterTemplate: '',
        downloadImages: false,
        filenameTemplate: '{{title}}.md',
        headingStyle: 'atx' as const,
        codeBlockStyle: 'fenced' as const,
      },
    }
    const { markdown } = createMarkdownPayload(state, '<p>text</p>', 'p')
    expect(markdown).not.toContain('---')
  })

  it('returns a filename based on template', () => {
    const state = baseState()
    const { filename } = createMarkdownPayload(state, '<p>x</p>', '#main')
    expect(filename).toContain('.md')
    expect(filename.length).toBeGreaterThan(3)
  })
})
