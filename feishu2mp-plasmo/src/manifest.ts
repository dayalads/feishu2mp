import { defineManifest } from "@plasmo/core/manifest"

export default defineManifest(() => ({
  manifest_version: 3,
  name: "飞书文档转微信公众号（Plasmo）",
  version: "1.0.0",
  permissions: ["storage", "activeTab", "scripting", "tabs", "sidePanel"],
  host_permissions: [
    "https://*.feishu.cn/*",
    "https://*.larksuite.com/*",
    "https://*.f.mioffice.cn/*",
    "https://*.sg.larksuite.com/*"
  ],
  action: {
    default_icon: {
      16: "assets/icon16.png",
      32: "assets/icon32.png",
      48: "assets/icon48.png",
      128: "assets/icon128.png"
    }
  },
  side_panel: {
    default_path: "sidepanel.html"
  },
  icons: {
    16: "assets/icon16.png",
    32: "assets/icon32.png",
    48: "assets/icon48.png",
    128: "assets/icon128.png"
  }
}))