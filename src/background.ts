import { clampImageConcurrency, createMarkdownMediaPackage, normalizeMediaDirectory } from './lib/media-package'
import { sendTabMessageWithRetry } from './lib/tabs'

const menuItems = [
  {
    id: 'docscrape-select',
    title: '选择导出',
    type: 'enable-selection' as const,
  },
  {
    id: 'docscrape-page',
    title: '全页导出',
    type: 'convert-page' as const,
  },
]

function createMenus() {
  if (!browser.contextMenus)
    return

  browser.contextMenus.removeAll().then(() => {
    for (const item of menuItems) {
      browser.contextMenus.create({
        id: item.id,
        title: item.title,
        contexts: ['page'],
      })
    }
  })
}

createMenus()

browser.runtime.onInstalled.addListener(createMenus)
browser.runtime.onStartup.addListener(createMenus)

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id)
    return

  const item = menuItems.find(item => item.id === info.menuItemId)
  if (!item)
    return

  if (item.type === 'enable-selection') {
    sendTabMessageWithRetry(tab.id, { type: item.type }).catch(() => {})
  }
  else if (item.type === 'convert-page') {
    sendTabMessageWithRetry(tab.id, { type: item.type })
      .then((resp: unknown) => {
        const response = resp as DownloadMessage | undefined
        if (response?.markdown) {
          doDownload({
            type: 'download',
            content: response.markdown,
            filename: response.filename || 'page.md',
            packageImages: response.packageImages,
            mediaDirectory: response.mediaDirectory,
            imageConcurrency: response.imageConcurrency,
          })
        }
      })
      .catch(() => {})
  }
})

interface DownloadMessage {
  type?: string
  content?: string
  markdown?: string
  filename?: string
  packageImages?: boolean
  mediaDirectory?: string
  imageConcurrency?: number
}

function getDownloadFilename(filename: string): string {
  const fallback = 'page.md'
  const name = String(filename || fallback)
    .split(/[\\/]/)
    .filter(Boolean)
    .pop() || fallback
  return name
}

function getZipFilename(filename: string) {
  return `${getDownloadFilename(filename).replace(/\.md$/i, '')}.zip`
}

function downloadUrl(url: string, filename: string): Promise<void> {
  return browser.downloads.download({
    filename: getDownloadFilename(filename),
    url,
    saveAs: false,
    conflictAction: 'uniquify',
  }).then(() => {})
}

function doMarkdownDownload(content: string, filename: string): Promise<void> {
  const dataUrl = `data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`
  return downloadUrl(dataUrl, filename)
}

function doZipDownload(content: string, filename: string, message: DownloadMessage): Promise<void> {
  return createMarkdownMediaPackage(
    content,
    getDownloadFilename(filename),
    {
      mediaDirectory: normalizeMediaDirectory(message.mediaDirectory || 'media'),
      imageConcurrency: clampImageConcurrency(message.imageConcurrency || 3),
    },
    fetchImage,
  ).then((zip) => {
    return blobToDataUrl(zip).then(url => downloadUrl(url, getZipFilename(filename)))
  })
}

function doDownload(message: DownloadMessage): Promise<void> {
  const content = message.content || ''
  const filename = message.filename || ''
  if (message.packageImages)
    return doZipDownload(content, filename, message)
  return doMarkdownDownload(content, filename)
}

browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const msg = message as DownloadMessage
  if (msg?.type === 'download') {
    doDownload(msg)
      .then(() => sendResponse({ success: true }))
      .catch((err: Error) => sendResponse({ error: err.message }))
  }
  return true
})

function fetchImage(url: string) {
  return fetch(url)
    .then((response) => {
      if (!response.ok)
        throw new Error(`HTTP ${response.status}`)
      const contentType = response.headers.get('content-type') || undefined
      return response.arrayBuffer().then(buffer => ({
        bytes: new Uint8Array(buffer),
        contentType,
      }))
    })
}

function blobToDataUrl(blob: Blob) {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer)
    const chunks: string[] = []
    const chunkSize = 0x8000
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      chunks.push(String.fromCharCode(...chunk))
    }
    return `data:${blob.type || 'application/zip'};base64,${btoa(chunks.join(''))}`
  })
}
