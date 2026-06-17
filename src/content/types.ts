import type TurndownService from 'turndown'
import type { DocScrapeConfig } from '../lib/config'

export interface MarkdownConfig {
  headingStyle: 'atx' | 'setext'
  codeBlockStyle: 'fenced' | 'indented'
}

export type RuntimeMessage
  = | { type: 'enable-selection' }
    | { type: 'convert-page' }
    | { type: 'download', content: string, filename: string }

export interface SelectionItem {
  element: Element
  selector: string
  markdown: string
}

export interface SelectionHighlight {
  element: Element
  overlay: HTMLDivElement
}

export interface HighlightOps {
  createHighlightOverlay: () => void
  updateHighlight: (el: Element, isSelected: boolean) => void
  createSelectedOverlay: (el: Element) => void
  updateSelectedOverlays: () => void
  clearSelectedOverlays: () => void
  hideHighlight: () => void
  showError: (message: string) => void
}

export type MessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: { markdown?: string, filename?: string, error?: string }) => void,
) => true | void

export type UiState
  = | { mode: 'hidden' }
    | { mode: 'picking', count?: number }
    | {
      mode: 'selected'
      count: number
      selector: string
      markdown: string
      filename: string
      previewOpen: boolean
      copyState: 'idle' | 'copied' | 'failed'
      downloadState: 'idle' | 'saving' | 'done' | 'error'
    }

export interface SelectionState {
  selectionEnabled: boolean
  pointerListenersActive: boolean
  selectedElement: Element | null
  selectedItems: SelectionItem[]
  selectedHighlights: SelectionHighlight[]
  hoveredElement: Element | null
  highlight: HTMLDivElement | null
  turndown: TurndownService | null
  messageListener: MessageListener | null
  config: DocScrapeConfig | null
  highlightOps: HighlightOps | null
}

export interface SelectionController {
  addMoreSelection: () => void
  exitSelection: () => void
  resetSelectionForAnotherPick: () => void
  copySelected: () => void
  downloadSelected: () => void
  togglePreview: () => void
}
