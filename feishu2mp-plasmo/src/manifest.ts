export default {
  manifest_version: 3,
  name: "飞书文档转微信公众号",
  short_name: "飞书转公众号",
  description: "在飞书文档页面侧边栏，一键转换为 Markdown 与微信公众号 HTML。作者：公众号 饼干哥哥AGI",
  version: "1.0.0",
  author: "公众号：饼干哥哥AGI",
  homepage_url: "https://mp.weixin.qq.com/",
  permissions: ["storage", "activeTab", "scripting", "tabs", "sidePanel"],
  host_permissions: [
    "https://*.feishu.cn/*",
    "https://*.larksuite.com/*",
    "https://*.f.mioffice.cn/*",
    "https://*.sg.larksuite.com/*"
  ],
  action: {
    default_title: "飞书文档转公众号 | 公众号：饼干哥哥AGI",
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
  // 在 MV3 中，选项页使用 options_ui
  options_ui: {
    page: "options.html",
    open_in_tab: true
  },
  icons: {
    16: "assets/icon16.png",
    32: "assets/icon32.png",
    48: "assets/icon48.png",
    128: "assets/icon128.png"
  }
}