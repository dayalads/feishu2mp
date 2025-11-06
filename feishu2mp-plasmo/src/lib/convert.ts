export type ConvertResult = {
  html: string
  url: string
  title?: string
}

export type MarkdownResult = {
  markdown: string
  url: string
  docToken?: string
  docType?: string
  hasImages?: boolean
}

export type ThemeJSON = {
  tags?: Record<string, string>
  pre_code?: string
  callout?: {
    container_tag?: string
    container_style?: string
    icon_style?: string
    content_tag?: string
    content_style?: string
    types?: Record<string, { bg: string; border: string; icon: string }>
  }
  codeblock?: {
    container_tag?: string
    container_style?: string
    pre_tag?: string
    pre_style?: string
    topbar_tag?: string
    topbar_style?: string
    code_tag?: string
    code_style?: string
    line_break_element?: string
  }
}

const tryFetch = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res
}

const defaultTheme = (): ThemeJSON => ({
  callout: {
    container_tag: "section",
    container_style:
      "box-sizing:border-box; max-width:100%; margin:15px 0; border-radius:12px; padding:14px 16px; font-family: Optima,'Microsoft YaHei',PingFangSC-Regular,serif; color:#333; line-height:1.8; word-break:break-word; text-align:left;",
    icon_style: "display:inline-block; font-size:18px; line-height:1.8; vertical-align:top; margin-right:8px;",
    content_tag: "section",
    content_style: "display:inline-block; vertical-align:top; width:calc(100% - 30px); font-size:16px; line-height:1.8; color:#333; text-align:left;",
    types: {
      TIP: { bg: "#FFFBE6", border: "#F7E9C4", icon: "💡" },
      NOTE: { bg: "#FFF8EE", border: "#F0E6D8", icon: "📌" },
      WARNING: { bg: "#FFF1F0", border: "#FFD8D3", icon: "⚠️" },
      INFO: { bg: "#F6FAFE", border: "#DCEBFF", icon: "ℹ️" }
    }
  },
  codeblock: {
    container_tag: "section",
    container_style:
      "margin:0; padding:0 10px; font-family: Optima,'Microsoft YaHei',PingFangSC-regular,serif; font-size:16px; color:#000; line-height:1.5em; word-break:break-word; overflow-wrap:break-word; text-align:left;",
    pre_tag: "pre",
    pre_style: "border-radius:5px; box-shadow: rgba(0,0,0,0.55) 0px 2px 10px; text-align:left; margin:10px 0; padding:0;",
    topbar_tag: "span",
    topbar_style:
      "display:block; height:30px; width:100%; background:#282c34 url(https://files.mdnice.com/user/3441/876cad08-0422-409d-bb5a-08afec5da8ee.svg) no-repeat 10px 10px / 40px; margin-bottom:-7px; border-radius:5px;",
    code_tag: "code",
    code_style:
      "overflow-x:auto; padding:16px; padding-top:15px; color:#abb2bf; background:#282c34; border-radius:5px; display:block; font-family:Consolas,Monaco,Menlo,monospace; font-size:12px;",
    line_break_element: "br"
  }
})

export const fetchTheme = async (base: string): Promise<ThemeJSON> => {
  try {
    const u = new URL("/theme", base)
    const res = await tryFetch(u.toString())
    const json = await res.json()
    return json as ThemeJSON
  } catch {
    return defaultTheme()
  }
}

// 优先加载用户上传的主题；不存在则回退到后端默认主题
export const loadEffectiveTheme = async (base: string): Promise<ThemeJSON> => {
  try {
    const raw = await getUserThemeJSON()
    if (raw) {
      const json = JSON.parse(raw)
      return json as ThemeJSON
    }
  } catch {
    // ignore parse errors -> fallback
  }
  return fetchTheme(base)
}

export const convertByBackend = async (docUrl: string, appId: string, appSecret: string, base: string) => {
  const u = new URL("/convert", base)
  u.searchParams.set("url", docUrl)
  if (appId) u.searchParams.set("app_id", appId)
  if (appSecret) u.searchParams.set("app_secret", appSecret)
  const [res, theme] = await Promise.all([tryFetch(u.toString()), loadEffectiveTheme(base)])
  const html = await res.text()
  let enhanced = applyWechatCalloutStyles(html, theme)
  enhanced = applyWechatCodeBlockStyles(enhanced, theme)
  enhanced = applyGeneralTagStyles(enhanced, theme)
  return { html: enhanced, url: docUrl } as ConvertResult
}

export const markdownByBackend = async (docUrl: string, appId: string, appSecret: string, base: string) => {
  const u = new URL("/api/markdown", base)
  u.searchParams.set("url", docUrl)
  u.searchParams.set("format", "json")
  if (appId) u.searchParams.set("app_id", appId)
  if (appSecret) u.searchParams.set("app_secret", appSecret)
  const res = await tryFetch(u.toString())
  const json = await res.json()
  const markdown = typeof json?.markdown === "string" ? json.markdown : ""
  return { markdown, url: docUrl, docToken: json?.docToken, docType: json?.docType, hasImages: !!json?.hasImages } as MarkdownResult
}

export const copyToClipboard = async (text: string) => {
  await navigator.clipboard.writeText(text)
}

const htmlToPlainText = (html: string) => {
  const div = document.createElement("div")
  div.innerHTML = html
  const text = div.textContent || div.innerText || ""
  div.remove()
  return text
}

export const copyHtmlToClipboard = async (html: string) => {
  const ClipboardItemCtor: any = (globalThis as any).ClipboardItem
  try {
    if (ClipboardItemCtor && navigator.clipboard && typeof navigator.clipboard.write === "function") {
      const item = new ClipboardItemCtor({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([htmlToPlainText(html)], { type: "text/plain" })
      })
      await navigator.clipboard.write([item])
      return
    }
    // Fallback: 使用 contenteditable + execCommand 复制富文本
    const div = document.createElement("div")
    div.contentEditable = "true"
    div.style.position = "fixed"
    div.style.left = "-9999px"
    div.style.top = "0"
    div.innerHTML = html
    document.body.appendChild(div)
    const range = document.createRange()
    range.selectNodeContents(div)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    document.execCommand("copy")
    sel?.removeAllRanges()
    div.remove()
  } catch {
    // 兜底：复制纯文本
    await copyToClipboard(htmlToPlainText(html))
  }
}

export const downloadHtml = (html: string, filename = "wechat.html") => {
  const blob = new Blob([html], { type: "text/html" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(a.href)
}

export const downloadMarkdown = (markdown: string, filename = "feishu.md") => {
  const blob = new Blob([markdown], { type: "text/markdown" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(a.href)
}
// 将包含 [!TIP] / [!NOTE] / [!WARNING] 等标记的引用，转换为更贴近飞书原版的高亮文本块
export const applyWechatCalloutStyles = (html: string, theme?: ThemeJSON) => {
  try {
    const wrap = document.createElement("div")
    wrap.innerHTML = html
    const blocks = Array.from(wrap.querySelectorAll("blockquote"))
    const conf = theme?.callout || defaultTheme().callout!
    const styleMap: Record<string, { bg: string; border: string; icon: string }> = conf.types || defaultTheme().callout!.types!
    blocks.forEach((bq) => {
      const firstP = bq.querySelector("p")
      const rawText = (firstP?.textContent || bq.textContent || "").trim()
      const m = rawText.match(/^\s*\[\!(TIP|NOTE|WARNING|INFO)\]/i)
      if (!m) return
      const type = m[1].toUpperCase()
      const sty = styleMap[type] || styleMap.TIP
      // 移除标记
      if (firstP) firstP.innerHTML = firstP.innerHTML.replace(/^\s*\[\!(TIP|NOTE|WARNING|INFO)\]\s*/i, "")
      else bq.innerHTML = bq.innerHTML.replace(/^\s*\[\!(TIP|NOTE|WARNING|INFO)\]\s*/i, "")
      // 构造高亮容器（使用 section 标签与简单内联样式，避免 flex/gap）
      const box = document.createElement(conf.container_tag || "section")
      const baseStyle = conf.container_style || defaultTheme().callout!.container_style!
      box.setAttribute("style", `${baseStyle} border:1px solid ${sty.border}; background:${sty.bg};`)
      // 图标与内容并排在同一行（避免 flex，使用 inline-block）
      const iconSpan = document.createElement("span")
      iconSpan.textContent = sty.icon
      iconSpan.setAttribute("style", conf.icon_style || defaultTheme().callout!.icon_style!)
      box.appendChild(iconSpan)
      // 内容容器（保持原有段落/列表等结构）
      const content = document.createElement(conf.content_tag || "section")
      content.setAttribute("style", conf.content_style || defaultTheme().callout!.content_style!)
      // 将原 blockquote 的所有子节点移入内容容器
      while (bq.firstChild) content.appendChild(bq.firstChild)
      // 清理开头空白段落与 <br/>
      const isEmptyP = (el: Element) => {
        if (!el || el.tagName.toLowerCase() !== "p") return false
        const txt = (el.textContent || "").replace(/\u00A0/g, " ").trim()
        return txt.length === 0
      }
      // 移除前导空文本节点
      while (content.firstChild && content.firstChild.nodeType === 3 && !(content.firstChild as Text).data.trim()) {
        content.removeChild(content.firstChild)
      }
      // 移除前导空 p / br
      while (content.firstElementChild && (isEmptyP(content.firstElementChild) || content.firstElementChild.tagName.toLowerCase() === "br")) {
        content.removeChild(content.firstElementChild)
      }
      // 将首个块元素的上边距归零，避免出现额外空行
      const firstEl = content.firstElementChild as HTMLElement | null
      if (firstEl) {
        const prev = firstEl.getAttribute("style") || ""
        firstEl.setAttribute("style", prev + (prev ? " " : "") + "margin-top:0;")
        // 如果首个元素为段落，则将其内容提升为行内 span，确保文字紧随图标显示
        if (firstEl.tagName.toLowerCase() === "p") {
          const inline = document.createElement("span")
          inline.setAttribute("style", "font-size:16px; line-height:1.8; color:#333;")
          inline.innerHTML = (firstEl.innerHTML || "").trim()
          content.insertBefore(inline, firstEl)
          // 若段落仅用于承载首行内容，则移除该段落，避免产生换行
          content.removeChild(firstEl)
        }
      }
      box.appendChild(content)
      bq.replaceWith(box)
    })
    return wrap.innerHTML
  } catch {
    return html
  }
}

// 将 <pre><code> 代码块转换为苹果风暗色代码块，使用公众号白名单样式
export const applyWechatCodeBlockStyles = (html: string, theme?: ThemeJSON) => {
  try {
    const wrap = document.createElement("div")
    wrap.innerHTML = html
    const pres = Array.from(wrap.querySelectorAll("pre"))
    const conf = theme?.codeblock || defaultTheme().codeblock!
  pres.forEach((pre) => {
      const code = pre.querySelector("code")
      const raw = (code?.textContent || pre.textContent || "").trim()
      if (!raw) return
      // 构造外层 section 容器
      const sect = document.createElement(conf.container_tag || "section")
      sect.setAttribute("style", conf.container_style || defaultTheme().codeblock!.container_style!)
      // 构造 pre 容器
      const preBox = document.createElement(conf.pre_tag || "pre")
      preBox.setAttribute("style", conf.pre_style || defaultTheme().codeblock!.pre_style!)
      // 顶部栏（苹果风交通灯）
      const topBar = document.createElement(conf.topbar_tag || "span")
      // 标记为代码块顶栏，防止被通用 span 样式覆盖
      topBar.setAttribute("data-code-topbar", "1")
      topBar.setAttribute("style", conf.topbar_style || defaultTheme().codeblock!.topbar_style!)
      preBox.appendChild(topBar)
      // 代码主体
      const codeOut = document.createElement(conf.code_tag || "code")
      codeOut.setAttribute("style", conf.code_style || defaultTheme().codeblock!.code_style!)
      // 将文本转为 HTML 并按行插入 <br>，同时保留前导缩进
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      const lines = esc(raw).split(/\r?\n/)
      const toHtmlLine = (line: string) => line.replace(/^ +/g, (m) => "&nbsp;".repeat(m.length))
      const br = conf.line_break_element || "br"
      codeOut.innerHTML = lines.map((l) => toHtmlLine(l)).join(`<${br}>`)
      preBox.appendChild(codeOut)
      sect.appendChild(preBox)
      pre.replaceWith(sect)
    })
    return wrap.innerHTML
  } catch {
    return html
  }
}

// 根据主题覆盖常规标签样式（p/h1-h6/img/a/hr/strong 等）
export const applyGeneralTagStyles = (html: string, theme?: ThemeJSON) => {
  try {
    const tags = theme?.tags
    if (!tags || Object.keys(tags).length === 0) return html
    const wrap = document.createElement("div")
    wrap.innerHTML = html
    const shouldSkip = (tag: string) => {
      // 始终避免覆盖代码相关标签，由代码块逻辑统一控制
      const t = tag.toLowerCase()
      if (t === "pre" || t === "code") return true
      return false
    }
    for (const [tag, style] of Object.entries(tags)) {
      if (shouldSkip(tag)) continue
      const nodes = Array.from(wrap.querySelectorAll(tag)) as HTMLElement[]
      nodes.forEach((el) => {
        // 跳过代码块顶栏 span，避免用户主题覆盖导致顶栏丢失
        if (tag.toLowerCase() === "span" && el.getAttribute("data-code-topbar") === "1") return
        const prev = el.getAttribute("style") || ""
        const s = style || ""
        if (!prev) {
          if (s) el.setAttribute("style", s)
        } else {
          const semiPrev = prev && !/;\s*$/.test(prev) ? ";" : ""
          const semiS = s && !/;\s*$/.test(s) ? ";" : ""
          // 先写已有（默认/专项）样式，再写主题通用样式，确保主题样式覆盖生效
          el.setAttribute("style", `${prev}${semiPrev}${s ? ` ${s}${semiS}` : ""}`)
        }
      })
    }
    return wrap.innerHTML
  } catch {
    return html
  }
}
import { getUserThemeJSON } from "./storage"