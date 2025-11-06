import type { PlasmoContentScript } from "plasmo"

export const config: PlasmoContentScript = {
  matches: [
    "https://*.feishu.cn/*",
    "https://*.larksuite.com/*",
    "https://*.f.mioffice.cn/*",
    "https://*.sg.larksuite.com/*"
  ],
  run_at: "document_end"
}

const isFeishuDocUrl = (url: string) => {
  try {
    const u = new URL(url)
    const hostOk = /feishu\.cn$|larksuite\.com$|f\.mioffice\.cn$|sg\.larksuite\.com$/.test(u.hostname)
    const pathOk = /(docx|wiki|docs)\//.test(u.pathname)
    return hostOk && pathOk
  } catch {
    return false
  }
}

const extractTitle = () => {
  const titleSel = [
    "h1.title", 
    "div[contenteditable='true'] h1",
    "header h1",
    "div[data-testid='doc-title']",
    "div[data-doc-title]"
  ]
  for (const s of titleSel) {
    const el = document.querySelector(s)
    if (el && el.textContent) return el.textContent.trim()
  }
  return document.title.trim()
}

const extractContentHtml = () => {
  const candidates = [
    "div[role='document']",
    "div[data-testid='doc-content']",
    "div[aria-label='Document content']",
    "div[data-editor-root]",
    "main"
  ]
  for (const s of candidates) {
    const el = document.querySelector(s)
    if (el) return el.innerHTML
  }
  return document.body.innerHTML
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return
  const { action } = message as { action: string }
  if (action === "extractFeishuContent") {
    const url = location.href
    if (!isFeishuDocUrl(url)) {
      sendResponse({ ok: false, error: "not-feishu-doc" })
      return
    }
    const title = extractTitle()
    const html = extractContentHtml()
    sendResponse({ ok: true, title, html, url })
  }
})