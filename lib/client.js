window.__ModuleLoader__.load({
	id: "dsh-file-browser",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var react = require("react");

		// ---------- styles ----------
		const CSS = `
/* 面板根：这一列由外壳（dsh-rightbar-shell）提供——位置、列宽、分隔线、背景、
   标题行都归外壳，这里只负责铺满它给的那块地方。 */
.fe-panel {
  position: relative;
  width: 100%; height: 100%; min-width: 0; max-width: none;
  display: flex; flex-direction: column;
  /* ---- 插件自有配色变量(浅色,默认) ---- */
  --fe-bg: #f4f6f9;           /* 面板背景 */
  --fe-bg-1: #ffffff;         /* layer-1: 搜索框/行悬停/代码区 */
  --fe-bg-2: #e9ecf2;         /* layer-2: 行选中/md code */
  --fe-border: #d7dbe3;       /* border-l1 */
  --fe-border-2: #c3c9d4;     /* border-l2 */
  --fe-fg: #1f2430;           /* 主文字 */
  --fe-fg-2: #5c6470;         /* 次要文字 */
  --fe-accent: #4d6bfe;       /* 品牌蓝 */
  --fe-ok: #18a058;
  --fe-err: #d03050;
  --fe-shadow: rgba(0,0,0,.12);
  --fe-hl-comment: #6b7280; --fe-hl-string: #2e7d32; --fe-hl-number: #b45309;
  --fe-hl-keyword: #7c3aed; --fe-hl-builtin: #0e7490; --fe-hl-type: #b45309;
  --fe-hl-func: #1d4ed8; --fe-hl-prop: #be185d; --fe-hl-operator: #374151;
  --fe-hl-attr: #b45309; --fe-hl-directive: #7c3aed;
  background: transparent;
  color: var(--fe-fg);
  font-size: 13px; line-height: 1.45;
  pointer-events: auto;
  box-sizing: border-box;
}
/* ---- 深色方案(点太阳/月亮按钮切换;参考 DSH 官方配色 #1B1B1C/#2D2D2E/#679EFE) ---- */
.fe-panel.fe-theme-dark {
  --fe-bg: #1B1B1C;
  --fe-bg-1: #2D2D2E;
  --fe-bg-2: #2D2D2E;
  --fe-border: #3a3a3b;
  --fe-border-2: #4a4a4c;
  --fe-fg: #e8eaee;
  --fe-fg-2: #9aa2ad;
  --fe-accent: #679EFE;
  --fe-ok: #63c99a;
  --fe-err: #f07178;
  --fe-shadow: rgba(0,0,0,.5);
  --fe-hl-comment: #7f848e; --fe-hl-string: #98c379; --fe-hl-number: #d19a66;
  --fe-hl-keyword: #c678dd; --fe-hl-builtin: #56b6c2; --fe-hl-type: #e5c07b;
  --fe-hl-func: #61afef; --fe-hl-prop: #e06c75; --fe-hl-operator: #abb2bf;
  --fe-hl-attr: #d19a66; --fe-hl-directive: #c678dd;
}
.fe-panel * { box-sizing: border-box; }
/* 面板根容器：必须显式撑满，否则会缩成内容宽（跟列宽脱节）。 */
.fe-overlay-root { width: 100%; height: 100%; min-width: 0; display: flex; flex-direction: column; }
.fe-header {
  display: flex; align-items: center; gap: 2px;
  padding: 7px 8px;
  border-bottom: 1px solid var(--fe-border);
  flex: none;
}
.fe-title { font-weight: 600; flex: 1; padding: 0 4px; }
.fe-iconbtn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0;
  border: none; border-radius: 7px;
  background: transparent;
  /* 这些按钮现在长在外壳的标题行里（不在 .fe-panel 内），
     --fe-* 那套变量在那里是不存在的 —— 所以以官方主题令牌为准，
     这样和外壳自己的关闭按钮、以及预览页里的同类按钮完全一致。 */
  color: var(--rb-fg-2, var(--fe-fg-2));
  cursor: pointer;
}
.fe-iconbtn:hover { background: rgba(127,127,127,.16); color: var(--rb-fg, var(--fe-fg)); }
.fe-iconbtn-on { color: var(--rb-accent, var(--fe-accent)); }
.fe-status { padding: 4px 10px; font-size: 11px; flex: none; }
.fe-status-ok { color: var(--fe-ok); }
.fe-status-err { color: var(--fe-err); }
.fe-tree { flex: 1; overflow: auto; padding: 2px 0 8px; user-select: none; }
.fe-row {
  display: flex; align-items: center; gap: 4px;
  padding: 2px 8px; margin: 0 4px;
  border-radius: 5px; cursor: pointer; white-space: nowrap;
}
.fe-row:hover { background: var(--fe-bg-1); }
.fe-row-selected { background: var(--fe-bg-2); }
.fe-row-selected .fe-node-name { color: var(--fe-fg); }
.fe-chevron {
  width: 14px; height: 14px; flex: none;
  display: flex; align-items: center; justify-content: center;
  color: var(--fe-fg-2);
}
.fe-chevron-none { visibility: hidden; }
.fe-node-icon { display: flex; flex: none; }
.fe-node-dir { color: var(--fe-accent); }
.fe-node-file { color: var(--fe-fg-2); }
.fe-node-name { overflow: hidden; text-overflow: ellipsis; }
.fe-node-size, .fe-node-rel {
  margin-left: auto; padding-left: 8px; flex: none;
  color: var(--fe-fg-2); font-size: 11px;
}
.fe-node-rel { max-width: 45%; overflow: hidden; text-overflow: ellipsis; }
.fe-node-loading { color: var(--fe-fg-2); font-size: 11px; }
/* 目录行右端的「折叠以下全部」：只在真有东西可折的行上渲染，所以不藏 */
.fe-collapse-btn {
  display: flex; margin-left: auto; flex: none;
  width: 20px; height: 20px; padding: 2px;
  border: none; background: 0 0;
  color: var(--rb-fg-2, var(--fe-fg-2)); cursor: pointer;
  align-items: center; justify-content: center;
}
.fe-collapse-btn:hover { color: var(--rb-accent, var(--fe-accent)); }
.fe-node-error { color: var(--fe-err); font-size: 12px; padding: 4px 8px; }
.fe-empty { color: var(--fe-fg-2); padding: 14px 10px; font-size: 12px; }
.fe-preview-body { flex: 1; display: flex; flex-direction: column; min-height: 0; }
/* 预览时把文件树藏起来（注意是藏、不是卸载）：滚动位置和展开状态都留在 DOM 里，
   返回时才有可能"目标行已经看得见就不动它"。 */
.fe-panel-previewing .fe-tree { display: none; }
.fe-preview-plain {
  flex: 1; overflow: auto; margin: 0;
  padding: 8px 10px;
  background: var(--fe-bg-1);
  color: var(--fe-fg);
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Courier New', monospace;
  font-size: calc(var(--fe-preview-scale, 1) * 12px); line-height: 1.5;
  white-space: pre-wrap; word-break: break-word;
}
.fe-editor-head {
  display: flex; align-items: center; gap: 2px;
  /* 与外壳标题行同高（10 + 28 + 10 = 48），上下留白相等 */
  padding: 10px 8px; flex: none;
  border-bottom: 1px solid var(--fe-border);
  color: var(--rb-fg-2, var(--fe-fg-2)); font-size: 13px;
}
.fe-editor-name { font-weight: 600; font-size: 14px; color: var(--rb-fg, var(--fe-fg)); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fe-btn {
  padding: 2px 9px; flex: none;
  border: 1px solid var(--fe-border-2); border-radius: 5px;
  background: var(--fe-bg-1); color: var(--fe-fg);
  font-size: 12px; cursor: pointer;
}
.fe-btn:hover { border-color: var(--fe-accent); color: var(--fe-accent); }
.fe-editor-textarea {
  flex: 1; width: 100%; resize: none;
  padding: 8px; border: none; outline: none;
  background: var(--fe-bg-1);
  color: var(--fe-fg);
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Courier New', monospace;
  font-size: calc(var(--fe-preview-scale, 1) * 12px); line-height: 1.5; white-space: pre;
}
.fe-editor-msg { padding: 10px 12px; font-size: 12px; color: var(--fe-fg-2); }
.fe-editor-msg.fe-err { color: var(--fe-err); }
.fe-md {
  flex: 1; overflow: auto; padding: 10px 14px;
  font-size: calc(var(--fe-preview-scale, 1) * 13px); line-height: 1.6; word-break: break-word;
}
.fe-md h1 { font-size: calc(var(--fe-preview-scale, 1) * 20px); margin: 10px 0 6px; }
.fe-md h2 { font-size: calc(var(--fe-preview-scale, 1) * 17px); margin: 10px 0 6px; }
.fe-md h3 { font-size: calc(var(--fe-preview-scale, 1) * 15px); margin: 8px 0 4px; }
.fe-md h4, .fe-md h5, .fe-md h6 { font-size: calc(var(--fe-preview-scale, 1) * 13px); margin: 8px 0 4px; }
.fe-md p { margin: 6px 0; }
.fe-md ul, .fe-md ol { margin: 6px 0; padding-left: 22px; }
.fe-md li { margin: 2px 0; }
.fe-md strong { font-weight: 700; }
.fe-md em { font-style: italic; }
.fe-md del { text-decoration: line-through; }
.fe-md code {
  background: var(--fe-bg-2); border-radius: 3px; padding: 1px 4px;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px;
}
.fe-md pre {
  background: var(--fe-bg-2); border: 1px solid var(--fe-border);
  border-radius: 6px; padding: 8px 10px; overflow: auto; margin: 8px 0;
}
.fe-md pre code { background: none; padding: 0; }
.fe-md a { color: var(--fe-accent); }
.fe-md blockquote {
  border-left: 3px solid var(--fe-border-2);
  margin: 6px 0; padding: 2px 10px;
  color: var(--fe-fg-2);
}
.fe-md hr { border: none; border-top: 1px solid var(--fe-border); margin: 10px 0; }
.fe-md table { border-collapse: collapse; margin: 8px 0; width: 100%; font-size: 12.5px; }
.fe-md th, .fe-md td { border: 1px solid var(--fe-border); padding: 4px 8px; text-align: left; }
.fe-md th { background: var(--fe-bg-2); font-weight: 600; }
.fe-md table code { font-size: 11.5px; }
.fe-md input[type=checkbox] { vertical-align: -2px; margin-right: 6px; }
.fe-md img { max-width: 100%; border-radius: 4px; }
.fe-hl { tab-size: 4; }
.fe-hl .fe-tok-c { color: var(--fe-hl-comment); font-style: italic; }
.fe-hl .fe-tok-s { color: var(--fe-hl-string); }
.fe-hl .fe-tok-n { color: var(--fe-hl-number); }
.fe-hl .fe-tok-k { color: var(--fe-hl-keyword); }
.fe-hl .fe-tok-b { color: var(--fe-hl-builtin); }
.fe-hl .fe-tok-t { color: var(--fe-hl-type); }
.fe-hl .fe-tok-f { color: var(--fe-hl-func); }
.fe-hl .fe-tok-p { color: var(--fe-hl-prop); }
.fe-hl .fe-tok-o { color: var(--fe-hl-operator); }
.fe-hl .fe-tok-a { color: var(--fe-hl-attr); }
.fe-hl .fe-tok-d { color: var(--fe-hl-directive); }
`;

		// ---------- 目录排列 ----------
		// 文件夹在上、文件在下，两组各自按名称升序（文件夹在前，树看起来更紧凑）。
		// 名称比较分两档：数字／英文按 A→Z，中文名整档排在后面、档内按拼音。
		// 这样新加一个中文名文件不会插到最前面顶掉一屏，英文那一档的位置也稳定。
		const isCJK = (s) => /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(s);
		const byNameInGroup = (a, b) => {
			const an = String((a && a.name) || '');
			const bn = String((b && b.name) || '');
			const ad = a && a.type === 'directory' ? 1 : 0;
			const bd = b && b.type === 'directory' ? 1 : 0;
			if (ad !== bd) return bd - ad; // 目录（1）在前，文件（0）在后
			const ac = isCJK(an) ? 1 : 0;
			const bc = isCJK(bn) ? 1 : 0;
			if (ac !== bc) return ac - bc;
			// numeric：数字按数值比（2 排在 10 前面）；'zh' 让中文走拼音序
			return an.localeCompare(bn, 'zh', { numeric: true });
		};
		// 统一在「数据进入缓存」的两个入口排一次（取数 / 读本地缓存），
		// 缓存里的顺序因此永远是排好的——渲染那边不必再管顺序，旧版本留下的
		// 缓存读进来也会当场重排，不会一直显示旧顺序。
		const sortEntries = (list) => Array.isArray(list) ? list.slice().sort(byNameInGroup) : list;

		// 从 root 到 dir 这条目录链（含两端），「定位到文件树」靠它逐级展开。
		// dir 不在 root 底下（例如文件属于别的工作区）时返回空数组。
		const dirChainFrom = (root, dir) => {
			if (typeof root !== 'string' || root === '' || typeof dir !== 'string' || dir === '') return [];
			if (dir !== root && dir.indexOf(root + '/') !== 0) return [];
			const chain = [];
			for (let cur = dir; ; ) {
				chain.unshift(cur);
				if (cur === root) break;
				const i = cur.lastIndexOf('/');
				if (i <= 0) break;
				cur = cur.slice(0, i);
			}
			return chain;
		};

		// ---------- fetch API (same origin as the GUI) ----------
		const api = {
			list: (path) => fetch('/plugins/file-browser/list?path=' + encodeURIComponent(path)).then((r) => r.json()).then((res) => {
				if (res && Array.isArray(res.entries)) res.entries = sortEntries(res.entries);
				return res;
			}),
			read: (path) => fetch('/plugins/file-browser/read?path=' + encodeURIComponent(path)).then((r) => r.json()),
			write: (path, content) => fetch('/plugins/file-browser/write', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ path, content }),
			}).then((r) => r.json()),
		};

		const inject = ["slots", "rightbarShell"];

		// 右栏替身（dsh-rightbar-shell）转来的「打开这个文件」请求。
		// 对话里点文件链接 → 官方/替身的 ctx.sidebarRight.openResource
		// → 广播本事件 → 本插件打开面板并载入该文件。
		const OPEN_FILE_EVENT = 'dsh:sidebar-right:open';

		// 告知外壳"标题行我自己来"：打开文档时预览自带一行标题，
		// 外壳把它的标题行让出来 —— 这样永远只有一行，不会两行叠着。
		const PRESENT_EVENT = 'dsh:sidebar-right:present';
		// 右栏主题（外壳广播）：深 / 浅，侧边栏里所有内容插件都跟着走
		const THEME_EVENT = 'dsh:sidebar-right:theme';
		// ⚠️ 必须在"改 editor 的同一个事件里"同步发这个通知。
		// 放到 useEffect 里发的话，React 会先提交一帧"没有标题行"的界面再补上，
		// 看起来就是标题跳一下。
		const notifyHead = (headless) => {
			window.dispatchEvent(new CustomEvent(PRESENT_EVENT, { detail: { headless: !!headless } }));
		};

		// ---------- shared store ----------
		// 本插件在外壳（dsh-rightbar-shell）里占的档位 id：登记用它，
		// "对话里点了文件、把这一列切回预览"也用它。
		const MODE_ID = 'files';
		// 外壳服务（在 apply 里取到）：档位切换、全屏都归它管。
		let SHELL = null;
		const store = {
			open: false,
			rootPath: null,
			// 待打开的文件请求（由 OPEN_FILE_EVENT 写入，ExplorerPanel 消费）
			pendingOpen: null,
			openSeq: 0,
			// 工具栏状态放这里：那三个按钮渲染在外壳的标题行里（不在面板的 React 树内），
			// 只能靠共享 store 拿到它们的状态。
			// 深浅由外壳（dsh-rightbar-shell）拥有并持久化，这里只跟随它的广播
			dark: true,
			// 全屏同理：真相在外壳，这里只镜像一份给预览工具栏的按钮用
			fullscreen: false,
			showHidden: false,
			refreshFn: null,
			listeners: new Set(),
		};
		const emit = () => { for (const fn of Array.from(store.listeners)) fn() };
		const setDark = (v) => { store.dark = !!v; emit() };
		const setShowHidden = (v) => { store.showHidden = !!v; emit() };
		const subscribe = (fn) => { store.listeners.add(fn); return () => { store.listeners.delete(fn) } };
		const setOpen = (value) => { store.open = !!value; emit() };
		// 全屏归外壳（它才握着布局）：本插件只转达请求。
		const setFullscreen = (v) => { if (SHELL) SHELL.setFullscreen(v) };

		// ---------- 目录列表缓存持久化(localStorage,跨页面刷新 / DSH 重启保持) ----------
		const CACHE_PREFIX = 'fe-tree-cache:';
		const EXPANDED_PREFIX = 'fe-tree-expanded:';
		const MAX_CACHED_DIRS = 120; // 最多持久化 120 个目录;超出丢弃最早的
		const loadTreeCache = (rootPath) => {
			try {
				const raw = window.localStorage.getItem(CACHE_PREFIX + rootPath);
				if (!raw) return null;
				const arr = JSON.parse(raw);
				if (!Array.isArray(arr)) return null;
				const cache = new Map();
				for (const pair of arr) {
					if (!Array.isArray(pair) || typeof pair[0] !== 'string' || !Array.isArray(pair[1])) continue;
					cache.set(pair[0], sortEntries(pair[1]));
				}
				return cache;
			} catch { return null }
		};
		const saveTreeCache = (rootPath, cache) => {
			if (!cache || cache.size === 0) return; // 空缓存不覆盖已存数据
			try {
				const arr = Array.from(cache.entries()).slice(0, MAX_CACHED_DIRS);
				window.localStorage.setItem(CACHE_PREFIX + rootPath, JSON.stringify(arr));
			} catch { /* 容量/隐私模式等失败时静默 */ }
		};
		const loadExpanded = (rootPath) => {
			try {
				const raw = window.localStorage.getItem(EXPANDED_PREFIX + rootPath);
				if (!raw) return null;
				const arr = JSON.parse(raw);
				return Array.isArray(arr) ? arr.filter((p) => typeof p === 'string') : null;
			} catch { return null }
		};
		const saveExpanded = (rootPath, expanded) => {
			if (!expanded || expanded.size === 0) return;
			try {
				window.localStorage.setItem(EXPANDED_PREFIX + rootPath, JSON.stringify(Array.from(expanded)));
			} catch { /* 静默 */ }
		};

		const useStore = () => {
			const [, setTick] = react.useState(0);
			react.useEffect(() => subscribe(() => setTick((x) => x + 1)), []);
			return store;
		};

		// ---------- markdown ----------
		const isMarkdown = (name) => /\.(md|markdown|mdown|mkd)$/i.test(name);
		const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
		const mdInline = (s) => {
			let t = escapeHtml(s);
			t = t.replace(/`([^`\n]+)`/g, (m, c) => '<code>' + c + '</code>');
			t = t.replace(/\*\*([^*]+)\*\*/g, (m, c) => '<strong>' + c + '</strong>');
			t = t.replace(/~~([^~]+)~~/g, (m, c) => '<del>' + c + '</del>');
			t = t.replace(/\*([^*\s][^*]*)\*/g, (m, c) => '<em>' + c + '</em>');
			t = t.replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, (m, alt, src) => '<img src="' + src + '" alt="' + alt + '" />');
			t = t.replace(/(?<!!)\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, href) => '<a href="' + href + '" target="_blank" rel="noreferrer">' + txt + '</a>');
			return t;
		};
		const itemContent = (content) => {
			const task = /^\[([ xX])\]\s+(.*)$/.exec(content);
			if (task) return '<input type="checkbox" disabled' + (task[1] !== ' ' ? ' checked' : '') + ' /> ' + mdInline(task[2]);
			return mdInline(content);
		};
		const splitRow = (line) => {
			let s = String(line).trim();
			if (s.startsWith('|')) s = s.slice(1);
			if (s.endsWith('|')) s = s.slice(0, -1);
			return s.split('|').map((c) => c.trim());
		};
		const isTableSep = (line) => /^\s*\|?[\s:|-]+\|?\s*$/.test(String(line)) && String(line).includes('-');
		const buildListHtml = (entries, start, minIndent) => {
			let out = '';
			let i = start;
			let currentType = null;
			let open = false;
			while (i < entries.length) {
				const e = entries[i];
				if (e.indent < minIndent) break;
				if (e.indent === minIndent) {
					if (currentType !== e.type) {
						if (open) out += '</' + currentType + '>';
						currentType = e.type;
						out += '<' + currentType + '>';
						open = true;
					}
					let itemHtml = '<li>' + itemContent(e.content);
					if (i + 1 < entries.length && entries[i + 1].indent > minIndent) {
						const sub = buildListHtml(entries, i + 1, entries[i + 1].indent);
						itemHtml += sub.out;
						i = sub.next;
					} else {
						i++;
					}
					itemHtml += '</li>';
					out += itemHtml;
				} else {
					i++;
				}
			}
			if (open) out += '</' + currentType + '>';
			return { out, next: i };
		};
		const renderMarkdown = (text) => {
			const lines = String(text).replace(/\r\n/g, '\n').split('\n');
			const out = [];
			let inCode = false;
			let codeLines = [];
			let codeLang = '';
			const flushCode = () => {
				if (inCode) {
					const lang = hlLangForFence(codeLang);
					const body = lang ? highlight(codeLines.join('\n'), lang) : escapeHtml(codeLines.join('\n'));
					out.push('<pre class="fe-hl' + (lang ? ' lang-' + lang : '') + '"><code>' + body + '</code></pre>');
					codeLines = [];
					inCode = false;
					codeLang = '';
				}
			};
			// Shared GFM table builder: header line + separator line + data rows.
			// Used for plain tables and for tables inside blockquotes.
			const tableFrom = (headerLine, sepLine, rowLines) => {
				const header = splitRow(headerLine);
				const aligns = splitRow(sepLine).map((c) => {
					if (/^:.*:$/.test(c)) return 'center';
					if (/^:/.test(c)) return 'left';
					if (/:$/.test(c)) return 'right';
					return '';
				});
				const cell = (content, tag, idx) => {
					const align = aligns[Math.min(idx, aligns.length - 1)];
					return '<' + tag + (align ? ' style="text-align:' + align + '"' : '') + '>' + mdInline(content) + '</' + tag + '>';
				};
				let html = '<table><thead><tr>';
				header.forEach((c, idx) => { html += cell(c, 'th', idx) });
				html += '</tr></thead><tbody>';
				for (const row of rowLines) {
					html += '<tr>';
					splitRow(row).forEach((c, idx) => { html += cell(c, 'td', idx) });
					html += '</tr>';
				}
				return html + '</tbody></table>';
			};
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (/^```/.test(line.trim())) {
					if (inCode) {
						flushCode(); // closing fence: exit code mode and push the block
					} else {
						inCode = true;
						codeLines = [];
						const fm = /^```\s*([\w+-]*)/.exec(line.trim());
						codeLang = fm && fm[1] ? fm[1] : '';
					}
					continue;
				}
				if (inCode) { codeLines.push(line); continue }
				// GFM table: header row + separator row
				if (/^\s*\|/.test(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
					const rowLines = [];
					let k = i + 2;
					while (k < lines.length && /^\s*\|/.test(lines[k]) && !isTableSep(lines[k])) {
						rowLines.push(lines[k]);
						k++;
					}
					out.push(tableFrom(line, lines[i + 1], rowLines));
					i = k - 1;
					continue;
				}
				const heading = /^(#{1,6})\s+(.*)$/.exec(line);
				if (heading) { out.push('<h' + heading[1].length + '>' + mdInline(heading[2]) + '</h' + heading[1].length + '>'); continue }
				const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line);
				const ordered = /^(\s*)\d+\.\s+(.*)$/.exec(line);
				const listMatch = bullet || ordered;
				if (listMatch) {
					const entries = [];
					let j = i;
					while (j < lines.length) {
						const bl = /^(\s*)[-*+]\s+(.*)$/.exec(lines[j]);
						const ol = /^(\s*)\d+\.\s+(.*)$/.exec(lines[j]);
						const m = bl || ol;
						if (!m) break;
						entries.push({ indent: m[1].length, type: bl ? 'ul' : 'ol', content: m[2] });
						j++;
					}
					out.push(buildListHtml(entries, 0, entries[0].indent).out);
					i = j - 1;
					continue;
				}
				const quote = /^\s*>\s?(.*)$/.exec(line);
				if (quote) {
					// Collect consecutive quoted lines into ONE blockquote, and
					// render GFM tables inside it: a quoted table row starts with
					// "> |", invisible to the plain table detector above.
					const q = [];
					let k = i;
					while (k < lines.length && /^\s*>\s?(.*)$/.exec(lines[k])) {
						q.push(/^\s*>\s?(.*)$/.exec(lines[k])[1]);
						k++;
					}
					const inner = [];
					let qi = 0;
					while (qi < q.length) {
						const ql = q[qi];
						if (/^\s*\|/.test(ql) && qi + 1 < q.length && isTableSep(q[qi + 1])) {
							const rowLines = [];
							let k2 = qi + 2;
							while (k2 < q.length && /^\s*\|/.test(q[k2]) && !isTableSep(q[k2])) {
								rowLines.push(q[k2]);
								k2++;
							}
							inner.push(tableFrom(ql, q[qi + 1], rowLines));
							qi = k2;
							continue;
						}
						if (ql.trim() === '') { qi++; continue }
						inner.push('<p>' + mdInline(ql) + '</p>');
						qi++;
					}
					out.push('<blockquote>' + inner.join('') + '</blockquote>');
					i = k - 1;
					continue;
				}
				if (/^\s*-+\s*$/.test(line)) { out.push('<hr/>'); continue }
				if (line.trim() === '') continue;
				out.push('<p>' + mdInline(line) + '</p>');
			}
			flushCode();
			return out.join('');
		};

		// ---------- syntax highlighting (self-contained, no runtime deps) ----------
		// Extension -> language id for direct file previews.
		const HL_EXT = {
			js: 'js', mjs: 'js', cjs: 'js', jsx: 'js',
			ts: 'ts', mts: 'ts', cts: 'ts', tsx: 'ts',
			json: 'json', jsonc: 'json', map: 'json',
			yaml: 'yaml', yml: 'yaml',
			py: 'python', pyw: 'python',
			c: 'c', h: 'c',
			cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp', hxx: 'cpp',
			java: 'java',
			go: 'go',
			rs: 'rust',
			sh: 'shell', bash: 'shell', zsh: 'shell',
			sql: 'sql',
			toml: 'toml',
			ini: 'ini', cfg: 'ini', conf: 'ini',
			css: 'css', scss: 'css', less: 'css',
			html: 'html', htm: 'html',
			md: 'markdown', markdown: 'markdown', txt: 'text',
		};
		// Fence-info aliases used by markdown code blocks (```lang).
		const HL_ALIAS = {
			javascript: 'js', jsx: 'js', typescript: 'ts', tsx: 'ts',
			py: 'python', 'c++': 'cpp', sh: 'shell', bash: 'shell',
			yml: 'yaml', jsonc: 'json',
		};
		const hlLangFor = (name) => {
			const n = String(name || '').toLowerCase();
			const i = n.lastIndexOf('.');
			const ext = i >= 0 ? n.slice(i + 1) : n;
			return HL_EXT[ext] || '';
		};
		const hlLangForFence = (l) => {
			const s = String(l || '').toLowerCase().trim();
			return HL_ALIAS[s] || HL_EXT[s] || (HL[s] ? s : '');
		};
		// Language configs. Flags: ln=line comment, bl=block comment, bt=backtick,
		// hs=hash comment, hsAny=hash anywhere, pr=preprocessor #, tr=triple quote,
		// de=@decorator, dl=$var, ks=quoted-key (json/yaml), ki=bare key: (yaml),
		// ke=key= (toml/ini), ct=capitalized=type, tg=html tags.
		const HL = {
			js: { ln: '//', bl: true, bt: true, kw: 'break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new of return static super switch this throw try typeof var void while with yield async await', bn: 'console Math JSON Promise Symbol BigInt Array Object String Number Boolean Function Date RegExp Error TypeError RangeError ReferenceError SyntaxError Map Set WeakMap WeakSet Proxy Reflect Intl URL URLSearchParams AbortController AbortSignal fetch setTimeout setInterval clearTimeout clearInterval queueMicrotask structuredClone atob btoa TextEncoder TextDecoder undefined null NaN Infinity globalThis window document process require module exports Buffer' },
			ts: { ln: '//', bl: true, bt: true, ct: true, kw: 'break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new of return static super switch this throw try typeof var void while with yield async await abstract as asserts declare enum implements infer interface is keyof namespace readonly satisfies type unknown using', bn: 'console Math JSON Promise Symbol BigInt Array Object String Number Boolean Function Date RegExp Error TypeError RangeError ReferenceError SyntaxError Map Set WeakMap WeakSet Proxy Reflect URL fetch setTimeout setInterval clearTimeout clearInterval undefined null NaN Infinity globalThis window document process require module exports Buffer any unknown never void', ty: 'string number boolean object symbol bigint' },
			json: { ks: true, kw: 'true false null', bn: '' },
			yaml: { hs: true, ks: true, ki: true, kw: 'true false null yes no on off', bn: '' },
			python: { hs: true, hsAny: true, tr: true, de: true, ct: true, kw: 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case', bn: 'None True False print len range str int float bool list dict set tuple bytes bytearray type object isinstance issubclass super property classmethod staticmethod enumerate zip map filter sorted sum min max abs round pow divmod open input eval exec repr format hash id vars dir getattr setattr hasattr delattr all any next iter reversed slice complex frozenset memoryview Exception ValueError TypeError KeyError IndexError AttributeError RuntimeError StopIteration NotImplementedError ImportError ModuleNotFoundError FileNotFoundError IOError OSError SystemExit KeyboardInterrupt' },
			c: { ln: '//', bl: true, pr: true, ct: true, kw: 'auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while', bn: 'NULL true false size_t ssize_t int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t ptrdiff_t wchar_t FILE stdin stdout stderr printf fprintf sprintf snprintf scanf fscanf sscanf malloc calloc realloc free memcpy memset memmove strlen strcmp strcpy strcat fopen fclose fread fwrite puts getchar putchar exit abort assert' },
			cpp: { ln: '//', bl: true, pr: true, ct: true, kw: 'alignas alignof and and_eq asm auto bitand bitor bool break case catch char class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq', bn: 'NULL nullptr true false size_t ssize_t int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t ptrdiff_t wchar_t FILE stdin stdout stderr cout cin cerr endl string vector map set unordered_map unordered_set unique_ptr shared_ptr weak_ptr make_unique make_shared move forward static_cast dynamic_cast const_cast reinterpret_cast printf scanf malloc free memcpy memset strlen printf sprintf fprintf puts getchar putchar exit abort assert std' },
			java: { ln: '//', bl: true, ct: true, kw: 'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null var record sealed permits yield', bn: 'String System out in err println print printf Math Integer Double Long Short Byte Float Character Boolean Object Class Exception RuntimeException IllegalArgumentException NullPointerException ArrayList HashMap HashSet List Map Set Optional StringBuilder Arrays Collections Thread Runnable' },
			go: { ln: '//', bl: true, bt: true, ct: true, kw: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var', bn: 'true false iota nil error string bool byte rune int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 uintptr float32 float64 complex64 complex128 any comparable len cap append copy make new delete panic recover print println sprintf fmt strings strconv sort time os io errors math' },
			rust: { ln: '//', bl: true, ct: true, kw: 'as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while', bn: 'Some None Ok Err String Vec Box Rc Arc RefCell HashMap HashSet Option Result print println format vec macro_rules' },
			shell: { hs: true, dl: true, kw: 'if then else elif fi for while until do done case esac function in select time coproc', bn: 'echo printf read cd ls pwd cat grep sed awk find cp mv rm mkdir touch chmod chown export source unset test exit return set shift' },
			sql: { ln: '--', bl: true, kw: 'select from where insert into values update set delete create table alter add drop index view join inner left right outer on as and or not null primary key foreign references unique default check constraint group by order having limit offset union all distinct case when then else end exists between like in is returning with recursive cast begin commit rollback transaction', bn: 'true false null' },
			toml: { hs: true, hsAny: true, ke: true, kw: 'true false', bn: '' },
			ini: { hs: true, hsAny: true, ke: true, kw: 'true false', bn: '' },
			css: { bl: true, kw: '', bn: '' },
			html: { tg: true, kw: '', bn: '' },
		};
		const HL_SETS = {};
		const hlSet = (s) => {
			const set = new Set();
			String(s || '').split(/\s+/).forEach((w) => { if (w) set.add(w) });
			return set;
		};
		Object.keys(HL).forEach((k) => {
			HL_SETS[k] = { kw: hlSet(HL[k].kw), bn: hlSet(HL[k].bn), ty: hlSet(HL[k].ty) };
		});
		const hlSpan = (cls, html) => '<span class="fe-tok-' + cls + '">' + html + '</span>';
		const HL_MAX = 300000;
		const HL_OP_RE = /^(===|!==|>>>|<<=|>>=|=>|\*\*|\+\+|--|&&|\|\||\?\?|\?\.|<=|>=|==|!=|<<|>>|\+=|-=|\*=|\/=|%=|\?|:|\.\.\.|\+|-|\*|\/|%|<|>|!|&|\||\^|~|=)/;
		const highlight = (text, lang) => {
			const cfg = HL[lang];
			if (!cfg) return escapeHtml(text);
			const src = String(text);
			if (src.length > HL_MAX) return escapeHtml(text);
			const sets = HL_SETS[lang];
			const n = src.length;
			let html = '';
			let i = 0;
			let prevCh = '';
			let multi = null;
			while (i < n) {
				if (multi) {
					const j = src.indexOf(multi.close, i);
					if (j === -1) { html += hlSpan(multi.cls, escapeHtml(src.slice(i - multi.openLen))); i = n; break }
					html += hlSpan(multi.cls, escapeHtml(src.slice(i - multi.openLen, j + multi.close.length)));
					prevCh = src[j + multi.close.length - 1];
					i = j + multi.close.length;
					multi = null;
					continue;
				}
				const c = src[i];
				const two = src.slice(i, i + 2);
				if (cfg.ln && two === cfg.ln) {
					const j = src.indexOf('\n', i);
					const end = j === -1 ? n : j;
					html += hlSpan('c', escapeHtml(src.slice(i, end)));
					prevCh = '\n';
					i = end; continue;
				}
				if (cfg.bl && two === '/*') {
					const j = src.indexOf('*/', i + 2);
					if (j === -1) { html += hlSpan('c', escapeHtml(src.slice(i))); i = n; break }
					html += hlSpan('c', escapeHtml(src.slice(i, j + 2)));
					prevCh = '/';
					i = j + 2; continue;
				}
				if (cfg.tg && src.slice(i, i + 4) === '<!--') {
					const j = src.indexOf('-->', i + 4);
					const end = j === -1 ? n : j + 3;
					html += hlSpan('c', escapeHtml(src.slice(i, end)));
					prevCh = '\n';
					i = end; continue;
				}
				if (cfg.hs && c === '#' && (cfg.hsAny || i === 0 || /\s/.test(src[i - 1]))) {
					const j = src.indexOf('\n', i);
					const end = j === -1 ? n : j;
					html += hlSpan('c', escapeHtml(src.slice(i, end)));
					prevCh = '\n';
					i = end; continue;
				}
				if (cfg.pr && c === '#') {
					let k = i - 1;
					while (k >= 0 && (src[k] === ' ' || src[k] === '\t')) k--;
					if (k < 0 || src[k] === '\n') {
						const j = src.indexOf('\n', i);
						const end = j === -1 ? n : j;
						html += hlSpan('d', escapeHtml(src.slice(i, end)));
						prevCh = '\n';
						i = end; continue;
					}
				}
				if (cfg.tr && (src.slice(i, i + 3) === '"""' || src.slice(i, i + 3) === "'''")) {
					multi = { cls: 's', close: src.slice(i, i + 3), openLen: 3 };
					i += 3; continue;
				}
				if (cfg.de && c === '@') {
					const dm = /^@[A-Za-z_][\w$]*/.exec(src.slice(i));
					if (dm) { html += hlSpan('b', escapeHtml(dm[0])); prevCh = dm[0][dm[0].length - 1]; i += dm[0].length; continue }
				}
				if (cfg.dl && c === '$') {
					const dm = /^\$[A-Za-z_][\w]*/.exec(src.slice(i));
					if (dm) { html += hlSpan('b', escapeHtml(dm[0])); prevCh = dm[0][dm[0].length - 1]; i += dm[0].length; continue }
				}
				if (c === '"' || c === "'") {
					let j = i + 1;
					let esc = false;
					while (j < n) {
						if (!esc && src[j] === c) break;
						if (!esc && src[j] === '\\') esc = true; else esc = false;
						if (src[j] === '\n') break;
						j++;
					}
					const end = j < n && src[j] === c ? j + 1 : j;
					let cls = 's';
					if (cfg.ks) {
						let k = end;
						while (k < n && (src[k] === ' ' || src[k] === '\t')) k++;
						if (src[k] === ':') cls = 'p';
					}
					html += hlSpan(cls, escapeHtml(src.slice(i, end)));
					prevCh = src[end - 1];
					i = end; continue;
				}
				if (cfg.bt && c === '`') {
					multi = { cls: 's', close: '`', openLen: 1 };
					i += 1; continue;
				}
				const nm = /^(0[xX][0-9a-fA-F]+|0[bB][01]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\d+)/.exec(src.slice(i));
				if (nm) {
					html += hlSpan('n', escapeHtml(nm[0]));
					prevCh = nm[0][nm[0].length - 1];
					i += nm[0].length; continue;
				}
				const idm = /^[A-Za-z_$][\w$]*/.exec(src.slice(i));
				if (idm) {
					const word = idm[0];
					let k2 = i + word.length;
					while (k2 < n && (src[k2] === ' ' || src[k2] === '\t')) k2++;
					const nextCh = src[i + word.length];
					let cls = '';
					if (sets.kw.has(word)) cls = 'k';
					else if (sets.bn.has(word)) cls = 'b';
					else if (sets.ty.has(word)) cls = 't';
					else if (cfg.ct && /^[A-Z]/.test(word)) cls = 't';
					else if (nextCh === '(') cls = 'f';
					else if (prevCh === '.') cls = 'p';
					else if (cfg.ki && src[k2] === ':') cls = 'p';
					else if (cfg.ke && src[k2] === '=' && src[k2 + 1] !== '=') cls = 'p';
					html += cls ? hlSpan(cls, escapeHtml(word)) : escapeHtml(word);
					prevCh = word[word.length - 1];
					i += word.length; continue;
				}
				if (cfg.tg && c === '<') {
					const gt = src.indexOf('>', i);
					const end = gt === -1 ? n : gt + 1;
					const seg = src.slice(i, end);
					let segHtml = '';
					let last = 0;
					let m;
					const tagRe = /(<\/?)([A-Za-z][\w-]*)|([A-Za-z-]+)(?=\s*=)|(\/?>)|("[^"]*"|'[^']*')/g;
					tagRe.lastIndex = 0;
					while ((m = tagRe.exec(seg)) !== null) {
						segHtml += escapeHtml(seg.slice(last, m.index));
						if (m[1]) segHtml += m[1] + hlSpan('t', escapeHtml(m[2]));
						else if (m[3]) segHtml += hlSpan('a', escapeHtml(m[3]));
						else if (m[4]) segHtml += escapeHtml(m[4]);
						else if (m[5]) segHtml += hlSpan('s', escapeHtml(m[5]));
						last = m.index + m[0].length;
					}
					segHtml += escapeHtml(seg.slice(last));
					html += segHtml;
					prevCh = seg[seg.length - 1] || '';
					i = end; continue;
				}
				const om = HL_OP_RE.exec(src.slice(i));
				if (om) {
					html += hlSpan('o', escapeHtml(om[0]));
					prevCh = om[0][om[0].length - 1];
					i += om[0].length; continue;
				}
				prevCh = c;
				html += escapeHtml(c);
				i++;
			}
			return html;
		};

		// ---------- icons ----------
		// 统一用 Material Design Icons（mdi）24×24 路径；
		// 取值来源：~/file/dsh/plugins/_reference/mdi.js
		const iconPaths = {
			chevronDown: 'M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z',
			chevronRight: 'M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z',
			chevronDoubleUp: 'M7.41,18.41L6,17L12,11L18,17L16.59,18.41L12,13.83L7.41,18.41M7.41,12.41L6,11L12,5L18,11L16.59,12.41L12,7.83L7.41,12.41Z',
			refresh: 'M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z',
			folder: 'M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z',
			file: 'M13,9V3.5L18.5,9M6,2C4.89,2 4,2.89 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6Z',
			chevronLeft: 'M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z',
			eye: 'M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z',
			fileCodeOutline: 'M14 2H6C4.89 2 4 2.9 4 4V20C4 21.11 4.89 22 6 22H18C19.11 22 20 21.11 20 20V8L14 2M18 20H6V4H13V9H18V20M9.54 15.65L11.63 17.74L10.35 19L7 15.65L10.35 12.3L11.63 13.56L9.54 15.65M17 15.65L13.65 19L12.38 17.74L14.47 15.65L12.38 13.56L13.65 12.3L17 15.65Z',
			fileDocumentOutline: 'M6,2A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6M6,4H13V9H18V20H6V4M8,12V14H16V12H8M8,16V18H13V16H8Z',
			fullscreen: 'M5,5H10V7H7V10H5V5M14,5H19V10H17V7H14V5M17,14H19V19H14V17H17V14M10,17V19H5V14H7V17H10Z',
			fullscreenExit: 'M14,14H19V16H16V19H14V14M5,14H10V19H8V16H5V14M8,5H10V10H5V8H8V5M19,8V10H14V5H16V8H19Z',
		};
		const Icon = (props) => react.createElement('svg', {
			width: props.size || 14,
			height: props.size || 14,
			viewBox: '0 0 24 24',
			fill: 'currentColor',
			style: { display: 'block' },
		}, react.createElement('path', { d: iconPaths[props.name] }));

		// 面板的工具按钮（深色 / 显示隐藏文件 / 刷新）。
		// 它们渲染在外壳标题行的右端、关闭按钮的左边，所以状态放在 store 里，
		// 而不是面板组件的局部 state。
		const Toolbar = () => {
			const s = useStore();
			return react.createElement(react.Fragment, null,
				react.createElement('button', {
					className: 'fe-iconbtn' + (s.showHidden ? ' fe-iconbtn-on' : ''),
					title: s.showHidden ? '隐藏隐藏文件' : '显示隐藏文件',
					onClick: () => setShowHidden(!store.showHidden),
				}, react.createElement(Icon, { name: 'eye', size: 16 })),
				react.createElement('button', {
					className: 'fe-iconbtn',
					title: '刷新',
					onClick: () => { if (store.refreshFn) store.refreshFn() },
				}, react.createElement(Icon, { name: 'refresh', size: 16 })),
			);
		};


		const fmtSize = (n) => {
			if (n === null || n === undefined) return '';
			if (n < 1024) return n + ' B';
			if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
			if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
			return (n / 1073741824).toFixed(1) + ' GB';
		};

		// ---------- header toggle button ----------
		// 这一层底下还有没有目录是展开的 —— 决定「折叠以下全部」按钮要不要出现。
		const hasExpandedBelow = (expanded, path) => {
			const prefix = path + '/';
			for (const p of expanded) if (p.indexOf(prefix) === 0) return true;
			return false;
		};

		// ---------- tree node ----------
		const TreeNode = (props) => {
			const entry = props.entry;
			const tree = props.tree;
			const isDir = entry.type === 'directory';
			const expanded = tree.expanded.has(entry.path);
			const loading = tree.loading.has(entry.path);
			const error = tree.errors[entry.path];
			const children = tree.cache.get(entry.path);
			const row = react.createElement('div', {
				className: 'fe-row' + (tree.selected === entry.path ? ' fe-row-selected' : ''),
				style: { paddingLeft: 6 + props.depth * 14 },
				// 供"定位到文件树"找到这一行（按路径滚动到它）
				'data-fe-path': entry.path,
				onClick: () => isDir ? props.onToggle(entry.path) : props.onOpen(entry, true),
				onDoubleClick: () => props.onOpen(entry, false),
				title: entry.path,
			},
				react.createElement('span', { className: 'fe-chevron' + (isDir ? '' : ' fe-chevron-none') }, isDir
					? react.createElement(Icon, { name: expanded ? 'chevronDown' : 'chevronRight', size: 12 })
					: null),
				react.createElement('span', { className: 'fe-node-icon fe-node-' + (isDir ? 'dir' : 'file') },
					react.createElement(Icon, { name: isDir ? 'folder' : 'file', size: 16 })),
				react.createElement('span', { className: 'fe-node-name', title: entry.name }, entry.name),
				isDir && loading ? react.createElement('span', { className: 'fe-node-loading' }, '…') : null,
				!isDir && typeof entry.size === 'number' ? react.createElement('span', { className: 'fe-node-size' }, fmtSize(entry.size)) : null,
				// 目录行右端：悬浮才出现的「折叠以下全部」按钮。
				// 只在这一层底下确实还有展开的目录时才出现，否则它什么也做不了。
				isDir && hasExpandedBelow(tree.expanded, entry.path) ? react.createElement('button', {
					className: 'fe-collapse-btn',
					title: '折叠以下所有目录',
					'aria-label': '折叠以下所有目录',
					onClick: (event) => { event.stopPropagation(); props.onCollapse(entry.path) },
				}, react.createElement(Icon, { name: 'chevronDoubleUp', size: 16 })) : null,
			);
			const nodes = [row];
			if (isDir && expanded) {
				if (children) {
					for (const child of children) {
						if (!props.showHidden && child.name.startsWith('.')) continue;
						nodes.push(react.createElement(TreeNode, { key: child.path, entry: child, depth: props.depth + 1, tree, showHidden: props.showHidden, onToggle: props.onToggle, onCollapse: props.onCollapse, onSelect: props.onSelect, onOpen: props.onOpen }));
					}
				} else if (!loading && error) {
					nodes.push(react.createElement('div', { key: '__err', className: 'fe-node-error', style: { paddingLeft: 6 + (props.depth + 1) * 14 } }, error));
				}
			}
			return react.createElement('div', { className: 'fe-node' }, ...nodes);
		};

		// ---------- main panel ----------
		const ExplorerPanel = (props) => {
			const s = useStore();
			const currentSessionId = props.useSessions((st) => st.current);
			// 新会话页判定:未选会话,或当前会话还是空白会话(新建但未发消息)。
			// 该页只有落地引导,没有会话标题与子代理信息,侧边栏在这里纯属遮挡,
			// 因此隐藏但不改动 open 状态 —— 回到真实会话时侧边栏自动恢复。
			const heroPage = props.useSessions((st) => {
				const id = st.current;
				if (id === undefined) return true;
				const entry = st.byId[id];
				return entry !== undefined && entry.blank === true;
			});
			const wsItems = props.useWorkspaces((st) => st.items);
			const recentWorkspaceId = props.useWorkspaces((st) => st.recentWorkspaceId);

			let rootPath = null;
			let rootName = '';
			if (currentSessionId) {
				for (const w of wsItems) {
					if (w.sessionIds.indexOf(currentSessionId) >= 0) { rootPath = w.path; rootName = w.title; break }
				}
			}
			if (!rootPath && recentWorkspaceId) {
				for (const w of wsItems) {
					if (w.workspaceId === recentWorkspaceId) { rootPath = w.path; rootName = w.title; break }
				}
			}
			if (!rootPath && wsItems.length > 0) { rootPath = wsItems[0].path; rootName = wsItems[0].title }

			const [tree, setTree] = react.useState(null);
			const [editor, setEditor] = react.useState(null);
			const [status, setStatus] = react.useState(null);
			// 「定位到文件树」的目标目录：目录链要先展开、子项可能要现拉，
			// 所以先记下目标，等那一行真的渲染出来了再滚动（见下面的 effect）。
			const [revealDir, setRevealDir] = react.useState(null);
			const revealTriesRef = react.useRef(0);
			// 文件树那个滚动容器（要滚到某一行为止）
			const treeRef = react.useRef(null);
			// 深色 / 显示隐藏文件这两个开关的状态住在 store 里了（按钮渲染在外壳标题行）
			const showHidden = s.showHidden;
			const dark = s.dark;
			// 字号缩放按钮已拿掉：预览不再调字号，CSS 里那套 `--fe-preview-scale`
			// 系数保持默认值 1（不再从 localStorage 读旧值，免得卡在某个缩放上出不来）。
			// Re-click on the previewed file schedules a close; a following
			// double-click cancels it, so dblclick never flickers.
			const previewToggleRef = react.useRef(null);
			const clearPreviewToggle = () => {
				if (previewToggleRef.current !== null) {
					clearTimeout(previewToggleRef.current);
					previewToggleRef.current = null;
				}
			};
			react.useEffect(() => () => {
				if (previewToggleRef.current !== null) clearTimeout(previewToggleRef.current);
			}, []);

			let statusSeq = 0;
			const showStatus = (msg) => {
				const seq = ++statusSeq;
				setStatus(msg);
				setTimeout(() => { if (seq === statusSeq) setStatus(null) }, 4000);
			};

			const without = (set, v) => { const n = new Set(set); n.delete(v); return n };
			const withVal = (set, v) => { const n = new Set(set); n.add(v); return n };

			react.useEffect(() => {
				if (!rootPath) { setTree(null); return }
				store.rootPath = rootPath;
				// 恢复本地持久化缓存 + 展开状态:展开的目录有缓存则秒显;
				// 缺缓存的展开目录(如缓存被 120 目录上限截断)重新拉取。
				const cached = loadTreeCache(rootPath) || new Map();
				const expanded = new Set(loadExpanded(rootPath) || []);
				expanded.add(rootPath); // 根目录始终展开
				const loading = new Set();
				for (const p of expanded) if (!cached.has(p)) loading.add(p);
				setTree({ rootPath, rootName, expanded, cache: cached, loading, selected: null, errors: {} });
				if (loading.size > 0) for (const p of loading) loadChildren(p);
				return () => {};
			}, [rootPath]);

			// 缓存 / 展开状态变更后防抖持久化(仅当引用变化时触发)。
			react.useEffect(() => {
				if (!tree || !tree.rootPath) return;
				const timer = setTimeout(() => { saveTreeCache(tree.rootPath, tree.cache); saveExpanded(tree.rootPath, tree.expanded) }, 600);
				return () => clearTimeout(timer);
			}, [tree && tree.rootPath, tree && tree.cache, tree && tree.expanded]);

			// 消费「打开这个文件」请求（来自右栏替身的窗口事件）。
			// 真正载入的函数定义在下面（openRequested），这里通过 ref 取最新那份，
			// 避免把它塞进依赖数组导致每次渲染都重跑。
			const lastOpenSeqRef = react.useRef(0);
			const openRequestedRef = react.useRef(null);
			react.useEffect(() => {
				const req = s.pendingOpen;
				if (!req || req.seq === lastOpenSeqRef.current) return;
				lastOpenSeqRef.current = req.seq;
				if (openRequestedRef.current) openRequestedRef.current(req.path);
			}, [s.pendingOpen]);

			// 打开 / 关掉文档时标题行的让位由 notifyHead 在事件里同步发出（见 apply 附近）；
			// 这里只负责"卸载时复位"，避免下次打开少一行。
			react.useEffect(() => () => { notifyHead(false) }, []);

			const loadChildren = (path) => {
				api.list(path).then((res) => {
					setTree((t) => {
						if (!t) return t;
						const cache = new Map(t.cache);
						const errors = { ...t.errors };
						if (res && !res.error) cache.set(path, (res && res.entries) || []);
						else errors[path] = (res && res.error) || 'list failed';
						return { ...t, cache, errors, loading: without(t.loading, path) };
					});
				}).catch((err) => {
					setTree((t) => t ? { ...t, loading: without(t.loading, path), errors: { ...t.errors, [path]: String((err && err.message) || err) } } : t);
				});
			};

			const toggleDir = (path) => {
				setTree((t) => {
					if (!t) return t;
					if (t.expanded.has(path)) return { ...t, expanded: without(t.expanded, path) };
					if (t.cache.has(path)) return { ...t, expanded: withVal(t.expanded, path) };
					return { ...t, expanded: withVal(t.expanded, path), loading: withVal(t.loading, path) };
				});
				setTree((t) => {
					if (!t || t.cache.has(path) || !t.expanded.has(path)) return t;
					loadChildren(path);
					return t;
				});
			};

			// 把 path 以下的所有子孙目录从展开集合里摘掉 —— 本级保持展开。
			// 只改 expanded，不动 cache —— 内容留着，下次展开不用重新拉。
			const collapseBelow = (path) => {
				setTree((t) => {
					if (!t) return t;
					const prefix = path + '/';
					const next = new Set();
					t.expanded.forEach((p) => { if (p.indexOf(prefix) !== 0) next.add(p) });
					return { ...t, expanded: next };
				});
			};

			const selectFile = (path) => setTree((t) => t ? { ...t, selected: path } : t);
			const openFile = (entry, startEditing, toggle) => {
				// 非文本:无法预览,仅选中
				if (!hlLangFor(entry.name)) { selectFile(entry.path); return }
				// 单击文本:立即预览
				doPreview(entry, startEditing, toggle);
			};

			const doPreview = (entry, startEditing, toggle) => {
				if (editor && editor.path === entry.path) {
					if (editor.editing) { clearPreviewToggle(); return; }
					if (startEditing) {
						clearPreviewToggle();
						if (editor.state === 'ready' && !editor.editing) {
							setEditor((e) => ({ ...e, editing: true, preview: false }));
						}
						return;
					}
					if (editor.state === 'ready' || editor.state === 'loading') {
						if (toggle) {
							// Single click on the previewed file closes the preview;
							// a double-click arriving in the window cancels it.
							clearPreviewToggle();
							previewToggleRef.current = setTimeout(() => {
								previewToggleRef.current = null;
								notifyHead(false);
								setEditor(null);
								setStatus(null);
							}, 220);
						} else {
							clearPreviewToggle();
						}
						return;
					}
					// 'error' / 'too-large': fall through and re-open (retry).
				}
				clearPreviewToggle();
				selectFile(entry.path);
				setEditor({ path: entry.path, name: entry.name, content: null, size: entry.size || 0, state: 'loading', editing: !!startEditing, preview: isMarkdown(entry.name) && !startEditing });
				notifyHead(true);
				setStatus(null);
				api.read(entry.path).then((res) => {
					setEditor((e) => {
						if (!e || e.path !== entry.path) return e;
						if (res && res.error) return { ...e, state: 'error', message: res.error, editing: false, preview: false };
						if (res && res.tooLarge) return { ...e, state: 'too-large', size: res.size, editing: false, preview: false };
						return { ...e, state: 'ready', content: res.content, size: res.size };
					});
				}).catch((err) => {
					setEditor((e) => e && e.path === entry.path ? { ...e, state: 'error', message: String((err && err.message) || err), editing: false, preview: false } : e);
				});
			};

			// 直接按路径打开一个文件（不经过树节点）——对话里点文件链接走这条路。
			// line 参数（来自 dsh-resource 地址）暂时只接收不定位，行定位留到下一步。
			const openRequested = (path) => {
				const name = String(path).split('/').filter(Boolean).pop() || String(path);
				clearPreviewToggle();
				selectFile(path);
				setStatus(null);
				setEditor({ path: path, name: name, content: null, size: 0, state: 'loading', editing: false, preview: isMarkdown(name) });
				notifyHead(true);
				api.read(path).then((res) => {
					setEditor((e) => {
						if (!e || e.path !== path) return e;
						if (res && res.error) return { ...e, state: 'error', message: res.error, editing: false, preview: false };
						if (res && res.tooLarge) return { ...e, state: 'too-large', size: res.size, editing: false, preview: false };
						return { ...e, state: 'ready', content: res.content, size: res.size };
					});
				}).catch((err) => {
					setEditor((e) => e && e.path === path ? { ...e, state: 'error', message: String((err && err.message) || err), editing: false, preview: false } : e);
				});
			};
			openRequestedRef.current = openRequested;

			const refresh = () => {
				if (!tree || !tree.rootPath) return;
				const root = tree.rootPath;
				const name = tree.rootName;
				// 只重新扫描已展开的目录;未展开目录沿用旧缓存(展开时仍秒回)
				const expanded = new Set(tree.expanded);
				if (!expanded.has(root)) expanded.add(root); // 根目录始终加载
				const cache = new Map(tree.cache);
				for (const p of expanded) cache.delete(p);
				setTree({ rootPath: root, rootName: name, expanded, cache, loading: new Set(expanded), selected: tree.selected, errors: {} });
				for (const p of expanded) loadChildren(p);
			};
			// 工具栏（渲染在外壳标题行里）靠这个回调触发刷新
			store.refreshFn = refresh;

			// 从磁盘重读当前预览的文件（"重新读取"按钮与实时刷新共用）
			const reloadEditor = (path) => {
				api.read(path).then((res) => {
					setEditor((e) => (e && e.path === path
						? { ...e, state: 'ready', content: res.content, size: res.size }
						: e));
				}).catch((err) => {
					setEditor((e) => (e && e.path === path
						? { ...e, state: 'error', message: String((err && err.message) || err), preview: false }
						: e));
				});
			};

			// ---------- 定位到文件树（预览工具栏上的"放大镜+文件夹"按钮）----------
			// 从预览回文件树，并把"这个文件在哪"露出来：展开它上面每一级目录，
			// 再把"装着这个文件的那个目录"那一行滚到面板最上端。
			const revealInTree = (path) => {
				const closePreview = () => { setFullscreen(false); notifyHead(false); setEditor(null); setStatus(null) };
				if (!tree || !tree.rootPath || typeof path !== 'string') { closePreview(); return }
				const root = tree.rootPath;
				const cut = path.lastIndexOf('/');
				const dir = cut > 0 ? path.slice(0, cut) : path;
				// 兜底报警：文件树里一切都是绝对路径，真收到相对路径（外壳没能按会话
				// cwd 还原）目录链必然是空的 —— 与其静默地什么都不做，不如留个线索。
				if (dir.charAt(0) !== '/') {
					console.warn('[file-browser] 无法定位：拿到的不是绝对路径 →', dir);
				}
				// 上级目录链（含 dir 自己）：root → … → dir
				const chain = dirChainFrom(root, dir);
				// 名字以 . 开头的目录平时不画 —— 要露出它，先替用户打开「显示隐藏文件」。
				// 根目录自己不算（它永远画，不看这个开关）。
				const hiddenInChain = chain.some((p) => p !== root && p.slice(p.lastIndexOf('/') + 1).startsWith('.'));
				if (!s.showHidden && hiddenInChain) setShowHidden(true);
				const added = chain.filter((p) => !tree.expanded.has(p));
				if (added.length > 0) {
					const expanded = new Set(tree.expanded);
					const loading = new Set(tree.loading);
					for (const p of added) {
						expanded.add(p);
						if (!tree.cache.has(p)) loading.add(p);   // 没缓存的现拉
					}
					setTree({ ...tree, expanded, loading });
					for (const p of added) if (!tree.cache.has(p)) loadChildren(p);
				}
				revealTriesRef.current = 0;
				setRevealDir(dir);
				// 留在全屏里会找不到回去的路（那个切换按钮长在预览上），所以一并退出
				closePreview();
			};

			// 目标行渲染出来了再滚：子目录是懒加载的，按下按钮的那一刻它可能还不存在。
			// tree 每变一次都重试，试够次数就放弃（例如目录被删了）。
			react.useEffect(() => {
				if (!revealDir) return;
				const box = treeRef.current;
				let row = null;
				if (box) {
					for (const el of box.querySelectorAll('[data-fe-path]')) {
						if (el.getAttribute('data-fe-path') === revealDir) { row = el; break }
					}
				}
				if (!row) {
					if (++revealTriesRef.current > 12) setRevealDir(null);
					return;
				}
				revealTriesRef.current = 0;
				// 目标行相对于滚动内容的纵向位置（两者相对同一个 offsetParent，差值即 scrollTop）
				const y = row.offsetTop - box.offsetTop;
				const h = row.offsetHeight || 0;
				// 「能看见就不动」：这一行已经完整落在可视区里，就什么都不做 ——
				// 从树里点开文件时多半如此，硬滚一下反而把用户调好的位置拉走。
				const visible = y >= box.scrollTop && y + h <= box.scrollTop + box.clientHeight;
				if (!visible) box.scrollTop = Math.max(0, y);
				setRevealDir(null);
			}, [revealDir, tree]);

			// ---------- C1 实时刷新：host 推来"哪些目录变了"（SSE）----------
			// 局部刷新，不整棵树重扫：
			//   · 文件树——只重扫受影响的目录，且只扫**已展开**的（没展开的下次
			//     展开时会重新拉，不必管）；
			//   · 预览——当前文件正好在受影响目录里才重读；**编辑中不碰**，否则
			//     会把用户没保存的改动冲掉。
			// 用 ref 取最新状态：effect 只挂一次（面板挂载期间），不能闭包住首帧。
			const liveRef = react.useRef({ tree: null, editor: null, loadChildren: null, reloadEditor: null });
			liveRef.current = { tree, editor, loadChildren, reloadEditor };
			react.useEffect(() => {
				const src = new EventSource('/plugins/file-browser/events');
				src.onmessage = (ev) => {
					let dirs;
					try { dirs = JSON.parse(ev.data).dirs } catch (e) { return }
					if (!Array.isArray(dirs) || dirs.length === 0) return;
					const cur = liveRef.current;
					const t = cur.tree;
					if (t && t.rootPath) {
						for (const d of dirs) if (t.expanded.has(d)) cur.loadChildren(d);
					}
					const ed = cur.editor;
					if (ed && typeof ed.path === 'string' && !ed.editing) {
						const cut = ed.path.lastIndexOf('/');
						const dir = cut > 0 ? ed.path.slice(0, cut) : ed.path;
						if (dirs.indexOf(dir) >= 0) cur.reloadEditor(ed.path);
					}
				};
				// 断线由浏览器自动重连；服务端若不是 SSE 它不会重连，也不会吵
				return () => src.close();
			}, []);

			const renderTree = () => {
				if (!tree || !tree.rootPath) return react.createElement('div', { className: 'fe-empty' }, '未找到当前工作区');
				const rows = [];
				rows.push(react.createElement('div', {
					key: 'root',
					className: 'fe-row fe-row-root',
					style: { paddingLeft: 6 },
					'data-fe-path': tree.rootPath,
					onClick: () => toggleDir(tree.rootPath),
					title: tree.rootPath,
				},
					react.createElement('span', { className: 'fe-chevron' }, react.createElement(Icon, { name: tree.expanded.has(tree.rootPath) ? 'chevronDown' : 'chevronRight', size: 12 })),
					react.createElement('span', { className: 'fe-node-icon fe-node-dir' }, react.createElement(Icon, { name: 'folder', size: 16 })),
					react.createElement('span', { className: 'fe-node-name', title: tree.rootName }, tree.rootName || tree.rootPath),
					tree.loading.has(tree.rootPath) ? react.createElement('span', { className: 'fe-node-loading' }, '…') : null,
					hasExpandedBelow(tree.expanded, tree.rootPath) ? react.createElement('button', {
						className: 'fe-collapse-btn',
						title: '折叠以下所有目录',
						'aria-label': '折叠以下所有目录',
						onClick: (event) => { event.stopPropagation(); collapseBelow(tree.rootPath) },
					}, react.createElement(Icon, { name: 'chevronDoubleUp', size: 16 })) : null,
				));
				if (tree.expanded.has(tree.rootPath)) {
					const children = tree.cache.get(tree.rootPath);
					if (children) {
						for (const child of children) {
							if (!showHidden && child.name.startsWith('.')) continue;
							rows.push(react.createElement(TreeNode, { key: child.path, entry: child, depth: 1, tree, showHidden, onToggle: toggleDir, onCollapse: collapseBelow, onSelect: selectFile, onOpen: (e, toggle) => openFile(e, false, toggle) }));
						}
					} else if (!tree.loading.has(tree.rootPath) && tree.errors[tree.rootPath]) {
						rows.push(react.createElement('div', { key: 'err', className: 'fe-node-error', style: { paddingLeft: 20 } }, tree.errors[tree.rootPath]));
					}
				}
				return rows;
			};

			const renderPreview = () => {
				if (!editor) return null;
				const isMd = isMarkdown(editor.name);
				const showPreview = isMd && !editor.editing && editor.preview && editor.state === 'ready';
				const head = react.createElement('div', { className: 'fe-editor-head' },
					react.createElement('span', { className: 'fe-editor-name', title: editor.name }, editor.name),
					// 预览 / 源码：靠右那一组的头一个（它改的是"用哪种方式看这份文档"）
					isMd && editor.state === 'ready' && !editor.editing
						? react.createElement('button', { className: 'fe-iconbtn', title: editor.preview ? '源码' : '预览', onClick: () => setEditor((e) => ({ ...e, preview: !e.preview })) }, react.createElement(Icon, { name: editor.preview ? 'fileCodeOutline' : 'fileDocumentOutline', size: 16 }))
						: null,
					// 全屏：同一个按钮进出（图标 fullscreen ⟷ fullscreenExit）。
					// 铺满整屏是外壳的事（它握着布局），这里只转达请求。
					react.createElement('button', {
						className: 'fe-iconbtn',
						title: s.fullscreen ? '退出全屏' : '全屏',
						'aria-label': s.fullscreen ? '退出全屏' : '全屏',
						onClick: () => setFullscreen(!s.fullscreen),
					}, react.createElement(Icon, { name: s.fullscreen ? 'fullscreenExit' : 'fullscreen', size: 16 })),
					react.createElement('button', {
						className: 'fe-iconbtn',
						title: '重新读取文件',
						onClick: () => reloadEditor(editor.path),
					}, react.createElement(Icon, { name: 'refresh', size: 16 })),
					// 返回 = 回文件树 + 定位到这个文件（两个动作合成一个：
					// 返回的落点本来就只有文件树，而"它在哪儿"几乎必然接着问）。
					// 已经看得见的话就不滚动 —— 见 revealInTree。
					react.createElement('button', {
						className: 'fe-iconbtn',
						title: '返回文件树（定位到这个文件）',
						'aria-label': '返回文件树并定位到这个文件',
						onClick: () => revealInTree(editor.path),
					}, react.createElement(Icon, { name: 'chevronLeft', size: 18 })),
				);
				let body = null;
				if (editor.state === 'loading') body = react.createElement('div', { className: 'fe-editor-msg' }, '加载中…');
				else if (editor.state === 'error') body = react.createElement('div', { className: 'fe-editor-msg fe-err' }, editor.message);
				else if (editor.state === 'too-large') body = react.createElement('div', { className: 'fe-editor-msg' }, '文件过大（' + fmtSize(editor.size) + '），不支持预览');
				else if (showPreview) body = react.createElement('div', { className: 'fe-md', dangerouslySetInnerHTML: { __html: renderMarkdown(editor.content) } });
				else if (!editor.editing) {
					const lang = hlLangFor(editor.name);
					body = lang && lang !== 'markdown' && lang !== 'text'
						? react.createElement('pre', { className: 'fe-preview-plain fe-hl lang-' + lang, dangerouslySetInnerHTML: { __html: highlight(editor.content, lang) } })
						: react.createElement('pre', { className: 'fe-preview-plain' }, editor.content);
				}
				else body = react.createElement('textarea', {
					className: 'fe-editor-textarea',
					spellCheck: false,
					value: editor.content,
					onChange: (e) => setEditor((prev) => ({ ...prev, content: e.target.value })),
				});
				return react.createElement('div', { className: 'fe-preview-body' }, head, body);
			};

			if (heroPage) return null;   // 新会话落地页不显示（开合由外壳决定）
			// 文件树常驻（预览时由 .fe-panel-previewing 藏起来）：它的滚动位置
			// 因此能留住，返回时才有"目标行已经看得见就不动"可言 —— 否则每次
			// 返回都是一棵全新的树（scrollTop 归零），只能一路滚过去。
			const treePanel = react.createElement('div', { className: 'fe-panel' + (dark ? ' fe-theme-dark' : '') + (editor ? ' fe-panel-previewing' : '') },
				status && !editor ? react.createElement('div', { className: 'fe-status ' + (status.ok ? 'fe-status-ok' : 'fe-status-err') }, status.text) : null,
				react.createElement('div', { className: 'fe-tree', ref: treeRef }, renderTree()),
				editor ? renderPreview() : null,
			);
			return react.createElement('div', { className: 'fe-overlay-root' }, treePanel);
		};

		function apply(ctx) {
			const styleEl = document.createElement('style');
			styleEl.textContent = CSS;
			document.head.appendChild(styleEl);
			ctx.effect(() => () => { styleEl.remove() }, 'file-browser: styles');

			// Double-click anywhere on the chat interface collapses the
			// explorer. Editable fields and interactive controls are excluded
			// so normal double-click behaviors (word select, edit, follow)
			// keep working. The conversation column carries data-phase
			// (active/hero); the explorer overlay lives outside it.
			const onChatDblClick = (e) => {
				if (!store.open) return;
				const target = e.target;
				if (!target || typeof target.closest !== 'function') return;
				if (target.closest('input, textarea, select, button, a, [contenteditable="true"], [role="button"]')) return;
				const root = target.closest('[data-phase]');
				if (!root) return;
				const phase = root.getAttribute('data-phase');
				if (phase !== 'active' && phase !== 'hero') return;
				setOpen(false);
			};
			document.addEventListener('dblclick', onChatDblClick);
			ctx.effect(() => () => { document.removeEventListener('dblclick', onChatDblClick) }, 'file-browser: chat dblclick collapse');

			// 右栏替身转来的"打开这个文件"请求：开面板 + 记下待载入的文件。
			// 真正载入由 ExplorerPanel 的 effect 消费（它持有 editor/tree 状态）。
			const onOpenFileRequest = (e) => {
				const d = e && e.detail;
				if (!d || !d.path) return;
				// ⚠️ 先把档位切回自己：侧边栏可能正停在别的档位（例如仓库浏览器），
				// 不切的话面板"开了"，画的却是别人 —— 看起来就像点了文件没反应。
				if (SHELL) SHELL.setMode(MODE_ID);
				store.openSeq += 1;
				store.pendingOpen = { path: d.path, line: d.line, seq: store.openSeq };
				setOpen(true);
			};
			window.addEventListener(OPEN_FILE_EVENT, onOpenFileRequest);
			ctx.effect(() => () => { window.removeEventListener(OPEN_FILE_EVENT, onOpenFileRequest) }, 'file-browser: open-file relay');

			// 侧边栏主题：外壳说了算（它同时管着仓库浏览器和这一列的背景），
			// 本插件只负责把自己的调色板跟着切。
			const onTheme = (e) => {
				const d = e && e.detail;
				if (!d) return;
				setDark(!!d.dark);
			};
			window.addEventListener(THEME_EVENT, onTheme);
			ctx.effect(() => () => { window.removeEventListener(THEME_EVENT, onTheme) }, 'file-browser: sidebar theme');

			const slots = ctx.get('slots');
			if (slots === undefined) return;
			// 外壳服务（档位登记 / 切档 / 全屏）。inject 里已声明，正常拿得到。
			SHELL = ctx.get('rightbarShell') || null;
			// 外壳的呈现状态跟着它走：它是真相，这里只做镜像（面板里的按钮要按它画图标）。
			if (SHELL) {
				const syncShell = () => {
					const snap = SHELL.getSnapshot();
					const fs = !!(snap && snap.fullscreen);
					if (fs !== store.fullscreen) { store.fullscreen = fs; emit() }
				};
				syncShell();
				ctx.effect(() => SHELL.subscribe(syncShell), 'file-browser: shell state mirror');
			}
			// 方案 B：向外壳的 rightbarShell 服务"报到"一次，把档位名、图标、
			// 内容组件、工具按钮一起交出去。外壳按当前档位渲染，本插件不需要
			// 知道还有别的浏览器，也不需要自己判断"现在轮到我了没有"。
			// 返回的注销函数挂到 ctx.effect：插件卸载时这一档自动摘掉。
			ctx.effect(() => ctx.rightbarShell.addMode({
				id: MODE_ID,
				// 菜单里的位置：号小的在前。文件浏览器排在仓库浏览器（2）上面，
				// 顺序是自己报的，外壳不按 id / 名字自动排。
				order: 1,
				label: '文件浏览器',
				icon: 'folderOpen',
				render: (props) => react.createElement(ExplorerPanel, props),
				actions: (props) => react.createElement(Toolbar, props),
			}), 'file-browser: rightbar mode');
			// 会话标题栏的开关与右上角入口都已交给外壳（dsh-rightbar-shell）：
			// 本插件不再往标题栏注册任何东西，避免出现两套开合入口。
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
