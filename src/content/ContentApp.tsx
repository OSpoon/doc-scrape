import { useEffect, useRef, useState } from 'react'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

const isFirefoxLike
  = import.meta.env.EXTENSION_PUBLIC_BROWSER === 'firefox'
    || import.meta.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

const uiMarker = 'data-docscrape-ui'

type RuntimeMessage
  = | { type: 'enable-selection' }
    | { type: 'convert-page' }
    | { type: 'download', content: string, filename: string }

type MessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: { markdown?: string, filename?: string, error?: string }) => void,
) => true | void

type UiState
  = | { mode: 'hidden' }
    | { mode: 'picking' }
    | { mode: 'selected', selector: string }

interface SelectionState {
  selectionEnabled: boolean
  selectedElement: Element | null
  hoveredElement: Element | null
  highlight: HTMLDivElement | null
  turndown: TurndownService | null
  messageListener: MessageListener | null
}

interface SelectionController {
  exitSelection: () => void
  resetSelectionForAnotherPick: () => void
  convertSelected: () => void
}

function sendRuntimeMessage(message: unknown) {
  if (isFirefoxLike)
    browser.runtime.sendMessage(message)
  else
    chrome.runtime.sendMessage(message)
}

type RuntimeMessageListener = Parameters<typeof browser.runtime.onMessage.addListener>[0]

function addRuntimeMessageListener(listener: MessageListener) {
  if (isFirefoxLike)
    browser.runtime.onMessage.addListener(listener as RuntimeMessageListener)
  else
    chrome.runtime.onMessage.addListener(listener as RuntimeMessageListener)
}

function removeRuntimeMessageListener(listener: MessageListener) {
  if (isFirefoxLike)
    browser.runtime.onMessage.removeListener(listener as RuntimeMessageListener)
  else
    chrome.runtime.onMessage.removeListener(listener as RuntimeMessageListener)
}

function getTurndown(state: SelectionState) {
  if (!state.turndown) {
    state.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      strongDelimiter: '**',
      bulletListMarker: '-',
    })
    state.turndown.use(gfm)
  }
  return state.turndown
}

function sanitizeFilename(title: string) {
  return title
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 80) || 'page'
}

function getPageFilename() {
  return `${sanitizeFilename(document.title || 'untitled')}.md`
}

function createMarkdownPayload(state: SelectionState, html: string) {
  return {
    markdown: getTurndown(state).turndown(html),
    filename: getPageFilename(),
  }
}

function markUiElement(el: HTMLElement) {
  el.setAttribute(uiMarker, '')
  return el
}

function generateSelector(el: Element | null): string {
  if (!el || el === document.body || el === document.documentElement)
    return 'body'
  if (el.id)
    return `#${CSS.escape(el.id)}`
  const path: string[] = []
  let current: Element | null = el
  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase()
    if (current.id) {
      path.unshift(`#${CSS.escape(current.id)}`)
      break
    }
    if (typeof (current as HTMLElement).className === 'string') {
      const classes = (current as HTMLElement).className.trim().split(/\s+/).filter(Boolean).slice(0, 2)
      if (classes.length)
        selector += `.${classes.map(c => CSS.escape(c)).join('.')}`
    }
    const parent = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter(s => s.tagName === current?.tagName)
      if (siblings.length > 1)
        selector += `:nth-of-type(${siblings.indexOf(current) + 1})`
    }
    path.unshift(selector)
    current = current.parentElement
  }
  return path.join(' > ')
}

function isDocScrapeUiElement(el: Element | null) {
  return Boolean(el?.closest?.(`[${uiMarker}]`))
}

function Hint({ onExit }: { onExit: () => void }) {
  return (
    <div className="docscrape-hint-layer" {...{ [uiMarker]: '' }}>
      <div className="docscrape-hint">
        <span className="docscrape-hint-dot" />
        <span className="docscrape-hint-text">点击页面元素进行选择</span>
        <button className="docscrape-hint-exit" type="button" onClick={onExit}>
          退出
        </button>
      </div>
    </div>
  )
}

function ConfirmBar(props: {
  selector: string
  onReselect: () => void
  onConvert: () => void
}) {
  return (
    <div className="docscrape-dialog" {...{ [uiMarker]: '' }}>
      <div className="docscrape-dialog-bar">
        <div className="docscrape-dialog-summary">
          <span className="docscrape-dialog-icon">✓</span>
          <span className="docscrape-dialog-title">已选择</span>
          <code className="docscrape-dialog-selector">{props.selector}</code>
        </div>
        <div className="docscrape-dialog-actions">
          <button className="docscrape-secondary" type="button" onClick={props.onReselect}>
            重新选择
          </button>
          <button className="docscrape-primary" type="button" onClick={props.onConvert}>
            转换 Markdown
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ContentApp() {
  const [ui, setUi] = useState<UiState>({ mode: 'hidden' })
  const uiModeRef = useRef(ui.mode)
  const controllerRef = useRef<SelectionController | null>(null)
  const stateRef = useRef<SelectionState>({
    selectionEnabled: false,
    selectedElement: null,
    hoveredElement: null,
    highlight: null,
    turndown: null,
    messageListener: null,
  })

  uiModeRef.current = ui.mode

  useEffect(() => {
    const state = stateRef.current

    function createHighlightOverlay() {
      if (state.highlight)
        return
      const el = markUiElement(document.createElement('div')) as HTMLDivElement
      el.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;display:none;'
      document.body.appendChild(el)
      state.highlight = el
    }

    function updateHighlight(el: Element, isSelected: boolean) {
      const hl = state.highlight
      if (!hl)
        return
      const rect = el.getBoundingClientRect()
      const border = isSelected ? '2px solid #2563eb' : '2px dashed #2563eb'
      const shadow = isSelected
        ? '0 0 0 1px rgba(255,255,255,0.9) inset,0 0 0 4px rgba(37,99,235,0.12)'
        : '0 0 0 1px rgba(255,255,255,0.88) inset'
      hl.style.cssText
        = `position:fixed;pointer-events:none;z-index:2147483646;`
          + `top:${rect.top}px;left:${rect.left}px;`
          + `width:${rect.width}px;height:${rect.height}px;`
          + `border:${border};border-radius:8px;box-sizing:border-box;`
          + `box-shadow:${shadow};background:rgba(37,99,235,0.05);display:block;`
    }

    function hideHighlight() {
      if (state.highlight)
        state.highlight.style.display = 'none'
    }

    function showError(message: string) {
      const msg = markUiElement(document.createElement('div'))
      msg.style.cssText
        = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);'
          + 'z-index:2147483647;background:#991b1b;color:#fff;'
          + 'padding:10px 16px;border-radius:999px;'
          + 'font:700 14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;'
          + 'box-shadow:0 18px 42px rgba(127,29,29,0.25);'
      msg.textContent = `Error: ${message}`
      document.body.appendChild(msg)
      setTimeout(() => msg.remove(), 4000)
    }

    function setListener<T extends EventTarget>(
      target: T,
      enabled: boolean,
      type: string,
      listener: EventListener,
    ) {
      if (enabled)
        target.addEventListener(type, listener, true)
      else
        target.removeEventListener(type, listener, true)
    }

    function clearSelectionState() {
      state.selectedElement = null
      state.hoveredElement = null
    }

    function setPointerSelectionListeners(enabled: boolean) {
      setListener(document, enabled, 'mousemove', handleMouseMove as EventListener)
      setListener(window, enabled, 'scroll', handleScroll as EventListener)
      setListener(document, enabled, 'click', handleClick as EventListener)
    }

    function setSelectionListeners(enabled: boolean) {
      setPointerSelectionListeners(enabled)
      setListener(document, enabled, 'keydown', handleKeyDown as EventListener)
    }

    function showPickingState() {
      clearSelectionState()
      createHighlightOverlay()
      hideHighlight()
      setUi({ mode: 'picking' })
      document.body.style.cursor = 'crosshair'
    }

    function exitSelection() {
      state.selectionEnabled = false
      clearSelectionState()
      setSelectionListeners(false)
      document.body.style.cursor = ''
      hideHighlight()
      setUi({ mode: 'hidden' })
    }

    function resetSelectionForAnotherPick() {
      if (!state.selectionEnabled)
        return
      showPickingState()
      setPointerSelectionListeners(true)
    }

    function doConvert(el: Element) {
      exitSelection()
      try {
        const { markdown, filename } = createMarkdownPayload(state, el.outerHTML)
        sendRuntimeMessage({ type: 'download', content: markdown, filename })
      }
      catch (e) {
        showError(e instanceof Error ? e.message : String(e))
      }
    }

    function convertSelected() {
      if (state.selectedElement)
        doConvert(state.selectedElement)
    }

    function enableSelection() {
      if (state.selectionEnabled)
        return
      state.selectionEnabled = true
      showPickingState()
      setSelectionListeners(true)
    }

    function handleMouseMove(e: MouseEvent) {
      if (!state.selectionEnabled)
        return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (!el || isDocScrapeUiElement(el))
        return
      if (el !== state.hoveredElement) {
        state.hoveredElement = el
        updateHighlight(el, false)
      }
    }

    function handleScroll() {
      if (!state.selectionEnabled || !state.hoveredElement)
        return
      updateHighlight(state.hoveredElement, false)
    }

    function handleClick(e: MouseEvent) {
      if (!state.selectionEnabled)
        return
      const el = e.target instanceof Element ? e.target : null
      if (!el || isDocScrapeUiElement(el))
        return
      e.preventDefault()
      e.stopPropagation()
      state.selectedElement = el
      updateHighlight(el, true)
      setPointerSelectionListeners(false)
      setUi({ mode: 'selected', selector: generateSelector(el) })
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape')
        return
      if (uiModeRef.current === 'selected')
        resetSelectionForAnotherPick()
      else if (state.selectionEnabled)
        exitSelection()
    }

    controllerRef.current = {
      exitSelection,
      resetSelectionForAnotherPick,
      convertSelected,
    }

    state.messageListener = (message, sender, sendResponse) => {
      const msg = message as RuntimeMessage
      if (msg.type === 'enable-selection') {
        enableSelection()
      }
      else if (msg.type === 'convert-page') {
        try {
          const { markdown, filename } = createMarkdownPayload(state, document.body.innerHTML)
          sendResponse({ markdown, filename })
        }
        catch (e) {
          sendResponse({ error: e instanceof Error ? e.message : String(e) })
        }
        return true
      }
    }

    createHighlightOverlay()
    addRuntimeMessageListener(state.messageListener)

    return () => {
      controllerRef.current = null
      exitSelection()
      if (state.highlight) {
        state.highlight.remove()
        state.highlight = null
      }
      if (state.messageListener) {
        removeRuntimeMessageListener(state.messageListener)
        state.messageListener = null
      }
    }
  }, [])

  return (
    <>
      {ui.mode === 'picking' && (
        <Hint onExit={() => controllerRef.current?.exitSelection()} />
      )}
      {ui.mode === 'selected' && (
        <ConfirmBar
          selector={ui.selector}
          onReselect={() => controllerRef.current?.resetSelectionForAnotherPick()}
          onConvert={() => controllerRef.current?.convertSelected()}
        />
      )}
    </>
  )
}
