import { useEffect, useState } from 'react'
import { BriefcaseBusiness, Check, Link2Off, LockKeyhole, Mail, PencilLine, Save, Send, Smile } from 'lucide-react'

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

function EmailPreview({ form, body, from, saved, dirty, sent, saving, sending, canSave, canSend, onBodyChange, onSave, onSend }) {
  return (
    <section className="preview-wrap" aria-label="Email preview">
      <article className="preview-sheet">
        <div className="preview-title">
          <span>{sent ? 'Email sent' : 'Review your email'}</span>
          {sent ? <span className="saved-mark"><Check size={15} />Sent</span> : saved ? <span className="saved-mark"><Check size={15} />Saved in Gmail</span> : null}
        </div>
        <dl className="email-meta">
          <div><dt>To</dt><dd>{form.to || 'recipient@example.com'}</dd></div>
          <div><dt>Subject</dt><dd>{form.subject || 'Your subject line'}</dd></div>
          <div><dt>From</dt><dd>{from || 'you@gmail.com'}</dd></div>
        </dl>
        <div className="email-editor-wrap">
          <label className="sr-only" htmlFor="email-body">Email body</label>
          <textarea
            id="email-body"
            className="email-body-editor"
            value={body}
            onChange={(event) => onBodyChange(event.target.value)}
            placeholder="Your generated email will appear here."
            disabled={sent}
          />
        </div>
        <div className="preview-actions">
          <span>{sent ? 'Delivered through Gmail.' : dirty ? 'You have unsaved changes.' : canSend ? 'Draft saved. Review before sending.' : 'Generate an email to create a Gmail draft.'}</span>
          <div className="email-actions">
            <button className="save-button" type="button" onClick={onSave} disabled={!canSave || saving || sending || sent}>
              <Save size={18} />{saving ? 'Saving…' : 'Save draft'}
            </button>
            <button className="send-button" type="button" onClick={onSend} disabled={!canSend || saving || sending || sent}>
              <Send size={18} />{sending ? 'Sending…' : sent ? 'Sent' : 'Send email'}
            </button>
          </div>
        </div>
      </article>
      <p className="privacy-note"><LockKeyhole size={15} />Nothing is sent until you review and confirm.</p>
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
  const [draftId, setDraftId] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
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

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setSaved(false)
    setDirty(Boolean(draftId))
    setSent(false)
  }

  function changeTone(nextTone) {
    setTone(nextTone)
    setBody(previewBodies[nextTone])
    setSaved(false)
    setDirty(Boolean(draftId))
    setSent(false)
  }

  async function createDraft(event) {
    event.preventDefault()
    setBusy(true)
    setNotice('')
    setSaved(false)
    setDraftId(null)
    setDirty(false)
    setSent(false)
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
      setDraftId(data.draftId)
      setDirty(false)
      setNotice(data.draftId ? 'Draft created in Gmail.' : 'Demo draft generated. Connect Gmail to save it.')
    } catch (error) {
      setNotice(error.message)
    } finally {
      setBusy(false)
    }
  }

  function updateBody(value) {
    setBody(value)
    setSaved(false)
    setDirty(Boolean(draftId))
    setSent(false)
  }

  async function saveDraft() {
    if (!draftId) return
    setSaving(true)
    setNotice('')
    try {
      const response = await fetch(`/api/drafts/${encodeURIComponent(draftId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: form.to, subject: form.subject, body }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to save the draft.')
      setSaved(true)
      setDirty(false)
      setNotice('Draft changes saved in Gmail.')
    } catch (error) {
      setNotice(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function sendDraft() {
    if (!draftId || !window.confirm(`Send this email to ${form.to}?`)) return
    setSending(true)
    setNotice('')
    try {
      const response = await fetch(`/api/drafts/${encodeURIComponent(draftId)}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: form.to, subject: form.subject, body }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to send the email.')
      setSent(true)
      setSaved(false)
      setDraftId(null)
      setDirty(false)
      setNotice('Email sent through Gmail.')
    } catch (error) {
      setNotice(error.message)
    } finally {
      setSending(false)
    }
  }

  async function disconnect() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setStatus((current) => ({ ...current, connected: false, email: null }))
    setSaved(false)
    setDraftId(null)
    setDirty(false)
    setSent(false)
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
            <p>Give PitchTrace the context. Review and edit the Gmail draft, then send it when you are ready.</p>
          </div>
          <form onSubmit={createDraft}>
            <ToneSwitch tone={tone} onChange={changeTone} />
            <label>To<input name="to" type="email" value={form.to} onChange={updateField} required autoComplete="email" /></label>
            <label>Subject<input name="subject" value={form.subject} onChange={updateField} required maxLength={160} /></label>
            <label>What should this email say?<textarea name="context" value={form.context} onChange={updateField} required rows={6} maxLength={4000} /></label>
            <button className="create-button" type="submit" disabled={busy}>
              <PencilLine size={21} />{busy ? 'Creating draft…' : status.connected ? 'Create Gmail draft' : 'Generate demo draft'}
            </button>
            {notice ? <p className={`notice ${saved || sent ? 'success' : ''}`} role="status">{notice}</p> : null}
          </form>
        </section>
        <EmailPreview
          form={form}
          body={body}
          from={status.email}
          saved={saved}
          dirty={dirty}
          sent={sent}
          saving={saving}
          sending={sending}
          canSave={Boolean(status.connected && draftId && dirty && body.trim())}
          canSend={Boolean(status.connected && draftId && body.trim())}
          onBodyChange={updateBody}
          onSave={saveDraft}
          onSend={sendDraft}
        />
      </main>
    </div>
  )
}
