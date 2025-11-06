# 飞书文档转 Markdown / 微信公众号 HTML（feishu2mp）

本仓库包含两个子模块：
- `feishu2md-main`：Go 实现的命令行工具与后端 Web 服务，用于拉取与解析飞书文档，输出 Markdown 与微信公众号兼容的 HTML。
- `feishu2mp-plasmo`：基于 Plasmo 的浏览器扩展，在飞书文档页面侧边栏一键转换并复制/下载 Markdown 或公众号 HTML，可连接本地后端服务。

适用场景：在飞书文档（`docx/wiki/docs`）中撰写内容后，快速生成 Markdown 或适配微信公众号编辑器的 HTML，并支持基础样式主题定制。

---

## 项目结构与核心逻辑

- **后端（Go）**
  - 命令行 `feishu2md`：
    - `config` 命令：配置 App ID/Secret。
    - `download` 命令：下载单文档或批量/知识库为 Markdown。
  - Web 服务 `feishu2md4web`：
    - `GET /api/markdown`：输入飞书文档链接，返回 Markdown（JSON）。
    - `GET /convert`：飞书文档 → Markdown → 微信公众号 HTML（纯内联样式），返回 HTML 文本。
    - `GET /theme`：返回后端主题 JSON（默认读取仓库根目录或后端工作目录中的 `theme.wechat.json`）。
  - 关键实现：
    - `core/client.go` 通过 Feishu/Lark Open API 拉取文档与素材。
    - `core/parser.go` 将飞书文档结构解析为 Markdown。
    - `core/wechat_html.go` 将 Markdown 转换为公众号兼容 HTML：移除 `style/link/script`，清理 `class/id`，图片转为 `https` 或 `data URI`，按主题为标签添加内联样式。
    - `web/convert_handler.go` 串联完整流程，处理图片与主题，输出 HTML。

- **浏览器扩展（Plasmo / React）**
  - 侧边栏 `src/sidepanel.tsx`：在飞书文档页面检测 URL，调用后端 `convert`/`api/markdown` 接口，一键转换、复制、下载，并保存历史。
  - 选项页 `src/options.tsx`：保存 `APP ID`、`APP SECRET`、后端地址（默认 `http://localhost:8080`），可上传自定义主题（保存在 `chrome.storage`）。
  - 内容脚本 `src/contents/feishu.ts`：在飞书域名下提取页面信息及 URL 作为兜底来源。
  - `src/lib/convert.ts`：封装与后端的交互与前端下载/复制工具；支持从后端获取默认主题或使用用户上传主题。

---

## 快速开始

- 前置要求：
  - Go `1.21+`
  - Node.js `18+`（建议），`pnpm 9+`
  - 浏览器（Chrome 115+ 或支持 `sidePanel` 的 Chromium 浏览器）

### 启动后端服务（本地）

1. 启动 Web 服务：
   - 使用 `make`：
     ```bash
     cd feishu2md-main
     make server
     ./feishu2md4web
     ```
   - 或直接运行：
     ```bash
     cd feishu2md-main/web
     go run .
     ```

2. 设置凭证（可选，亦可通过查询参数传入）：
   ```bash
   cd feishu2md-main
   ./feishu2md config --appId <APP_ID> --appSecret <APP_SECRET>
   ```

3. Docker 运行（可选）：
   ```bash
   cd feishu2md-main
   make image
   docker run -it --rm -p 8080:8080 feishu2md
   ```

后端默认监听 `http://localhost:8080`。

### 开发/预览浏览器扩展

```bash
cd feishu2mp-plasmo
pnpm i
pnpm dev   # 打开 Plasmo 开发预览
```

- 在浏览器扩展页面加载开发产物或使用 Plasmo 的 Dev 工具预览。
- 打开任意飞书文档页面，点击扩展图标打开侧边栏，即可使用。

### 打包扩展

```bash
cd feishu2mp-plasmo
pnpm build
pnpm package
```

---

## 社区与作者

欢迎平时有在用 AI 开发产品的同学加入「AI 开发者交流群」。

![AI 开发者交流群二维码](./微信图片_20251106173621_2310_102.jpg)

作者：公众号「饼干哥哥AGI」。

---

## 使用说明

- 在飞书文档页，打开扩展侧边栏：
  - 转 Markdown：复制或下载 `.md` 文件。
  - 转公众号 HTML：复制或下载 `.html`，直接粘贴至公众号编辑器。
- 在选项页设置：
  - `APP ID`、`APP SECRET`（保存在 `chrome.storage`，不会上传）。
  - 后端地址（默认 `http://localhost:8080`）。
  - 自定义主题 JSON（优先级高于后端默认主题）。

---

## API 端点（后端）

- `GET /api/markdown?url=<doc-url>&app_id=<id>&app_secret=<secret>&format=json`
  - 返回：`{ markdown, url, docToken, docType, hasImages }`
- `GET /convert?url=<doc-url>&app_id=<id>&app_secret=<secret>`
  - 返回：`text/html`（纯 HTML 文本，适配公众号，内联样式）
- `GET /theme`（可选 `?name=theme.wechat.json`）
  - 返回：主题 JSON（默认读取工作目录或上级目录）。

---

## 主题定制

- 仓库提供示例：`theme.wechat.json`（微信风）、`theme.reddit.json`（示例风格）。
- 扩展中可上传自定义主题（JSON），包含：
  - `tags`: 标签样式映射，如 `p/h1/h2/...` 对应内联样式字符串。
  - `pre_code`: `<pre><code>` 的 `code` 内联样式。
- 后端会优先返回本地 `theme.wechat.json`；前端若上传了主题则优先使用上传主题。

---

## 常见问题

- 无法转换/鉴权失败：请确认在飞书开放平台为应用开通必要权限，并确保链接为新版文档（`docx`/`wiki`）。
- 图片过大或来源跨域：后端会尝试转为 `data URI`；生产环境建议对图片走图床/CDN。
- 侧边栏未显示：浏览器版本需支持 `sidePanel`；或点击扩展图标尝试打开。

---

## 开发与测试

- Go 格式化与测试：
  ```bash
  cd feishu2md-main
  make format
  make test
  ```
- 前端类型检查：
  ```bash
  cd feishu2mp-plasmo
  pnpm build
  ```

---

## 许可证

本仓库包含第三方 `feishu2md` 相关代码，保留原 LICENSE。请参考子模块内的 `LICENSE`。