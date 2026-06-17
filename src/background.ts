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

function sendTabMessage(tabId: number, message: Record<string, unknown>) {
  return browser.tabs.sendMessage(tabId, message)
}

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id)
    return

  const item = menuItems.find(item => item.id === info.menuItemId)
  if (!item)
    return

  if (item.type === 'enable-selection') {
    sendTabMessage(tab.id, { type: item.type }).catch(() => {})
  }
  else if (item.type === 'convert-page') {
    sendTabMessage(tab.id, { type: item.type })
      .then((resp: unknown) => {
        const response = resp as { markdown?: string, filename?: string } | undefined
        if (response?.markdown)
          doDownload(response.markdown, response.filename || 'page.md')
      })
      .catch(() => {})
  }
})

function getDownloadFilename(filename: string): string {
  const fallback = 'page.md'
  const name = String(filename || fallback)
    .split(/[\\/]/)
    .filter(Boolean)
    .pop() || fallback
  return name
}

function doDownload(content: string, filename: string): Promise<void> {
  const dataUrl = `data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`
  return browser.downloads.download({
    url: dataUrl,
    filename: getDownloadFilename(filename),
    saveAs: false,
    conflictAction: 'uniquify',
  }).then(() => {})
}

browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const msg = message as { type?: string, content?: string, filename?: string }
  if (msg?.type === 'download') {
    doDownload(msg.content || '', msg.filename || '')
      .then(() => sendResponse({ success: true }))
      .catch((err: Error) => sendResponse({ error: err.message }))
  }
  return true
})
