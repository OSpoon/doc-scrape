import type { RuntimeMessage, SelectionController, SelectionItem, SelectionState, UiState } from '../types'
import { useEffect, useRef, useState } from 'react'
import { generateSelector, isDocScrapeUiElement, markUiElement } from '../lib/dom'
import { createMarkdownPayload } from '../lib/markdown'
import { addRuntimeMessageListener, removeRuntimeMessageListener, sendRuntimeMessage } from '../lib/runtime'
import { useConfig } from './useConfig'
import { useHighlight } from './useHighlight'

export function useSelection(shadowRoot: ShadowRoot) {
  const [ui, setUi] = useState<UiState>({ mode: 'hidden' })
  const uiRef = useRef(ui)
  const controllerRef = useRef<SelectionController | null>(null)
  const stateRef = useRef<SelectionState>({
    selectionEnabled: false,
    pointerListenersActive: false,
    selectedElement: null,
    selectedItems: [],
    selectedHighlights: [],
    hoveredElement: null,
    highlight: null,
    turndown: null,
    messageListener: null,
    config: null,
    highlightOps: null,
  })

  uiRef.current = ui

  // Delegate config loading + storage-change listening
  useConfig(stateRef)

  // Delegate highlight / selected overlays / error toast
  useHighlight(shadowRoot, stateRef)

  useEffect(() => {
    const state = stateRef.current
    const errorTimeoutIds: ReturnType<typeof setTimeout>[] = []

    function clearSelectionState() {
      state.selectedElement = null
      state.selectedItems = []
      state.hoveredElement = null
      state.highlightOps?.clearSelectedOverlays()
    }

    function showPickingState() {
      clearSelectionState()
      state.highlightOps?.createHighlightOverlay()
      state.highlightOps?.hideHighlight()
      setUi({ mode: 'picking', count: 0 })
      document.body.style.cursor = 'crosshair'
    }

    function exitSelection() {
      state.selectionEnabled = false
      state.pointerListenersActive = false
      clearSelectionState()
      document.body.style.cursor = ''
      state.highlightOps?.hideHighlight()
      setUi({ mode: 'hidden' })
    }

    function resetSelectionForAnotherPick() {
      if (!state.selectionEnabled)
        return
      showPickingState()
      state.pointerListenersActive = true
    }

    function addMoreSelection() {
      if (!state.selectionEnabled)
        state.selectionEnabled = true
      state.pointerListenersActive = true
      state.selectedElement = null
      state.hoveredElement = null
      state.highlightOps?.createHighlightOverlay()
      state.highlightOps?.hideHighlight()
      setUi({ mode: 'picking', count: state.selectedItems.length })
      document.body.style.cursor = 'crosshair'
    }

    function getCombinedMarkdown(items: SelectionItem[]) {
      return items
        .map(item => item.markdown.trim())
        .filter(Boolean)
        .join('\n\n---\n\n')
    }

    function getSelectionSummary(items: SelectionItem[]) {
      const latest = items.at(-1)
      if (!latest)
        return 'body'
      if (items.length === 1)
        return latest.selector
      return `${items.length} 个元素 · ${latest.selector}`
    }

    async function setSelectedElement(el: Element) {
      try {
        const selector = generateSelector(el)
        const { markdown, filename } = createMarkdownPayload(state, el.outerHTML, selector)
        const item = {
          element: el,
          selector,
          markdown,
        }
        state.selectedItems = [...state.selectedItems, item]
        state.selectedElement = el
        state.highlightOps?.createSelectedOverlay(el)
        state.highlightOps?.hideHighlight()
        state.pointerListenersActive = false
        setUi({
          mode: 'selected',
          count: state.selectedItems.length,
          selector: getSelectionSummary(state.selectedItems),
          markdown: getCombinedMarkdown(state.selectedItems),
          filename,
          previewOpen: true,
          copyState: 'idle',
          downloadState: 'idle',
        })
      }
      catch (e) {
        state.highlightOps?.showError(e instanceof Error ? e.message : String(e))
      }
    }

    async function writeClipboard(text: string) {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return
      }

      const textarea = markUiElement(document.createElement('textarea'))
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;'
      document.body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand('copy')
      textarea.remove()
      if (!copied)
        throw new Error('Clipboard copy failed')
    }

    function copySelected() {
      const current = uiRef.current
      if (current.mode !== 'selected')
        return
      setUi({ ...current, copyState: 'idle' })
      void writeClipboard(current.markdown)
        .then(() => {
          setUi((latest) => {
            if (latest.mode !== 'selected')
              return latest
            return { ...latest, copyState: 'copied' }
          })
        })
        .catch(() => {
          setUi((latest) => {
            if (latest.mode !== 'selected')
              return latest
            return { ...latest, copyState: 'failed' }
          })
        })
    }

    function downloadSelected() {
      const current = uiRef.current
      if (current.mode !== 'selected' || current.downloadState === 'saving')
        return
      setUi({ ...current, downloadState: 'saving' })
      sendRuntimeMessage({
        type: 'download',
        content: current.markdown,
        filename: current.filename,
        packageImages: state.config?.packageImages,
        mediaDirectory: state.config?.mediaDirectory,
        imageConcurrency: state.config?.imageConcurrency,
      })
        .then(() => {
          if (uiRef.current.mode !== 'selected')
            return
          setUi((latest) => {
            if (latest.mode !== 'selected')
              return latest
            return { ...latest, downloadState: 'done' }
          })
          // eslint-disable-next-line react/web-api-no-leaked-timeout
          const dlTimeoutId = setTimeout(() => {
            if (uiRef.current.mode === 'selected')
              exitSelection()
          }, 1200)
          errorTimeoutIds.push(dlTimeoutId)
        })
        .catch(() => {
          if (uiRef.current.mode !== 'selected')
            return
          setUi((latest) => {
            if (latest.mode !== 'selected')
              return latest
            return { ...latest, downloadState: 'error' }
          })
        })
    }

    function togglePreview() {
      setUi((current) => {
        if (current.mode !== 'selected')
          return current
        return { ...current, previewOpen: !current.previewOpen }
      })
    }

    function enableSelection() {
      if (state.selectionEnabled)
        return
      state.selectionEnabled = true
      state.pointerListenersActive = true
      showPickingState()
    }

    function handleMouseMove(e: MouseEvent) {
      if (!state.selectionEnabled || !state.pointerListenersActive)
        return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (!el || isDocScrapeUiElement(el))
        return
      if (el !== state.hoveredElement) {
        state.hoveredElement = el
        state.highlightOps?.updateHighlight(el, false)
      }
    }

    function handleScroll() {
      state.highlightOps?.updateSelectedOverlays()
      if (state.selectionEnabled && state.pointerListenersActive) {
        state.highlightOps?.hideHighlight()
        state.hoveredElement = null
      }
    }

    function handleClick(e: MouseEvent) {
      if (!state.selectionEnabled || !state.pointerListenersActive)
        return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (!el || isDocScrapeUiElement(el))
        return
      e.preventDefault()
      e.stopPropagation()
      setSelectedElement(el)
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape')
        return
      if (uiRef.current.mode === 'selected') {
        resetSelectionForAnotherPick()
      }
      else {
        exitSelection()
      }
    }

    controllerRef.current = {
      addMoreSelection,
      exitSelection,
      resetSelectionForAnotherPick,
      copySelected,
      downloadSelected,
      togglePreview,
    }

    state.messageListener = (message, sender, sendResponse) => {
      const msg = message as RuntimeMessage
      if (msg.type === 'enable-selection') {
        enableSelection()
      }
      else if (msg.type === 'convert-page') {
        void (async () => {
          try {
            const { markdown, filename } = createMarkdownPayload(state, document.body.innerHTML, 'body')
            sendResponse({
              markdown,
              filename,
              packageImages: state.config?.packageImages,
              mediaDirectory: state.config?.mediaDirectory,
              imageConcurrency: state.config?.imageConcurrency,
            })
          }
          catch (e) {
            sendResponse({ error: e instanceof Error ? e.message : String(e) })
          }
        })()
        return true
      }
    }

    addRuntimeMessageListener(state.messageListener)

    document.addEventListener('mousemove', handleMouseMove, true)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleScroll, true)
    document.addEventListener('click', handleClick, true)
    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      controllerRef.current = null
      document.removeEventListener('mousemove', handleMouseMove, true)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll, true)
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      for (const timeoutId of errorTimeoutIds)
        clearTimeout(timeoutId)
      state.selectionEnabled = false
      state.pointerListenersActive = false
      clearSelectionState()
      document.body.style.cursor = ''
      state.highlightOps?.hideHighlight()
      setUi({ mode: 'hidden' })
      if (state.messageListener) {
        removeRuntimeMessageListener(state.messageListener)
        state.messageListener = null
      }
    }
  }, [shadowRoot])

  return { ui, controllerRef }
}
