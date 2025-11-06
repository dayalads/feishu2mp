package core

import (
	"encoding/json"
	"fmt"
	"html"
	"io/ioutil"
	"net/url"
	"regexp"
	"strings"

	"github.com/88250/lute"
)

// WeChatHTMLConverter 微信公众号 HTML 转换器
type WeChatHTMLConverter struct {
	imageURLs map[string]string // token -> https URL 或 data URI 映射
	styles    map[string]string // 标签样式映射（从主题JSON加载）
	preCode   string            // <pre><code> 内 code 的样式（从主题JSON加载）
}

// NewWeChatHTMLConverter 创建新的转换器
func NewWeChatHTMLConverter() *WeChatHTMLConverter {
	return &WeChatHTMLConverter{
		imageURLs: make(map[string]string),
		styles:    defaultTagStyles(),
		preCode:   defaultPreCodeStyle(),
	}
}

// SetImageURL 设置图片 token 到 URL 的映射
func (w *WeChatHTMLConverter) SetImageURL(token, imageURL string) {
	w.imageURLs[token] = imageURL
}

// ThemeConfig 主题配置结构（从 JSON 文件读取）
type ThemeConfig struct {
	Tags    map[string]string `json:"tags"`
	PreCode string            `json:"pre_code"`
}

// LoadThemeFromFile 尝试从指定路径加载主题 JSON；失败则保持默认样式
func (w *WeChatHTMLConverter) LoadThemeFromFile(path string) error {
	if path == "" {
		return nil
	}
	bs, err := ioutil.ReadFile(path)
	if err != nil {
		return err
	}
	var cfg ThemeConfig
	if err := json.Unmarshal(bs, &cfg); err != nil {
		return err
	}
	if cfg.Tags != nil && len(cfg.Tags) > 0 {
		w.styles = cfg.Tags
	}
	if strings.TrimSpace(cfg.PreCode) != "" {
		w.preCode = strings.TrimSpace(cfg.PreCode)
	}
	return nil
}

// MarkdownToWeChatHTML 将 Markdown 转换为微信公众号格式的 HTML
// 返回纯 HTML 文本，所有样式都是内联的，不使用 style/link/script 标签
func (w *WeChatHTMLConverter) MarkdownToWeChatHTML(markdown string) (string, error) {
	// 使用 lute 将 Markdown 转换为标准 HTML
	engine := lute.New(func(l *lute.Lute) {
		l.RenderOptions.AutoSpace = true
		// CodeBlockPreview 可能不存在于当前版本的 lute 库中，移除该设置
	})

	htmlStr := engine.MarkdownStr("", markdown)

	// 处理图片，将 token 和相对路径转换为 HTTPS 绝对路径或 data URI
	htmlStr = w.processImages(htmlStr)

	// 移除所有 style、link、script 标签及其内容
	htmlStr = w.removeStyleLinkScriptTags(htmlStr)

	// 移除所有 class 和 id 属性
	htmlStr = w.removeClassAndID(htmlStr)

	// 将剩余标签转换为带内联样式的微信公众号兼容格式
	htmlStr = w.convertToInlineStyles(htmlStr)

	// 清理多余空白和换行
	htmlStr = w.cleanupWhitespace(htmlStr)

	return htmlStr, nil
}

// processImages 处理图片，确保使用 HTTPS 绝对路径或 data URI
func (w *WeChatHTMLConverter) processImages(htmlStr string) string {
	// 匹配 <img> 标签
	imgPattern := regexp.MustCompile(`<img[^>]*src=["']([^"']+)["'][^>]*>`)

	return imgPattern.ReplaceAllStringFunc(htmlStr, func(match string) string {
		// 提取 src 属性
		srcMatch := regexp.MustCompile(`src=["']([^"']+)["']`)
		srcAttr := srcMatch.FindStringSubmatch(match)
		if len(srcAttr) < 2 {
			return match
		}

		originalSrc := srcAttr[1]

		// 检查是否是 token（在映射中）
		if httpsURL, exists := w.imageURLs[originalSrc]; exists {
			return strings.Replace(match, originalSrc, httpsURL, 1)
		}

		// 处理相对路径和协议
		finalURL := w.normalizeImageURL(originalSrc)

		return strings.Replace(match, originalSrc, finalURL, 1)
	})
}

// normalizeImageURL 标准化图片 URL，确保是 HTTPS 绝对路径或 data URI
func (w *WeChatHTMLConverter) normalizeImageURL(imgURL string) string {
	// 移除空白
	imgURL = strings.TrimSpace(imgURL)

	// 如果是 data URI，保持原样（公众号支持）
	if strings.HasPrefix(imgURL, "data:") {
		return imgURL
	}

	// 如果是完整的 HTTPS URL，直接返回
	if strings.HasPrefix(imgURL, "https://") {
		return imgURL
	}

	// 如果是 HTTP URL，转换为 HTTPS
	if strings.HasPrefix(imgURL, "http://") {
		return strings.Replace(imgURL, "http://", "https://", 1)
	}

	// 如果是 // 开头的协议相对路径，添加 https:
	if strings.HasPrefix(imgURL, "//") {
		return "https:" + imgURL
	}

	// 如果是 / 开头的绝对路径，返回原样（实际使用时应配置基础 URL）
	if strings.HasPrefix(imgURL, "/") {
		return imgURL
	}

	// 其他情况返回原样（可能是 token 或其他格式）
	return imgURL
}

// removeStyleLinkScriptTags 移除 style、link、script 标签及其内容
func (w *WeChatHTMLConverter) removeStyleLinkScriptTags(htmlStr string) string {
	// 移除 <style> 标签及其内容
	stylePattern := regexp.MustCompile(`(?i)<style[^>]*>[\s\S]*?</style>`)
	htmlStr = stylePattern.ReplaceAllString(htmlStr, "")

	// 移除 <link> 标签
	linkPattern := regexp.MustCompile(`(?i)<link[^>]*>`)
	htmlStr = linkPattern.ReplaceAllString(htmlStr, "")

	// 移除 <script> 标签及其内容
	scriptPattern := regexp.MustCompile(`(?i)<script[^>]*>[\s\S]*?</script>`)
	htmlStr = scriptPattern.ReplaceAllString(htmlStr, "")

	return htmlStr
}

// removeClassAndID 移除所有 class 和 id 属性
func (w *WeChatHTMLConverter) removeClassAndID(htmlStr string) string {
	// 移除 class 属性
	classPattern := regexp.MustCompile(`(?i)\s*class=["'][^"']*["']`)
	htmlStr = classPattern.ReplaceAllString(htmlStr, "")

	// 移除 id 属性
	idPattern := regexp.MustCompile(`(?i)\s*id=["'][^"']*["']`)
	htmlStr = idPattern.ReplaceAllString(htmlStr, "")

	// 移除 data-* 属性（可选，但公众号可能不支持）
	dataPattern := regexp.MustCompile(`(?i)\s*data-[^=]*=["'][^"']*["']`)
	htmlStr = dataPattern.ReplaceAllString(htmlStr, "")

	return htmlStr
}

// convertToInlineStyles 将标签转换为带内联样式的格式
func (w *WeChatHTMLConverter) convertToInlineStyles(htmlStr string) string {
	// 处理各种标签，添加内联样式（按主题配置）
	for tag, style := range w.styles {
		if tag == "pre_code" { // 兼容可能的键名，实际从 w.preCode 读取
			continue
		}
		if strings.TrimSpace(style) == "" {
			continue
		}
		htmlStr = w.addInlineStyleToTag(htmlStr, tag, style)
	}

	// 处理 <pre><code> 的 code 样式（不覆盖 pre 背景色）
	if strings.TrimSpace(w.preCode) != "" {
		htmlStr = w.addInlineStyleToPreCode(htmlStr, w.preCode)
	}

	return htmlStr
}

// addInlineStyleToTag 为指定标签添加内联样式
func (w *WeChatHTMLConverter) addInlineStyleToTag(htmlStr, tagName, style string) string {
	// 匹配开标签（自闭合或普通标签）
	pattern := regexp.MustCompile(fmt.Sprintf(`(?i)<%s(\s[^>]*)?>`, regexp.QuoteMeta(tagName)))

	return pattern.ReplaceAllStringFunc(htmlStr, func(match string) string {
		// 检查是否已有 style 属性
		if strings.Contains(strings.ToLower(match), "style=") {
			// 已有 style，合并（追加）
			stylePattern := regexp.MustCompile(`(?i)(style=["'])([^"']*)(["'])`)
			return stylePattern.ReplaceAllString(match, fmt.Sprintf(`$1%s $2$3`, style))
		} else {
			// 没有 style，添加
			// 检查是否是自闭合标签
			if strings.HasSuffix(strings.TrimSpace(match), "/>") {
				return strings.Replace(match, "/>", fmt.Sprintf(` style="%s" />`, html.EscapeString(style)), 1)
			} else {
				return strings.Replace(match, ">", fmt.Sprintf(` style="%s">`, html.EscapeString(style)), 1)
			}
		}
	})
}

// addInlineStyleToPreCode 为 pre 标签内的 code 添加样式（不覆盖 pre 的背景色）
func (w *WeChatHTMLConverter) addInlineStyleToPreCode(htmlStr, style string) string {
	// 匹配 <pre><code> 或 <pre>...<code>
	pattern := regexp.MustCompile(`(?i)<pre[^>]*>([\s\S]*?)(<code[^>]*>)([\s\S]*?)(</code>)`)

	return pattern.ReplaceAllStringFunc(htmlStr, func(match string) string {
		// 提取 code 标签
		codePattern := regexp.MustCompile(`(?i)(<code)([^>]*?)(>)`)
		return codePattern.ReplaceAllString(match, fmt.Sprintf(`$1$2 style="%s"$3`, html.EscapeString(style)))
	})
}

// cleanupWhitespace 清理多余的空白和换行
func (w *WeChatHTMLConverter) cleanupWhitespace(htmlStr string) string {
	// 移除标签之间的多余空白
	htmlStr = regexp.MustCompile(`>\s+<`).ReplaceAllString(htmlStr, "><")

	// 移除多余的空行（保留单行空白）
	htmlStr = regexp.MustCompile(`\n{3,}`).ReplaceAllString(htmlStr, "\n\n")

	return strings.TrimSpace(htmlStr)
}

// ValidateHTTPSURL 验证并标准化 URL 为 HTTPS
func ValidateHTTPSURL(rawURL string) (string, error) {
	rawURL = strings.TrimSpace(rawURL)

	// 如果已经是 HTTPS，直接返回
	if strings.HasPrefix(rawURL, "https://") {
		return rawURL, nil
	}

	// 如果是 HTTP，转换为 HTTPS
	if strings.HasPrefix(rawURL, "http://") {
		return strings.Replace(rawURL, "http://", "https://", 1), nil
	}

	// 如果是协议相对路径，添加 https:
	if strings.HasPrefix(rawURL, "//") {
		return "https:" + rawURL, nil
	}

	// 尝试解析为 URL
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return "", fmt.Errorf("invalid URL: %w", err)
	}

	// 如果解析后的 URL 没有 scheme，添加 https://
	if parsedURL.Scheme == "" {
		if parsedURL.Host == "" {
			return "", fmt.Errorf("URL has no host: %s", rawURL)
		}
		parsedURL.Scheme = "https"
	}

	// 如果是 http，转换为 https
	if parsedURL.Scheme == "http" {
		parsedURL.Scheme = "https"
	}

	return parsedURL.String(), nil
}

// 默认样式（与原始硬编码保持一致）
func defaultTagStyles() map[string]string {
	return map[string]string{
		"p":          "margin: 12px 0; text-align: justify; word-wrap: break-word; word-break: break-all; line-height: 1.8; font-size: 17px; color: #333333;",
		"h1":         "font-size: 24px; font-weight: bold; line-height: 1.4; margin: 20px 0 15px; color: #333333;",
		"h2":         "font-size: 22px; font-weight: bold; line-height: 1.4; margin: 18px 0 12px; color: #333333;",
		"h3":         "font-size: 20px; font-weight: bold; line-height: 1.4; margin: 16px 0 10px; color: #333333;",
		"h4":         "font-size: 18px; font-weight: bold; line-height: 1.4; margin: 14px 0 8px; color: #333333;",
		"h5":         "font-size: 17px; font-weight: bold; line-height: 1.4; margin: 12px 0 6px; color: #333333;",
		"h6":         "font-size: 16px; font-weight: bold; line-height: 1.4; margin: 10px 0 4px; color: #333333;",
		"ul":         "margin: 12px 0; padding-left: 30px; list-style-type: disc;",
		"ol":         "margin: 12px 0; padding-left: 30px;",
		"li":         "margin: 8px 0; line-height: 1.8; font-size: 17px; color: #333333;",
		"blockquote": "margin: 15px 0; padding: 10px 15px; border-left: 4px solid #e6e6e6; background-color: #f9f9f9; color: #666666; font-size: 16px; line-height: 1.8;",
		"pre":        "background-color: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; margin: 15px 0; font-size: 14px; line-height: 1.6; color: #333333;",
		"code":       "background-color: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; color: #e83e8c;",
		"img":        "max-width: 100%; height: auto; display: block; margin: 15px auto; border-radius: 5px;",
		"a":          "color: #576b95; text-decoration: none; border-bottom: 1px solid #576b95;",
		"hr":         "border: none; border-top: 1px solid #eaeaea; margin: 20px 0;",
		"strong":     "font-weight: bold; color: #333333;",
		"em":         "font-style: italic;",
		"u":          "text-decoration: underline;",
		"span":       "font-size: 17px; line-height: 1.8; color: #333333;",
		"table":      "width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 16px;",
		"th":         "border: 1px solid #ddd; padding: 10px; text-align: left; background-color: #f5f5f5; font-weight: bold;",
		"td":         "border: 1px solid #ddd; padding: 10px; text-align: left;",
		"figure":     "margin: 15px 0;",
		"figcaption": "text-align: center; color: #888; font-size: 0.8em; margin-top: 5px;",
	}
}

func defaultPreCodeStyle() string {
	return "background-color: transparent; padding: 0; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; color: #333333;"
}
