import { useEffect, useState } from "react"
import { getCredentials, saveCredentials, getUserThemeJSON, saveUserThemeJSON, clearUserThemeJSON } from "./lib/storage"

const Options = () => {
  const [appId, setAppId] = useState("")
  const [appSecret, setAppSecret] = useState("")
  const [backendBase, setBackendBase] = useState("http://localhost:8080")
  const [saved, setSaved] = useState(false)
  const [userThemeJSON, setUserThemeJSON] = useState<string | null>(null)
  const [themeStatus, setThemeStatus] = useState<string>("未上传")

  useEffect(() => {
    getCredentials().then(({ appId, appSecret, backendBase }) => {
      setAppId(appId || "")
      setAppSecret(appSecret || "")
      setBackendBase(backendBase || "http://localhost:8080")
    })
    getUserThemeJSON().then((raw) => {
      setUserThemeJSON(raw)
      setThemeStatus(raw ? "已上传并生效（优先使用）" : "未上传")
    })
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveCredentials(appId.trim(), appSecret.trim(), backendBase.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const onThemeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const json = JSON.parse(text)
      // 简单校验结构：必须包含 tags 或 callout 或 codeblock 任一
      if (!(json.tags || json.callout || json.codeblock)) {
        setThemeStatus("JSON 结构不包含主题字段")
        return
      }
      await saveUserThemeJSON(text)
      setUserThemeJSON(text)
      setThemeStatus("已上传并生效（优先使用）")
    } catch (err) {
      setThemeStatus("JSON 解析失败，请检查文件格式")
    }
  }

  const onClearTheme = async () => {
    await clearUserThemeJSON()
    setUserThemeJSON(null)
    setThemeStatus("未上传")
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto", maxWidth: 640 }}>
      <h2 style={{ marginTop: 0 }}>插件设置</h2>

      {/* 引导说明 */}
      <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>如何获取凭证？</div>
        <ol style={{ margin: 0, paddingLeft: 18, color: "#374151" }}>
          <li>登录飞书开放平台</li>
          <li>创建一个应用，获取 App ID 和 App Secret</li>
          <li>确保应用权限正确，能访问文档内容</li>
          <li>将凭证填写到下方并保存</li>
        </ol>
      </div>

      <form onSubmit={onSubmit}>
        <label style={{ display: "block", fontSize: 13, color: "#6b7280" }}>飞书 App ID</label>
        <input value={appId} onChange={(e) => setAppId(e.target.value)} style={{ display: "block", width: "100%", marginBottom: 10, padding: 8, borderRadius: 6, border: "1px solid #d1d5db" }} />

        <label style={{ display: "block", fontSize: 13, color: "#6b7280" }}>飞书 App Secret</label>
        <input value={appSecret} onChange={(e) => setAppSecret(e.target.value)} style={{ display: "block", width: "100%", marginBottom: 10, padding: 8, borderRadius: 6, border: "1px solid #d1d5db" }} />

        <label style={{ display: "block", fontSize: 13, color: "#6b7280" }}>后端服务地址</label>
        <input value={backendBase} onChange={(e) => setBackendBase(e.target.value)} placeholder="http://localhost:8080" style={{ display: "block", width: "100%", marginBottom: 12, padding: 8, borderRadius: 6, border: "1px solid #d1d5db" }} />

        <button type="submit" style={{ padding: "8px 16px" }}>保存</button>
        {saved && <span style={{ marginLeft: 8, color: "green" }}>已保存</span>}
      </form>

      {/* 主题上传 */}
      <div style={{ marginTop: 18, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>自定义主题（JSON）</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
          上传后，插件将优先使用您上传的主题；后端继续使用默认主题。
        </div>
        <input type="file" accept="application/json,.json" onChange={onThemeFileChange} />
        <div style={{ marginTop: 8, fontSize: 13 }}>
          当前状态：<span style={{ color: themeStatus.includes("生效") ? "#16a34a" : "#ef4444" }}>{themeStatus}</span>
        </div>
        {userThemeJSON && (
          <div style={{ marginTop: 8 }}>
            <button onClick={onClearTheme} style={{ padding: "6px 12px" }}>清除已上传主题</button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, background: "#f0fdf4", border: "1px solid #dcfce7", borderRadius: 8, padding: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>安全说明</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: "#374151" }}>
          <li>凭证仅保存在浏览器的 <code>chrome.storage</code> 中，不会上传。</li>
          <li>后端仅用于拉取并解析您有权限访问的文档。</li>
          <li>自定义主题同样保存在浏览器 <code>chrome.storage</code> 中，您可随时清除。</li>
        </ul>
      </div>
    </div>
  )
}

export default Options