package main

import (
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

// themeHandler 返回主题 JSON 内容，供前端插件获取
func themeHandler(c *gin.Context) {
	// 允许通过 ?name= 指定文件名，默认 theme.wechat.json
	name := c.Query("name")
	if name == "" {
		name = "theme.wechat.json"
	}

	// 搜索路径：仅当前目录与上级目录的默认文件，不再读取环境变量
	themePath := ""
	cwd, _ := os.Getwd()
	p1 := filepath.Join(cwd, name)
	p2 := filepath.Join(filepath.Dir(cwd), name)
	if _, err := os.Stat(p1); err == nil {
		themePath = p1
	} else if _, err := os.Stat(p2); err == nil {
		themePath = p2
	}

	// 如果未找到文件，返回 404
	if themePath == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "theme file not found"})
		return
	}

	data, err := ioutil.ReadFile(themePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Header("Content-Type", "application/json; charset=utf-8")
	c.String(http.StatusOK, string(data))
}