package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/Wsine/feishu2md/core"
	"github.com/Wsine/feishu2md/utils"
	"github.com/gin-gonic/gin"
)

// convertHandler 处理飞书文档转微信公众号 HTML 的完整流程
func convertHandler(c *gin.Context) {
	// 获取参数
	feishuDocxURL, err := url.QueryUnescape(c.Query("url"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid encoded feishu/larksuite URL",
		})
		return
	}

	// 从查询参数或环境变量获取凭证
	appId := c.Query("app_id")
	appSecret := c.Query("app_secret")
	if appId == "" {
		appId = os.Getenv("FEISHU_APP_ID")
	}
	if appSecret == "" {
		appSecret = os.Getenv("FEISHU_APP_SECRET")
	}

	if appId == "" || appSecret == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Missing app_id or app_secret. Please provide them as query parameters.",
		})
		return
	}

	// 验证 URL
	docType, docToken, err := utils.ValidateDocumentURL(feishuDocxURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Invalid document URL: %v", err),
		})
		return
	}

	// 创建客户端
	ctx := context.Background()
	config := core.NewConfig(appId, appSecret)
	client := core.NewClient(
		config.Feishu.AppId, config.Feishu.AppSecret,
	)

	// 处理 wiki 页面
	if docType == "wiki" {
		node, err := client.GetWikiNodeInfo(ctx, docToken)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to get wiki node info",
			})
			return
		}
		docType = node.ObjType
		docToken = node.ObjToken
	}

	if docType == "docs" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Unsupported docs document type",
		})
		return
	}

	// 获取文档内容并解析为 Markdown
	docx, blocks, err := client.GetDocxContent(ctx, docToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get document content",
		})
		return
	}

	parser := core.NewParser(config.Output)
	markdown := parser.ParseDocxContent(docx, blocks)

	// 创建微信公众号 HTML 转换器
	converter := core.NewWeChatHTMLConverter()

	// 加载主题 JSON（仅尝试当前目录或上级目录的默认 theme.wechat.json，不再读取环境变量）
	themePath := ""
	cwd, _ := os.Getwd()
	p1 := filepath.Join(cwd, "theme.wechat.json")
	p2 := filepath.Join(filepath.Dir(cwd), "theme.wechat.json")
	if _, err := os.Stat(p1); err == nil {
		themePath = p1
	} else if _, err := os.Stat(p2); err == nil {
		themePath = p2
	}
	if themePath != "" {
		_ = converter.LoadThemeFromFile(themePath) // 读取失败时继续使用默认样式
	}

	// 处理图片：下载并转换为 data URI 或 HTTPS URL
	for _, imgToken := range parser.ImgTokens {
		// 下载图片原始数据
		localLink, rawImage, err := client.DownloadImageRaw(ctx, imgToken, config.Output.ImageDir)
		if err != nil {
			log.Printf("Warning: Failed to download image %s: %v", imgToken, err)
			// 如果下载失败，跳过该图片
			continue
		}

		// 检测图片 MIME 类型
		mimeType := "image/png" // default
		ext := strings.ToLower(filepath.Ext(localLink))
		switch ext {
		case ".jpg", ".jpeg":
			mimeType = "image/jpeg"
		case ".png":
			mimeType = "image/png"
		case ".gif":
			mimeType = "image/gif"
		case ".webp":
			mimeType = "image/webp"
		case ".svg":
			mimeType = "image/svg+xml"
		case ".bmp":
			mimeType = "image/bmp"
		default:
			// 尝试从内容检测
			if len(rawImage) > 4 && rawImage[0] == 0xFF && rawImage[1] == 0xD8 {
				mimeType = "image/jpeg"
			} else if len(rawImage) > 8 && string(rawImage[0:8]) == "\x89PNG\r\n\x1a\n" {
				mimeType = "image/png"
			} else if len(rawImage) > 4 && string(rawImage[0:4]) == "GIF8" {
				mimeType = "image/gif"
			}
		}

		// 方案1: 小图片使用 data URI（公众号支持）
		if len(rawImage) < 500*1024 { // 小于 500KB
			base64Data := base64.StdEncoding.EncodeToString(rawImage)
			dataURI := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data)
			converter.SetImageURL(imgToken, dataURI)
		} else {
			// 方案2: 大图片也使用 data URI（临时方案）
			// 生产环境建议上传到图床服务
			imageServiceURL := os.Getenv("IMAGE_SERVICE_URL")
			if imageServiceURL != "" {
				// TODO: 实现图片上传到图床服务的逻辑
				log.Printf("Image service URL configured but upload not implemented. Using data URI for large image.")
			}

			// 临时方案：使用 data URI（可能有大小限制）
			base64Data := base64.StdEncoding.EncodeToString(rawImage)
			dataURI := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data)
			converter.SetImageURL(imgToken, dataURI)

			log.Printf("Large image (%d bytes) converted to data URI, token: %s", len(rawImage), imgToken)
		}
	}

	// 转换为微信公众号 HTML
	wechatHTML, err := converter.MarkdownToWeChatHTML(markdown)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to convert to WeChat HTML: %v", err),
		})
		return
	}

	// 返回纯 HTML 文本，便于前端复制粘贴
	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, wechatHTML)
}



