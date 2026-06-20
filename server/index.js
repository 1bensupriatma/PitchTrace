import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import express from 'express'
import session from 'express-session'

dotenv.config()

const app = express()
const port = Number(process.env.PORT || 8005)
const appOrigin = process.env.APP_ORIGIN || 'http://127.0.0.1:5173'
const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://127.0.0.1:${port}/api/auth/google/callback`
const hasGoogleConfig = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
const hasOpenAIConfig = Boolean(process.env.OPENAI_API_KEY)
const isProduction = process.env.NODE_ENV === 'production'
const dirname = path.dirname(fileURLToPath(import.meta.url))

app.disable('x-powered-by')
app.use(express.json({ limit: '32kb' }))
app.use(session({
  name: 'pitchtrace.sid',
  secret: process.env.SESSION_SECRET || 'local-development-only-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: isProduction, maxAge: 7 * 24 * 60 * 60 * 1000 },
}))

const cleanHeader = (value) => String(value || '').replace(/[\r\n]/g, ' ').trim()
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

function validateDraftInput(input) {
  const to = cleanHeader(input.to)
  const subject = cleanHeader(input.subject).slice(0, 160)
  const context = String(input.context || '').trim().slice(0, 4000)
  const tone = input.tone === 'casual' ? 'casual' : 'professional'
  if (!isEmail(to)) throw new Error('Enter a valid recipient email address.')
  if (!subject) throw new Error('Add a subject.')
  if (!context) throw new Error('Describe what the email should say.')
  return { to, subject, context, tone }
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url')
}

async function refreshGoogleToken(req) {
  if (!req.session.google?.refreshToken) throw new Error('Connect Gmail before creating a draft.')
  if (req.session.google.accessToken && Date.now() < req.session.google.expiresAt - 60_000) return req.session.google.accessToken
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: req.session.google.refreshToken,
    grant_type: 'refresh_token',
  })
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  const data = await response.json()
  if (!response.ok) throw new Error('Gmail authorization expired. Please reconnect Gmail.')
  req.session.google.accessToken = data.access_token
  req.session.google.expiresAt = Date.now() + data.expires_in * 1000
  return data.access_token
}

async function generateEmail({ to, subject, context, tone }) {
  if (!hasOpenAIConfig) {
    const name = to.split('@')[0].split(/[._-]/)[0]
    const greeting = `${name.charAt(0).toUpperCase()}${name.slice(1)}`
    return tone === 'casual'
      ? `Hi ${greeting},\n\n${context}\n\nThanks!`
      : `Hi ${greeting},\n\nI’m writing regarding ${subject.toLowerCase()}. ${context}\n\nPlease let me know if you have any questions.\n\nBest regards,`
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      instructions: `You write complete, ready-to-review email drafts. Use a ${tone} tone. Preserve the user's facts; do not invent names, dates, commitments, or claims. Return plain text only, including a greeting and sign-off. Do not include a subject line or markdown.`,
      input: `Recipient: ${to}\nSubject: ${subject}\nUser intent:\n${context}`,
      max_output_tokens: 700,
    }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || 'The email model could not create a draft.')
  const text = data.output_text || data.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text
  if (!text) throw new Error('The email model returned an empty draft.')
  return text.trim()
}

async function createGmailDraft(req, input, body) {
  const accessToken = await refreshGoogleToken(req)
  const mime = [
    `To: ${input.to}`,
    `From: ${cleanHeader(req.session.google.email)}`,
    `Subject: ${input.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
  ].join('\r\n')
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw: base64Url(mime) } }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || 'Gmail could not save the draft.')
  return data.id
}

app.get('/api/status', (req, res) => {
  res.json({
    connected: Boolean(req.session.google?.refreshToken),
    email: req.session.google?.email || null,
    demo: !hasGoogleConfig || !hasOpenAIConfig,
    googleConfigured: hasGoogleConfig,
    openAIConfigured: hasOpenAIConfig,
  })
})

app.get('/api/auth/google', (req, res) => {
  if (!hasGoogleConfig) return res.redirect(`${appOrigin}/?error=google-not-configured`)
  const state = crypto.randomBytes(24).toString('hex')
  req.session.oauthState = state
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email https://www.googleapis.com/auth/gmail.compose',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

app.get('/api/auth/google/callback', async (req, res) => {
  try {
    if (!req.query.code || !req.query.state || req.query.state !== req.session.oauthState) throw new Error('Invalid OAuth state.')
    delete req.session.oauthState
    const tokenBody = new URLSearchParams({
      code: String(req.query.code),
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    })
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: tokenBody })
    const tokens = await tokenResponse.json()
    if (!tokenResponse.ok || !tokens.refresh_token) throw new Error('Google did not return an offline refresh token.')
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } })
    const profile = await profileResponse.json()
    if (!profileResponse.ok || !profile.email) throw new Error('Could not read the connected Google account.')
    req.session.google = { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: Date.now() + tokens.expires_in * 1000, email: profile.email }
    res.redirect(`${appOrigin}/?connected=1`)
  } catch (error) {
    console.error(error)
    res.redirect(`${appOrigin}/?error=oauth-failed`)
  }
})

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.status(204).end())
})

app.post('/api/drafts', async (req, res) => {
  try {
    const input = validateDraftInput(req.body)
    const body = await generateEmail(input)
    const draftId = req.session.google?.refreshToken ? await createGmailDraft(req, input, body) : null
    res.json({ body, draftId, demo: !hasOpenAIConfig })
  } catch (error) {
    const clientError = /Enter|Add a subject|Describe|Connect Gmail/.test(error.message)
    res.status(clientError ? 400 : 502).json({ error: error.message || 'Unable to create the draft.' })
  }
})

if (isProduction) {
  const dist = path.resolve(dirname, '../dist')
  app.use(express.static(dist))
  app.get('/{*splat}', (_, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.listen(port, '127.0.0.1', () => console.log(`PitchTrace server running on http://127.0.0.1:${port}`))
