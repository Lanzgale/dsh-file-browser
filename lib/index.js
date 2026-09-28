/**
 * dsh-file-browser — host half.
 *
 * Registers the /plugins/file-browser/* HTTP routes for the web file-browser
 * panel: list / read / write / raw（图片字节）/ docx（Word 抽取）/ events。
 * The routes are served by the same web server as the GUI (webServer /
 * httpServer dual-key compatible), so the browser client fetches them from
 * the page origin.
 *
 * 没有"用外部程序打开"这条路：这台机器上没有任何可用的关联程序（pandoc /
 * libreoffice 都没装），用户也不用 VS Code —— 预览必须在面板里自足。
 *
 * @module dsh-file-browser
 */
import { inflateRawSync } from 'node:zlib'

export const name = 'file-browser'
export const inject = ['fs']

const MAX_READ = 1_000_000
const MAX_IMAGE = 25 * 1024 * 1024   // 图像预览上限（25 MB）
const MAX_DOCX = 20 * 1024 * 1024    // Word 抽取上限（20 MB）
const RAW_CHUNK = 512 * 1024         // /raw 每次向文件服务要的字节数

// /raw 只服务这些扩展名 —— 它是"给 <img> 取字节"的口子，不是通用下载口。
// 客户端那张视图表必须和这里一致，否则点了图片会拿到 415。
const IMAGE_MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', ico: 'image/x-icon', avif: 'image/avif',
  svg: 'image/svg+xml',
}
const extOf = (name) => {
  const n = String(name || '').toLowerCase()
  const i = n.lastIndexOf('.')
  return i >= 0 ? n.slice(i + 1) : n
}
const mimeForImage = (name) => IMAGE_MIME[extOf(name)] || null

// 只认单段 Range（`bytes=a-b` / `bytes=a-` / `bytes=-n`）。多段、语法不对一律
// 当作"整份"返回：拼 multipart 的收益远小于出错的代价，浏览器的默认行为够用。
const parseRange = (header, size) => {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header || '').trim())
  if (!m || (m[1] === '' && m[2] === '')) return null
  let start
  let end
  if (m[1] === '') {
    const n = Number(m[2])
    if (n <= 0 || size === 0) return { invalid: true }
    start = Math.max(0, size - n)
    end = size - 1
  } else {
    start = Number(m[1])
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return { invalid: true }
  return { start, end }
}

// ---------- .docx → Markdown（零依赖）----------
// .docx 就是个 zip，正文在 word/document.xml。这里自己走中央目录、只用 node:zlib
// 解那一个条目：不引第三方 unzip 库，也不调 python（机器上有没有 python、
// 什么版本，都不该影响面板能不能看 Word）。
const ZIP_EOCD = 0x06054b50
const ZIP_CENTRAL = 0x02014b50
const ZIP_LOCAL = 0x04034b50
const readZipEntry = (buf, wantName) => {
  let eocd = -1
  const floor = Math.max(0, buf.length - 66000)   // zip 注释最长 65535
  for (let i = buf.length - 22; i >= floor; i--) {
    if (buf.readUInt32LE(i) === ZIP_EOCD) { eocd = i; break }
  }
  if (eocd < 0) return null
  const count = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)
  for (let i = 0; i < count; i++) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== ZIP_CENTRAL) return null
    const method = buf.readUInt16LE(off + 10)
    const csize = buf.readUInt32LE(off + 20)
    const fnl = buf.readUInt16LE(off + 28)
    const efl = buf.readUInt16LE(off + 30)
    const cml = buf.readUInt16LE(off + 32)
    const name = buf.toString('utf8', off + 46, off + 46 + fnl)
    if (name === wantName) {
      const lho = buf.readUInt32LE(off + 42)
      if (lho + 30 > buf.length || buf.readUInt32LE(lho) !== ZIP_LOCAL) return null
      const dataOff = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28)
      const raw = buf.subarray(dataOff, dataOff + csize)
      if (method === 0) return raw.toString('utf8')
      if (method === 8) return inflateRawSync(raw).toString('utf8')
      return null   // 其它压缩方式（极少见）不支持
    }
    off += 46 + fnl + efl + cml
  }
  return null
}

const XML_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const decodeXml = (s) => String(s)
  .replace(/&#x([0-9a-fA-F]+);/g, (m, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (m, dec) => String.fromCodePoint(Number(dec)))
  .replace(/&(amp|lt|gt|quot|apos);/g, (m, name) => XML_ENT[name])

// 段落里的可见文字：<w:t> 是文本，<w:tab/> 制表符，<w:br/> 换行。
const paraText = (inner) => {
  let out = ''
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/?>|<w:br\b[^>]*\/?>/g
  let m
  while ((m = re.exec(inner)) !== null) {
    if (m[1] !== undefined) out += decodeXml(m[1])
    else if (m[0].startsWith('<w:tab')) out += '\t'
    else out += '\n'
  }
  return out
}

// 逐 run 走一遍，保留**行内格式**：粗体、斜体、下划线、删除线。合同里"条款标题"
// 就是整段粗体，全段一律加粗和只把真粗的那几个字加粗，观感差很多。
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Word 的长度单位是 twip（1/20 磅），字号是半磅。换算成 CSS：
// twip → pt = /20，pt → px = ×4/3；半磅 → pt = /2。
const twipsToPx = (tw) => Math.round((Number(tw) / 20) * (4 / 3))
const halfPointsToPx = (hp) => Math.round((Number(hp) / 2) * (4 / 3))
const DEFAULT_FONT_PX = 14   // 没写字号时按 Word 中文默认的 10.5 磅（五号）= 14px
// 对齐：只认白名单里的值，绝不把文档里的字符串直接拼进 style。
const ALIGN = { center: 'center', right: 'right', end: 'right', both: 'justify', justify: 'justify', distribute: 'justify', left: 'left', start: 'left' }

const runHtml = (body) => {
  const rPr = (/<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(body) || [])[1] || ''
  const text = paraText(body)
  if (text === '') return ''
  const on = (re) => re.test(rPr)
  const bold = on(/<w:b\/>|<w:b\s+[^>]*\/>/) && !on(/<w:b\s+w:val="(?:0|false)"/)
  const italic = on(/<w:i\/>|<w:i\s+[^>]*\/>/) && !on(/<w:i\s+w:val="(?:0|false)"/)
  const underline = on(/<w:u\s+[^>]*w:val="(?!none)/)
  const strike = on(/<w:strike\/>|<w:strike\s+[^>]*\/>/)
  // 制表符与手动换行：Word 里用来对齐签名行 / 断行，HTML 里得显式表示
  let html = esc(text)
    .replace(/\t/g, '<span style="display:inline-block;width:2em"></span>')
    .replace(/\n/g, '<br/>')
  if (underline) html = '<u>' + html + '</u>'
  if (strike) html = '<del>' + html + '</del>'
  if (italic) html = '<em>' + html + '</em>'
  if (bold) html = '<strong>' + html + '</strong>'
  return html
}

// 段落：把 Word 的段落属性翻成行内 style。缩进 / 间距用**相对字号**（em）表示，
// 这样将来面板改字号时版式比例仍然对。
const paraHtml = (inner) => {
  const pPr = (/<w:pPr>([\s\S]*?)<\/w:pPr>/.exec(inner) || [])[1] || ''
  const runRe = /<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g
  let body = ''
  let plain = ''
  let r
  while ((r = runRe.exec(inner)) !== null) {
    body += runHtml(r[1])
    plain += paraText(r[1])
  }
  if (plain.trim() === '') return ''   // 空段落（Word 用来挤间距）不画

  const szMatch = /<w:sz\s+w:val="(\d+)"/.exec(inner)
  const sizePx = szMatch ? halfPointsToPx(szMatch[1]) : DEFAULT_FONT_PX
  const style = ['font-size:' + sizePx + 'px']

  const jc = /<w:jc\s+w:val="([^"]*)"/.exec(pPr)
  if (jc && ALIGN[jc[1]]) style.push('text-align:' + ALIGN[jc[1]])

  const ind = /<w:ind\b[^>]*\/?>/.exec(pPr)
  if (ind) {
    const attr = (name) => {
      const m = new RegExp('w:' + name + '="(-?\\d+)"').exec(ind[0])
      return m ? Number(m[1]) : null
    }
    const firstLine = attr('firstLine')
    const hanging = attr('hanging')
    const left = attr('left') ?? attr('start')
    const right = attr('right') ?? attr('end')
    if (firstLine !== null) style.push('text-indent:' + (twipsToPx(firstLine) / sizePx).toFixed(2) + 'em')
    if (hanging !== null) {
      const em = (twipsToPx(hanging) / sizePx).toFixed(2)
      style.push('text-indent:-' + em + 'em', 'padding-left:' + em + 'em')
    }
    if (left !== null && left > 0) style.push('padding-left:' + (twipsToPx(left) / sizePx).toFixed(2) + 'em')
    if (right !== null && right > 0) style.push('padding-right:' + (twipsToPx(right) / sizePx).toFixed(2) + 'em')
  }

  const spacing = /<w:spacing\b[^>]*\/?>/.exec(pPr)
  if (spacing) {
    const num = (name) => {
      const m = new RegExp('w:' + name + '="(-?\\d+)"').exec(spacing[0])
      return m ? Number(m[1]) : null
    }
    const before = num('before')
    const after = num('after')
    if (before !== null && before > 0) style.push('margin-top:' + twipsToPx(before) + 'px')
    if (after !== null && after > 0) style.push('margin-bottom:' + twipsToPx(after) + 'px')
    const line = num('line')
    const rule = /w:lineRule="(\w+)"/.exec(spacing[0])
    if (line !== null && line > 0) {
      // auto = 倍数（240 = 单倍行距）；exact / atLeast 是长度
      if (!rule || rule[1] === 'auto') style.push('line-height:' + (line / 240).toFixed(2))
      else style.push('line-height:' + twipsToPx(line) + 'px')
    }
  }

  // 标题样式（Heading1 / 标题1）没有字号时给一套默认层级
  const hm = /heading\s*([1-6])/i.exec(pPr) || /标题\s*([1-6])/.exec(pPr)
  if (hm && !szMatch) {
    const level = Number(hm[1])
    style[0] = 'font-size:' + (level === 1 ? 22 : level === 2 ? 18 : level === 3 ? 16 : 14) + 'px'
    body = '<strong>' + body + '</strong>'
    if (!spacing) style.push('margin:10px 0 6px')
  }
  // 整段粗体、又不太长：合同里"第X条"就是这个形态，给一点点上间距当小标题
  if (/<w:numPr>/.test(pPr)) style.push('padding-left:0')

  return '<p style="' + style.join(';') + '">' + body + '</p>'
}

const tableHtml = (inner) => {
  const rows = []
  const rowRe = /<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g
  let r
  while ((r = rowRe.exec(inner)) !== null) {
    const cells = []
    const cellRe = /<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g
    let c
    while ((c = cellRe.exec(r[1])) !== null) {
      let cell = ''
      const pRe = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g
      let p
      while ((p = pRe.exec(c[1])) !== null) cell += paraHtml(p[1])
      cells.push(cell)
    }
    if (cells.length > 0) rows.push(cells)
  }
  if (rows.length === 0) return ''
  // 表格宽度：Word 用 pct 时 w:val 是百分比的 50 倍（5000 = 100%）
  let width = ''
  const tblW = /<w:tblW\b[^>]*\/?>/.exec(inner)
  if (tblW) {
    const val = /w:w="(\d+)"/.exec(tblW[0])
    const type = /w:type="(\w+)"/.exec(tblW[0])
    if (val && type && type[1] === 'pct') width = ' style="width:' + (Number(val[1]) / 50).toFixed(1) + '%"'
  }
  const body = rows.map((cells) => '<tr>' + cells.map((cell) => '<td>' + cell + '</td>').join('') + '</tr>').join('')
  return '<table' + width + '>' + body + '</table>'
}

// .docx 的正文 → HTML。**为什么不是 Markdown**：居中、首行缩进、段间距、行距、
// 字号这些在 Markdown 里没有对应写法，而它们恰恰决定"看起来像不像那份 Word"。
// 安全性：所有文字过 esc()，所有从文档里读到的枚举值都经白名单（ALIGN / 数值正则），
// 拼进标签的属性没有一处来自文档原文。
const docxToHtml = (xml) => {
  const bs = xml.indexOf('<w:body')
  const be = xml.lastIndexOf('</w:body>')
  const body = bs >= 0 && be > bs ? xml.slice(xml.indexOf('>', bs) + 1, be) : xml
  const out = []
  // 顶层只有两种块：表格和段落（自闭合的空段落单列一支）。
  const blockRe = /<w:tbl(?:\s[^>]*)?>([\s\S]*?)<\/w:tbl>|<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>|<w:p(?:\s[^>]*)?\/>/g
  let m
  while ((m = blockRe.exec(body)) !== null) {
    if (m[1] !== undefined) {
      const table = tableHtml(m[1])
      if (table) out.push(table)
      continue
    }
    const html = paraHtml(m[2] || '')
    if (html) out.push(html)
  }
  return out.join('')
}

export function apply(ctx) {
  const fs = ctx.fs
  const message = (err) => String((err && err.message) || err)

  const readBody = async (req) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    return Buffer.concat(chunks).toString('utf8')
  }
  const send = (res, status, obj) => {
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    })
    res.end(JSON.stringify(obj))
  }
  const param = (req, key) => {
    try {
      return new URL(req.url ?? '/', 'http://x').searchParams.get(key)
    } catch {
      return null
    }
  }
  const requirePath = (req, res) => {
    const path = param(req, 'path')
    if (!path) {
      send(res, 400, { error: 'missing path' })
      return null
    }
    return path
  }

  // ---------- 变更事件（C1）：DSH 写入文件 → 通知浏览器刷新对应目录 ----------
  //
  // 信号源是 `fs/observed`。注意它**读也会发**：DSH 的文件服务每次观察到路径都
  // 记一次，所以必须先按 actor 过滤出写入工具（与官方 dsh-skill-filesystem 同
  // 口径：只认 `write` / `edit`），否则任何一次预览都会让整棵树重扫。
  //
  // 只推送"文件所在目录"这一层：父目录的列表变了，子目录的内容没变。
  // 事件在 agent 跑一次 bash/多文件编辑时会成批到达，故做 200ms 合并。
  const FLUSH_MS = 200
  const MAX_PENDING = 500
  const sseClients = new Set()
  let pending = new Set()
  let flushTimer = null

  const parentDirOf = (p) => {
    const s = String(p)
    const i = s.lastIndexOf('/')
    return i > 0 ? s.slice(0, i) : s
  }

  const flush = () => {
    flushTimer = null
    if (pending.size === 0) return
    // 没有客户端在听时**不清空**：留着等下一个客户端连上补发，
    // 这样面板关闭期间发生的变更不会丢。
    if (sseClients.size === 0) return
    const dirs = Array.from(pending)
    pending = new Set()
    const frame = 'data: ' + JSON.stringify({ dirs }) + '\n\n'
    for (const client of sseClients) {
      try {
        client.write(frame)
      } catch {
        sseClients.delete(client)
      }
    }
  }

  const scheduleFlush = () => {
    if (flushTimer !== null) return
    flushTimer = setTimeout(flush, FLUSH_MS)
  }

  const mutationToolName = (actor) => {
    if (actor === null || typeof actor !== 'object' || !('name' in actor)) return undefined
    const value = actor.name
    return value === 'edit' || value === 'write' ? value : undefined
  }

  ctx.on('fs/observed', (target, _observation, actor) => {
    if (mutationToolName(actor) === undefined) return
    if (target === null || typeof target !== 'object') return
    if (pending.size >= MAX_PENDING) return
    // 两种拼法都收：客户端缓存里的路径来自 `fs.processPath`（= targetKey，
    // realpath 之后的形态），而这里直接拿到的是 `displayPath`（未 realpath）。
    // 工作区没有软链时两者相同；有软链时会不同——都收进去，客户端按字符串匹配
    // 就不会漏。Set 天然去重，通常只多出一条完全相同项。
    for (const spelling of [target.displayPath, target.targetKey]) {
      if (typeof spelling === 'string' && spelling.length > 0) pending.add(parentDirOf(spelling))
    }
    scheduleFlush()
  })

  // 进程退出/插件卸载时收摊：清掉待发定时器，断开所有 SSE 连接。
  ctx.effect(() => () => {
    if (flushTimer !== null) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    for (const client of sseClients) {
      try {
        client.end()
      } catch {
        /* already closed */
      }
    }
    sseClients.clear()
    pending = new Set()
  }, 'file-browser: change feed')

  let registered = false
  const registerWeb = () => {
    if (registered) return
    const webServer = ctx.get('webServer') ?? ctx.get('httpServer')
    if (webServer === undefined) return
    registered = true

    const route = (path, handler) => {
      ctx.effect(() => webServer.register({ kind: 'exact', path, handler }), 'file-browser: ' + path)
    }

    route('/plugins/file-browser/list', async (req, res) => {
      const path = requirePath(req, res)
      if (path === null) return
      try {
        const target = await fs.resolve(path)
        const info = await fs.stat(target)
        if (info === undefined || info.type !== 'directory') {
          send(res, 404, { error: 'not-a-directory' })
          return
        }
        const entries = await fs.listDir(target)
        send(res, 200, {
          entries: entries.map((e) => ({
            name: e.name,
            type: e.type,
            size: typeof e.size === 'number' ? e.size : null,
            path: fs.processPath(e.target),
          })),
        })
      } catch (err) {
        send(res, 500, { error: message(err) })
      }
    })

    route('/plugins/file-browser/read', async (req, res) => {
      const path = requirePath(req, res)
      if (path === null) return
      try {
        const target = await fs.resolve(path)
        const info = await fs.stat(target)
        if (info === undefined) {
          send(res, 404, { error: 'not-found' })
          return
        }
        if (info.type !== 'file') {
          send(res, 400, { error: 'not-a-file' })
          return
        }
        const size = typeof info.size === 'number' ? info.size : 0
        if (size > MAX_READ) {
          send(res, 200, { tooLarge: true, size })
          return
        }
        const content = await fs.readText(target)
        // version 是文件服务的"内容版本"（设备:inode:大小:mtime:ctime）。客户端
        // 保存时原样带回来，文件在我们编辑期间被改过就会被拒绝 —— 乐观锁由文件
        // 服务拥有，这里只负责把版本号来回传，不自己发明一套。
        send(res, 200, { content, size, version: info.version ?? null })
      } catch (err) {
        send(res, 500, { error: message(err) })
      }
    })

    route('/plugins/file-browser/write', async (req, res) => {
      if (req.method !== 'POST') {
        send(res, 405, { error: 'use POST' })
        return
      }
      let body
      try {
        body = JSON.parse(await readBody(req))
      } catch {
        send(res, 400, { error: 'bad-json' })
        return
      }
      const path = String((body && body.path) || '')
      if (!path) {
        send(res, 400, { error: 'missing path' })
        return
      }
      const content = String((body && body.content) ?? '')
      const bytes = Buffer.byteLength(content, 'utf8')
      if (bytes > MAX_READ) {
        send(res, 400, { error: `too-large: ${bytes} bytes exceeds the ${MAX_READ}-byte limit` })
        return
      }
      // 默认走乐观锁：必须带上"我读到的那一版"。不带就直接拒绝 —— 允许盲写
      // 就等于允许悄悄覆盖模型刚改过的内容。force（用户在面板上确认过冲突）
      // 才走不带期望值的写入。
      const force = body && body.force === true
      const version = body && typeof body.version === 'string' && body.version.length > 0 ? body.version : null
      if (!force && version === null) {
        send(res, 400, { error: 'missing version (read the file first, or pass force)' })
        return
      }
      try {
        const target = await fs.resolve(path)
        const expected = force ? undefined : { kind: 'replaceIfVersion', version }
        const result = await fs.writeText(target, content, expected)
        send(res, 200, { ok: true, version: (result && result.version) || null, operation: (result && result.operation) || null })
      } catch (err) {
        // 版本对不上：文件在编辑期间被改过。给客户端一个可区分的信号，
        // 它据此亮"磁盘已变"，让用户在"重新读取 / 覆盖磁盘"里选。
        if (err && err.code === 'FS_STALE_VERSION') {
          send(res, 409, { error: message(err), stale: true })
          return
        }
        send(res, 500, { error: message(err) })
      }
    })

    // 图像字节：给客户端的 <img> 用。分块读，**内存不随文件大小涨** ——
    // fs.readByteRange 以窗口为界（不整文件入内存），所以这里能原生支持 Range。
    route('/plugins/file-browser/raw', async (req, res) => {
      const path = requirePath(req, res)
      if (path === null) return
      const mime = mimeForImage(path)
      if (mime === null) {
        send(res, 415, { error: 'unsupported-type' })
        return
      }
      let target
      let size
      try {
        target = await fs.resolve(path)
        const info = await fs.stat(target)
        if (info === undefined || info.type !== 'file') {
          send(res, 404, { error: 'not-a-file' })
          return
        }
        size = typeof info.size === 'number' ? info.size : 0
      } catch (err) {
        send(res, 500, { error: message(err) })
        return
      }
      if (size > MAX_IMAGE) {
        send(res, 413, { error: 'too-large', size, limit: MAX_IMAGE })
        return
      }
      const range = size > 0 ? parseRange(req.headers.range, size) : null
      if (range && range.invalid) {
        res.writeHead(416, { 'content-range': 'bytes */' + size, 'cache-control': 'no-store' })
        res.end()
        return
      }
      const start = range ? range.start : 0
      const end = size === 0 ? -1 : (range ? range.end : size - 1)
      const length = end >= start ? end - start + 1 : 0
      const headers = {
        'content-type': mime,
        // 同名文件随时可能被换掉，别让中间层或浏览器留着旧图
        'cache-control': 'no-store, no-transform',
        'content-disposition': 'inline',
        'accept-ranges': 'bytes',
        'content-length': String(length),
        // 图片里可能带脚本（尤其 .svg）：nosniff 防"按内容猜类型"，
        // CSP 再把"直接打开这条 URL"时的脚本执行掐掉。正常用法是 <img>，
        // 那种情况下脚本本来就不会执行。
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; sandbox",
      }
      if (range) headers['content-range'] = 'bytes ' + start + '-' + end + '/' + size
      res.writeHead(range ? 206 : 200, headers)
      if (length === 0) {
        res.end()
        return
      }
      let off = start
      let left = length
      try {
        while (left > 0) {
          const chunk = await fs.readByteRange(target, { offset: off, length: Math.min(RAW_CHUNK, left) })
          if (!chunk || chunk.length === 0) break   // 文件在读到一半时被截断
          const buf = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)
          if (!res.write(buf)) await new Promise((done) => res.once('drain', done))
          off += chunk.length
          left -= chunk.length
          if (res.destroyed || res.writableEnded) return
        }
      } catch (err) {
        res.destroy()   // 响应头已经发出去了，这时候没法再回一个 JSON 错误
        return
      }
      res.end()
    })

    // Word（.docx）只读预览：抽出文字和表格，转成 Markdown 交给客户端现成的
    // 渲染器。**只读**是硬性的 —— 抽出来的文本不是原文件，改回去没有意义。
    route('/plugins/file-browser/docx', async (req, res) => {
      const path = requirePath(req, res)
      if (path === null) return
      if (extOf(path) !== 'docx') {
        send(res, 415, { error: 'not-a-docx' })
        return
      }
      try {
        const target = await fs.resolve(path)
        const info = await fs.stat(target)
        if (info === undefined || info.type !== 'file') {
          send(res, 404, { error: 'not-found' })
          return
        }
        const size = typeof info.size === 'number' ? info.size : 0
        if (size > MAX_DOCX) {
          send(res, 200, { tooLarge: true, size })
          return
        }
        const bytes = await fs.readBytes(target, undefined, MAX_DOCX)
        const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        const xml = readZipEntry(buf, 'word/document.xml')
        if (xml === null) {
          send(res, 415, { error: '这不是可读的 .docx（老式 .doc 或文件已损坏）' })
          return
        }
        send(res, 200, { content: docxToHtml(xml), size })
      } catch (err) {
        if (err && err.code === 'FS_TOO_LARGE') {
          send(res, 200, { tooLarge: true, size: null })
          return
        }
        send(res, 500, { error: message(err) })
      }
    })

    // 变更流（SSE）：面板打开时连上、关掉就断开；断线由浏览器自动重连。
    // 只推「哪些目录变了」，不推内容——客户端自己决定重扫哪几个目录、
    // 要不要重读当前预览的文件。面板关着期间攒下的变更不会丢：上面 flush
    // 在没有客户端时不清空 pending，这里连上就补发。
    route('/plugins/file-browser/events', (req, res) => {
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        // no-transform 让压缩中间件跳过这条响应：gzip 会把 SSE 的即时帧缓冲住
        'cache-control': 'no-store, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      })
      res.write(': connected\n\n')
      sseClients.add(res)
      if (flushTimer !== null) {
        clearTimeout(flushTimer)
        flushTimer = null
      }
      flush()   // 补发面板关闭期间攒下的变更
      // 心跳：既防中间层掐掉空闲连接，也顺便探活
      const beat = setInterval(() => {
        try { res.write(': ping\n\n') } catch { /* 断开由下面的 close 收走 */ }
      }, 25000)
      const done = () => {
        clearInterval(beat)
        sseClients.delete(res)
      }
      req.on('close', done)
      res.on('close', done)
    })
  }

  registerWeb()
  ctx.on('internal/service', (name) => {
    if (name === 'webServer' || name === 'httpServer') registerWeb()
  })
}
