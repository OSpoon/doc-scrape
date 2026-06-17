import type { DocScrapeConfig, MarkdownProfile } from '../lib/config'
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { defaultConfig, defaultMarkdownProfile, getConfig, normalizeProfile, normalizeProfiles, saveConfig } from '../lib/config'
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
      profiles: normalizeProfiles(config.profiles),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(setSaved, 2000, false)
  }

  function handleReset() {
    setConfig(defaultConfig)
    setSaved(false)
  }

  function updateProfile(id: string, patch: Partial<MarkdownProfile>) {
    if (!config)
      return
    setConfig({
      ...config,
      profiles: config.profiles.map(profile => profile.id === id ? { ...profile, ...patch } : profile),
    })
    setSaved(false)
  }

  function addProfile(source?: MarkdownProfile) {
    if (!config)
      return
    const profile = normalizeProfile({
      ...(source || defaultMarkdownProfile),
      id: `profile-${Date.now()}`,
      name: source ? `${source.name} 副本` : '新规则',
      urlPattern: source?.urlPattern || '',
    }, config.profiles.length)
    setConfig({ ...config, profiles: [...config.profiles, profile] })
    setSaved(false)
  }

  function removeProfile(id: string) {
    if (!config || config.profiles.length <= 1)
      return
    setConfig({ ...config, profiles: config.profiles.filter(profile => profile.id !== id) })
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
        <div className="options-section-title-row">
          <h2>Markdown 转换规则</h2>
          <button className="options-btn-small" type="button" onClick={() => addProfile()}>
            新增规则
          </button>
        </div>

        <div className="options-profiles">
          {config.profiles.map((profile, index) => (
            <article className="options-profile" key={profile.id}>
              <div className="options-profile-header">
                <strong>{profile.name || `规则 ${index + 1}`}</strong>
                <div className="options-profile-actions">
                  <button className="options-link" type="button" onClick={() => addProfile(profile)}>
                    复制
                  </button>
                  <button
                    className="options-link options-link-danger"
                    type="button"
                    onClick={() => removeProfile(profile.id)}
                    disabled={config.profiles.length <= 1}
                  >
                    删除
                  </button>
                </div>
              </div>

              <div className="options-field">
                <label htmlFor={`profile-name-${profile.id}`}>规则名称</label>
                <input
                  id={`profile-name-${profile.id}`}
                  type="text"
                  value={profile.name}
                  onChange={e => updateProfile(profile.id, { name: e.target.value })}
                />
              </div>

              <div className="options-field">
                <label htmlFor={`profile-pattern-${profile.id}`}>URL 正则</label>
                <input
                  id={`profile-pattern-${profile.id}`}
                  type="text"
                  value={profile.urlPattern}
                  placeholder={index === 0 ? '留空作为默认规则' : '例如：zhihu\\.com|csdn\\.net'}
                  onChange={e => updateProfile(profile.id, { urlPattern: e.target.value })}
                />
                <span className="options-hint">从上到下匹配，第一条命中的规则会用于当前页面。</span>
              </div>

              <div className="options-profile-grid">
                <div className="options-field">
                  <label htmlFor={`heading-${profile.id}`}>标题风格</label>
                  <select
                    id={`heading-${profile.id}`}
                    value={profile.headingStyle}
                    onChange={e => updateProfile(profile.id, { headingStyle: e.target.value as MarkdownProfile['headingStyle'] })}
                  >
                    <option value="atx"># 号标题</option>
                    <option value="setext">下划线标题</option>
                  </select>
                </div>

                <div className="options-field">
                  <label htmlFor={`code-${profile.id}`}>代码块</label>
                  <select
                    id={`code-${profile.id}`}
                    value={profile.codeBlockStyle}
                    onChange={e => updateProfile(profile.id, { codeBlockStyle: e.target.value as MarkdownProfile['codeBlockStyle'] })}
                  >
                    <option value="fenced">围栏</option>
                    <option value="indented">4 空格缩进</option>
                  </select>
                </div>

                <div className="options-field">
                  <label htmlFor={`fence-${profile.id}`}>围栏字符</label>
                  <select
                    id={`fence-${profile.id}`}
                    value={profile.fence}
                    onChange={e => updateProfile(profile.id, { fence: e.target.value as MarkdownProfile['fence'] })}
                  >
                    <option value="```">```</option>
                    <option value="~~~">~~~</option>
                  </select>
                </div>

                <div className="options-field">
                  <label htmlFor={`bullet-${profile.id}`}>列表符号</label>
                  <select
                    id={`bullet-${profile.id}`}
                    value={profile.bulletListMarker}
                    onChange={e => updateProfile(profile.id, { bulletListMarker: e.target.value as MarkdownProfile['bulletListMarker'] })}
                  >
                    <option value="-">-</option>
                    <option value="+">+</option>
                    <option value="*">*</option>
                  </select>
                </div>

                <div className="options-field">
                  <label htmlFor={`em-${profile.id}`}>斜体符号</label>
                  <select
                    id={`em-${profile.id}`}
                    value={profile.emDelimiter}
                    onChange={e => updateProfile(profile.id, { emDelimiter: e.target.value as MarkdownProfile['emDelimiter'] })}
                  >
                    <option value="*">*</option>
                    <option value="_">_</option>
                  </select>
                </div>

                <div className="options-field">
                  <label htmlFor={`strong-${profile.id}`}>加粗符号</label>
                  <select
                    id={`strong-${profile.id}`}
                    value={profile.strongDelimiter}
                    onChange={e => updateProfile(profile.id, { strongDelimiter: e.target.value as MarkdownProfile['strongDelimiter'] })}
                  >
                    <option value="**">**</option>
                    <option value="__">__</option>
                  </select>
                </div>

                <div className="options-field">
                  <label htmlFor={`link-${profile.id}`}>链接风格</label>
                  <select
                    id={`link-${profile.id}`}
                    value={profile.linkStyle}
                    onChange={e => updateProfile(profile.id, { linkStyle: e.target.value as MarkdownProfile['linkStyle'] })}
                  >
                    <option value="inlined">行内链接</option>
                    <option value="referenced">引用链接</option>
                  </select>
                </div>

                <div className="options-field">
                  <label htmlFor={`link-ref-${profile.id}`}>引用链接</label>
                  <select
                    id={`link-ref-${profile.id}`}
                    value={profile.linkReferenceStyle}
                    onChange={e => updateProfile(profile.id, { linkReferenceStyle: e.target.value as MarkdownProfile['linkReferenceStyle'] })}
                  >
                    <option value="full">完整</option>
                    <option value="collapsed">折叠</option>
                    <option value="shortcut">快捷</option>
                  </select>
                </div>

                <div className="options-field">
                  <label htmlFor={`hr-${profile.id}`}>分割线</label>
                  <input
                    id={`hr-${profile.id}`}
                    type="text"
                    value={profile.hr}
                    onChange={e => updateProfile(profile.id, { hr: e.target.value })}
                  />
                </div>

                <div className="options-field">
                  <label htmlFor={`br-${profile.id}`}>换行</label>
                  <input
                    id={`br-${profile.id}`}
                    type="text"
                    value={profile.br}
                    onChange={e => updateProfile(profile.id, { br: e.target.value })}
                  />
                </div>
              </div>

              <div className="options-field options-field-row">
                <input
                  id={`pre-${profile.id}`}
                  type="checkbox"
                  checked={profile.preformattedCode}
                  onChange={e => updateProfile(profile.id, { preformattedCode: e.target.checked })}
                />
                <label htmlFor={`pre-${profile.id}`}>保留 pre 中的原始代码格式</label>
              </div>
            </article>
          ))}
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
