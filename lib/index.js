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
    const display = target !== null && typeof target === 'object' ? target.displayPath : undefined
    if (typeof display !== 'string' || display.length === 0) return
    if (pending.size >= MAX_PENDING) return
    pending.add(parentDirOf(display))
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
        send(res, 200, { content, size })
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
      try {
        const target = await fs.resolve(path)
        await fs.writeText(target, String((body && body.content) ?? ''))
        send(res, 200, { ok: true })
      } catch (err) {
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
  }

  registerWeb()
  ctx.on('internal/service', (name) => {
    if (name === 'webServer' || name === 'httpServer' || name === 'shell') registerWeb()
  })
}
