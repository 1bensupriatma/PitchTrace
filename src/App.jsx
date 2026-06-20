import { useEffect, useMemo, useState } from 'react'
import { BriefcaseBusiness, Check, Link2Off, LockKeyhole, Mail, PencilLine, Smile } from 'lucide-react'

const sample = {
  to: 'maya@atlas.studio',
  subject: 'Following up on the proposal',
  context: "Thank Maya for yesterday’s call, recap the timeline we discussed, and ask whether Friday works for next steps.",
}

const previewBodies = {
  professional: `Hi Maya,\n\nThank you for taking the time to speak with me yesterday. I appreciated our conversation and the clarity around the path forward.\n\nI wanted to recap the timeline we discussed and make sure we are aligned on the next steps. Would Friday work for a brief call to confirm the remaining details?\n\nBest regards,\nAlex`,
  casual: `Hi Maya,\n\nThanks again for the great call yesterday! I wanted to quickly recap the timeline we discussed and make sure we're on the same page.\n\nWould Friday work to connect on next steps?\n\nBest,\nAlex`,
}

function Header({ status, onDisconnect, onConfigurationHelp }) {
  const connected = status.connected
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="PitchTrace home">PitchTrace<span>.</span></a>
      <div className="account-area">
        <div className={`connection ${connected ? 'connected' : ''}`}>
          <span className="status-dot" aria-hidden="true" />
          <span>{connected ? 'Gmail connected' : status.demo ? 'Demo mode' : 'Gmail not connected'}</span>
        </div>
        {connected ? (
          <>
            <span className="divider" />
            <span className="account-email">{status.email}</span>
            <button className="disconnect" onClick={onDisconnect}><Link2Off size={18} />Disconnect</button>
          </>
        ) : status.googleConfigured ? (
          <a className="connect-button" href="/api/auth/google"><Mail size={17} />Connect Gmail</a>
        ) : (
          <button className="connect-button" type="button" onClick={onConfigurationHelp}><Mail size={17} />Configure Gmail</button>
        )}
      </div>
    </header>
  )
}

function ToneSwitch({ tone, onChange }) {
  return (
    <fieldset className="tone-switch">
      <legend className="sr-only">Email tone</legend>
      <button type="button" className={tone === 'casual' ? 'active' : ''} onClick={() => onChange('casual')} aria-pressed={tone === 'casual'}>
        <Smile size={21} />Casual
      </button>
      <button type="button" className={tone === 'professional' ? 'active' : ''} onClick={() => onChange('professional')} aria-pressed={tone === 'professional'}>
        <BriefcaseBusiness size={20} />Professional
      </button>
    </fieldset>
  )
}

function EmailPreview({ form, body, from, saved }) {
  return (
    <section className="preview-wrap" aria-label="Email preview">
      <article className="preview-sheet">
        <div className="preview-title">
          <span>{saved ? 'Gmail draft created' : 'Live preview'}</span>
          {saved ? <span className="saved-mark"><Check size={15} />Saved</span> : null}
        </div>
        <dl className="email-meta">
          <div><dt>To</dt><dd>{form.to || 'recipient@example.com'}</dd></div>
          <div><dt>Subject</dt><dd>{form.subject || 'Your subject line'}</dd></div>
          <div><dt>From</dt><dd>{from || 'you@gmail.com'}</dd></div>
        </dl>
        <div className="email-body">
          {(body || 'Your generated email will appear here.').split('\n').map((line, index) => (
            <p key={`${index}-${line}`}>{line || '\u00a0'}</p>
          ))}
        </div>
      </article>
      <p className="privacy-note"><LockKeyhole size={15} />Saved drafts stay in Gmail until you send them.</p>
    </section>
  )
}

export default function App() {
  const [status, setStatus] = useState({ connected: false, demo: true, email: null, googleConfigured: false, openAIConfigured: false })
  const [tone, setTone] = useState('professional')
  const [form, setForm] = useState(sample)
  const [body, setBody] = useState(previewBodies.professional)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    const params = new URLSearchParams(window.location.search)
    const oauthError = params.get('error')
    if (oauthError === 'google-not-configured') setNotice('Gmail OAuth is not configured. Add your Google credentials to .env and restart the app.')
    if (oauthError === 'oauth-failed') setNotice('Google could not complete the connection. Check the redirect URI and try again.')
    if (params.has('connected')) setNotice('Gmail connected successfully.')
    if (oauthError || params.has('connected')) window.history.replaceState({}, '', window.location.pathname)
    fetch('/api/status')
      .then((response) => response.json())
      .then((data) => { if (active) setStatus(data) })
      .catch(() => { if (active) setNotice('The server is not reachable. Start it with npm run dev.') })
    return () => { active = false }
  }, [])

  const preview = useMemo(() => body || previewBodies[tone], [body, tone])

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setSaved(false)
  }

  function changeTone(nextTone) {
    setTone(nextTone)
    setBody(previewBodies[nextTone])
    setSaved(false)
  }

  async function createDraft(event) {
    event.preventDefault()
    setBusy(true)
    setNotice('')
    setSaved(false)
    try {
      const response = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tone }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to create the draft.')
      setBody(data.body)
      setSaved(Boolean(data.draftId))
      setNotice(data.draftId ? 'Draft created in Gmail.' : 'Demo draft generated. Connect Gmail to save it.')
    } catch (error) {
      setNotice(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setStatus((current) => ({ ...current, connected: false, email: null }))
    setSaved(false)
  }

  function showConfigurationHelp() {
    setNotice('Create .env from .env.example, add your Google OAuth client ID and secret, then restart npm run dev.')
  }

  return (
    <div className="app-shell">
      <Header status={status} onDisconnect={disconnect} onConfigurationHelp={showConfigurationHelp} />
      <main className="workspace">
        <section className="composer">
          <div className="intro">
            <h1>Write the email you<br />meant to send.</h1>
            <p>Give PitchTrace the context. It will shape the words and save a draft to Gmail—never send it.</p>
          </div>
          <form onSubmit={createDraft}>
            <ToneSwitch tone={tone} onChange={changeTone} />
            <label>To<input name="to" type="email" value={form.to} onChange={updateField} required autoComplete="email" /></label>
            <label>Subject<input name="subject" value={form.subject} onChange={updateField} required maxLength={160} /></label>
            <label>What should this email say?<textarea name="context" value={form.context} onChange={updateField} required rows={6} maxLength={4000} /></label>
            <button className="create-button" type="submit" disabled={busy}>
              <PencilLine size={21} />{busy ? 'Creating draft…' : status.connected ? 'Create Gmail draft' : 'Generate demo draft'}
            </button>
            {notice ? <p className={`notice ${saved ? 'success' : ''}`} role="status">{notice}</p> : null}
          </form>
        </section>
        <EmailPreview form={form} body={preview} from={status.email} saved={saved} />
      </main>
    </div>
  )
}
