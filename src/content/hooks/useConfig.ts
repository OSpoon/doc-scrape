import type { SelectionState } from '../types'
import { useEffect } from 'react'
import { getConfig } from '../../lib/config'

/**
 * Load config from storage on mount, listen for remote changes,
 * and write into `stateRef.current.config`. Also resets the cached
 * TurndownService when config changes so it re-creates with new options.
 */
export function useConfig(stateRef: React.MutableRefObject<SelectionState>) {
  useEffect(() => {
    const state = stateRef.current

    function loadConfig() {
      return getConfig().then((config) => {
        state.config = config
        state.turndown = null // force TurndownService re-creation
      })
    }

    function handleStorageChange(changes: Record<string, chrome.storage.StorageChange>) {
      if (changes.docscrape_config)
        void loadConfig()
    }

    void loadConfig()
    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [stateRef])
}
