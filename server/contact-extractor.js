import dns from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import * as cheerio from 'cheerio'

const USER_AGENT = 'PitchTraceContactExtractor/1.0'
const MAX_PAGE_BYTES = 2 * 1024 * 1024
const MAX_REDIRECTS = 3
const MAX_AGENT_PAGES = 5

export class ContactExtractionError extends Error {
  constructor(message, status = 502, details = {}) {
    super(message)
    this.status = status
    this.details = details
  }
}

function isPrivateIpv4(address) {
  const parts = address.split('.').map(Number)
  const [a, b] = parts
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0)
}

export function isPrivateAddress(address) {
  const normalized = String(address).toLowerCase().split('%')[0]
  if (net.isIPv4(normalized)) return isPrivateIpv4(normalized)
  if (!net.isIPv6(normalized)) return true
  if (normalized.startsWith('::ffff:')) return isPrivateIpv4(normalized.slice(7))
  return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') ||
    normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
    normalized.startsWith('fea') || normalized.startsWith('feb') || normalized.startsWith('ff')
}

function validateUrl(rawUrl) {
  let url
  try { url = new URL(String(rawUrl || '').trim()) } catch { throw new ContactExtractionError('Enter a complete public URL, including https://.', 400) }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new ContactExtractionError('Only public HTTP and HTTPS URLs are supported.', 400)
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || (net.isIP(host) && isPrivateAddress(host))) {
    throw new ContactExtractionError('Private and local network addresses cannot be scanned.', 400)
  }
  return url
}

function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error)
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
      return callback(new ContactExtractionError('The source resolves to a private or unavailable network address.', 400))
    }
    if (options?.all) return callback(null, addresses)
    const requestedFamily = Number(options?.family || 0)
    const selected = addresses.find(({ family }) => !requestedFamily || family === requestedFamily) || addresses[0]
    callback(null, selected.address, selected.family)
  })
}

function requestPage(rawUrl, { maxBytes = MAX_PAGE_BYTES, redirects = 0, allowedOrigin } = {}) {
  const url = validateUrl(rawUrl)
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http
    const request = transport.request(url, {
      method: 'GET',
      lookup: safeLookup,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.1' },
    }, (response) => {
      const status = response.statusCode || 500
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume()
        if (redirects >= MAX_REDIRECTS) return reject(new ContactExtractionError('The source redirected too many times.', 400))
        const next = new URL(response.headers.location, url)
        if (allowedOrigin && next.origin !== allowedOrigin) return reject(new ContactExtractionError('The website redirected outside the permitted domain.', 400))
        if (url.protocol === 'https:' && next.protocol !== 'https:') return reject(new ContactExtractionError('The source redirected to an insecure URL.', 400))
        requestPage(next, { maxBytes, redirects: redirects + 1, allowedOrigin }).then(resolve, reject)
        return
      }
      if (status < 200 || status >= 300) {
        response.resume()
        const errorStatus = [401, 403, 404].includes(status) ? status : 502
        return reject(new ContactExtractionError(`The source returned HTTP ${status}.`, errorStatus))
      }
      const chunks = []
      let bytes = 0
      response.on('data', (chunk) => {
        bytes += chunk.length
        if (bytes > maxBytes) request.destroy(new ContactExtractionError('The page is too large to scan safely.', 413))
        else chunks.push(chunk)
      })
      response.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8'), contentType: response.headers['content-type'] || '', url: url.toString() }))
    })
    request.setTimeout(10_000, () => request.destroy(new ContactExtractionError('The source took too long to respond.', 504)))
    request.on('error', (error) => reject(error instanceof ContactExtractionError ? error : new ContactExtractionError('Could not retrieve that public page.', 502)))
    request.end()
  })
}

function matchingRobotsGroup(text) {
  const groups = []
  let agents = []
  let rules = []
  const flush = () => {
    if (agents.length) groups.push({ agents, rules })
    agents = []
    rules = []
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const separator = line.indexOf(':')
    if (separator < 0) continue
    const key = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()
    if (key === 'user-agent') {
      if (rules.length) flush()
      agents.push(value.toLowerCase())
    } else if ((key === 'allow' || key === 'disallow') && agents.length) rules.push({ type: key, path: value })
  }
  flush()
  const exact = groups.filter(({ agents: names }) => names.some((name) => name === USER_AGENT.toLowerCase()))
  return exact.length ? exact : groups.filter(({ agents: names }) => names.includes('*'))
}

export function isPathAllowed(robotsText, url) {
  const path = `${url.pathname}${url.search}`
  const matches = matchingRobotsGroup(robotsText).flatMap(({ rules }) => rules)
    .filter((rule) => rule.path && path.startsWith(rule.path))
    .sort((a, b) => b.path.length - a.path.length || (a.type === 'allow' ? -1 : 1))
  return !matches.length || matches[0].type === 'allow'
}

async function loadRobotsPolicy(url) {
  const robotsUrl = new URL('/robots.txt', url)
  try {
    const { body } = await requestPage(robotsUrl, { maxBytes: 256 * 1024 })
    return body
  } catch (error) {
    if (error instanceof ContactExtractionError && error.status === 404) return ''
    throw new ContactExtractionError('The site robots.txt policy could not be verified, so the page was not scanned.', 502)
  }
}

async function enforceRobots(url, policy) {
  const robotsText = policy === undefined ? await loadRobotsPolicy(url) : policy
  if (!isPathAllowed(robotsText, url)) throw new ContactExtractionError('This page is disallowed by the site robots.txt policy.', 403)
}

function candidateLinks(html, pageUrl, origin) {
  const $ = cheerio.load(html)
  const candidates = new Map()
  $('a[href]').each((_, element) => {
    let url
    try { url = new URL($(element).attr('href'), pageUrl) } catch { return }
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) return
    url.hash = ''
    const label = cleanText($(element).text()).toLowerCase()
    const signal = `${url.pathname} ${label}`
    let score = 0
    if (/contact|reach|connect|get-in-touch/.test(signal)) score += 100
    if (/team|people|staff|leadership|directory/.test(signal)) score += 85
    if (/about|company|who-we-are/.test(signal)) score += 65
    if (/location|office/.test(signal)) score += 45
    if (!score) return
    const normalized = url.toString()
    candidates.set(normalized, Math.max(score, candidates.get(normalized) || 0))
  })
  return [...candidates].map(([url, score]) => ({ url, score })).sort((a, b) => b.score - a.score)
}

function pageEvidence(html, page) {
  const $ = cheerio.load(html)
  $('script,style,noscript,svg,template').remove()
  return {
    url: page.url,
    title: page.title,
    description: page.description,
    text: cleanText($('body').text()).slice(0, 6000),
  }
}

function mergeContacts(target, incoming) {
  for (const contact of incoming) {
    const existing = target.find((item) => (contact.email && item.email === contact.email) || (!contact.email && contact.phone && item.phone === contact.phone))
    if (existing) Object.entries(contact).forEach(([key, value]) => { if (!existing[key] && value) existing[key] = value })
    else target.push({ ...contact })
  }
}

function applyAiReview(contacts, evidence, review) {
  if (!review || !Array.isArray(review.contacts)) return contacts
  const evidenceByEmail = new Map()
  for (const page of evidence) {
    for (const email of page.text.match(emailPattern) || []) evidenceByEmail.set(email.toLowerCase(), page.url)
  }
  for (const candidate of review.contacts.slice(0, 50)) {
    const email = cleanEmail(candidate.email)
    const sourceUrl = evidenceByEmail.get(email)
    if (!validEmail(email) || !sourceUrl) continue
    const sourceText = evidence.find((page) => page.url === sourceUrl)?.text.toLowerCase() || ''
    const existing = contacts.find((contact) => contact.email === email)
    const supported = (value) => {
      const cleaned = cleanText(value)
      return cleaned && sourceText.includes(cleaned.toLowerCase()) ? cleaned : ''
    }
    const fields = { name: supported(candidate.name), title: supported(candidate.title), company: supported(candidate.company), phone: supported(candidate.phone) }
    if (existing) Object.entries(fields).forEach(([key, value]) => { if (value) existing[key] = value })
    else contacts.push({ email, sourceUrl, address: '', confidence: 'medium', ...fields })
  }
  return contacts
}

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim()
const cleanEmail = (value) => cleanText(value).replace(/^mailto:/i, '').split('?')[0].toLowerCase()
const validEmail = (value) => /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(value)
const phonePattern = /(?:\+?\d[\d\s().-]{6,}\d)/g
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

function jsonLdObjects(value) {
  if (Array.isArray(value)) return value.flatMap(jsonLdObjects)
  if (!value || typeof value !== 'object') return []
  return [value, ...Object.values(value).flatMap(jsonLdObjects)]
}

function addressText(address) {
  if (typeof address === 'string') return cleanText(address)
  if (!address || typeof address !== 'object') return ''
  return cleanText([address.streetAddress, address.addressLocality, address.addressRegion, address.postalCode, address.addressCountry].filter(Boolean).join(', '))
}

export function extractContacts(html, sourceUrl) {
  const $ = cheerio.load(html)
  $('script:not([type="application/ld+json"]),style,noscript,svg,template').remove()
  const title = cleanText($('title').first().text())
  const description = cleanText($('meta[name="description"]').attr('content'))
  const siteName = cleanText($('meta[property="og:site_name"]').attr('content') || $('meta[name="application-name"]').attr('content'))
  const companyFallback = siteName || title.split(/[|–—-]/)[0].trim() || new URL(sourceUrl).hostname.replace(/^www\./, '')
  const contacts = []

  const addContact = (candidate) => {
    const email = cleanEmail(candidate.email)
    const phone = cleanText(candidate.phone)
    if (!validEmail(email) && !phone) return
    const existing = contacts.find((contact) => (email && contact.email === email) || (!email && phone && contact.phone === phone))
    const next = {
      name: cleanText(candidate.name), title: cleanText(candidate.title), company: cleanText(candidate.company) || companyFallback,
      email: validEmail(email) ? email : '', phone, address: cleanText(candidate.address), sourceUrl,
    }
    if (existing) Object.entries(next).forEach(([key, value]) => { if (!existing[key] && value) existing[key] = value })
    else contacts.push(next)
  }

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      for (const item of jsonLdObjects(JSON.parse($(element).html()))) {
        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']]
        if (types.some((type) => ['Person', 'Organization', 'LocalBusiness'].includes(type))) {
          addContact({ name: item.name, title: item.jobTitle, company: item.worksFor?.name || (types.includes('Person') ? '' : item.name), email: item.email, phone: item.telephone, address: addressText(item.address) })
        }
      }
    } catch { /* Ignore invalid third-party structured data. */ }
  })

  $('a[href^="mailto:"]').each((_, element) => {
    const anchor = $(element)
    const container = anchor.closest('article,li,tr,[class*="team"],[class*="contact"],section,div').first()
    const heading = cleanText(container.find('h1,h2,h3,h4,strong,[itemprop="name"]').first().text())
    const context = cleanText(container.text()).slice(0, 500)
    const phone = context.match(phonePattern)?.[0] || ''
    addContact({ name: heading && !heading.includes('@') ? heading : '', email: anchor.attr('href'), phone })
  })

  $('a[href^="tel:"]').each((_, element) => {
    const anchor = $(element)
    const container = anchor.closest('article,li,tr,[class*="team"],[class*="contact"],section,div').first()
    const heading = cleanText(container.find('h1,h2,h3,h4,strong,[itemprop="name"]').first().text())
    const email = container.find('a[href^="mailto:"]').first().attr('href') || ''
    addContact({ name: heading && !heading.includes('@') ? heading : '', email, phone: String(anchor.attr('href') || '').replace(/^tel:/i, '').split('?')[0] })
  })

  const visibleText = cleanText($('body').text())
  for (const email of visibleText.match(emailPattern) || []) addContact({ email })
  const address = cleanText($('address,[itemprop="address"]').first().text())
  if (!contacts.length) {
    const phone = visibleText.match(phonePattern)?.[0] || ''
    addContact({ company: companyFallback, phone, address })
  } else if (address && contacts.length === 1) contacts[0].address = address

  const normalized = contacts.slice(0, 50).map((contact, index) => ({
    id: `contact-${index + 1}`,
    ...contact,
    confidence: contact.email && contact.name ? 'high' : contact.email ? 'medium' : 'low',
  }))
  return { page: { url: sourceUrl, title: title || companyFallback, description }, contacts: normalized }
}

export async function extractContactPage(rawUrl) {
  const requestedUrl = validateUrl(rawUrl)
  await enforceRobots(requestedUrl)
  const page = await requestPage(requestedUrl)
  if (page.contentType && !/html|xhtml|text\/plain/i.test(page.contentType)) throw new ContactExtractionError('The source is not an HTML contact page.', 415)
  const result = extractContacts(page.body, page.url)
  return { ...result, warnings: result.contacts.length ? [] : ['No public email address or phone number was found on this page.'] }
}

export async function scanWebsite(rawUrl, { review } = {}) {
  const requestedUrl = validateUrl(rawUrl)
  const origin = requestedUrl.origin
  const homepage = new URL('/', requestedUrl).toString()
  const queue = [{ url: requestedUrl.toString(), score: 120 }]
  if (homepage !== requestedUrl.toString()) queue.push({ url: homepage, score: 110 })
  const visited = new Set()
  const contacts = []
  const pages = []
  const evidence = []
  const robotsPolicy = await loadRobotsPolicy(requestedUrl)

  while (queue.length && pages.length < MAX_AGENT_PAGES) {
    queue.sort((a, b) => b.score - a.score)
    const next = queue.shift()
    if (visited.has(next.url)) continue
    visited.add(next.url)
    let response
    try {
      await enforceRobots(new URL(next.url), robotsPolicy)
      response = await requestPage(next.url, { allowedOrigin: origin })
    } catch (error) {
      if (next.url === requestedUrl.toString() || ![403, 404].includes(error.status)) throw error
      continue
    }
    if (response.contentType && !/html|xhtml|text\/plain/i.test(response.contentType)) continue
    const extracted = extractContacts(response.body, response.url)
    pages.push({ ...extracted.page, contactsFound: extracted.contacts.length })
    evidence.push(pageEvidence(response.body, extracted.page))
    mergeContacts(contacts, extracted.contacts)
    for (const candidate of candidateLinks(response.body, response.url, origin)) {
      if (!visited.has(candidate.url) && !queue.some((item) => item.url === candidate.url)) queue.push(candidate)
    }
  }

  let aiReview = null
  let reviewError = ''
  if (review) {
    try { aiReview = await review({ origin, pages: evidence, contacts }) }
    catch (error) { reviewError = error.message || 'AI review was unavailable.' }
  }
  applyAiReview(contacts, evidence, aiReview)
  const proposedCompany = cleanText(aiReview?.company)
  const evidenceText = evidence.map((page) => page.text.toLowerCase()).join(' ')
  const reviewedCompany = proposedCompany && evidenceText.includes(proposedCompany.toLowerCase()) ? proposedCompany : ''
  const company = reviewedCompany || contacts.find(({ company: value }) => value)?.company || pages[0]?.title || requestedUrl.hostname.replace(/^www\./, '')
  const normalized = contacts.slice(0, 50).map((contact, index) => ({ ...contact, id: `contact-${index + 1}`, company: contact.company || company }))
  return {
    page: { url: requestedUrl.toString(), title: company, description: `${pages.length} page${pages.length === 1 ? '' : 's'} reviewed` },
    contacts: normalized,
    pages,
    agent: {
      mode: aiReview ? 'ai-assisted' : 'deterministic-fallback',
      pageLimit: MAX_AGENT_PAGES,
      steps: [
        `Restricted scan to ${origin}`,
        `Reviewed ${pages.length} of ${MAX_AGENT_PAGES} allowed pages`,
        `Collected ${contacts.length} sourced contact candidate${contacts.length === 1 ? '' : 's'}`,
        aiReview ? 'AI normalized company and contact context from retrieved evidence' : reviewError || 'AI review skipped because OpenAI is not configured',
      ],
    },
    warnings: [reviewError, normalized.length ? '' : 'No public email address or phone number was found within the controlled page limit.'].filter(Boolean),
  }
}
