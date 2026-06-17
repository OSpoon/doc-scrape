import type { SelectionState } from '../types'
import { useEffect } from 'react'
import { markUiElement } from '../lib/dom'

/**
 * Manages visual overlays rendered inside the Shadow DOM:
 * - hover highlight (dashed blue border)
 * - selected-element overlays (solid blue border)
 * - error toast notifications
 */
export function useHighlight(
  shadowRoot: ShadowRoot,
  stateRef: React.MutableRefObject<SelectionState>,
) {
  useEffect(() => {
    const state = stateRef.current

    function ensureMounted() {
      const root = shadowRoot.host
      if (root.isConnected)
        return
      document.documentElement.appendChild(root)
    }

    function createHighlightOverlay() {
      ensureMounted()
      if (state.highlight)
        return
      const el = markUiElement(document.createElement('div')) as HTMLDivElement
      el.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;display:none;'
      shadowRoot.appendChild(el)
      state.highlight = el
    }

    function updateHighlight(el: Element, isSelected: boolean) {
      ensureMounted()
      const hl = state.highlight
      if (!hl)
        return
      const rect = el.getBoundingClientRect()
      const border = isSelected ? '2px solid #e61f69' : '2px dashed #e61f69'
      const shadow = isSelected
        ? '0 0 0 1px rgba(255,255,255,0.9) inset,0 0 0 4px rgba(230,31,105,0.12)'
        : '0 0 0 1px rgba(255,255,255,0.88) inset'
      hl.style.cssText
        = `position:fixed;pointer-events:none;z-index:2147483646;`
          + `top:${rect.top}px;left:${rect.left}px;`
          + `width:${rect.width}px;height:${rect.height}px;`
          + `border:${border};border-radius:8px;box-sizing:border-box;`
          + `box-shadow:${shadow};background:rgba(230,31,105,0.05);display:block;`
    }

    function updateSelectedOverlay(overlay: HTMLDivElement, el: Element) {
      ensureMounted()
      const rect = el.getBoundingClientRect()
      overlay.style.cssText
        = `position:fixed;pointer-events:none;z-index:2147483645;`
          + `top:${rect.top}px;left:${rect.left}px;`
          + `width:${rect.width}px;height:${rect.height}px;`
          + `border:2px solid rgba(230,31,105,0.72);border-radius:8px;box-sizing:border-box;`
          + `box-shadow:0 0 0 4px rgba(230,31,105,0.1);background:rgba(230,31,105,0.04);`
    }

    function createSelectedOverlay(el: Element) {
      const overlay = markUiElement(document.createElement('div')) as HTMLDivElement
      updateSelectedOverlay(overlay, el)
      shadowRoot.appendChild(overlay)
      state.selectedHighlights.push({ element: el, overlay })
    }

    function updateSelectedOverlays() {
      for (const item of state.selectedHighlights)
        updateSelectedOverlay(item.overlay, item.element)
    }

    function clearSelectedOverlays() {
      for (const item of state.selectedHighlights)
        item.overlay.remove()
      state.selectedHighlights = []
    }

    function hideHighlight() {
      if (state.highlight)
        state.highlight.style.display = 'none'
    }

    const errorTimeoutIds: ReturnType<typeof setTimeout>[] = []

    function showError(message: string) {
      ensureMounted()
      const msg = markUiElement(document.createElement('div'))
      msg.style.cssText
        = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);'
          + 'z-index:2147483647;background:#991b1b;color:#fff;'
          + 'padding:10px 16px;border-radius:999px;'
          + 'font:700 14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;'
          + 'box-shadow:0 18px 42px rgba(127,29,29,0.25);'
          + 'pointer-events:auto;'
      msg.textContent = `Error: ${message}`
      shadowRoot.appendChild(msg)
      const timeoutId = setTimeout(() => msg.remove(), 4000)
      errorTimeoutIds.push(timeoutId)
    }

    // Attach functions to state so useSelection can call them
    state.highlightOps = {
      ensureMounted,
      createHighlightOverlay,
      updateHighlight,
      createSelectedOverlay,
      updateSelectedOverlays,
      clearSelectedOverlays,
      hideHighlight,
      showError,
    }

    createHighlightOverlay()

    return () => {
      for (const timeoutId of errorTimeoutIds)
        clearTimeout(timeoutId)
      clearSelectedOverlays()
      if (state.highlight) {
        state.highlight.remove()
        state.highlight = null
      }
      state.highlightOps = null
    }
  }, [shadowRoot, stateRef])
}
