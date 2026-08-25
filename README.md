# dsh-file-browser

> **File Browser for DeepSeek Harness** — right-side resizable file tree with Markdown rendering, syntax highlighting, in-panel editing, and a built-in light/dark theme switch. Install: `dsh plugin --profile web add dsh-file-browser`.

DeepSeek Harness 的全局文件浏览器插件：在任何会话的标题栏右侧提供文件夹切换按钮，点击后在页面**右侧**打开可调宽度的文件树面板。

> **上游**：本插件 fork 自 [joejojoking-cloud/dsh-file-explorer](https://github.com/joejojoking-cloud/dsh-file-explorer)（MIT License），已更名并深度定制（双主题、字号缩放、刷新保持展开、隐藏文件开关、内嵌预览等）。原始版权归上游作者所有。

## 功能

- 右侧面板（`shell.overlay`，可开关）：左边缘拖拽调宽，双击聊天区域收回
- 标题栏：「文件预览」+ 六个图标 —— 深色/浅色切换（太阳/月亮）、隐藏文件开关（眼睛）、刷新、关闭
- 搜索框「搜索文件」：递归扫描工作区（跳过 `.git` / `node_modules`，最多 300 条）
- 文件树：根目录默认展开，目录点击展开/折叠（懒加载），单击文本文件立即内嵌预览，单击非文本仅选中
- 预览：`.md` 渲染 Markdown（标题/列表/代码块/引用/链接），代码按扩展名自动语法高亮；顶栏 A−/A+ 缩放字号（60%–180%）
- 超过 1 MB 的文件提示不支持预览

## 安装

```sh
dsh plugin --profile web add <本包路径或 npm 包名>
```

重启 harness 后生效：所有会话都会加载该插件（host 路由 `/plugins/file-browser/*` + web client 面板）。

## 结构

- `lib/index.js` — host 半部：`fs`/`shell` 服务 + `webServer` HTTP 路由（list / search / read / write / open-vscode）
- `lib/client.js` — web client 半部：`window.__ModuleLoader__` bundle，注册 `shell.overlay` 面板与 `conversation.session.header.actions` 切换按钮
- `cordis.patch.yml` — bundle 补丁，把 `file-browser` 行插入 profile 的 host 组合

## 本地开发速查

- 架构速查：`~/file/dsh/notes/architecture-dsh-file-browser.md`（当前路径）
- client 改动刷新即生效；host 改动需重启 DSH
