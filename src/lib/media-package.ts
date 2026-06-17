export interface MediaPackageOptions {
  mediaDirectory: string
  imageConcurrency: number
}

export interface FetchedImage {
  bytes: Uint8Array
  contentType?: string
}

export type FetchImage = (url: string) => Promise<FetchedImage>

interface ImageMatch {
  full: string
  url: string
  title: string
  index: number
}

interface DownloadedImage {
  url: string
  path: string
  bytes: Uint8Array
}

interface ZipEntry {
  path: string
  bytes: Uint8Array
}

const textEncoder = new TextEncoder()

export function clampImageConcurrency(value: number) {
  if (!Number.isFinite(value))
    return 3
  return Math.min(8, Math.max(1, Math.round(value)))
}

export function normalizeMediaDirectory(value: string) {
  const cleaned = value
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .map(part => sanitizePathPart(part))
    .filter(Boolean)
    .join('/')
  return cleaned || 'media'
}

function sanitizePathPart(value: string) {
  return value
    .split('')
    .map(char => char.charCodeAt(0) < 32 ? '_' : char)
    .join('')
    .replace(/[<>:"\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function isDownloadableImageUrl(url: string) {
  return /^https?:\/\//i.test(url.trim())
}

function getExtensionFromContentType(contentType?: string) {
  const type = contentType?.split(';')[0]?.trim().toLowerCase()
  if (type === 'image/jpeg')
    return 'jpg'
  if (type === 'image/png')
    return 'png'
  if (type === 'image/gif')
    return 'gif'
  if (type === 'image/webp')
    return 'webp'
  if (type === 'image/svg+xml')
    return 'svg'
  if (type === 'image/avif')
    return 'avif'
  return ''
}

function getExtensionFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname
    const match = pathname.match(/\.([a-z0-9]{1,8})$/i)
    return match?.[1]?.toLowerCase() || ''
  }
  catch {
    return ''
  }
}

function getBaseNameFromUrl(url: string, fallback: string) {
  try {
    const pathname = new URL(url).pathname
    const last = decodeURIComponent(pathname.split('/').filter(Boolean).at(-1) || '')
    const withoutExt = last.replace(/\.[a-z0-9]{1,8}$/i, '')
    return sanitizePathPart(withoutExt) || fallback
  }
  catch {
    return fallback
  }
}

function getImagePath(url: string, contentType: string | undefined, mediaDirectory: string, index: number, usedPaths: Set<string>) {
  const fallback = `image-${index + 1}`
  const baseName = getBaseNameFromUrl(url, fallback)
  const extension = getExtensionFromUrl(url) || getExtensionFromContentType(contentType) || 'bin'
  let candidate = `${mediaDirectory}/${baseName}.${extension}`
  let suffix = 2
  while (usedPaths.has(candidate)) {
    candidate = `${mediaDirectory}/${baseName}-${suffix}.${extension}`
    suffix += 1
  }
  usedPaths.add(candidate)
  return candidate
}

function parseMarkdownImages(markdown: string) {
  const imageRegex = /!\[[^\]]*\]\(([^)\s]+)(\s+"[^"]*")?\)/g
  const matches: ImageMatch[] = []
  for (const match of markdown.matchAll(imageRegex)) {
    const url = match[1]
    if (!url || match.index === undefined || !isDownloadableImageUrl(url))
      continue
    matches.push({
      full: match[0],
      url,
      title: match[2] || '',
      index: match.index,
    })
  }
  return matches
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>) {
  const results = Array.from({ length: items.length }) as R[]
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index], index)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

export async function createMarkdownMediaPackage(
  markdown: string,
  markdownFilename: string,
  options: MediaPackageOptions,
  fetchImage: FetchImage,
) {
  const mediaDirectory = normalizeMediaDirectory(options.mediaDirectory)
  const concurrency = clampImageConcurrency(options.imageConcurrency)
  const matches = parseMarkdownImages(markdown)
  const urls = Array.from(new Set(matches.map(match => match.url)))
  const usedPaths = new Set<string>()
  const downloadedByUrl = new Map<string, DownloadedImage>()

  await mapWithConcurrency(urls, concurrency, async (url, index) => {
    try {
      const image = await fetchImage(url)
      const path = getImagePath(url, image.contentType, mediaDirectory, index, usedPaths)
      downloadedByUrl.set(url, { url, path, bytes: image.bytes })
    }
    catch {
      // Keep the original remote image URL in Markdown when a download fails.
    }
  })

  let packagedMarkdown = markdown
  const replacements = matches
    .map((match) => {
      const downloaded = downloadedByUrl.get(match.url)
      if (!downloaded)
        return null
      const replacement = match.full.replace(`(${match.url}${match.title})`, `(${downloaded.path}${match.title})`)
      return {
        start: match.index,
        end: match.index + match.full.length,
        replacement,
      }
    })
    .filter((replacement): replacement is { start: number, end: number, replacement: string } => Boolean(replacement))

  for (let i = replacements.length - 1; i >= 0; i--) {
    const replacement = replacements[i]
    packagedMarkdown = `${packagedMarkdown.slice(0, replacement.start)}${replacement.replacement}${packagedMarkdown.slice(replacement.end)}`
  }

  const entries: ZipEntry[] = [
    { path: markdownFilename, bytes: textEncoder.encode(packagedMarkdown) },
    ...Array.from(downloadedByUrl.values()).map(image => ({ path: image.path, bytes: image.bytes })),
  ]

  return createZip(entries)
}

const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let k = 0; k < 8; k++)
    c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
  crcTable[i] = c >>> 0
}

function crc32(bytes: Uint8Array) {
  let crc = 0xFFFFFFFF
  for (const byte of bytes)
    crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear())
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { dosDate, dosTime }
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true)
}

function concat(parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function createZip(entries: ZipEntry[]) {
  const parts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0
  const { dosDate, dosTime } = dosDateTime()

  for (const entry of entries) {
    const name = textEncoder.encode(entry.path)
    const crc = crc32(entry.bytes)
    const localHeader = new Uint8Array(30 + name.length)
    const localView = new DataView(localHeader.buffer)
    writeUint32(localView, 0, 0x04034B50)
    writeUint16(localView, 4, 20)
    writeUint16(localView, 6, 0x0800)
    writeUint16(localView, 8, 0)
    writeUint16(localView, 10, dosTime)
    writeUint16(localView, 12, dosDate)
    writeUint32(localView, 14, crc)
    writeUint32(localView, 18, entry.bytes.length)
    writeUint32(localView, 22, entry.bytes.length)
    writeUint16(localView, 26, name.length)
    localHeader.set(name, 30)
    parts.push(localHeader, entry.bytes)

    const centralHeader = new Uint8Array(46 + name.length)
    const centralView = new DataView(centralHeader.buffer)
    writeUint32(centralView, 0, 0x02014B50)
    writeUint16(centralView, 4, 20)
    writeUint16(centralView, 6, 20)
    writeUint16(centralView, 8, 0x0800)
    writeUint16(centralView, 10, 0)
    writeUint16(centralView, 12, dosTime)
    writeUint16(centralView, 14, dosDate)
    writeUint32(centralView, 16, crc)
    writeUint32(centralView, 20, entry.bytes.length)
    writeUint32(centralView, 24, entry.bytes.length)
    writeUint16(centralView, 28, name.length)
    writeUint32(centralView, 42, offset)
    centralHeader.set(name, 46)
    centralParts.push(centralHeader)

    offset += localHeader.length + entry.bytes.length
  }

  const centralDirectory = concat(centralParts)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  writeUint32(endView, 0, 0x06054B50)
  writeUint16(endView, 8, entries.length)
  writeUint16(endView, 10, entries.length)
  writeUint32(endView, 12, centralDirectory.length)
  writeUint32(endView, 16, offset)

  const zipBytes = concat([...parts, centralDirectory, end])
  const zipBuffer = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength) as ArrayBuffer
  return new Blob([zipBuffer], { type: 'application/zip' })
}
