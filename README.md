# dsh-file-browser

> **File Browser for DeepSeek Harness** — right-side resizable file tree with Markdown rendering, syntax highlighting, and in-panel editing. Install: `dsh plugin --profile web add dsh-file-browser`.

DeepSeek Harness 的全局文件浏览器插件：在**右侧边栏**里画一棵文件树，单击文本文件即时预览、可直接编辑。侧边栏本身（列的开合、标题行、右上角按钮、深浅配色）由接口插件 `dsh-rightbar-shell` 提供；本插件只负责树和预览这两块内容。

> **上游**：本插件 fork 自 [joejojoking-cloud/dsh-file-explorer](https://github.com/joejojoking-cloud/dsh-file-explorer)（MIT License），已更名并深度定制（双主题、字号缩放、刷新保持展开、隐藏文件开关、内嵌预览等）。原始版权归上游作者所有。

## 功能

- 右侧面板：本插件向外壳 `dsh-rightbar-shell` 登记一个**档位**（`ctx.rightbarShell.addMode`），内容就画在那一列里；开合走会话标题栏右上角的入口按钮
- 标题行由接口插件绘制：左边是「图标 + 当前浏览器名」的切换按钮，右端依次是 深浅切换 / **显示隐藏文件** / **刷新** / 收起侧边栏（中间两个由本插件提供）
- 文件树：根目录默认展开，目录点击展开/折叠（懒加载），单击文本文件立即内嵌预览，单击非文本仅选中
- **折叠以下全部**：目录行右端有一个 `chevron-double-up` 按钮，只在该层底下确实还有展开的目录时才出现；点它把那层以下的子孙目录一次性收起（本级保持展开）
- 图标一律取自 Material Design Icons（mdi）的 24×24 路径，随主题文字色自动适配
- 预览：`.md` 渲染 Markdown（标题/列表/代码块/引用/链接），代码按扩展名自动语法高亮；预览工具栏：字号缩放（60%–180%）、重新读取文件、返回文件目录
- 超过 1 MB 的文件提示不支持预览
- 专注浏览：**搜索功能已移除**（查找文件请交给 agent 或命令行）；目录列表与展开状态**持久化**，关网页/刷新/重启后秒回原样
- **新会话页自动隐藏**：未选会话、或当前是空白会话（新建未发言）时不渲染面板，并同时撤掉给内容让位的布局边距；`open` 开关本身不改动，回到真实会话原样恢复

## 缓存与刷新

- 目录列表缓存 + **展开状态**持久化在浏览器 localStorage（按工作区根目录）：关网页、Ctrl+Shift+R、重启 DSH 后重开面板，**原样恢复**（含展开的目录）
- 树**不是实时扫描**：目录首次展开时扫描并缓存；收起再展开、面板重开都用缓存（秒回）
- 刷新按钮**只重新扫描已展开的目录**，未展开目录沿用缓存
- **AI 改文件会自动刷新**：host 把「哪些目录变了」推给面板（实时流），面板只重扫受影响的已展开目录；当前预览的文件若正好在那个目录里也会重读，但**正在编辑时不重读**（免得冲掉没保存的改动）
- 面板**之外**改的文件（终端里手动改、用别的编辑器改）不会推——那类还是点**刷新按钮**
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
- `lib/client.js` — web client 半部：`window.__ModuleLoader__` bundle，向外壳登记 `rightbar` 档位（内容 + 工具按钮）
- `cordis.patch.yml` — bundle 补丁，把 `file-browser` 行插入 profile 的 host 组合

## 本地开发速查

- 架构速查：`~/file/dsh/notes/archive/插件开发/note_dsh-file-browser-architecture.md`（已归档）
- client 改动刷新即生效；host 改动需重启 DSH
