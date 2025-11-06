export {};

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.sync.set({ saveHistory: true, maxHistoryItems: 50 })
  }
  // 让点击扩展图标时直接打开侧边栏
  if (chrome.sidePanel?.setOptions) {
    chrome.sidePanel.setOptions({ openPanelOnActionClick: true })
  }
})

// 兜底处理：在部分浏览器版本中需要显式打开侧边栏
if (chrome.action?.onClicked) {
  chrome.action.onClicked.addListener(async (tab) => {
    try {
      const windowId = tab?.windowId
      if (windowId !== undefined && chrome.sidePanel?.open) {
        await chrome.sidePanel.open({ windowId })
      }
    } catch {
      // ignore
    }
  })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return
  const { action, payload } = message as { action: string; payload?: any }
  if (action === "saveToHistory") {
    chrome.storage.local.get(["history"]).then((res) => {
      const history: any[] = Array.isArray(res.history) ? res.history : []
      history.unshift(payload)
      chrome.storage.sync.get(["maxHistoryItems"]).then(({ maxHistoryItems }) => {
        const limit = typeof maxHistoryItems === "number" ? maxHistoryItems : 50
        const sliced = history.slice(0, limit)
        chrome.storage.local.set({ history: sliced })
        sendResponse({ ok: true })
      })
    })
    return true
  }
  if (action === "getHistory") {
    chrome.storage.local.get(["history"]).then((res) => {
      sendResponse({ data: Array.isArray(res.history) ? res.history : [] })
    })
    return true
  }
  if (action === "clearHistory") {
    chrome.storage.local.set({ history: [] }).then(() => sendResponse({ ok: true }))
    return true
  }
})