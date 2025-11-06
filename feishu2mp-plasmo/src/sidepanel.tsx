import { useEffect, useMemo, useState } from "react"
import { convertByBackend, copyToClipboard, copyHtmlToClipboard, downloadHtml, markdownByBackend, downloadMarkdown } from "./lib/convert"
import { getCredentials } from "./lib/storage"

type Status = { type: "idle" | "info" | "success" | "error"; text: string }

const SidePanel = () => {
  const [wechatStatus, setWechatStatus] = useState<Status>({ type: "idle", text: "" })
  const [resultHtml, setResultHtml] = useState("")
  const [processingWechat, setProcessingWechat] = useState(false)

  const [docUrl, setDocUrl] = useState("")
  const [mdStatus, setMdStatus] = useState<Status>({ type: "idle", text: "" })
  const [markdown, setMarkdown] = useState("")
  const [processingMd, setProcessingMd] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  const statusStyleWechat = useMemo(() => {
    switch (wechatStatus.type) {
      case "info":
        return { background: "#f6fafe", color: "#074799" }
      case "success":
        return { background: "#f2fbf1", color: "#137329" }
      case "error":
        return { background: "#fff5f5", color: "#991b1b" }
      default:
        return { background: "transparent", color: "inherit" }
    }
  }, [wechatStatus])

  const statusStyleMd = useMemo(() => {
    switch (mdStatus.type) {
      case "info":
        return { background: "#f6fafe", color: "#074799" }
      case "success":
        return { background: "#f2fbf1", color: "#137329" }
      case "error":
        return { background: "#fff5f5", color: "#991b1b" }
      default:
        return { background: "transparent", color: "inherit" }
    }
  }, [mdStatus])

  const getChrome = () => (typeof globalThis !== "undefined" ? (globalThis as any).chrome : undefined)
  const getActiveTab = () => new Promise<any>((resolve, reject) => {
    const c = getChrome()
    if (!c?.tabs?.query) {
      reject(new Error("no-active-tab"))
      return
    }
    c.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
      if (tabs && tabs[0]) resolve(tabs[0])
      else reject(new Error("no-active-tab"))
    })
  })

  const isFeishuDocUrl = (url?: string) => {
    if (!url) return false
    try {
      const u = new URL(url)
      const hostOk = /feishu\.cn$|larksuite\.com$|f\.mioffice\.cn$|sg\.larksuite\.com$/.test(u.hostname)
      const pathOk = /(docx|wiki|docs)\//.test(u.pathname)
      return hostOk && pathOk
    } catch {
      return false
    }
  }

  // 更稳的 URL 解析：优先取活动标签页 URL，失败则由内容脚本返回
  const resolveDocUrl = async (): Promise<string> => {
    try {
      const tab = await getActiveTab()
      const direct = tab?.url || ""
      if (isFeishuDocUrl(direct)) return direct
      const c = getChrome()
      if (tab?.id && c?.tabs?.sendMessage) {
        try {
          const res = await new Promise<any>((resolve, reject) => {
            c.tabs.sendMessage(tab.id, { action: "extractFeishuContent" }, (response: any) => {
              const last = (c.runtime as any)?.lastError
              if (last?.message) reject(new Error(last.message))
              else resolve(response)
            })
          })
          const fromContent = res?.url || ""
          if (isFeishuDocUrl(fromContent)) return fromContent
        } catch {
          // ignore content-script errors
        }
      }
    } catch {
      // ignore
    }
    return ""
  }

  const onConvertWechat = async () => {
    setProcessingWechat(true)
    setResultHtml("")
    setWechatStatus({ type: "info", text: "正在转换..." })
    try {
      const urlToUse = await resolveDocUrl()
      if (!isFeishuDocUrl(urlToUse)) {
        setWechatStatus({ type: "error", text: "请在飞书文档页面使用" })
        setProcessingWechat(false)
        return
      }
      const { appId, appSecret, backendBase } = await getCredentials()
      if (!appId || !appSecret) {
        setWechatStatus({ type: "error", text: "请先在选项页保存 APP ID 与 Secret" })
        setProcessingWechat(false)
        return
      }
      const res = await convertByBackend(urlToUse!, appId, appSecret, backendBase)
      setResultHtml(res.html)
      setWechatStatus({ type: "success", text: "转换成功" })
      const c = getChrome()
      if (c?.runtime?.sendMessage) {
        c.runtime.sendMessage({ action: "saveToHistory", payload: { url: urlToUse, time: Date.now() } })
      }
    } catch (e: any) {
      setWechatStatus({ type: "error", text: e?.message || "转换失败" })
    } finally {
      setProcessingWechat(false)
    }
  }

  const onCopyWechat = async () => {
    if (!resultHtml) return
    await copyHtmlToClipboard(resultHtml)
    setWechatStatus({ type: "success", text: "已复制为富文本（HTML）" })
  }

  const onDownloadWechat = () => {
    if (!resultHtml) return
    downloadHtml(resultHtml)
  }

  const onMdConvert = async () => {
    setProcessingMd(true)
    setMarkdown("")
    setMdStatus({ type: "info", text: "正在转换为 Markdown..." })
    try {
      const urlToUse = await resolveDocUrl()
      if (!isFeishuDocUrl(urlToUse)) {
        setMdStatus({ type: "error", text: "请在飞书文档页打开后再使用" })
        setProcessingMd(false)
        return
      }
      const { appId, appSecret, backendBase } = await getCredentials()
      if (!appId || !appSecret) {
        setMdStatus({ type: "error", text: "请在选项页保存 APP ID 与 Secret" })
        setProcessingMd(false)
        return
      }
      const res = await markdownByBackend(urlToUse!, appId, appSecret, backendBase)
      setMarkdown(res.markdown || "")
      setMdStatus({ type: "success", text: "Markdown 转换完成" })
    } catch (e: any) {
      setMdStatus({ type: "error", text: e?.message || "Markdown 转换失败" })
    } finally {
      setProcessingMd(false)
    }
  }

  const onCopyMd = async () => {
    if (!markdown) return
    await copyToClipboard(markdown)
    setMdStatus({ type: "success", text: "Markdown 已复制" })
  }

  const onDownloadMd = () => {
    if (!markdown) return
    downloadMarkdown(markdown)
  }

  useEffect(() => {
    setWechatStatus({ type: "idle", text: "" })
    setMdStatus({ type: "idle", text: "" })
    resolveDocUrl()
      .then((u) => { if (u) setDocUrl(u) })
      .catch(() => {})
  }, [])

  const openOptions = () => {
    const c = getChrome()
    if (c?.runtime?.openOptionsPage) c.runtime.openOptionsPage()
  }

  return (
    <div style={{ width: "100%", padding: 12, boxSizing: "border-box", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>飞书文档转 Markdown</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setShowInfo(true)} title="说明" style={{ border: "none", background: "transparent", cursor: "pointer" }}>ℹ️</button>
          <button onClick={openOptions} title="设置" style={{ border: "none", background: "transparent", cursor: "pointer" }}>⚙️ 设置</button>
        </div>
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10 }}>
        <div style={{ fontSize: 12, color: "#6b7280" }}>当前在飞书文档页使用，无需手动输入链接</div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={onMdConvert} disabled={processingMd} style={{ flex: 1, padding: 8 }}>{processingMd ? "转换中..." : "开始转换"}</button>
          <button onClick={() => { setMarkdown(""); setMdStatus({ type: "idle", text: "" }) }} style={{ width: 80, padding: 8 }}>重置</button>
        </div>

        {mdStatus.text && (
          <div style={{ marginTop: 8, padding: 8, borderRadius: 6, ...statusStyleMd }}>{mdStatus.text}</div>
        )}
        {markdown && (
          <div style={{ marginTop: 8 }}>
            <textarea readOnly value={markdown} style={{ width: "100%", minHeight: 120, padding: 8, borderRadius: 6, border: "1px solid #d1d5db" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={onCopyMd} style={{ flex: 1, padding: 8 }}>复制 Markdown</button>
              <button onClick={onDownloadMd} style={{ flex: 1, padding: 8 }}>下载 .md</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "linear-gradient(135deg,#07c160,#06ad56)", color: "#fff" }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>转换为微信公众号格式</div>
        <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8 }}>使用已保存的 APP ID 和 Secret</div>
        <button onClick={onConvertWechat} disabled={processingWechat} style={{ width: "100%", padding: 10, borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer" }}>{processingWechat ? "转换中..." : "🚀 一键转换"}</button>
        {wechatStatus.text && (
          <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: "#ffffff", color: "#065f46" }}>{wechatStatus.text}</div>
        )}
        {resultHtml && (
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button onClick={onCopyWechat} style={{ flex: 1, padding: 8 }}>复制 HTML</button>
            <button onClick={onDownloadWechat} style={{ flex: 1, padding: 8 }}>下载 HTML</button>
          </div>
        )}
      </div>

      {/* 预览区域：展示转换后的 HTML，带苹果风代码块样式 */}
      {resultHtml && (
        <section style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, color: "#374151", marginBottom: 6 }}>HTML 预览</div>
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#ffffff",
              padding: 12,
              boxShadow: "0 8px 24px rgba(0,0,0,.06)",
              maxHeight: 420,
              overflow: "auto",
              fontFamily: "Optima,'Microsoft YaHei',PingFangSC-regular,serif",
              color: "#000",
              lineHeight: "1.7",
              wordBreak: "break-word",
            }}
            dangerouslySetInnerHTML={{ __html: resultHtml }}
          />
        </section>
      )}

      <div style={{ marginTop: 8, color: "#666" }}>需在飞书文档页使用，后端默认 http://localhost:8080</div>

      {showInfo && (
        <div
          onClick={() => setShowInfo(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(520px, 92vw)", background: "#fff", borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,.2)", border: "1px solid #e5e7eb" }}>
            <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700 }}>支持链接说明</div>
              <button onClick={() => setShowInfo(false)} title="关闭" style={{ border: "none", background: "transparent", cursor: "pointer" }}>✖️</button>
            </div>
            <div style={{ padding: 12, color: "#374151" }}>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>https://{`<workspace>`.toString()}.feishu.cn/docx/...</li>
                <li>https://{`<workspace>`.toString()}.larksuite.com/docx/...</li>
                <li>https://{`<workspace>`.toString()}.feishu.cn/wiki/...</li>
                <li>另外也支持 https://*.f.mioffice.cn 与 https://*.sg.larksuite.com</li>
              </ul>
              <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>在上述域名下的 docx/wiki/docs 页面打开侧边栏即可使用。</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SidePanel