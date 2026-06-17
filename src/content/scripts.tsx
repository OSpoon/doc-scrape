import ReactDOM from 'react-dom/client'
import { uiMarker } from './constants'
import ContentApp from './ContentApp'
import './styles.css'

/**
 * Extension.js content_script entrypoint. The framework calls this on
 * injection and calls the returned function on HMR/teardown to clean up.
 * Do not invoke it yourself.
 */
export default function initial() {
  let cleanup: (() => void) | null = null
  let cancelled = false

  const stopWaiting = whenDocumentElementReady(() => {
    if (!cancelled)
      cleanup = mount()
  })

  return () => {
    cancelled = true
    stopWaiting()
    cleanup?.()
  }
}

function mount() {
  const rootDiv = document.createElement('div')
  rootDiv.setAttribute('data-extension-root', 'true')
  rootDiv.setAttribute(uiMarker, '')
  rootDiv.style.cssText
    = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;overflow:visible;'
  document.documentElement.appendChild(rootDiv)

  // Injecting content_scripts inside a shadow dom
  // prevents conflicts with the host page's styles.
  // This way, styles from the extension won't leak into the host page.
  const shadowRoot = rootDiv.attachShadow({ mode: 'open' })

  const styleElement = document.createElement('style')
  shadowRoot.appendChild(styleElement)

  fetchCSS().then(response => styleElement.textContent = response)

  const mountingPoint = ReactDOM.createRoot(shadowRoot)
  mountingPoint.render(
    <div className="content_script">
      <ContentApp shadowRoot={shadowRoot} />
    </div>,
  )

  return () => {
    mountingPoint.unmount()
    rootDiv.remove()
  }
}

function whenDocumentElementReady(callback: () => void) {
  if (document.documentElement) {
    callback()
    return () => {}
  }

  const observer = new MutationObserver(() => {
    if (!document.documentElement)
      return
    observer.disconnect()
    callback()
  })
  observer.observe(document, { childList: true, subtree: true })
  return () => observer.disconnect()
}

async function fetchCSS() {
  const cssUrl = new URL('./styles.css', import.meta.url)
  const response = await fetch(cssUrl)
  const text = await response.text()
  return response.ok ? text : Promise.reject(text)
}
