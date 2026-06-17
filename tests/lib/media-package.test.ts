import { describe, expect, it } from 'vitest'
import { clampImageConcurrency, createMarkdownMediaPackage, normalizeMediaDirectory } from '../../src/lib/media-package'

function readBlobAsText(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

describe('media package config helpers', () => {
  it('normalizes media directory path parts', () => {
    expect(normalizeMediaDirectory(' assets / bad:name ')).toBe('assets/bad_name')
    expect(normalizeMediaDirectory('')).toBe('media')
  })

  it('clamps image concurrency', () => {
    expect(clampImageConcurrency(0)).toBe(1)
    expect(clampImageConcurrency(4.4)).toBe(4)
    expect(clampImageConcurrency(99)).toBe(8)
    expect(clampImageConcurrency(Number.NaN)).toBe(3)
  })
})

describe('createMarkdownMediaPackage', () => {
  it('creates a zip with markdown and downloaded images', async () => {
    const zip = await createMarkdownMediaPackage(
      '![one](https://example.com/images/photo.png)\n![two](https://example.com/missing.jpg)',
      'page.md',
      { mediaDirectory: 'media', imageConcurrency: 2 },
      async (url) => {
        if (url.includes('missing'))
          throw new Error('not found')
        return {
          bytes: new Uint8Array([1, 2, 3]),
          contentType: 'image/png',
        }
      },
    )

    const text = await readBlobAsText(zip)

    expect(zip.type).toBe('application/zip')
    expect(text).toContain('page.md')
    expect(text).toContain('media/photo.png')
    expect(text).toContain('![one](media/photo.png)')
    expect(text).toContain('![two](https://example.com/missing.jpg)')
  })
})
