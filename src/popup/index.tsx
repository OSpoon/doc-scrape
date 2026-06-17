import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

type TabInfo = { id: number, title: string, url: string } | null
const iconUrl = browser.runtime.getURL('icons/icon.png')

function Popup() {
  const [tab, setTab] = useState<TabInfo>(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle')
  const hasTab = Boolean(tab)

  useEffect(() => {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const t = tabs[0]
      if (t?.id !== undefined)
        setTab({ id: t.id, title: t.title || '', url: t.url || '' })
    })
  }, [])

  function sendToTab(message: unknown) {
    if (!tab)
      return Promise.reject(new Error('No active tab'))
    return browser.tabs.sendMessage(tab.id, message)
  }

  function startSelection() {
    if (!hasTab)
      return
    sendToTab({ type: 'enable-selection' }).catch(() => {})
    window.close()
  }

  async function convertPage() {
    if (!tab || saving)
      return
    setSaving(true)
    setStatus('idle')
    try {
      const resp = await sendToTab({ type: 'convert-page' }) as { markdown?: string, filename?: string, error?: string }
      if (resp?.markdown) {
        await browser.runtime.sendMessage({ type: 'download', content: resp.markdown, filename: resp.filename || 'page.md' })
        setStatus('done')
        setTimeout(() => window.close(), 800)
      }
      else {
        setStatus('error')
      }
    }
    catch {
      setStatus('error')
    }
    finally {
      setSaving(false)
    }
  }

  function openOptions() {
    browser.runtime.openOptionsPage()
    window.close()
  }

  return (
    <div className="popup-container">
      <header className="popup-header">
        <div className="popup-brand">
          <img className="popup-icon" src={iconUrl} alt="" aria-hidden="true" />
          <div>
            <h1>DocScrape</h1>
            <span>任意网页转 Markdown</span>
          </div>
        </div>
        <button className="popup-settings" type="button" onClick={openOptions} aria-label="打开设置">
          设置
        </button>
      </header>

      <section className="popup-page" aria-label="当前页面">
        <span className="popup-page-label">当前页面</span>
        <p className="popup-page-title" title={tab?.url || ''}>
          {tab?.title || '无法读取当前标签页'}
        </p>
      </section>

      <div className="popup-actions">
        <button
          className="popup-btn popup-btn-primary"
          type="button"
          onClick={startSelection}
          disabled={!hasTab}
        >
          <span className="popup-btn-title">选择元素</span>
          <span className="popup-btn-subtitle">点选页面区域</span>
        </button>
        <button
          className="popup-btn popup-btn-secondary"
          type="button"
          onClick={convertPage}
          disabled={!hasTab || saving}
        >
          <span className="popup-btn-title">
            {saving ? '导出中...' : status === 'done' ? '已保存' : status === 'error' ? '重试整页' : '导出整页'}
          </span>
          <span className="popup-btn-subtitle">保存为 .md</span>
        </button>
      </div>

      {status !== 'idle' && (
        <p className={`popup-status popup-status-${status}`}>
          {status === 'done' ? 'Markdown 文件已保存。' : '当前页面暂时无法导出。'}
        </p>
      )}
    </div>
  )
}

const root = document.getElementById('root')
if (root)
  createRoot(root).render(<Popup />)
