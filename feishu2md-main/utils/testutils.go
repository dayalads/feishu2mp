package utils

import (
	"log"
	"os"
	"path/filepath"
	"regexp"
	"runtime"

	"github.com/joho/godotenv"
)

const projectDirName = "feishu2md"

// LoadEnv loads env vars from .env
func LoadEnv() {
	re := regexp.MustCompile(`^(.*` + projectDirName + `)`)
	cwd, _ := os.Getwd()
	rootPath := re.Find([]byte(cwd))

	err := godotenv.Load(string(rootPath) + `/.env`)
	if err != nil {
		log.Fatal("Can not load .env file")
		os.Exit(-1)
	}
}

// LoadEnvSilent loads env vars from .env, but doesn't fail if file doesn't exist
func LoadEnvSilent() error {
	re := regexp.MustCompile(`^(.*` + projectDirName + `)`)
	cwd, _ := os.Getwd()
	rootPath := re.Find([]byte(cwd))

	err := godotenv.Load(string(rootPath) + `/.env`)
	if err != nil {
		// 文件不存在是正常的，不报错
		return err
	}
	return nil
}

func RootDir() string {
	_, b, _, _ := runtime.Caller(0)
	root := filepath.Join(filepath.Dir(b), "..")
	return root
}
