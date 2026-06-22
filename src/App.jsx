import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowRight, BriefcaseBusiness, Check, Clock3, Download, FileText, Globe2, History,
  Link2Off, LockKeyhole, Mail, Paperclip, PencilLine, RefreshCw, Save, Search, Send,
  Smile, Sparkles, Trash2, X,
} from 'lucide-react'

const sample = {
  to: 'maya@atlas.studio',
  cc: '',
  bcc: '',
  subject: 'Following up on the proposal',
  context: 'Thank Maya for yesterday’s call, recap the timeline we discussed, and ask whether Friday works for next steps.',
  signature: '',
}

const previewBodies = {
  professional: `Hi Maya,\n\nThank you for taking the time to speak with me yesterday. I appreciated our conversation and the clarity around the path forward.\n\nI wanted to recap the timeline we discussed and make sure we are aligned on the next steps. Would Friday work for a brief call to confirm the remaining details?\n\nBest regards,\nAlex`,
  casual: `Hi Maya,\n\nThanks again for the great call yesterday! I wanted to quickly recap the timeline we discussed and make sure we're on the same page.\n\nWould Friday work to connect on next steps?\n\nBest,\nAlex`,
}

const builtInTemplates = [
  { id: 'follow-up', name: 'Meeting follow-up', subject: 'Following up on our conversation', context: 'Thank them for their time, summarize the key decision, and propose a clear next step.' },
  { id: 'introduction', name: 'Warm introduction', subject: 'Introduction', context: 'Introduce yourself, explain why you are reaching out, and suggest a short introductory call.' },
  { id: 'check-in', name: 'Quick check-in', subject: 'Checking in', context: 'Ask how things are going, reference the last conversation, and offer help with the next step.' },
  { id: 'thank-you', name: 'Thank you', subject: 'Thank you', context: 'Express sincere thanks, mention what was especially helpful, and close warmly.' },
]

async function apiRequest(url, options) {
  const response = await fetch(url, options)
  const data = response.status === 204 ? null : await response.json()
  if (!response.ok) {
    const error = new Error(data?.error || 'The request could not be completed.')
    error.details = data?.details
    throw error
  }
  return data
}

function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, data: String(reader.result).split(',')[1] })
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
    reader.readAsDataURL(file)
  })
}

function Header({ status, onDisconnect, onConfigurationHelp }) {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="PitchTrace home">PitchTrace<span>.</span></a>
      <div className="account-area">
        <div className={`connection ${status.connected ? 'connected' : ''}`}>
          <span className="status-dot" aria-hidden="true" />
          <span>{status.connected ? 'Gmail connected' : status.demo ? 'Demo mode' : 'Gmail not connected'}</span>
        </div>
        {status.connected ? (
          <>
            <span className="divider" />
            <span className="account-email">{status.email}</span>
            <button className="disconnect" onClick={onDisconnect}><Link2Off size={18} />Disconnect</button>
          </>
        ) : status.googleConfigured ? (
          <a className="connect-button" href={status.googleAuthUrl || '/api/auth/google'}><Mail size={17} />Connect Gmail</a>
        ) : (
          <button className="connect-button" type="button" onClick={onConfigurationHelp}><Mail size={17} />Configure Gmail</button>
        )}
      </div>
    </header>
  )
}

function ProductHeader({ active, minimal = false }) {
  return (
    <header className="product-header">
      <a className="brand" href="/" aria-label="PitchTrace home">PitchTrace<span>.</span></a>
      {minimal ? null : (
        <nav aria-label="Product navigation">
          <a className={active === 'home' ? 'active' : ''} href="/">Home</a>
          <a className={active === 'pitch' ? 'active' : ''} href="/pitch">Pitch</a>
          <a className={active === 'scrape' ? 'active' : ''} href="/scrape">Scrape</a>
        </nav>
      )}
    </header>
  )
}

function MailPreviewMotif() {
  return (
    <div className="home-motif mail-motif" aria-hidden="true">
      <div className="motif-window-bar"><i /><i /><i /></div>
      <div className="motif-row"><b>To</b><span>alex.jordan@acme.com</span></div>
      <div className="motif-row"><b>Subject</b><span>Ideas to streamline your intake process</span></div>
      <div className="motif-copy"><p>Hi Alex,</p><p>I noticed Acme is scaling its customer intake. Would a quick 15-minute call be useful?</p><p>Best,<br />Taylor</p></div>
      <div className="motif-compose"><span>Send</span><i /><i /><i /><i /></div>
    </div>
  )
}

function ScrapePreviewMotif() {
  const rows = [
    ['Alex Jordan', 'Head of Ops', 'alex.j@acme.com'],
    ['Morgan Lee', 'Product Lead', 'morgan.l@acme.com'],
    ['Riley Chen', 'Growth Manager', 'r.chen@acme.com'],
    ['Jamie Patel', 'Sales Director', 'jamie.p@acme.com'],
  ]
  return (
    <div className="home-motif scrape-motif" aria-hidden="true">
      <label>Source URL</label>
      <div className="motif-url">https://acme.com/about/team</div>
      <div className="scan-status"><Check size={13} /><span>Scan complete</span><b>128 results found</b></div>
      <div className="results-head"><span>Name</span><span>Title</span><span>Email</span></div>
      {rows.map((row) => <div className="result-row" key={row[0]}>{row.map((value) => <span key={value}>{value}</span>)}</div>)}
      <div className="results-foot"><Download size={13} />Export CSV</div>
    </div>
  )
}

function HomePage() {
  return (
    <div className="home-shell">
      <ProductHeader active="home" minimal />
      <main className="home-main">
        <section className="home-intro">
          <h1>Choose your<br />starting point<span>.</span></h1>
          <p>Turn research into outreach without losing the thread.</p>
        </section>
        <section className="pathways" aria-label="PitchTrace products">
          <a className="pathway" href="/pitch">
            <div className="pathway-copy">
              <span className="pathway-icon"><Mail size={27} /></span>
              <h2>Pitch</h2>
              <p>Write, review, and send polished Gmail drafts.</p>
              <span className="pathway-cta">Open Pitch<ArrowRight size={20} /></span>
            </div>
            <MailPreviewMotif />
          </a>
          <a className="pathway" href="/scrape">
            <div className="pathway-copy">
              <span className="pathway-icon"><Globe2 size={27} /></span>
              <h2>Scrape</h2>
              <p>Collect prospect details from a source URL.</p>
              <span className="pathway-cta">Open Scrape<ArrowRight size={20} /></span>
            </div>
            <ScrapePreviewMotif />
          </a>
        </section>
      </main>
      <footer className="home-footer"><span className="footer-mark" />Research clearly. Reach out thoughtfully.</footer>
    </div>
  )
}

function ScrapePage() {
  const [url, setUrl] = useState('')
  const [page, setPage] = useState(null)
  const [contacts, setContacts] = useState([])
  const [selected, setSelected] = useState([])
  const [agent, setAgent] = useState(null)
  const [pages, setPages] = useState([])
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  async function scanContactPage(event) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const result = await apiRequest('/api/scrape/agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
      })
      setPage(result.page)
      setContacts(result.contacts)
      setSelected(result.contacts.map(({ id }) => id))
      setAgent(result.agent)
      setPages(result.pages || [])
      setMessage({ type: result.contacts.length ? 'success' : 'info', text: result.contacts.length ? `Found ${result.contacts.length} contact${result.contacts.length === 1 ? '' : 's'} on this page.` : result.warnings?.[0] || 'No public contact details were found.' })
    } catch (error) {
      setPage(null)
      setContacts([])
      setSelected([])
      setAgent(null)
      setPages([])
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  function updateContact(id, field, value) {
    setContacts((current) => current.map((contact) => contact.id === id ? { ...contact, [field]: value } : contact))
  }

  function toggleContact(id) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }

  function toggleAll() {
    setSelected(selected.length === contacts.length ? [] : contacts.map(({ id }) => id))
  }

  function exportCsv() {
    const chosen = contacts.filter(({ id }) => selected.includes(id))
    if (!chosen.length) return setMessage({ type: 'error', text: 'Select at least one contact to export.' })
    const fields = ['name', 'title', 'company', 'email', 'phone', 'address', 'sourceUrl']
    const escape = (value) => `"${String(value || '').replaceAll('"', '""')}"`
    const csv = [fields.map(escape), ...chosen.map((contact) => fields.map((field) => escape(contact[field])))].map((row) => row.join(',')).join('\r\n')
    const href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = href
    link.download = `pitchtrace-contacts-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(href)
    setMessage({ type: 'success', text: `Exported ${chosen.length} contact${chosen.length === 1 ? '' : 's'}.` })
  }

  function openInPitch() {
    const contact = contacts.find(({ id, email }) => selected.includes(id) && email)
    if (!contact) return setMessage({ type: 'error', text: 'Select a contact with an email address first.' })
    const handoff = {
      to: contact.email,
      subject: `Introduction — ${contact.company || contact.name || 'quick conversation'}`,
      context: `Write a concise introduction to ${contact.name || 'this contact'}${contact.title ? `, ${contact.title}` : ''}${contact.company ? ` at ${contact.company}` : ''}. Explain why a short conversation could be useful and propose a clear next step. Source: ${contact.sourceUrl}`,
    }
    sessionStorage.setItem('pitchtrace.scrapeHandoff', JSON.stringify(handoff))
    window.location.href = '/pitch?from=scrape'
  }

  const selectedCount = selected.length

  return (
    <div className="scrape-shell">
      <ProductHeader active="scrape" />
      <main className="scrape-main">
        <section className="scrape-copy">
          <a className="back-link" href="/"><ArrowRight size={15} />Back to home</a>
          <h1>Collect the signal<br />before you write<span>.</span></h1>
          <p>Give the controlled agent a public website. It will inspect a small set of likely contact pages, then use AI to organize only the evidence it found.</p>
          <form onSubmit={scanContactPage}>
            <label>Website URL<div className="scrape-url-field"><Globe2 size={18} /><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" required /></div></label>
            <button type="submit" disabled={loading}><Sparkles size={18} />{loading ? 'Agent is reviewing…' : 'Run controlled agent'}</button>
          </form>
          <p className="scrape-guidance"><LockKeyhole size={15} />Same domain only, five pages maximum, robots.txt enforced, and every result keeps its source URL.</p>
          {message ? <p className={`scrape-message ${message.type}`} role="status">{message.text}</p> : null}
        </section>
        <section className="scrape-stage" aria-label="Contact extraction results">
          <div className="stage-header">
            <div><span>{page?.url || 'Source preview'}</span><strong>{page?.title || 'Contact results'}</strong></div>
            <div className="stage-actions">
              <button type="button" onClick={exportCsv} disabled={!selectedCount}><Download size={16} />Export CSV</button>
              <button type="button" className="stage-primary" onClick={openInPitch} disabled={!selectedCount}><Mail size={16} />Open in Pitch</button>
            </div>
          </div>
          {contacts.length ? (
            <div className="contact-results">
              {agent ? <div className="agent-trace"><div><Sparkles size={16} /><strong>{agent.mode === 'ai-assisted' ? 'AI review complete' : 'Controlled scan complete'}</strong><span>{pages.length}/{agent.pageLimit} pages</span></div><ol>{agent.steps.map((step) => <li key={step}>{step}</li>)}</ol></div> : null}
              <div className="results-summary"><span>{selectedCount} of {contacts.length} selected</span><small>Edit any field before export or handoff.</small></div>
              <div className="contact-table-wrap">
                <table className="contact-table">
                  <thead><tr><th><input type="checkbox" checked={selectedCount === contacts.length} onChange={toggleAll} aria-label="Select all contacts" /></th><th>Name</th><th>Title</th><th>Company</th><th>Email</th><th>Phone</th></tr></thead>
                  <tbody>{contacts.map((contact) => (
                    <tr key={contact.id}>
                      <td><input type="checkbox" checked={selected.includes(contact.id)} onChange={() => toggleContact(contact.id)} aria-label={`Select ${contact.name || contact.email || 'contact'}`} /></td>
                      {['name', 'title', 'company', 'email', 'phone'].map((field) => <td key={field}><input aria-label={`${field} for ${contact.name || contact.email || 'contact'}`} value={contact[field]} onChange={(event) => updateContact(contact.id, field, event.target.value)} /></td>)}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="stage-empty"><span>{loading ? <Sparkles size={24} /> : <Search size={24} />}</span><h2>{loading ? 'Agent is reviewing the website…' : 'Results will appear here'}</h2><p>{loading ? 'Checking access, following likely contact pages, and collecting sourced evidence.' : 'Enter a public company website to begin.'}</p></div>
          )}
        </section>
      </main>
    </div>
  )
}

function ToneSwitch({ tone, onChange }) {
  return (
    <fieldset className="tone-switch">
      <legend className="sr-only">Email tone</legend>
      <button type="button" className={tone === 'casual' ? 'active' : ''} onClick={() => onChange('casual')} aria-pressed={tone === 'casual'}><Smile size={21} />Casual</button>
      <button type="button" className={tone === 'professional' ? 'active' : ''} onClick={() => onChange('professional')} aria-pressed={tone === 'professional'}><BriefcaseBusiness size={20} />Professional</button>
    </fieldset>
  )
}

function Notice({ notice }) {
  if (!notice?.message) return null
  return (
    <div className={`notice ${notice.type || 'error'}`} role="status">
      <span>{notice.message}</span>
      {notice.details ? (
        <small>
          {notice.details.provider ? `${notice.details.provider} · ` : ''}
          {notice.details.requestId ? `Request ${notice.details.requestId}` : ''}
          {notice.details.retryable ? ' · Safe to retry' : ''}
        </small>
      ) : null}
    </div>
  )
}

function ActionDialog({ type, form, templateName, sending, onTemplateNameChange, onCancel, onSaveTemplate, onSend }) {
  if (!type) return null
  const isSend = type === 'send'
  return (
    <div className="dialog-backdrop">
      <section className="action-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <span className="dialog-icon">{isSend ? <Send size={22} /> : <Save size={22} />}</span>
        <h2 id="dialog-title">{isSend ? 'Send this email?' : 'Save as a template'}</h2>
        {isSend ? (
          <>
            <p>This will send the reviewed Gmail draft. This action cannot be undone.</p>
            <dl className="dialog-summary">
              <div><dt>To</dt><dd>{form.to}</dd></div>
              <div><dt>Subject</dt><dd>{form.subject}</dd></div>
            </dl>
            <div className="dialog-actions">
              <button type="button" className="dialog-cancel" onClick={onCancel}>Cancel</button>
              <button type="button" className="send-button" onClick={onSend} disabled={sending}><Send size={17} />{sending ? 'Sending…' : 'Send email'}</button>
            </div>
          </>
        ) : (
          <form onSubmit={onSaveTemplate}>
            <p>Save the current subject and instructions for reuse in future emails.</p>
            <label>Template name<input value={templateName} onChange={(event) => onTemplateNameChange(event.target.value)} autoFocus maxLength={60} required /></label>
            <div className="dialog-actions">
              <button type="button" className="dialog-cancel" onClick={onCancel}>Cancel</button>
              <button type="submit" className="dialog-primary"><Save size={17} />Save template</button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

function EmailPreview({
  form, body, from, attachments, saved, dirty, sent, saving, sending, rewriting,
  canSave, canSend, onBodyChange, onBodySelect, onRemoveAttachment, onRewrite, onSave, onSend, editorRef,
}) {
  return (
    <section className="preview-wrap" aria-label="Email preview">
      <article className="preview-sheet">
        <div className="preview-title">
          <span>{sent ? 'Email sent' : 'Review your email'}</span>
          {sent ? <span className="saved-mark"><Check size={15} />Sent</span> : saved ? <span className="saved-mark"><Check size={15} />Saved in Gmail</span> : null}
        </div>
        <dl className="email-meta">
          <div><dt>To</dt><dd>{form.to || 'recipient@example.com'}</dd></div>
          {form.cc ? <div><dt>CC</dt><dd>{form.cc}</dd></div> : null}
          {form.bcc ? <div><dt>BCC</dt><dd>{form.bcc}</dd></div> : null}
          <div><dt>Subject</dt><dd>{form.subject || 'Your subject line'}</dd></div>
          <div><dt>From</dt><dd>{from || 'you@gmail.com'}</dd></div>
        </dl>
        <div className="ai-toolbar" aria-label="AI editing tools">
          <span><Sparkles size={15} />AI edit</span>
          <button type="button" onClick={() => onRewrite('shorten')} disabled={rewriting || sent}>Shorten</button>
          <button type="button" onClick={() => onRewrite('warmer')} disabled={rewriting || sent}>Make warmer</button>
          <button type="button" onClick={() => onRewrite('grammar')} disabled={rewriting || sent}>Fix grammar</button>
          {rewriting ? <em>Rewriting…</em> : null}
        </div>
        <div className="email-editor-wrap">
          <label className="sr-only" htmlFor="email-body">Email body</label>
          <textarea
            ref={editorRef}
            id="email-body"
            className="email-body-editor"
            value={body}
            onChange={(event) => onBodyChange(event.target.value)}
            onSelect={onBodySelect}
            placeholder="Your generated email will appear here."
            disabled={sent}
          />
        </div>
        {attachments.length ? (
          <div className="preview-attachments">
            <Paperclip size={15} />
            {attachments.map((file, index) => (
              <span key={`${file.name}-${file.size}-${index}`}>{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => onRemoveAttachment(index)} disabled={sent}><X size={13} /></button></span>
            ))}
          </div>
        ) : null}
        <div className="preview-actions">
          <span>{sent ? 'Delivered through Gmail.' : dirty ? 'You have unsaved changes.' : canSend ? 'Draft saved. Review before sending.' : 'Generate an email to create a Gmail draft.'}</span>
          <div className="email-actions">
            <button className="save-button" type="button" onClick={onSave} disabled={!canSave || saving || sending || sent}><Save size={18} />{saving ? 'Saving…' : 'Save draft'}</button>
            <button className="send-button" type="button" onClick={onSend} disabled={!canSend || saving || sending || sent}><Send size={18} />{sending ? 'Sending…' : sent ? 'Sent' : 'Send email'}</button>
          </div>
        </div>
      </article>
      <p className="privacy-note"><LockKeyhole size={15} />Nothing is sent until you review and confirm.</p>
    </section>
  )
}

function DraftLibrary({ drafts, history, loading, onRefresh, onOpen, onDelete }) {
  return (
    <section className="library" aria-label="Gmail workspace">
      <div className="library-heading">
        <div><span className="eyebrow">Gmail workspace</span><h2>Drafts and delivery history</h2></div>
        <button type="button" className="refresh-button" onClick={onRefresh} disabled={loading}><RefreshCw size={16} />{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      <div className="library-grid">
        <article className="library-panel">
          <h3><FileText size={18} />Gmail drafts <span>{drafts.length}</span></h3>
          <div className="library-list">
            {drafts.length ? drafts.map((draft) => (
              <div className="library-item" key={draft.id}>
                <button type="button" className="item-main" onClick={() => onOpen(draft.id)}>
                  <strong>{draft.subject || '(No subject)'}</strong>
                  <span>To {draft.to || 'No recipient'}</span>
                  <small>{draft.body?.slice(0, 100) || 'Open this draft to review it.'}</small>
                </button>
                <button type="button" className="icon-button danger" aria-label={`Delete ${draft.subject}`} onClick={() => onDelete(draft)}><Trash2 size={17} /></button>
              </div>
            )) : <p className="empty-state">No Gmail drafts found.</p>}
          </div>
        </article>
        <article className="library-panel">
          <h3><History size={18} />Delivery history <span>{history.length}</span></h3>
          <div className="library-list">
            {history.length ? history.map((item) => (
              <div className="history-item" key={item.id}>
                <strong>{item.subject}</strong>
                <span>To {item.to}</span>
                <small><Clock3 size={13} />{new Date(item.sentAt).toLocaleString()} · Gmail ID {item.messageId}</small>
              </div>
            )) : <p className="empty-state">Sent emails will appear here.</p>}
          </div>
        </article>
      </div>
    </section>
  )
}

function PitchWorkspace() {
  const [status, setStatus] = useState({ connected: false, demo: true, email: null, googleConfigured: false, googleAuthUrl: null, openAIConfigured: false })
  const [tone, setTone] = useState('professional')
  const [form, setForm] = useState(() => {
    try { return { ...sample, signature: localStorage.getItem('pitchtrace.signature') || '' } } catch { return sample }
  })
  const [body, setBody] = useState(previewBodies.professional)
  const [attachments, setAttachments] = useState([])
  const [draftId, setDraftId] = useState(null)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [rewriting, setRewriting] = useState(false)
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [drafts, setDrafts] = useState([])
  const [history, setHistory] = useState([])
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const [notice, setNotice] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [templateName, setTemplateName] = useState('')
  const [customTemplates, setCustomTemplates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pitchtrace.templates') || '[]') } catch { return [] }
  })
  const editorRef = useRef(null)

  const showError = useCallback((error) => setNotice({ message: error.message, type: 'error', details: error.details }), [])
  const showSuccess = useCallback((message) => setNotice({ message, type: 'success' }), [])

  const refreshLibrary = useCallback(async () => {
    if (!status.connected) return
    setLibraryLoading(true)
    const [draftResult, historyResult] = await Promise.allSettled([
      apiRequest('/api/gmail/drafts'),
      apiRequest('/api/history'),
    ])
    if (draftResult.status === 'fulfilled') setDrafts(draftResult.value.drafts)
    else showError(draftResult.reason)
    if (historyResult.status === 'fulfilled') setHistory(historyResult.value.history)
    else showError(historyResult.reason)
    setLibraryLoading(false)
  }, [showError, status.connected])

  useEffect(() => {
    let active = true
    const params = new URLSearchParams(window.location.search)
    const oauthError = params.get('error')
    if (oauthError === 'google-not-configured') setNotice({ message: 'Gmail OAuth is not configured. Add your Google credentials to .env and restart the app.', type: 'error' })
    if (oauthError === 'oauth-failed') setNotice({ message: 'Google could not complete the connection. Check the redirect URI and try again.', type: 'error' })
    if (params.has('connected')) setNotice({ message: 'Gmail connected successfully.', type: 'success' })
    if (params.get('from') === 'scrape') {
      try {
        const handoff = JSON.parse(sessionStorage.getItem('pitchtrace.scrapeHandoff') || 'null')
        if (handoff?.to) {
          setForm((current) => ({ ...current, to: handoff.to, subject: handoff.subject || current.subject, context: handoff.context || current.context }))
          setNotice({ message: 'Contact added from Scrape. Review the instructions, then create the Gmail draft.', type: 'success' })
          sessionStorage.removeItem('pitchtrace.scrapeHandoff')
        }
      } catch { setNotice({ message: 'The selected contact could not be loaded.', type: 'error' }) }
    }
    if (oauthError || params.has('connected') || params.has('from')) window.history.replaceState({}, '', window.location.pathname)
    apiRequest('/api/status').then((data) => { if (active) setStatus(data) }).catch((error) => { if (active) showError(error) })
    return () => { active = false }
  }, [showError])

  useEffect(() => { refreshLibrary() }, [refreshLibrary])

  useEffect(() => {
    if (!dialog) return undefined
    const closeOnEscape = (event) => { if (event.key === 'Escape' && !sending) setDialog(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [dialog, sending])

  function markDraftDirty() {
    if (draftId) {
      setSaved(false)
      setDirty(true)
    }
    setSent(false)
  }

  function updateField(event) {
    const { name, value } = event.target
    if (name === 'signature') {
      const previousSignature = form.signature.trim()
      setForm((current) => ({ ...current, signature: value }))
      try { localStorage.setItem('pitchtrace.signature', value) } catch { /* Local storage can be disabled. */ }
      if (draftId) {
        setBody((current) => {
          const trimmedBody = current.trimEnd()
          if (previousSignature && trimmedBody.endsWith(previousSignature)) return `${trimmedBody.slice(0, -previousSignature.length).trimEnd()}\n\n${value.trim()}`.trimEnd()
          return value.trim() ? `${trimmedBody}\n\n${value.trim()}` : current
        })
        markDraftDirty()
      }
      return
    }
    setForm((current) => ({ ...current, [name]: value }))
    if (['to', 'cc', 'bcc', 'subject'].includes(name)) markDraftDirty()
  }

  function changeTone(nextTone) {
    setTone(nextTone)
    if (!draftId) setBody(previewBodies[nextTone])
  }

  function applyTemplate(event) {
    const template = [...builtInTemplates, ...customTemplates].find((item) => item.id === event.target.value)
    if (!template) return
    setForm((current) => ({ ...current, subject: template.subject, context: template.context }))
    markDraftDirty()
  }

  function openTemplateDialog() {
    setTemplateName(form.subject ? `${form.subject} template` : '')
    setDialog('template')
  }

  function saveTemplate(event) {
    event.preventDefault()
    const name = templateName.trim()
    if (!name) return
    const template = { id: crypto.randomUUID(), name: name.slice(0, 60), subject: form.subject, context: form.context }
    const next = [...customTemplates, template].slice(-20)
    setCustomTemplates(next)
    localStorage.setItem('pitchtrace.templates', JSON.stringify(next))
    setDialog(null)
    showSuccess('Template saved in this browser.')
  }

  async function updateAttachments(event) {
    try {
      const files = Array.from(event.target.files || [])
      if (files.some((file) => file.size > 5 * 1024 * 1024)) throw new Error('Each attachment must be 5 MB or smaller.')
      if (files.reduce((total, file) => total + file.size, 0) > 10 * 1024 * 1024) throw new Error('Attachments are limited to 10 MB total.')
      setAttachments(await Promise.all(files.map(fileToAttachment)))
      markDraftDirty()
    } catch (error) {
      showError(error)
    }
  }

  function removeAttachment(index) {
    setAttachments((current) => current.filter((_, attachmentIndex) => attachmentIndex !== index))
    markDraftDirty()
  }

  function messagePayload() {
    return { to: form.to, cc: form.cc, bcc: form.bcc, subject: form.subject, body, attachments }
  }

  async function createDraft(event) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    setSaved(false)
    setDraftId(null)
    setDirty(false)
    setSent(false)
    try {
      const data = await apiRequest('/api/drafts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, tone, attachments }),
      })
      setBody(data.body)
      setSaved(Boolean(data.draftId))
      setDraftId(data.draftId)
      showSuccess(data.draftId ? 'Draft created in Gmail.' : 'Demo draft generated. Connect Gmail to save it.')
      if (data.draftId) await refreshLibrary()
    } catch (error) {
      showError(error)
    } finally {
      setBusy(false)
    }
  }

  function updateBody(value) {
    setBody(value)
    markDraftDirty()
  }

  async function rewriteBody(action) {
    const selectedText = selection.end > selection.start ? body.slice(selection.start, selection.end) : body
    if (!selectedText.trim()) return
    setRewriting(true)
    setNotice(null)
    try {
      const data = await apiRequest('/api/rewrite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, text: selectedText }),
      })
      const nextBody = selection.end > selection.start ? `${body.slice(0, selection.start)}${data.text}${body.slice(selection.end)}` : data.text
      setBody(nextBody)
      markDraftDirty()
      showSuccess(selection.end > selection.start ? 'Selected text updated.' : 'Email updated.')
    } catch (error) {
      showError(error)
    } finally {
      setRewriting(false)
    }
  }

  async function saveDraft() {
    if (!draftId) return
    setSaving(true)
    setNotice(null)
    try {
      await apiRequest(`/api/drafts/${encodeURIComponent(draftId)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(messagePayload()),
      })
      setSaved(true)
      setDirty(false)
      showSuccess('Draft changes saved in Gmail.')
      await refreshLibrary()
    } catch (error) {
      showError(error)
    } finally {
      setSaving(false)
    }
  }

  async function sendDraft() {
    if (!draftId) return
    setSending(true)
    setNotice(null)
    try {
      const data = await apiRequest(`/api/drafts/${encodeURIComponent(draftId)}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(messagePayload()),
      })
      setSent(true)
      setDialog(null)
      setSaved(false)
      setDraftId(null)
      setDirty(false)
      showSuccess(`Email sent through Gmail. Message ID: ${data.messageId}`)
      await refreshLibrary()
    } catch (error) {
      setDialog(null)
      showError(error)
    } finally {
      setSending(false)
    }
  }

  async function openDraft(id) {
    try {
      const { draft } = await apiRequest(`/api/gmail/drafts/${encodeURIComponent(id)}`)
      setForm((current) => ({ ...current, to: draft.to, cc: draft.cc, bcc: draft.bcc, subject: draft.subject }))
      setBody(draft.body)
      setAttachments(draft.attachments)
      setDraftId(draft.id)
      setSaved(true)
      setDirty(false)
      setSent(false)
      showSuccess('Gmail draft opened for editing.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      showError(error)
    }
  }

  async function deleteDraft(draft) {
    if (!window.confirm(`Delete the Gmail draft “${draft.subject}”?`)) return
    try {
      await apiRequest(`/api/gmail/drafts/${encodeURIComponent(draft.id)}`, { method: 'DELETE' })
      if (draftId === draft.id) {
        setDraftId(null)
        setSaved(false)
        setDirty(false)
      }
      showSuccess('Gmail draft deleted.')
      await refreshLibrary()
    } catch (error) {
      showError(error)
    }
  }

  async function disconnect() {
    await apiRequest('/api/auth/logout', { method: 'POST' })
    setStatus((current) => ({ ...current, connected: false, email: null }))
    setDrafts([])
    setHistory([])
    setSaved(false)
    setDraftId(null)
    setDirty(false)
    setSent(false)
  }

  return (
    <div className="app-shell">
      <Header status={status} onDisconnect={disconnect} onConfigurationHelp={() => setNotice({ message: 'Create .env from .env.example, add your Google OAuth client ID and secret, then restart npm run dev.', type: 'error' })} />
      <main className="workspace">
        <section className="composer">
          <div className="intro"><h1>Write the email you<br />meant to send.</h1><p>Generate, review, save, and send polished Gmail drafts from one workspace.</p></div>
          <form onSubmit={createDraft}>
            <div className="template-row">
              <label>Template<select defaultValue="" onChange={applyTemplate}><option value="">Choose a template</option>{[...builtInTemplates, ...customTemplates].map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
              <button type="button" className="secondary-button" onClick={openTemplateDialog}><Save size={16} />Save template</button>
            </div>
            <ToneSwitch tone={tone} onChange={changeTone} />
            <label>To<input name="to" type="email" value={form.to} onChange={updateField} required autoComplete="email" /></label>
            <div className="recipient-grid">
              <label>CC<input name="cc" value={form.cc} onChange={updateField} placeholder="name@example.com" /></label>
              <label>BCC<input name="bcc" value={form.bcc} onChange={updateField} placeholder="name@example.com" /></label>
            </div>
            <label>Subject<input name="subject" value={form.subject} onChange={updateField} required maxLength={160} /></label>
            <label>What should this email say?<textarea name="context" value={form.context} onChange={updateField} required rows={5} maxLength={6000} /></label>
            <label><span className="field-heading">Signature <small>Saved in this browser</small></span><textarea name="signature" className="compact-textarea" value={form.signature} onChange={updateField} rows={3} placeholder={'Best,\nYour name'} maxLength={2000} /></label>
            <label className="attachment-input"><span><Paperclip size={16} />Attachments <small>5 MB each, 10 MB total</small></span><input type="file" multiple onChange={updateAttachments} /></label>
            {attachments.length ? <div className="attachment-list">{attachments.map((file, index) => <span key={`${file.name}-${file.size}-${index}`}>{file.name}<small>{Math.ceil(file.size / 1024)} KB</small><button type="button" aria-label={`Remove ${file.name}`} onClick={() => removeAttachment(index)}><X size={13} /></button></span>)}</div> : null}
            <button className="create-button" type="submit" disabled={busy}><PencilLine size={21} />{busy ? 'Creating draft…' : status.connected ? 'Generate Gmail draft' : 'Generate demo draft'}</button>
            <Notice notice={notice} />
          </form>
        </section>
        <EmailPreview
          form={form} body={body} from={status.email} attachments={attachments}
          saved={saved} dirty={dirty} sent={sent} saving={saving} sending={sending} rewriting={rewriting}
          canSave={Boolean(status.connected && draftId && dirty && body.trim())}
          canSend={Boolean(status.connected && draftId && body.trim())}
          onBodyChange={updateBody}
          onBodySelect={(event) => setSelection({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })}
          onRemoveAttachment={removeAttachment} onRewrite={rewriteBody} onSave={saveDraft} onSend={() => setDialog('send')} editorRef={editorRef}
        />
      </main>
      {status.connected ? <DraftLibrary drafts={drafts} history={history} loading={libraryLoading} onRefresh={refreshLibrary} onOpen={openDraft} onDelete={deleteDraft} /> : null}
      <ActionDialog
        type={dialog}
        form={form}
        templateName={templateName}
        sending={sending}
        onTemplateNameChange={setTemplateName}
        onCancel={() => setDialog(null)}
        onSaveTemplate={saveTemplate}
        onSend={sendDraft}
      />
    </div>
  )
}

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return <HomePage />
  if (path === '/scrape') return <ScrapePage />
  return <PitchWorkspace />
}
