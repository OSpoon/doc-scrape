import type { MarkdownConfig, SelectionState } from '../types'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { applyTemplate } from '../../lib/config'
import { uiMarker } from '../constants'

function getTurndown(state: SelectionState, config?: MarkdownConfig) {
  if (!state.turndown) {
    state.turndown = new TurndownService({
      headingStyle: config?.headingStyle || 'atx',
      codeBlockStyle: config?.codeBlockStyle || 'fenced',
      emDelimiter: '*',
      strongDelimiter: '**',
      bulletListMarker: '-',
    })
    state.turndown.use(gfm)
  }
  return state.turndown
}

export function sanitizeFilename(title: string) {
  return title
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 80) || 'page'
}

function formatDate(date = new Date()) {
  return date.toISOString().split('T')[0]
}

function getPageTitle() {
  return sanitizeFilename(document.title || 'untitled')
}

function shouldSkipUrl(value: string) {
  return /^(?:data|blob|javascript|mailto|tel):/i.test(value.trim())
}

function toAbsoluteUrl(value: string, baseUrl: string) {
  const trimmed = value.trim()
  if (!trimmed || shouldSkipUrl(trimmed))
    return value
  try {
    return new URL(trimmed, baseUrl).href
  }
  catch {
    return value
  }
}

function normalizeSrcset(value: string, baseUrl: string) {
  return value
    .split(',')
    .map((candidate) => {
      const parts = candidate.trim().split(/\s+/)
      const url = parts.shift()
      if (!url)
        return ''
      return [toAbsoluteUrl(url, baseUrl), ...parts].join(' ')
    })
    .filter(Boolean)
    .join(', ')
}

function normalizeAttributeUrls(root: ParentNode, baseUrl: string) {
  const urlAttributes = ['href', 'src', 'poster', 'cite', 'action']
  for (const attr of urlAttributes) {
    for (const el of root.querySelectorAll(`[${attr}]`)) {
      const value = el.getAttribute(attr)
      if (value)
        el.setAttribute(attr, toAbsoluteUrl(value, baseUrl))
    }
  }

  for (const el of root.querySelectorAll('[srcset]')) {
    const value = el.getAttribute('srcset')
    if (value)
      el.setAttribute('srcset', normalizeSrcset(value, baseUrl))
  }
}

function removeNonContentNodes(root: ParentNode) {
  for (const el of root.querySelectorAll(`script, style, noscript, template, [${uiMarker}], [data-extension-root="true"]`))
    el.remove()
}

export function normalizeHtmlForMarkdown(html: string) {
  const template = document.createElement('template')
  template.innerHTML = html
  const baseUrl = document.baseURI || window.location.href
  removeNonContentNodes(template.content)
  normalizeAttributeUrls(template.content, baseUrl)
  return template.innerHTML.trim()
}

export function createMarkdownPayload(
  state: SelectionState,
  html: string,
  selector = 'body',
) {
  const config = state.config
  const markdownConfig: MarkdownConfig | undefined = config
    ? { headingStyle: config.headingStyle, codeBlockStyle: config.codeBlockStyle }
    : undefined

  let markdown = getTurndown(state, markdownConfig).turndown(normalizeHtmlForMarkdown(html))

  if (config?.includeFrontmatter) {
    const frontmatter = applyTemplate(config.frontmatterTemplate, {
      title: getPageTitle(),
      url: window.location.href,
      selector,
      date: formatDate(),
    })
    markdown = frontmatter + markdown
  }

  const filename = applyTemplate(config?.filenameTemplate || '{{title}}.md', {
    title: getPageTitle(),
    date: formatDate(),
    selector,
  })

  return { markdown, filename }
}
