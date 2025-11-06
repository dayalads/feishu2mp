// 兼容在开发预览或非扩展上下文时缺少 chrome 全局对象的情况
const getChrome = () => (typeof globalThis !== "undefined" ? (globalThis as any).chrome : undefined)
const hasChromeStorage = () => {
  const c = getChrome()
  return !!(c && c.storage && c.storage.sync)
}

export const getCredentials = async () => {
  if (hasChromeStorage()) {
    const c = getChrome() as any
    const all = await (c.storage.sync.get(null) as Promise<Record<string, any>>)
    const idKeys = ["appId", "app_id", "APP_ID"]
    const secretKeys = ["appSecret", "app_secret", "APP_SECRET"]
    let appId = ""
    let appSecret = ""
    for (const k of idKeys) {
      if (typeof all[k] === "string" && all[k]) {
        appId = all[k]
        break
      }
    }
    for (const k of secretKeys) {
      if (typeof all[k] === "string" && all[k]) {
        appSecret = all[k]
        break
      }
    }
    const backendBase = typeof all.backendBase === "string" && all.backendBase ? all.backendBase : "http://localhost:8080"
    return { appId, appSecret, backendBase }
  }

  // Fallback for dev preview without chrome.storage
  const appId = localStorage.getItem("appId") || localStorage.getItem("app_id") || ""
  const appSecret = localStorage.getItem("appSecret") || localStorage.getItem("app_secret") || ""
  const backendBase = localStorage.getItem("backendBase") || "http://localhost:8080"
  return { appId, appSecret, backendBase }
}

export const saveCredentials = async (appId: string, appSecret: string, backendBase?: string) => {
  const obj: Record<string, any> = { appId, appSecret }
  if (backendBase) obj.backendBase = backendBase
  if (hasChromeStorage()) {
    const c = getChrome() as any
    await (c.storage.sync.set(obj) as Promise<void>)
  } else {
    localStorage.setItem("appId", appId)
    localStorage.setItem("appSecret", appSecret)
    if (backendBase) localStorage.setItem("backendBase", backendBase)
  }
}

// 用户自定义主题 JSON 管理
export const getUserThemeJSON = async (): Promise<string | null> => {
  if (hasChromeStorage()) {
    const c = getChrome() as any
    const all = await (c.storage.sync.get(null) as Promise<Record<string, any>>)
    const raw = all.userThemeJSON
    return typeof raw === "string" && raw.trim() ? raw : null
  }
  const raw = localStorage.getItem("userThemeJSON")
  return raw && raw.trim() ? raw : null
}

export const saveUserThemeJSON = async (jsonText: string): Promise<void> => {
  const trimmed = (jsonText || "").trim()
  if (!trimmed) return
  if (hasChromeStorage()) {
    const c = getChrome() as any
    await (c.storage.sync.set({ userThemeJSON: trimmed }) as Promise<void>)
  } else {
    localStorage.setItem("userThemeJSON", trimmed)
  }
}

export const clearUserThemeJSON = async (): Promise<void> => {
  if (hasChromeStorage()) {
    const c = getChrome() as any
    await (c.storage.sync.remove(["userThemeJSON"]) as Promise<void>)
  } else {
    localStorage.removeItem("userThemeJSON")
  }
}