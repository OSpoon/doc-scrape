import { ConfirmBar } from './components/ConfirmBar'
import { Hint } from './components/Hint'
import { useSelection } from './hooks/useSelection'

export default function ContentApp({ shadowRoot }: { shadowRoot: ShadowRoot }) {
  const { ui, controllerRef } = useSelection(shadowRoot)

  return (
    <>
      {ui.mode === 'picking' && (
        <Hint count={ui.count || 0} onExit={() => controllerRef.current?.exitSelection()} />
      )}
      {ui.mode === 'selected' && (
        <ConfirmBar
          copyState={ui.copyState}
          count={ui.count}
          downloadState={ui.downloadState}
          filename={ui.filename}
          markdown={ui.markdown}
          previewOpen={ui.previewOpen}
          selector={ui.selector}
          onAddMore={() => controllerRef.current?.addMoreSelection()}
          onClose={() => controllerRef.current?.exitSelection()}
          onCopy={() => controllerRef.current?.copySelected()}
          onDownload={() => controllerRef.current?.downloadSelected()}
          onTogglePreview={() => controllerRef.current?.togglePreview()}
        />
      )}
    </>
  )
}
