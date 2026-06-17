import type { DocScrapeConfig } from '../lib/config'
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { defaultConfig, getConfig, saveConfig } from '../lib/config'
import { clampImageConcurrency, normalizeMediaDirectory } from '../lib/media-package'

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
    await saveConfig({
      ...config,
      mediaDirectory: normalizeMediaDirectory(config.mediaDirectory),
      imageConcurrency: clampImageConcurrency(config.imageConcurrency),
    })
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
        <h2>实验功能</h2>
        <div className="options-field options-field-row">
          <input
            id="packageImages"
            type="checkbox"
            checked={config.packageImages}
            onChange={e => update('packageImages', e.target.checked)}
          />
          <label htmlFor="packageImages">下载时将 Markdown 与图片打包为 zip</label>
        </div>

        {config.packageImages && (
          <>
            <div className="options-field">
              <label htmlFor="mediaDirectory">媒体文件目录</label>
              <input
                id="mediaDirectory"
                type="text"
                value={config.mediaDirectory}
                onChange={e => update('mediaDirectory', e.target.value)}
                onBlur={() => update('mediaDirectory', normalizeMediaDirectory(config.mediaDirectory))}
              />
              <span className="options-hint">图片会保存到 zip 中的此目录，并在 Markdown 中改写为相对路径。</span>
            </div>

            <div className="options-field">
              <label htmlFor="imageConcurrency">图片下载并发数</label>
              <input
                id="imageConcurrency"
                type="number"
                min="1"
                max="8"
                step="1"
                value={config.imageConcurrency}
                onChange={e => update('imageConcurrency', clampImageConcurrency(Number(e.target.value)))}
              />
              <span className="options-hint">建议 2-4。失败的图片会保留原始 URL，不影响 Markdown 导出。</span>
            </div>
          </>
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
