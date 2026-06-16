import { describe, expect, it } from 'vitest'
import { uiMarker } from '../../../src/content/constants'
import { generateSelector, isDocScrapeUiElement, markUiElement } from '../../../src/content/lib/dom'

describe('generateSelector', () => {
  it('returns "body" for null', () => {
    expect(generateSelector(null)).toBe('body')
  })

  it('returns "body" for document.body', () => {
    expect(generateSelector(document.body)).toBe('body')
  })

  it('returns "body" for document.documentElement', () => {
    expect(generateSelector(document.documentElement)).toBe('body')
  })

  it('uses id selector when element has an id', () => {
    const el = document.createElement('div')
    el.id = 'main-content'
    document.body.appendChild(el)
    try {
      expect(generateSelector(el)).toBe('#main-content')
    }
    finally {
      el.remove()
    }
  })

  it('escapes special characters in id', () => {
    const el = document.createElement('div')
    el.id = 'foo.bar:baz'
    document.body.appendChild(el)
    try {
      // CSS.escape output varies, but special chars must be escaped
      const sel = generateSelector(el)
      expect(sel.startsWith('#')).toBe(true)
      expect(sel).not.toContain('.bar')
      expect(sel).not.toContain(':baz')
    }
    finally {
      el.remove()
    }
  })

  it('builds a tag + class path for elements without id', () => {
    const parent = document.createElement('section')
    parent.className = 'wrapper'
    const child = document.createElement('article')
    child.className = 'post featured'
    parent.appendChild(child)
    document.body.appendChild(parent)
    try {
      const sel = generateSelector(child)
      expect(sel).toMatch(/^section\.wrapper > article\.post\.featured$/)
    }
    finally {
      parent.remove()
    }
  })

  it('adds nth-of-type for sibling disambiguation', () => {
    const parent = document.createElement('ul')
    for (let i = 0; i < 3; i++) {
      const li = document.createElement('li')
      li.className = 'item'
      parent.appendChild(li)
    }
    document.body.appendChild(parent)
    try {
      const second = parent.children[1]
      expect(generateSelector(second)).toBe(`ul > li.item:nth-of-type(2)`)
    }
    finally {
      parent.remove()
    }
  })

  it('stops at nearest id ancestor', () => {
    const ancestor = document.createElement('div')
    ancestor.id = 'root'
    const mid = document.createElement('div')
    mid.className = 'mid'
    const leaf = document.createElement('span')
    ancestor.appendChild(mid)
    mid.appendChild(leaf)
    document.body.appendChild(ancestor)
    try {
      const sel = generateSelector(leaf)
      expect(sel).toBe('#root > div.mid > span')
    }
    finally {
      ancestor.remove()
    }
  })

  it('uses at most 2 class names', () => {
    const el = document.createElement('div')
    el.className = 'a b c d e'
    document.body.appendChild(el)
    try {
      const sel = generateSelector(el)
      expect(sel).toBe('div.a.b')
    }
    finally {
      el.remove()
    }
  })
})

describe('markUiElement', () => {
  it('sets the ui data attribute', () => {
    const div = document.createElement('div')
    markUiElement(div)
    expect(div.hasAttribute(uiMarker)).toBe(true)
  })
})

describe('isDocScrapeUiElement', () => {
  it('returns true for marked elements', () => {
    const div = markUiElement(document.createElement('div'))
    document.body.appendChild(div)
    try {
      expect(isDocScrapeUiElement(div)).toBe(true)
    }
    finally {
      div.remove()
    }
  })

  it('returns true for descendants of marked elements', () => {
    const outer = markUiElement(document.createElement('div'))
    const inner = document.createElement('span')
    outer.appendChild(inner)
    document.body.appendChild(outer)
    try {
      expect(isDocScrapeUiElement(inner)).toBe(true)
    }
    finally {
      outer.remove()
    }
  })

  it('returns false for normal elements', () => {
    const div = document.createElement('div')
    expect(isDocScrapeUiElement(div)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isDocScrapeUiElement(null)).toBe(false)
  })
})
