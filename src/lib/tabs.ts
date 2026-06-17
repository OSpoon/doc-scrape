function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function sendTabMessageWithRetry<T = unknown>(
  tabId: number,
  message: unknown,
  retries = 12,
  delayMs = 150,
) {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await browser.tabs.sendMessage(tabId, message) as T
    }
    catch (error) {
      lastError = error
      await wait(delayMs)
    }
  }
  throw lastError
}
