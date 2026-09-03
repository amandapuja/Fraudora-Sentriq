// ─── Fraudora Sentriq TraceX — Browser E2E test suite ────────────────────────
// Runs the 16 acceptance tests against the running app (frontend :8443,
// backend :8000) using the locally installed Chrome via playwright-core.
// Usage:  node e2e/run-e2e.mjs
// Output: PASS/FAIL per test, screenshots in e2e/screenshots/, exit code 0/1.

import { chromium } from "playwright-core"
import { mkdirSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SHOTS = resolve(ROOT, "e2e", "screenshots")
mkdirSync(SHOTS, { recursive: true })

const BASE = "http://localhost:8443"
const EMAIL = "analyst@trustlens.dev"
const PASSWORD = "password123"
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"

const results = []
function record(test, verdict, note) {
  results.push({ test, verdict, note })
  console.log(`${verdict === "PASS" ? "PASS" : verdict === "FAIL" ? "FAIL" : "BLOCKED"} TEST ${test} — ${verdict}: ${note}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let browser
try {
  browser = await chromium.launch({ executablePath: CHROME, headless: true })
} catch (err) {
  console.error("FATAL: could not launch Chrome:", err.message)
  process.exit(2)
}
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
page.setDefaultTimeout(15000)

const loginBtn = () => page.getByRole("button", { name: "Masuk", exact: true })

async function shot(name) {
  try { await page.screenshot({ path: resolve(SHOTS, name), fullPage: false }) } catch { }
}

async function gotoApp() {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 })
}

// ── TEST 1 — app loads ────────────────────────────────────────────────────────
try {
  await gotoApp()
  await page.waitForSelector("body", { timeout: 20000 })
  await page.waitForTimeout(2500)
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000))
  const ok = bodyText.length > 200 && /fraudora|trustlens/i.test(bodyText)
  await shot("01-loading.png")
  record(1, ok ? "PASS" : "FAIL", ok ? `landing rendered (${bodyText.length} chars)` : `page too short or missing brand text`)
} catch (err) {
  record(1, "FAIL", err.message)
}

// ── TEST 2 — login ────────────────────────────────────────────────────────────
let userName = ""
try {
  await loginBtn().first().click()
  await page.waitForSelector('input[type="email"]', { timeout: 10000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await shot("02-login-form.png")
  await loginBtn().last().click()
  await page.waitForSelector("text=Selamat datang", { timeout: 15000 })
  const h1 = await page.locator("h1").first().innerText()
  userName = (h1.match(/Selamat datang,\s*([^👋]+)/) ?? [])[1]?.trim() ?? ""
  const guestMode = await page.evaluate(() => document.body.innerText.includes("GUEST MODE"))
  const liveBadge = await page.evaluate(() => /LIVE|POLLING/.test(document.body.innerText))
  await shot("03-dashboard.png")
  record(2, !guestMode ? "PASS" : "FAIL", `dashboard reached; authenticated=${!guestMode}; live badge=${liveBadge}`)
} catch (err) {
  record(2, "FAIL", `login flow error: ${err.message}`)
}

// ── TEST 3 — dashboard KPIs from backend ──────────────────────────────────────
try {
  await page.waitForSelector("text=Total Transaksi", { timeout: 10000 })
  const body = await page.evaluate(() => document.body.innerText)
  const hasKpis = /Total Transaksi/.test(body) && /Alert Terbuka/.test(body) && /Risiko Tinggi/.test(body) && /Cross-Border/.test(body)
  const hasFeeds = /Fraud Alerts Terbaru/.test(body) && /Transaksi Mencurigakan/.test(body) && /Aktivitas Terbaru/.test(body)
  const hasRealValues = /Rp\s|\.\d{3}/.test(body) && /[a-z]{2,4}[-_][a-z0-9]{6,}/i.test(body)
  record(3, hasKpis && hasFeeds && hasRealValues ? "PASS" : "FAIL", `KPIs=${hasKpis} feeds=${hasFeeds} realValues=${hasRealValues}`)
} catch (err) {
  record(3, "FAIL", err.message)
}

// ── TEST 4 — transactions table ───────────────────────────────────────────────
try {
  await page.locator('button:has-text("Transactions")').click()
  await page.waitForSelector("text=Transaction Monitoring", { timeout: 10000 })
  await page.waitForSelector("tbody tr", { timeout: 10000 })
  const rows = await page.locator("tbody tr").count()
  await shot("04-transactions.png")
  record(4, rows >= 5 ? "PASS" : "FAIL", `${rows} rows rendered (need >=5)`)
} catch (err) {
  record(4, "FAIL", err.message)
}

// ── TEST 5 — demo transaction generation ──────────────────────────────────────
let demoRefs = []
try {
  await page.locator("text=Demo Transaction Generator").waitFor({ timeout: 10000 })
  await page.fill('input[type="number"]', "2")
  await page.locator('button:has-text("Cross-Border High")').click()
  await page.locator('button:has-text("Generate")').click()
  await page.waitForSelector("text=transaksi ·", { timeout: 15000 })
  await sleep(1200)
  const body = await page.evaluate(() => document.body.innerText)
  const matches = [...body.matchAll(/[A-Za-z]{2,5}[-_][A-Za-z0-9-]{6,}/g)].map((m) => m[0])
  demoRefs = [...new Set(matches)]
  const hasScore = /0\.\d{2}/.test(body)
  await shot("05-demo-generate.png")
  record(5, demoRefs.length >= 1 && hasScore ? "PASS" : "FAIL", `result panel shown; refs=${demoRefs.slice(0, 4)}; scores present=${hasScore}`)
} catch (err) {
  record(5, "FAIL", `demo generator: ${err.message}`)
}

// ── TEST 6 — fraud scoring visible ────────────────────────────────────────────
try {
  const body = await page.evaluate(() => document.body.innerText)
  const hasRiskBadges = /HIGH|MEDIUM|LOW/.test(body)
  const hasScores = /0\.\d{2}/.test(body)
  record(6, hasRiskBadges && hasScores ? "PASS" : "FAIL", `risk badges=${hasRiskBadges} scores=${hasScores}`)
} catch (err) {
  record(6, "FAIL", err.message)
}

// ── TEST 7 — alert creation (toast or queue) ─────────────────────────────────
try {
  let toast = false
  try {
    await page.waitForSelector("text=New fraud alert", { timeout: 12000 })
    toast = true
  } catch { }
  await page.locator('button:has-text("Alerts")').click()
  await page.waitForSelector("text=Fraud Alert Queue", { timeout: 10000 })
  await sleep(1500)
  const rows = await page.locator("tbody tr").count()
  await shot("06-alerts.png")
  record(7, toast || rows >= 1 ? "PASS" : "FAIL", `toast=${toast}; queue rows=${rows}`)
} catch (err) {
  record(7, "FAIL", err.message)
}

// ── TEST 8 — realtime update without refresh ─────────────────────────────────
try {
  await page.locator('button:has-text("Dashboard")').click()
  await page.waitForTimeout(2000)
  const kpiBefore = await page.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find((d) => /Total Transaksi/.test(d.innerText || "") && d.innerText.length < 200)
    return el ? el.innerText : null
  })
  await page.locator('button:has-text("Transactions")').click()
  await page.locator("text=Demo Transaction Generator").waitFor({ timeout: 10000 })
  await page.fill('input[type="number"]', "1")
  await page.locator('button:has-text("Random")').click()
  await page.locator('button:has-text("Generate")').click()
  await page.waitForSelector("text=transaksi ·", { timeout: 15000 })
  await sleep(2500)
  await page.locator('button:has-text("Dashboard")').click()
  await page.waitForTimeout(2500)
  const kpiAfter = await page.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find((d) => /Total Transaksi/.test(d.innerText || "") && d.innerText.length < 200)
    return el ? el.innerText : null
  })
  const changed = kpiBefore && kpiAfter && kpiBefore !== kpiAfter
  await shot("07-realtime.png")
  record(8, changed ? "PASS" : "FAIL", `KPI updated without reload: before=${kpiBefore ? kpiBefore.slice(0, 40) : "null"} after=${kpiAfter ? kpiAfter.slice(0, 40) : "null"}`)
} catch (err) {
  record(8, "FAIL", err.message)
}

// ── TEST 9 — alert detail modal ───────────────────────────────────────────────
try {
  await page.locator('button:has-text("Alerts")').click()
  await page.waitForSelector("text=Fraud Alert Queue", { timeout: 10000 })
  await sleep(800)
  await page.locator("tbody tr").first().click()
  await page.waitForSelector("text=ALERT INVESTIGATION", { timeout: 10000 })
  const body = await page.evaluate(() => document.body.innerText)
  const hasRisk = /RISK INDICATORS/.test(body) && /fraud score/i.test(body)
  const hasActions = /investigating|resolved|dismissed|Tandai FRAUD/.test(body)
  await shot("08-alert-detail.png")
  record(9, hasRisk && hasActions ? "PASS" : "FAIL", `risk indicators=${hasRisk} analyst actions=${hasActions}`)
} catch (err) {
  record(9, "FAIL", err.message)
}

// ── TEST 14 (status change — run here while modal is open) ────────────────────
let statusChanged = false
try {
  await page.locator('button:has-text("investigating")').click()
  await page.waitForSelector("text=Status alert diubah", { timeout: 10000 })
  await page.locator('button:has-text("✕")').click().catch(() => page.keyboard.press("Escape"))
  await sleep(1200)
  const body = await page.evaluate(() => document.body.innerText)
  statusChanged = /investigating/i.test(body)
  record(14, statusChanged ? "PASS" : "FAIL", "alert status changed and reflected in queue")
} catch (err) {
  record(14, "FAIL", err.message)
}

// ── TEST 10 — graph ───────────────────────────────────────────────────────────
try {
  await page.locator('button:has-text("Graph")').click()
  await page.waitForSelector("svg", { timeout: 15000 })
  await sleep(2500)
  const body = await page.evaluate(() => document.body.innerText)
  const hasSource = /SOURCE:\s*(NEO4J|POSTGRES FALLBACK)/i.test(body)
  const nodeCount = await page.locator("svg g").count()
  await page.locator("svg g").first().click({ force: true }).catch(() => {})
  await sleep(800)
  const bodyAfter = await page.evaluate(() => document.body.innerText)
  const inspector = /HUBUNGAN/i.test(bodyAfter)
  await shot("09-graph.png")
  record(10, nodeCount > 0 && hasSource ? "PASS" : "FAIL", `svg groups=${nodeCount} sourceBadge=${hasSource} inspector=${inspector}`)
} catch (err) {
  record(10, "FAIL", err.message)
}

// ── TEST 11 — cross-border ────────────────────────────────────────────────────
try {
  await page.locator('button:has-text("Cross Border")').click()
  await page.waitForSelector("text=Cross-Border", { timeout: 15000 })
  await sleep(1500)
  const body = await page.evaluate(() => document.body.innerText)
  const hasKpi = /Transaksi Cross-Border/.test(body)
  const hasRoutes = /Rute Berisiko/.test(body)
  const hasCountries = /Profil Risiko Negara/.test(body)
  await shot("10-crossborder.png")
  record(11, hasKpi && hasRoutes && hasCountries ? "PASS" : "FAIL", `kpi=${hasKpi} routes=${hasRoutes} countries=${hasCountries}`)
} catch (err) {
  record(11, "FAIL", err.message)
}

// ── TEST 12 — ML ──────────────────────────────────────────────────────────────
try {
  await page.locator('button:has-text("ML")').click()
  await page.waitForSelector("text=Fraud Scoring Engine", { timeout: 15000 })
  await sleep(1200)
  const body = await page.evaluate(() => document.body.innerText)
  const hasEngine = /Fraud Scoring Engine/.test(body)
  const hasEvents = /Event Scoring Terbaru/.test(body)
  const honest = /rule|Rule|artifact|Artifact/.test(body)
  await shot("11-ml.png")
  record(12, hasEngine && hasEvents ? "PASS" : "FAIL", `engine=${hasEngine} events=${hasEvents} honestNote=${honest}`)
} catch (err) {
  record(12, "FAIL", err.message)
}

// ── TEST 13 — audit logs ──────────────────────────────────────────────────────
try {
  await page.locator('button:has-text("Audit Logs")').click()
  await page.waitForSelector("text=Audit Log", { timeout: 15000 })
  await sleep(1500)
  const rows = await page.locator("tbody tr").count()
  const body = await page.evaluate(() => document.body.innerText)
  const hasActions = /DEMO TRANSACTIONS GENERATED|TRANSACTION CREATED|USER LOGIN/i.test(body)
  await shot("12-audit.png")
  record(13, rows >= 1 && hasActions ? "PASS" : "FAIL", `rows=${rows} realActions=${hasActions}`)
} catch (err) {
  record(13, "FAIL", err.message)
}

// ── TEST 15 — logout ──────────────────────────────────────────────────────────
try {
  const profileBtn = userName
    ? page.locator(`button:has-text("${userName}")`).first()
    : page.locator("header button, nav button").last()
  await profileBtn.click()
  await page.waitForSelector('button:has-text("Logout")', { timeout: 5000 })
  await page.locator('button:has-text("Logout")').click()
  await page.waitForTimeout(1500)
  const body = await page.evaluate(() => document.body.innerText)
  const backToMarketing = /fraudora/i.test(body) && !/Selamat datang/.test(body)
  await shot("13-logout.png")
  record(15, backToMarketing ? "PASS" : "FAIL", `returned to marketing page=${backToMarketing}`)
} catch (err) {
  record(15, "FAIL", `logout: ${err.message}`)
}

// ── TEST 16 — login again ─────────────────────────────────────────────────────
try {
  await loginBtn().first().click()
  await page.waitForSelector('input[type="email"]', { timeout: 10000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await loginBtn().last().click()
  await page.waitForSelector("text=Selamat datang", { timeout: 15000 })
  await page.waitForTimeout(1500)
  const body = await page.evaluate(() => document.body.innerText)
  const authenticated = !body.includes("GUEST MODE")
  const hasData = /Total Transaksi/.test(body)
  await shot("14-login-again.png")
  record(16, authenticated && hasData ? "PASS" : "FAIL", `dashboard accessible again; authenticated=${authenticated}; backend data=${hasData}`)
} catch (err) {
  record(16, "FAIL", err.message)
}

await browser.close()

const passed = results.filter((r) => r.verdict === "PASS").length
console.log(`\n━━━ E2E SUMMARY: ${passed}/${results.length} passed ━━━`)
for (const r of results) console.log(`  ${r.test}: ${r.verdict}`)
process.exit(passed === results.length ? 0 : 1)

