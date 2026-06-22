import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import session from 'express-session'

class EncryptedJsonFile {
  constructor(filePath, secret, fallback = {}) {
    this.filePath = filePath
    this.key = crypto.createHash('sha256').update(secret).digest()
    this.fallback = fallback
    this.queue = Promise.resolve()
  }

  async read() {
    try {
      const envelope = JSON.parse(await fs.readFile(this.filePath, 'utf8'))
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(envelope.iv, 'base64url'))
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'))
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(envelope.data, 'base64url')),
        decipher.final(),
      ])
      return JSON.parse(plaintext.toString('utf8'))
    } catch (error) {
      if (error.code === 'ENOENT') return structuredClone(this.fallback)
      throw error
    }
  }

  async write(value) {
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv)
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
    const envelope = JSON.stringify({
      iv: iv.toString('base64url'),
      tag: cipher.getAuthTag().toString('base64url'),
      data: ciphertext.toString('base64url'),
    })
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`
    await fs.writeFile(temporaryPath, envelope, { mode: 0o600 })
    await fs.rename(temporaryPath, this.filePath)
  }

  update(mutator) {
    const operation = this.queue.then(async () => {
      const current = await this.read()
      const next = await mutator(current)
      await this.write(next === undefined ? current : next)
      return next === undefined ? current : next
    })
    this.queue = operation.catch(() => {})
    return operation
  }
}

export class EncryptedSessionStore extends session.Store {
  constructor(filePath, secret) {
    super()
    this.storage = new EncryptedJsonFile(filePath, secret, {})
  }

  get(sid, callback) {
    this.storage.read().then((sessions) => {
      const value = sessions[sid]
      const expiresAt = value?.cookie?.expires ? new Date(value.cookie.expires).getTime() : null
      callback(null, expiresAt && expiresAt < Date.now() ? null : value || null)
    }).catch(callback)
  }

  set(sid, value, callback = () => {}) {
    this.storage.update((sessions) => ({ ...sessions, [sid]: value })).then(() => callback()).catch(callback)
  }

  destroy(sid, callback = () => {}) {
    this.storage.update((sessions) => {
      delete sessions[sid]
      return sessions
    }).then(() => callback()).catch(callback)
  }

  touch(sid, value, callback = () => {}) {
    this.set(sid, value, callback)
  }
}

export class DeliveryHistoryStore {
  constructor(filePath, secret) {
    this.storage = new EncryptedJsonFile(filePath, secret, {})
  }

  async list(email) {
    const history = await this.storage.read()
    return history[email] || []
  }

  async add(email, entry) {
    await this.storage.update((history) => ({
      ...history,
      [email]: [entry, ...(history[email] || [])].slice(0, 100),
    }))
  }
}
