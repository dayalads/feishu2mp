package main

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/88250/lute"
	"github.com/Wsine/feishu2md/core"
	"github.com/Wsine/feishu2md/utils"
	"github.com/gin-gonic/gin"
)

func downloadHandler(c *gin.Context) {
	// get parameters
	feishu_docx_url, err := url.QueryUnescape(c.Query("url"))
	if err != nil {
		c.String(http.StatusBadRequest, "Invalid encoded feishu/larksuite URL")
		return
	}

	// Get credentials from query parameters or environment variables
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

	// Validate the url to download
	docType, docToken, err := utils.ValidateDocumentURL(feishu_docx_url)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Invalid document URL: %v", err),
		})
		return
	}
	fmt.Println("Captured document token:", docToken)

	// Create client with context
	ctx := context.Background()
	config := core.NewConfig(appId, appSecret)
	client := core.NewClient(
		config.Feishu.AppId, config.Feishu.AppSecret,
	)

	// Process the download
	parser := core.NewParser(config.Output)
	markdown := ""

	// for a wiki page, we need to renew docType and docToken first
	if docType == "wiki" {
		node, err := client.GetWikiNodeInfo(ctx, docToken)
		if err != nil {
			c.String(http.StatusInternalServerError, "Internal error: client.GetWikiNodeInfo")
			log.Panicf("error: %s", err)
			return
		}
		docType = node.ObjType
		docToken = node.ObjToken
	}
	if docType == "docs" {
		c.String(http.StatusBadRequest, "Unsupported docs document type")
		return
	}

	docx, blocks, err := client.GetDocxContent(ctx, docToken)
	if err != nil {
		c.String(http.StatusInternalServerError, "Internal error: client.GetDocxContent")
		log.Panicf("error: %s", err)
		return
	}
	markdown = parser.ParseDocxContent(docx, blocks)

	// Check if JSON response is requested (for API calls)
	// For JSON format, convert images to base64 data URIs
	if c.Query("format") == "json" {
		// Process images and convert to base64 data URIs
		for _, imgToken := range parser.ImgTokens {
			localLink, rawImage, err := client.DownloadImageRaw(ctx, imgToken, config.Output.ImageDir)
			if err != nil {
				log.Printf("Warning: Failed to download image %s: %v", imgToken, err)
				// Keep the token in markdown if download fails
				continue
			}
			
			// Detect image MIME type from file extension
			ext := filepath.Ext(localLink)
			mimeType := "image/png" // default
			switch strings.ToLower(ext) {
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
				// Fallback: try to detect from content
				if len(rawImage) > 4 && rawImage[0] == 0xFF && rawImage[1] == 0xD8 {
					mimeType = "image/jpeg"
				} else if len(rawImage) > 8 && string(rawImage[0:8]) == "\x89PNG\r\n\x1a\n" {
					mimeType = "image/png"
				} else if len(rawImage) > 4 && string(rawImage[0:4]) == "GIF8" {
					mimeType = "image/gif"
				}
			}
			
			// Convert to base64 data URI
			base64Data := base64.StdEncoding.EncodeToString(rawImage)
			dataURI := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data)
			
			// Replace image token with data URI in markdown
			// Pattern: ![](imgToken) -> ![](data:image/png;base64,...)
			imgPattern := regexp.MustCompile(regexp.QuoteMeta("![](" + imgToken + ")"))
			markdown = imgPattern.ReplaceAllString(markdown, "![]("+dataURI+")")
		}
		
		engine := lute.New(func(l *lute.Lute) {
			l.RenderOptions.AutoSpace = true
		})
		result := engine.FormatStr("md", markdown)
		
		c.JSON(http.StatusOK, gin.H{
			"markdown": result,
			"docToken": docToken,
			"docType":  docType,
			"hasImages": len(parser.ImgTokens) > 0,
		})
		return
	}

	// Original file download behavior (for /download endpoint)
	zipBuffer := new(bytes.Buffer)
	writer := zip.NewWriter(zipBuffer)
	for _, imgToken := range parser.ImgTokens {
		localLink, rawImage, err := client.DownloadImageRaw(ctx, imgToken, config.Output.ImageDir)
		if err != nil {
			c.String(http.StatusInternalServerError, "Internal error: client.DownloadImageRaw")
			log.Panicf("error: %s", err)
			return
		}
		markdown = strings.Replace(markdown, imgToken, localLink, 1)
		f, err := writer.Create(localLink)
		if err != nil {
			c.String(http.StatusInternalServerError, "Internal error: zipWriter.Create")
			log.Panicf("error: %s", err)
			return
		}
		_, err = f.Write(rawImage)
		if err != nil {
			c.String(http.StatusInternalServerError, "Internal error: zipWriter.Create.Write")
			log.Panicf("error: %s", err)
			return
		}
	}

	engine := lute.New(func(l *lute.Lute) {
		l.RenderOptions.AutoSpace = true
	})
	result := engine.FormatStr("md", markdown)

	// Set response (original file download behavior)
	if len(parser.ImgTokens) > 0 {
		mdName := fmt.Sprintf("%s.md", docToken)
		f, err := writer.Create(mdName)
		if err != nil {
			c.String(http.StatusInternalServerError, "Internal error: zipWriter.Create")
			log.Panicf("error: %s", err)
			return
		}
		_, err = f.Write([]byte(result))
		if err != nil {
			c.String(http.StatusInternalServerError, "Internal error: zipWriter.Create.Write")
			log.Panicf("error: %s", err)
			return
		}

		err = writer.Close()
		if err != nil {
			c.String(http.StatusInternalServerError, "Internal error: zipWriter.Close")
			log.Panicf("error: %s", err)
			return
		}
		c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.zip"`, docToken))
		c.Data(http.StatusOK, "application/octet-stream", zipBuffer.Bytes())
	} else {
		c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.md"`, docToken))
		c.Data(http.StatusOK, "application/octet-stream", []byte(result))
	}
}
