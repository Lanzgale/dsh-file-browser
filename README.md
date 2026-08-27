# dsh-file-browser

> **File Browser for DeepSeek Harness** — right-side resizable file tree with Markdown rendering, syntax highlighting, in-panel editing, and a built-in light/dark theme switch. Install: `dsh plugin --profile web add dsh-file-browser`.

DeepSeek Harness 的全局文件浏览器插件：在任何会话的标题栏右侧提供文件夹切换按钮，点击后在页面**右侧**打开可调宽度的文件树面板。

> **上游**：本插件 fork 自 [joejojoking-cloud/dsh-file-explorer](https://github.com/joejojoking-cloud/dsh-file-explorer)（MIT License），已更名并深度定制（双主题、字号缩放、刷新保持展开、隐藏文件开关、内嵌预览等）。原始版权归上游作者所有。

## 功能

- 右侧面板（`shell.overlay`，可开关）：左边缘拖拽调宽，双击聊天区域收回
- 标题栏：「文件预览」+ 六个图标 —— 深色/浅色切换（太阳/月亮）、隐藏文件开关（眼睛）、刷新、关闭
- 文件树：根目录默认展开，目录点击展开/折叠（懒加载），单击文本文件立即内嵌预览，单击非文本仅选中
- 预览：`.md` 渲染 Markdown（标题/列表/代码块/引用/链接），代码按扩展名自动语法高亮；顶栏字号缩放按钮（60%–180%）
- 超过 1 MB 的文件提示不支持预览
- 专注浏览：**搜索功能已移除**（查找文件请交给 agent 或命令行）；目录列表与展开状态**持久化**，关网页/刷新/重启后秒回原样

## 缓存与刷新

- 目录列表缓存 + **展开状态**持久化在浏览器 localStorage（按工作区根目录）：关网页、Ctrl+Shift+R、重启 DSH 后重开面板，**原样恢复**（含展开的目录）
- 树**不是实时扫描**：目录首次展开时扫描并缓存；收起再展开、面板重开都用缓存（秒回）
- 刷新按钮**只重新扫描已展开的目录**，未展开目录沿用缓存
- 文件有增删时树先显示旧状态，点**刷新按钮**更新
- 缓存仅在两种情况下丢失：清除该站点的浏览器数据、隐私/无痕模式关窗

## 预览支持的文件类型

单击文本文件立即内嵌预览（代码按扩展名自动语法高亮）：

| 类别 | 扩展名 |
|---|---|
| Markdown | `.md` `.markdown` `.mdown` `.mkd` —— 渲染标题/列表/代码块/引用/链接；顶栏可切换「源码 / 预览」 |
| 纯文本 | `.txt` |
| 脚本 / 代码 | `.py` `.pyw`、`.js` `.mjs` `.cjs` `.jsx`、`.ts` `.mts` `.cts` `.tsx`、`.c` `.h`、`.cpp` `.cc` `.cxx` `.hpp` `.hh` `.hxx`、`.java`、`.go`、`.rs`、`.sh` `.bash` `.zsh` |
| 数据 / 配置 | `.json` `.jsonc` `.map`、`.yaml` `.yml`、`.toml`、`.ini` `.cfg` `.conf`、`.sql` |
| 标记 / 样式 | `.html` `.htm`、`.css` `.scss` `.less` |

**不能预览**：

- **非文本 / 二进制文件**（图片、PDF、音视频、压缩包、可执行文件等）——单击仅选中，不读取内容
- **超过 1 MB 的文本文件**——提示「文件过大，不支持预览」

## 安装

```sh
dsh plugin --profile web add <本包路径或 npm 包名>
```

重启 harness 后生效：所有会话都会加载该插件（host 路由 `/plugins/file-browser/*` + web client 面板）。

## 结构

- `lib/index.js` — host 半部：`fs`/`shell` 服务 + `webServer` HTTP 路由（list / read / write / open-vscode）
- `lib/client.js` — web client 半部：`window.__ModuleLoader__` bundle，注册 `shell.overlay` 面板与 `conversation.session.header.actions` 切换按钮
- `cordis.patch.yml` — bundle 补丁，把 `file-browser` 行插入 profile 的 host 组合

## 本地开发速查

- 架构速查：`~/file/dsh/notes/architecture-dsh-file-browser.md`（当前路径）
- client 改动刷新即生效；host 改动需重启 DSH
