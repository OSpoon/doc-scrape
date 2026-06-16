import { marked } from 'marked'
import { useMemo, useState } from 'react'
import { uiMarker } from '../constants'

export function ConfirmBar(props: {
  copyState: 'idle' | 'copied' | 'failed'
  count: number
  filename: string
  markdown: string
  previewOpen: boolean
  selector: string
  downloadState: 'idle' | 'saving' | 'done' | 'error'
  onAddMore: () => void
  onClose: () => void
  onCopy: () => void
  onDownload: () => void
  onTogglePreview: () => void
}) {
  const copyText = props.copyState === 'copied'
    ? '已复制'
    : props.copyState === 'failed' ? '复制失败' : '复制'
  const markdownSize = `${props.markdown.length} 字符`
  const previewText = props.previewOpen ? '收起预览' : '预览'
  const title = props.count > 1 ? `已转换 ${props.count} 项` : '已转换'
  const [renderedView, setRenderedView] = useState(true)
  const renderedHtml = useMemo(() => marked.parse(props.markdown) as string, [props.markdown])

  const tips = '重新选择请按ESC键'

  function getDownloadText() {
    if (props.downloadState === 'saving')
      return '保存中...'
    if (props.downloadState === 'done')
      return '已保存 ✓'
    if (props.downloadState === 'error')
      return '保存失败，重试'
    return '下载 Markdown'
  }

  return (
    <div className="docscrape-dialog" {...{ [uiMarker]: '' }}>
      <div className="docscrape-dialog-shell">
        {props.previewOpen && (
          <div className="docscrape-preview">
            <div className="docscrape-preview-header">
              <span className="docscrape-preview-title">{props.filename}</span>
              <div className="docscrape-preview-header-actions">
                <span className="docscrape-preview-count">{markdownSize}</span>
                <button className="docscrape-preview-copy" type="button" onClick={props.onCopy}>
                  {copyText}
                </button>
                <button className="docscrape-preview-toggle" type="button" onClick={() => setRenderedView(v => !v)}>
                  {renderedView ? '源码' : '渲染'}
                </button>
              </div>
            </div>
            {renderedView
              ? (
                  // eslint-disable-next-line react/dom-no-dangerously-set-innerhtml
                  <div className="docscrape-preview-rendered" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
                )
              : (
                  <textarea className="docscrape-preview-content" readOnly value={props.markdown} />
                )}
          </div>
        )}
        <div className="docscrape-dialog-bar">
          <div className="docscrape-dialog-row-primary">
            <div className="docscrape-dialog-summary">
              <span className="docscrape-dialog-icon">✓</span>
              <span className="docscrape-dialog-title">{title}</span>
              <code className="docscrape-dialog-selector">{props.selector}</code>
            </div>
            <div className="docscrape-dialog-tips">
              Tips：
              {tips}
            </div>
            <div className="docscrape-dialog-actions-primary">
              <button className="docscrape-close" type="button" aria-label="退出" onClick={props.onClose}>
                ×
              </button>
            </div>
          </div>
          <div className="docscrape-dialog-row-secondary">
            <button className="docscrape-secondary" type="button" onClick={props.onTogglePreview}>
              {previewText}
            </button>
            <button className="docscrape-secondary" type="button" onClick={props.onAddMore}>
              继续添加
            </button>
            <button className="docscrape-primary" type="button" onClick={props.onDownload} disabled={props.downloadState === 'saving'}>
              {getDownloadText()}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
