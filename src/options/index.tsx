import type { DocScrapeConfig } from '../lib/config'
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { defaultConfig, getConfig, saveConfig } from '../lib/config'

const iconUrl = browser.runtime.getURL('icons/icon.png')

function OptionsPage() {
  const [config, setConfig] = useState<DocScrapeConfig | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getConfig().then(setConfig)
  }, [])

  if (!config)
    return <div className="options-loading">加载中...</div>

  function update<K extends keyof DocScrapeConfig>(key: K, value: DocScrapeConfig[K]) {
    if (!config)
      return
    setConfig({ ...config, [key]: value })
    setSaved(false)
  }

  async function handleSave() {
    if (!config)
      return
    setSaving(true)
    await saveConfig(config)
    setSaving(false)
    setSaved(true)
    setTimeout(setSaved, 2000, false)
  }

  function handleReset() {
    setConfig(defaultConfig)
    setSaved(false)
  }

  return (
    <div className="options-container">
      <header className="options-header">
        <div className="options-brand">
          <img className="options-icon" src={iconUrl} alt="" aria-hidden="true" />
          <h1>DocScrape 设置</h1>
        </div>
        <p className="options-desc">配置导出行为与 Markdown 格式</p>
      </header>

      <section className="options-section">
        <h2>常规</h2>
        <div className="options-field">
          <label htmlFor="filenameTemplate">文件名模板</label>
          <input
            id="filenameTemplate"
            type="text"
            value={config.filenameTemplate}
            onChange={e => update('filenameTemplate', e.target.value)}
          />
          <span className="options-hint">{`可用变量：{{title}}、{{date}}、{{selector}}`}</span>
        </div>

        <div className="options-field options-field-row">
          <input
            id="includeFrontmatter"
            type="checkbox"
            checked={config.includeFrontmatter}
            onChange={e => update('includeFrontmatter', e.target.checked)}
          />
          <label htmlFor="includeFrontmatter">导出时添加 YAML frontmatter</label>
        </div>

        {config.includeFrontmatter && (
          <div className="options-field">
            <label htmlFor="frontmatterTemplate">Frontmatter 模板</label>
            <textarea
              id="frontmatterTemplate"
              rows={6}
              value={config.frontmatterTemplate}
              onChange={e => update('frontmatterTemplate', e.target.value)}
            />
          </div>
        )}

      </section>

      <section className="options-section">
        <h2>Markdown</h2>
        <div className="options-field">
          <label htmlFor="headingStyle">标题风格</label>
          <select
            id="headingStyle"
            value={config.headingStyle}
            onChange={e => update('headingStyle', e.target.value as DocScrapeConfig['headingStyle'])}
          >
            <option value="atx"># 号标题（推荐）</option>
            <option value="setext">下划线标题</option>
          </select>
        </div>

        <div className="options-field">
          <label htmlFor="codeBlockStyle">代码块风格</label>
          <select
            id="codeBlockStyle"
            value={config.codeBlockStyle}
            onChange={e => update('codeBlockStyle', e.target.value as DocScrapeConfig['codeBlockStyle'])}
          >
            <option value="fenced">反引号围栏 ```（推荐）</option>
            <option value="indented">4空格缩进</option>
          </select>
        </div>
      </section>

      <div className="options-actions">
        <button className="options-btn-primary" type="button" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : saved ? '已保存 ✓' : '保存设置'}
        </button>
        <button className="options-btn-secondary" type="button" onClick={handleReset}>
          恢复默认
        </button>
      </div>

      <footer className="options-footer">
        右键扩展图标 → 选项，可随时回到此页面。
      </footer>
    </div>
  )
}

const root = document.getElementById('root')
if (root)
  createRoot(root).render(<OptionsPage />)
