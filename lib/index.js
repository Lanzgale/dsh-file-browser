/**
 * dsh-file-browser — host half.
 *
 * Registers the /plugins/file-browser/* HTTP routes for the web
 * file-browser panel (list / read / write / open-vscode) and
 * launches VS Code through the shell service. The routes are served by the
 * same web server as the GUI (webServer / httpServer dual-key compatible),
 * so the browser client fetches them from the page origin.
 *
 * @module dsh-file-browser
 */
export const name = 'file-browser'
export const inject = ['fs']

const MAX_READ = 1_000_000

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

    route('/plugins/file-browser/open-vscode', async (req, res) => {
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
      const shell = ctx.get('shell')
      const subprocess = ctx.get('subprocess')
      try {
        // Preferred: spawn the real VS Code executable directly through the
        // subprocess seam (no shell sandbox). On Windows `code` resolves to a
        // .cmd shim that Node cannot spawn, so derive <install>\Code.exe from
        // <install>\bin\code.cmd.
        if (subprocess !== undefined) {
          let resolved = null
          try { resolved = await subprocess.resolveExecutable('code') } catch { /* not on PATH */ }
          let program = null
          if (resolved) {
            if (/\.(cmd|bat)$/i.test(String(resolved))) {
              const derived = String(resolved).replace(/[\\/]bin[\\/][^\\/]*$/i, '') + '\\Code.exe'
              try {
                const t = await fs.resolve(derived)
                const info = await fs.stat(t)
                if (info !== undefined && info.type === 'file') program = derived
              } catch { /* derived exe absent */ }
            } else {
              program = resolved
            }
          }
          if (program !== null) {
            const handle = subprocess.spawn({
              argv: [program, path],
              cwd: path,
              stdio: { stdin: 'ignore', stdout: { maxBytes: 4096 }, stderr: { maxBytes: 4096 } },
              graceMs: 8000,
            })
            const outcome = await handle.done
            send(res, 200, { ok: outcome.exitCode === 0, exitCode: outcome.exitCode })
            return
          }
        }
        // Fallback: sandboxed shell with Start-Process (detaches immediately).
        if (shell !== undefined) {
          const quoted = '"' + path.replace(/"/g, '""') + '"'
          const command = 'Start-Process -FilePath code -ArgumentList ' + quoted
          const spec = shell.resolve({ command, timeoutMs: 10000 })
          const result = await shell.run(spec)
          if (result.exitCode === 0) {
            send(res, 200, { ok: true })
            return
          }
        }
        send(res, 200, { ok: false, error: '未找到 VS Code（code 命令不在 PATH 中）' })
      } catch (err) {
        send(res, 500, { ok: false, error: message(err) })
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
    if (name === 'webServer' || name === 'httpServer' || name === 'shell') registerWeb()
  })
}
