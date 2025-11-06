package main

import (
	"embed"
	"html/template"
	"log"
	"net/http"
	"os"

	"github.com/Wsine/feishu2md/utils"
	"github.com/gin-gonic/gin"
)

//go:embed templ/*
var f embed.FS

func main() {
	// 设置GIN_MODE为release，避免加载.env文件（凭证通过API参数传递）
	if mode := os.Getenv("GIN_MODE"); mode != "release" {
		// 尝试加载.env文件，如果不存在也不报错（凭证通过API参数传递）
		_ = utils.LoadEnvSilent()
	}

	router := gin.New()

	// 添加CORS中间件，允许浏览器扩展访问
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	templ := template.Must(template.New("").ParseFS(f, "templ/*.templ.html"))
	router.SetHTMLTemplate(templ)

	router.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.templ.html", nil)
	})
	router.GET("/download", downloadHandler)
	router.GET("/api/markdown", downloadHandler) // New API endpoint that returns JSON
	router.GET("/convert", convertHandler)       // 飞书文档 → Markdown → 微信公众号 HTML
	router.GET("/theme", themeHandler)           // 返回主题 JSON 配置
	router.OPTIONS("/api/markdown", func(c *gin.Context) {
		c.AbortWithStatus(204)
	})
	router.OPTIONS("/convert", func(c *gin.Context) {
		c.AbortWithStatus(204)
	})
	router.OPTIONS("/theme", func(c *gin.Context) {
		c.AbortWithStatus(204)
	})

	// 指定端口8080
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 飞书文档转Markdown后端服务启动中...")
	log.Printf("📡 监听地址: http://localhost:%s", port)
	log.Printf("📝 API端点: http://localhost:%s/api/markdown", port)
	log.Printf("📱 微信公众号HTML转换端点: http://localhost:%s/convert", port)
	log.Printf("🎨 主题配置端点: http://localhost:%s/theme", port)
	log.Printf("✅ CORS已启用，允许浏览器扩展访问")

	if err := router.Run(":" + port); err != nil {
		log.Panicf("error: %s", err)
	}
}
