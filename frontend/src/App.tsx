import { useState, useEffect, useRef, createContext, useContext, type ReactNode, type CSSProperties } from "react"
import {
  apiLogin, apiRegister, apiMe, getToken, getStoredUser, clearSession,
  ApiError, type BackendUser, type BackendRole,
} from "./lib/api"
import { RealtimeProvider, useRealtime } from "./lib/realtime"
import { LiveBadge } from "./components/LiveBadge"
import { ToastStack, useAlertToasts } from "./components/Toasts"
import { OverviewTab } from "./components/OverviewTab"
import { AlertsTab } from "./components/AlertsTab"
import { TransactionsTab } from "./components/TransactionsTab"
import { GraphTab } from "./components/GraphTab"
import { CrossBorderTab } from "./components/CrossBorderTab"
import { MLTab } from "./components/MLTab"
import { AuditTab } from "./components/AuditTab"

// ─── Token Types ───────────────────────────────────────────────────────────────
interface TokenSet {
  bgDeep: string; bgFixed: string; glassCard: string; cardShine: string
  border: string; borderHi: string; borderCyan: string; blur: string
  text: string; textSub: string; textMuted: string
  cyan: string; violet: string; indigo: string; pink: string
  coral: string; emerald: string; amber: string; red: string
  cyanDim: string; violetDim: string; indigoDim: string; pinkDim: string
  coralDim: string; emeraldDim: string; amberDim: string; redDim: string
  navBg: string; sectionAlt: string; ctaBtn: string; pinkBtn: string
  glass: string; glassSoft: string
}

interface GradientSet {
  pageBg: string; sectionAlt: string; heroCyan: string; heroViolet: string
  ctaBtn: string; pinkBtn: string; coralBtn: string; cardShine: string
}

// ─── Token Objects ─────────────────────────────────────────────────────────────
const LIGHT: TokenSet = {
  bgDeep: "linear-gradient(135deg, #dce4f7 0%, #e8d8f5 50%, #d4e8f7 100%)",
  bgFixed: "linear-gradient(135deg, #dce4f7 0%, #e8d8f5 55%, #d4e8f7 100%)",
  glassCard: "rgba(255,255,255,0.68)",
  cardShine: "linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.55) 100%)",
  border: "rgba(180,160,240,0.22)", borderHi: "rgba(139,92,246,0.28)", borderCyan: "rgba(6,182,212,0.28)",
  blur: "blur(18px)",
  text: "#1e2257", textSub: "#5b6399", textMuted: "#9aa3c4",
  cyan: "#06b6d4", violet: "#8b5cf6", indigo: "#6366f1", pink: "#ec4899",
  coral: "#f05478", emerald: "#10b981", amber: "#f59e0b", red: "#ef4444",
  cyanDim: "rgba(6,182,212,0.12)", violetDim: "rgba(139,92,246,0.10)",
  indigoDim: "rgba(99,102,241,0.10)", pinkDim: "rgba(236,72,153,0.10)",
  coralDim: "rgba(240,84,120,0.10)", emeraldDim: "rgba(16,185,129,0.10)",
  amberDim: "rgba(245,158,11,0.10)", redDim: "rgba(239,68,68,0.09)",
  navBg: "rgba(240,236,255,0.85)", sectionAlt: "rgba(255,255,255,0.28)",
  ctaBtn: "linear-gradient(135deg, #8b5cf6, #6366f1)",
  pinkBtn: "linear-gradient(135deg, #f05478, #ec4899)",
  glass: "rgba(255,255,255,0.62)", glassSoft: "rgba(255,255,255,0.35)",
}

const DARK: TokenSet = {
  bgDeep: "linear-gradient(135deg, #080c18 0%, #0d1225 50%, #0a0f1e 100%)",
  bgFixed: "#080c18",
  glassCard: "rgba(15,22,45,0.65)",
  cardShine: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
  border: "rgba(255,255,255,0.08)", borderHi: "rgba(167,139,250,0.22)", borderCyan: "rgba(34,211,238,0.22)",
  blur: "blur(20px)",
  text: "#f0f4ff", textSub: "#94a3b8", textMuted: "#4b5563",
  cyan: "#22d3ee", violet: "#a78bfa", indigo: "#818cf8", pink: "#f472b6",
  coral: "#f472b6", emerald: "#34d399", amber: "#fbbf24", red: "#f87171",
  cyanDim: "rgba(34,211,238,0.10)", violetDim: "rgba(167,139,250,0.10)",
  indigoDim: "rgba(129,140,248,0.10)", pinkDim: "rgba(244,114,182,0.10)",
  coralDim: "rgba(244,114,182,0.10)", emeraldDim: "rgba(52,211,153,0.10)",
  amberDim: "rgba(251,191,36,0.10)", redDim: "rgba(248,113,113,0.10)",
  navBg: "rgba(8,12,24,0.85)", sectionAlt: "rgba(13,18,38,0.45)",
  ctaBtn: "linear-gradient(135deg, #a78bfa, #818cf8)",
  pinkBtn: "linear-gradient(135deg, #f472b6, #c084fc)",
  glass: "rgba(15,22,45,0.50)", glassSoft: "rgba(15,22,45,0.30)",
}

function deriveG(T: TokenSet): GradientSet {
  return {
    pageBg: T.bgDeep,
    sectionAlt: T.sectionAlt,
    heroCyan: `radial-gradient(ellipse 55% 60% at 75% 40%, ${T.cyan}21 0%, transparent 70%)`,
    heroViolet: `radial-gradient(ellipse 55% 60% at 20% 60%, ${T.violet}1c 0%, transparent 70%)`,
    ctaBtn: T.ctaBtn,
    pinkBtn: T.pinkBtn,
    coralBtn: `linear-gradient(135deg, ${T.coral}, ${T.pink})`,
    cardShine: T.cardShine,
  }
}

// ─── Theme Context ─────────────────────────────────────────────────────────────
interface ThemeContextValue {
  theme: "light" | "dark"
  toggleTheme: () => void
  T: TokenSet
  G: GradientSet
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => undefined,
  T: LIGHT,
  G: deriveG(LIGHT),
})

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("fst-theme")
    return saved === "dark" ? "dark" : "light"
  })

  useEffect(() => {
    localStorage.setItem("fst-theme", theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === "light" ? "dark" : "light")
  const T = theme === "light" ? LIGHT : DARK
  const G = deriveG(T)

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, T, G }}>
      {children}
    </ThemeContext.Provider>
  )
}

// ─── Auth Context ──────────────────────────────────────────────────────────────
type AuthType = "unauthenticated" | "authenticated" | "guest"
type AppView = "marketing" | "login" | "dashboard" | "settings"

interface User {
  name: string; email: string; role: string; status: string; avatar: string; avatarColor?: string
}

interface AuthState {
  type: AuthType; user?: User
}

interface AuthContextValue {
  auth: AuthState
  view: AppView
  setView: (v: AppView) => void
  loginGuest: () => void
  logout: () => void
  updateUser: (updates: Partial<User>) => void
  loginWithCredentials: (email: string, password: string) => Promise<User>
  registerAccount: (payload: {
    full_name: string; email: string; password: string
    role: BackendRole; institution_name?: string
  }) => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  auth: { type: "unauthenticated" },
  view: "marketing",
  setView: () => undefined,
  loginGuest: () => undefined,
  logout: () => undefined,
  updateUser: () => undefined,
  loginWithCredentials: async () => { throw new Error("AuthProvider belum siap") },
  registerAccount: async () => undefined,
})

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "U"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function roleLabel(role: BackendRole): string {
  if (role === "ADMIN") return "Admin"
  if (role === "ANALYST") return "Analyst"
  return "Institution"
}

function backendUserToDisplay(bu: BackendUser): User {
  return {
    name: bu.full_name,
    email: bu.email,
    role: roleLabel(bu.role),
    status: "Authenticated",
    avatar: initialsFromName(bu.full_name),
  }
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ type: "unauthenticated" })
  const [view, setView] = useState<AppView>("marketing")

  // Pulihkan sesi dari localStorage, lalu validasi token ke backend.
  // Token lama dari clone/deployment sebelumnya tidak boleh membuat UI terlihat
  // login padahal backend sudah menolaknya.
  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      const token = getToken()
      const storedUser = getStoredUser()
      if (!token || !storedUser) return

      try {
        const currentUser = await apiMe()
        if (cancelled) return
        setAuth({ type: "authenticated", user: backendUserToDisplay(currentUser) })
        setView("dashboard")
      } catch {
        clearSession()
        if (!cancelled) {
          setAuth({ type: "unauthenticated" })
        }
      }
    }

    void restoreSession()
    return () => { cancelled = true }
  }, [])

  const login = (user: User) => setAuth({ type: "authenticated", user })
  const loginGuest = () => setAuth({ type: "guest" })
  const logout = () => { clearSession(); setAuth({ type: "unauthenticated" }); setView("marketing") }
  const updateUser = (updates: Partial<User>) => {
    setAuth(prev => prev.user ? { ...prev, user: { ...prev.user, ...updates } } : prev)
  }

  const loginWithCredentials = async (email: string, password: string) => {
    const isDemoCredentials =
      email.trim().toLowerCase() === "analyst@trustlens.dev" && password === "password123"
    const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true"

    if (isDemoMode && isDemoCredentials) {
      const demoUser: User = {
        name: "TrustLens Analyst",
        email: "analyst@trustlens.dev",
        role: "Analyst",
        status: "Demo session",
        avatar: "TA",
      }
      login(demoUser)
      return demoUser
    }

    try {
      const result = await apiLogin(email, password)
      const displayUser = backendUserToDisplay(result.user)
      login(displayUser)
      return displayUser
    } catch (error) {
      throw error
    }
  }

  const registerAccount = async (payload: {
    full_name: string; email: string; password: string
    role: BackendRole; institution_name?: string
  }) => {
    await apiRegister(payload)
  }

  return (
    <AuthContext.Provider value={{
      auth, view, setView, loginGuest, logout, updateUser, loginWithCredentials, registerAccount,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
export function useTheme(): ThemeContextValue { return useContext(ThemeContext) }
export function useAuth(): AuthContextValue { return useContext(AuthContext) }

// ─── MetricStatus ─────────────────────────────────────────────────────────────
export type MetricStatus =
  | "actual" | "target" | "projected" | "illustrative" | "pending"
  | "simulation" | "industry" | "in progress" | "not benchmarked"

// ─── StatusBadge ──────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: MetricStatus }) {
  const { T } = useTheme()
  const cfg: Record<MetricStatus, { label: string; color: string; bg: string; border: string }> = {
    actual:           { label: "ACTUAL",            color: T.emerald, bg: T.emeraldDim,  border: `${T.emerald}4d` },
    target:           { label: "TARGET",            color: T.cyan,    bg: T.cyanDim,     border: `${T.cyan}4d` },
    projected:        { label: "PROJECTED",         color: T.amber,   bg: T.amberDim,    border: `${T.amber}4d` },
    illustrative:     { label: "ILLUSTRATIVE",      color: T.violet,  bg: T.violetDim,   border: T.borderHi },
    pending:          { label: "PENDING",           color: T.textSub, bg: "rgba(91,99,153,0.08)", border: "rgba(91,99,153,0.20)" },
    simulation:       { label: "SIMULATION",        color: "#0d9488", bg: "rgba(13,148,136,0.10)", border: "rgba(13,148,136,0.30)" },
    industry:         { label: "INDUSTRY DATA",     color: "#3b82f6", bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.30)" },
    "in progress":    { label: "IN PROGRESS",       color: T.amber,   bg: T.amberDim,    border: `${T.amber}4d` },
    "not benchmarked":{ label: "NOT YET BENCHMARKED", color: "#6b7280", bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.20)" },
  }
  const { label, color, bg, border } = cfg[status]
  return (
    <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600,
      letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 6,
      color, background: bg, border: `1px solid ${border}` }}>
      {label}
    </span>
  )
}

// ─── GlassCard ────────────────────────────────────────────────────────────────
export function GlassCard({ children, style = {}, accent, className = "" }: {
  children: ReactNode; style?: CSSProperties; accent?: string; className?: string
}) {
  const { T, G } = useTheme()
  return (
    <div className={`fst-card ${className}`.trim()} style={{
      background: G.cardShine,
      backdropFilter: T.blur,
      WebkitBackdropFilter: T.blur,
      border: `1px solid ${accent ? accent + "30" : T.border}`,
      borderRadius: 14,
      padding: 20,
      position: "relative",
      overflow: "hidden",
      boxShadow: "0 2px 12px rgba(100,80,200,0.07), 0 1px 4px rgba(100,80,200,0.05)",
      ...style,
    }}>
      {accent && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, transparent, ${accent}80, transparent)`,
          borderRadius: "14px 14px 0 0" }} />
      )}
      {children}
    </div>
  )
}

// ─── SVG Icon set ─────────────────────────────────────────────────────────────
export function Icon({ name, size = 20, color = "currentColor" }: { name: string; size?: number; color?: string }) {
  const paths: Record<string, ReactNode> = {
    shield:   <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    network:  <><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/><line x1="5" y1="19" x2="19" y2="19"/></>,
    refresh:  <><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></>,
    search:   <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    building: <><rect x="2" y="7" width="20" height="14" rx="1"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>,
    globe:    <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>,
    lock:     <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    zap:      <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    chart:    <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    alert:    <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    tag:      <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>,
    trophy:   <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></>,
    gear:     <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    clipboard:<><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></>,
    beaker:   <><path d="M9 3h6v8l3.5 6A2 2 0 0 1 16.76 20H7.24a2 2 0 0 1-1.74-2.97L9 11V3z"/><line x1="6" y1="6" x2="18" y2="6"/></>,
    cloud:    <><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {paths[name] ?? null}
    </svg>
  )
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────
function SectionLabel({ children, large }: { children: ReactNode; large?: boolean }) {
  const { T } = useTheme()
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${T.violet}50)` }} />
      <span style={{ fontSize: large ? 20 : 10,
        fontFamily: large ? "'Playfair Display',serif" : "'JetBrains Mono',monospace",
        color: T.violet,
        letterSpacing: large ? "-0.01em" : "0.18em",
        textTransform: large ? undefined : "uppercase" as const,
        whiteSpace: "nowrap" as const,
        fontWeight: large ? 700 : 600 }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${T.violet}50)` }} />
    </div>
  )
}

// ─── Tag ──────────────────────────────────────────────────────────────────────
export function Tag({ children, color }: { children: ReactNode; color?: string }) {
  const { T } = useTheme()
  const c = color ?? T.cyan
  return (
    <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: c,
      background: c + "14", border: `1px solid ${c}28`,
      padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" as const }}>
      {children}
    </span>
  )
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold })
    obs.observe(el); return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function FadeIn({ children, delay = 0, visible, style = {} }:
  { children: ReactNode; delay?: number; visible: boolean; style?: CSSProperties }) {
  return (
    <div style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(22px)",
      transition: `opacity 0.65s cubic-bezier(.4,0,.2,1) ${delay}ms, transform 0.65s cubic-bezier(.4,0,.2,1) ${delay}ms`, ...style }}>
      {children}
    </div>
  )
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-label="Fraudora Sentriq TraceX">
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect width={36} height={36} rx={10} fill="rgba(139,92,246,0.14)" />
      <rect width={36} height={36} rx={10} stroke="url(#logo-grad)" strokeWidth={1.5} fill="none" opacity={0.5} />
      <path d="M18 6L8 11v9c0 5.5 4.4 10.6 10 12 5.6-1.4 10-6.5 10-12v-9L18 6z"
        fill="url(#logo-grad)" opacity={0.92} />
      <path d="M14 18.5l2.5 2.5 5-5" stroke="#fff" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function WordMark({ size = 15, showSub = false }: { size?: number; showSub?: boolean }) {
  const { T } = useTheme()
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: size, fontWeight: 800, letterSpacing: "-0.01em",
          background: `linear-gradient(90deg, ${T.cyan}, ${T.violet})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Fraudora
        </span>
        <span style={{ fontSize: size * 0.82, fontWeight: 700, color: T.violet }}>Sentriq</span>
        <span style={{ fontSize: size * 0.72, fontWeight: 600, color: T.indigo, letterSpacing: "0.04em" }}>TraceX</span>
      </div>
      {showSub && (
        <div style={{ fontSize: size * 0.6, fontFamily: "'JetBrains Mono',monospace",
          color: T.textSub, marginTop: 2, letterSpacing: "0.06em" }}>
          Fraud Intelligence Platform
        </div>
      )}
    </div>
  )
}

// ─── Theme Toggle ─────────────────────────────────────────────────────────────
function ThemeToggle() {
  const { theme, toggleTheme, T } = useTheme()
  return (
    <button onClick={toggleTheme} style={{
      fontSize: 14, padding: "5px 12px", borderRadius: 20, border: `1px solid ${T.border}`,
      background: T.glassSoft, cursor: "pointer", fontFamily: "inherit",
      color: T.textSub, display: "flex", alignItems: "center", gap: 4,
    }}>
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  )
}

// ─── PasswordInput ────────────────────────────────────────────────────────────
function PasswordInput({ value, onChange, placeholder, style = {} }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  style?: CSSProperties
}) {
  const { T } = useTheme()
  const [show, setShow] = useState(false)
  const base: CSSProperties = {
    width: "100%", background: T.glassCard, border: `1.5px solid ${T.border}`,
    borderRadius: 12, padding: "11px 44px 11px 14px", fontSize: 14, color: T.text,
    outline: "none", fontFamily: "inherit", transition: "border-color 0.2s, box-shadow 0.2s",
    boxShadow: "0 1px 6px rgba(100,80,200,0.06)", ...style,
  }
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "••••••••••"}
        style={base}
        onFocus={e => { (e.target as HTMLInputElement).style.borderColor = T.violet }}
        onBlur={e => { (e.target as HTMLInputElement).style.borderColor = T.border }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 2 }}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
            <line x1={1} y1={1} x2={23} y2={23} strokeLinecap="round" />
          </svg>
        ) : (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx={12} cy={12} r={3} />
          </svg>
        )}
      </button>
    </div>
  )
}

// ─── Navbar (marketing) ───────────────────────────────────────────────────────
function Navbar() {
  const { T, G } = useTheme()
  const { setView } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", fn); return () => window.removeEventListener("scroll", fn)
  }, [])

  const links = [
    { href: "#problem", label: "Masalah" },
    { href: "#solution", label: "Solusi" },
    { href: "#technology", label: "Teknologi" },
    { href: "#validation", label: "Validasi" },
    { href: "#crossborder", label: "Cross Border" },
    { href: "#business", label: "Bisnis" },
  ]

  return (
    <nav className="marketing-nav" style={{
      position: "fixed", top: 16, left: 16, right: 16, zIndex: 100,
      maxWidth: 1280, margin: "0 auto",
      background: T.navBg,
      backdropFilter: T.blur,
      WebkitBackdropFilter: T.blur,
      border: `1px solid ${T.border}`,
      borderRadius: 999,
      boxShadow: scrolled ? "0 8px 32px rgba(100,80,200,0.16)" : "0 4px 20px rgba(100,80,200,0.08)",
      transition: "all 0.35s ease",
    }}>
      <div style={{ padding: "0 28px", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="#" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <LogoMark size={30} />
          <WordMark size={14} showSub />
        </a>

        <div className="marketing-links" style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {links.map(l => (
            <a key={l.href} href={l.href} style={{ fontSize: 13, color: T.textSub,
              textDecoration: "none", fontWeight: 500 }}>
              {l.label}
            </a>
          ))}
        </div>

        <div className="marketing-actions" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => setView("login")} style={{ fontSize: 13, fontWeight: 600, color: T.violet,
            background: T.violetDim, border: `1px solid ${T.borderHi}`, padding: "7px 18px",
            borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>
            Masuk
          </button>
          <button onClick={() => setView("login")} style={{ fontSize: 13, fontWeight: 700, color: "#fff",
            background: G.ctaBtn, padding: "7px 18px", border: "none",
            borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>
            Mulai Sekarang
          </button>
          <ThemeToggle />
          <button onClick={() => setOpen(!open)} style={{ background: "none", border: "none",
            color: T.textSub, cursor: "pointer" }}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d={open ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div style={{ background: T.navBg, backdropFilter: T.blur, WebkitBackdropFilter: T.blur,
          borderTop: `1px solid ${T.border}`, borderRadius: "0 0 28px 28px",
          padding: "16px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}
              style={{ fontSize: 14, color: T.textSub, textDecoration: "none" }}>
              {l.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  )
}

// ─── Dashboard Navbar ─────────────────────────────────────────────────────────
function DashboardNavbar({ activeTab, setActiveTab }: {
  activeTab: string
  setActiveTab: (t: string) => void
}) {
  const { T, G } = useTheme()
  const { auth, setView, logout } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)

  const authTabs = [
    { id: "overview", label: "Dashboard" },
    { id: "alerts", label: "Alerts" },
    { id: "transactions", label: "Transactions" },
    { id: "graph", label: "Graph" },
    { id: "crossborder", label: "Cross Border" },
    { id: "ml", label: "ML" },
    { id: "audit", label: "Audit Logs" },
  ]

  const guestTabs = [
    { id: "overview", label: "Dashboard" },
    { id: "transactions", label: "Transactions" },
    { id: "graph", label: "Graph" },
    { id: "crossborder", label: "Cross Border" },
    { id: "ml", label: "ML" },
    { id: "audit", label: "Audit Logs" },
  ]

  const tabs = auth.type === "guest" ? guestTabs : authTabs
  const user = auth.user

  return (
    <nav className="dashboard-nav" style={{
      position: "sticky", top: 0, zIndex: 50,
      background: T.navBg, backdropFilter: T.blur, WebkitBackdropFilter: T.blur,
      borderBottom: `1px solid ${T.border}`,
      boxShadow: "0 2px 20px rgba(100,80,200,0.08)",
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 28px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>

        {/* Left: logo + role */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <LogoMark size={28} />
          <WordMark size={13} />
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace",
            color: T.violet, background: T.violetDim, border: `1px solid ${T.borderHi}`,
            padding: "2px 10px", borderRadius: 20 }}>
            {auth.type === "guest" ? "GUEST" : user?.role ?? "ANALYST"}
          </span>
        </div>

        {/* Center: tabs */}
        <div className="dashboard-tabs" style={{ display: "flex", gap: 2, overflow: "auto" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 8,
                border: "none", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                background: activeTab === t.id ? G.ctaBtn : "none",
                color: activeTab === t.id ? "#fff" : T.textSub,
                transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Right */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {auth.type === "authenticated" && user ? (
            <>
              <ThemeToggle />
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setProfileOpen(o => !o)}
                  style={{ display: "flex", alignItems: "center", gap: 8, background: "none",
                    border: `1px solid ${T.border}`, borderRadius: 10, padding: "4px 10px 4px 6px",
                    cursor: "pointer", fontFamily: "inherit" }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: "50%",
                    background: user.avatarColor === "cyan" ? `linear-gradient(135deg,#06b6d4,#22d3ee)`
                      : user.avatarColor === "coral" ? `linear-gradient(135deg,#f05478,#ec4899)`
                      : user.avatarColor === "emerald" ? `linear-gradient(135deg,#10b981,#34d399)`
                      : user.avatarColor === "indigo" ? `linear-gradient(135deg,#6366f1,#818cf8)`
                      : G.ctaBtn,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                    {user.avatar}
                  </div>
                  <span style={{ fontSize: 13, color: T.textSub }}>{user.name}</span>
                  <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace",
                    color: T.emerald, background: T.emeraldDim, border: `1px solid ${T.emerald}40`,
                    padding: "2px 6px", borderRadius: 8 }}>{user.status}</span>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth={2}>
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {profileOpen && (
                  <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 200,
                    background: T.navBg, backdropFilter: T.blur, WebkitBackdropFilter: T.blur,
                    border: `1px solid ${T.border}`, borderRadius: 12, minWidth: 160,
                    boxShadow: "0 8px 32px rgba(100,80,200,0.18)", overflow: "hidden" }}>
                    {[
                      { label: "Profil", action: () => { setView("settings"); setProfileOpen(false) } },
                      { label: "Pengaturan", action: () => { setView("settings"); setProfileOpen(false) } },
                    ].map(item => (
                      <button key={item.label} onClick={item.action} style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "11px 16px", background: "none", border: "none",
                        fontSize: 13, color: T.text, cursor: "pointer", fontFamily: "inherit",
                        borderBottom: `1px solid ${T.border}`,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = T.violetDim)}
                      onMouseLeave={e => (e.currentTarget.style.background = "none")}
                      >{item.label}</button>
                    ))}
                    <button onClick={() => { setProfileOpen(false); logout() }} style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "11px 16px", background: "none", border: "none",
                      fontSize: 13, color: T.coral, cursor: "pointer", fontFamily: "inherit",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = T.coralDim)}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                    >Logout</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace",
                color: T.amber, background: T.amberDim, border: `1px solid ${T.amber}40`,
                padding: "3px 10px", borderRadius: 10, fontWeight: 700 }}>
                GUEST MODE
              </span>
              <ThemeToggle />
              <button onClick={() => setView("login")} style={{ fontSize: 13, fontWeight: 600,
                color: T.violet, background: T.violetDim, border: `1px solid ${T.borderHi}`,
                padding: "5px 14px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>
                Masuk
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

// ─── Guest Banner ─────────────────────────────────────────────────────────────
function GuestBanner() {
  const { T } = useTheme()
  const { auth, setView } = useAuth()
  if (auth.type !== "guest") return null
  return (
    <div style={{
      background: "rgba(251,191,36,0.15)",
      border: "1px solid rgba(251,191,36,0.3)",
      borderBottom: "1px solid rgba(251,191,36,0.3)",
      padding: "8px 28px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    }}>
      <div>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.amber }}>
          Anda sedang menggunakan Mode Tamu
        </span>
        <span style={{ fontSize: 12, color: T.textSub, marginLeft: 12 }}>
          Beberapa fitur dan data dibatasi. Masuk untuk mengakses fitur analyst.
        </span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setView("login")} style={{
          fontSize: 12, fontWeight: 600, color: "#fff",
          background: "rgba(245,158,11,0.85)", border: "none",
          padding: "5px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
        }}>
          Masuk
        </button>
        <button style={{
          fontSize: 12, fontWeight: 600, color: T.amber,
          background: "none", border: `1px solid ${T.amber}50`,
          padding: "5px 14px", borderRadius: 8, cursor: "default", fontFamily: "inherit",
        }}>
          Mode Tamu ✓
        </button>
      </div>
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  const { T, G } = useTheme()
  const { setView } = useAuth()
  return (
    <section style={{ minHeight: "100vh", display: "flex", alignItems: "center",
      position: "relative", overflow: "hidden", paddingTop: 130 }}>
      <div style={{ position: "absolute", inset: 0, background: G.pageBg }} />
      {/* Animated ambient orbs */}
      <div style={{ position: "absolute", top: "10%", right: "12%", width: 480, height: 480,
        borderRadius: "50%", background: G.heroCyan, filter: "blur(60px)",
        animation: "orb-drift-1 12s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "15%", left: "8%", width: 380, height: 380,
        borderRadius: "50%", background: G.heroViolet, filter: "blur(70px)",
        animation: "orb-drift-2 15s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0,
        backgroundImage: `linear-gradient(${T.violet}0f 1px, transparent 1px), linear-gradient(90deg, ${T.violet}0f 1px, transparent 1px)`,
        backgroundSize: "56px 56px" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto",
        padding: "0 28px 140px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}>

        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 28,
            background: T.indigoDim, border: `1px solid ${T.borderHi}`,
            borderRadius: 24, padding: "5px 14px 5px 8px" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.indigo,
              boxShadow: `0 0 8px ${T.indigo}`, animation: "pulse-glow 2s infinite" }} />
            <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: T.indigo, letterSpacing: "0.04em" }}>
              ALIBABA HACKATHON 2026
            </span>
          </div>

          <h1 className="aurora-title" style={{ fontSize: "clamp(36px,5.5vw,68px)", fontWeight: 800, lineHeight: 1.08,
            marginBottom: 22, letterSpacing: "-0.02em" }}>
            Mendeteksi Fraud Tanpa Batas,<br />Menjaga Privasi Tanpa Kompromi.
          </h1>

          <p style={{ fontSize: 16, color: T.textSub, lineHeight: 1.75, marginBottom: 32, maxWidth: 500 }}>
            AI powered cross border fraud intelligence menggunakan Graph Neural Networks dan
            privacy preserving Federated Learning  tanpa berbagi data transaksi mentah antar institusi.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 36 }}>
            {["Graph Intelligence", "Federated Learning", "Cross Border Security", "Alibaba Cloud Ready"].map(b => (
              <Tag key={b} color={T.violet}>{b}</Tag>
            ))}
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <button onClick={() => setView("login")} className="fst-btn" style={{ padding: "12px 28px", background: G.ctaBtn,
              color: "#fff", fontWeight: 700, fontSize: 14, borderRadius: 10, border: "none",
              cursor: "pointer", boxShadow: "0 8px 32px rgba(139,92,246,0.30)", fontFamily: "inherit" }}>
              Mulai Sekarang
            </button>
            <a href="#validation" style={{ padding: "12px 28px",
              background: T.glassSoft, backdropFilter: T.blur,
              border: `1px solid ${T.border}`, color: T.text, fontWeight: 600, fontSize: 14,
              borderRadius: 12, textDecoration: "none" }}>
              Lihat Validasi Teknis
            </a>
          </div>

          <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.amber,
              animation: "pulse-glow 2s infinite" }} />
            <span style={{ fontSize: 12, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>
              POC Stage &rarr; Prototype in Development
            </span>
          </div>
        </div>

        <div>
          <HeroGraphViz />
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0,
        background: T.navBg, backdropFilter: T.blur, WebkitBackdropFilter: T.blur,
        borderTop: `1px solid ${T.border}` }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "18px 28px",
          display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24 }}>
          {[
            { v: "USD 83B", l: "Global online fraud 2024", note: "Statista 2024" },
            { v: "700-800", l: "Fraud cases/day Indonesia", note: "KOMDIGI 2025" },
            { v: "1,243", l: "Laporan fraud Q3 2025", note: "KOMDIGI 2025" },
            { v: "USD 24B+", l: "Annual digital fraud losses", note: "McAfee 2020" },
          ].map(st => (
            <div key={st.v}>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.cyan,
                fontFamily: "'JetBrains Mono',monospace", letterSpacing: "-0.02em", marginBottom: 3 }}>{st.v}</div>
              <div style={{ fontSize: 12, color: T.textSub, marginTop: 3, lineHeight: 1.4 }}>{st.l}</div>
              <div style={{ fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>src: {st.note}</div>
              <div style={{ marginTop: 5 }}><StatusBadge status="industry" /></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HeroGraphViz() {
  const { T } = useTheme()
  const nodes = [
    { id: "HQ", x: 50, y: 48, r: 8.5, color: T.cyan,    label: "FST Core",  ring: true,  risk: "core" },
    { id: "A1", x: 18, y: 20, r: 5.5, color: T.red,     label: "0x1F",                   risk: "high" },
    { id: "A2", x: 80, y: 18, r: 5,   color: T.emerald, label: "0x2A",                   risk: "low" },
    { id: "SG", x: 83, y: 62, r: 7,   color: T.violet,  label: "SG Node", ring: true,    risk: "cross" },
    { id: "A3", x: 30, y: 82, r: 5.5, color: T.amber,   label: "0x3B",                   risk: "med" },
    { id: "CN", x: 13, y: 66, r: 6.5, color: T.indigo,  label: "CN Node", ring: true,    risk: "cross" },
    { id: "A4", x: 63, y: 85, r: 5,   color: T.red,     label: "0xCC",                   risk: "high" },
    { id: "A5", x: 44, y: 28, r: 4.5, color: T.emerald, label: "0x4D",                   risk: "low" },
  ]
  const edges: { a: string; b: string; delay: number }[] = [
    { a: "HQ", b: "A1", delay: 0 },
    { a: "HQ", b: "A2", delay: 1.4 },
    { a: "HQ", b: "SG", delay: 2.8 },
    { a: "HQ", b: "CN", delay: 0.7 },
    { a: "HQ", b: "A5", delay: 3.5 },
    { a: "A1", b: "A3", delay: 1.9 },
    { a: "SG", b: "A4", delay: 0.3 },
    { a: "SG", b: "A2", delay: 2.1 },
    { a: "CN", b: "A3", delay: 3.2 },
    { a: "A5", b: "A2", delay: 4.1 },
  ]

  // stagger offsets for node breathing so nothing pulses together
  const breatheDelays = ["0s","0.6s","1.2s","1.8s","0.9s","2.4s","1.5s","0.3s"]
  // period per risk type
  const breathePeriod: Record<string, string> = {
    core: "3.5s", high: "2.4s", med: "3s", low: "3.8s", cross: "4s"
  }
  const breatheAmp: Record<string, [number, number]> = {
    core: [0.06, 0.28], high: [0.08, 0.32], med: [0.05, 0.18], low: [0.04, 0.15], cross: [0.05, 0.2]
  }

  return (
    <GlassCard style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span className="graph-live-label" style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: T.cyan, letterSpacing: "0.2em" }}>
          LIVE &middot; TRANSACTION GRAPH
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StatusBadge status="simulation" />
          <div className="graph-monitor-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: T.emerald, marginLeft: 6 }} />
          <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: T.emerald }}>MONITORING</span>
        </div>
      </div>

      <svg viewBox="0 0 100 100" style={{ width: "100%", height: 300, marginTop: 8 }}>
        <defs>
          <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="core-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <radialGradient id="core-grad" cx="50%" cy="50%" r="50%">
            <stop stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#06b6d4" />
          </radialGradient>
        </defs>

        {/* ── Edges ── */}
        {edges.map(({ a, b }) => {
          const na = nodes.find(n => n.id === a)!
          const nb = nodes.find(n => n.id === b)!
          const risky = na.risk === "high" || nb.risk === "high"
          return (
            <line key={`${a}-${b}`} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
              stroke={risky ? T.red + "35" : T.violet + "22"}
              strokeWidth={risky ? 0.7 : 0.45}
              strokeDasharray={risky ? "2,1.5" : undefined} />
          )
        })}

        {/* ── Transaction particles along edges ── */}
        {edges.map(({ a, b, delay }) => {
          const na = nodes.find(n => n.id === a)!
          const nb = nodes.find(n => n.id === b)!
          const risky = na.risk === "high" || nb.risk === "high"
          const particleColor = risky ? "#f87171" : "#67e8f9"
          const dur = risky ? "2.8s" : "3.6s"
          const path = `M ${na.x} ${na.y} L ${nb.x} ${nb.y}`
          return (
            <circle key={`p-${a}-${b}`} r={0.9} fill={particleColor} opacity={0}>
              <animateMotion dur={dur} begin={`${delay}s`} repeatCount="indefinite" path={path} />
              <animate attributeName="opacity" dur={dur} begin={`${delay}s`} repeatCount="indefinite"
                values="0;0.9;0.9;0" keyTimes="0;0.1;0.85;1" />
            </circle>
          )
        })}

        {/* ── Nodes ── */}
        {nodes.map((n, i) => {
          const isCore = n.id === "HQ"
          const [minOp, maxOp] = breatheAmp[n.risk]
          const dur = breathePeriod[n.risk]
          const del = breatheDelays[i]
          return (
            <g key={n.id} filter={isCore ? "url(#core-glow)" : "url(#node-glow)"}>
              {/* outer ring for cross border / core nodes — expands and fades */}
              {n.ring && (
                <circle cx={n.x} cy={n.y} fill="none" stroke={n.color} strokeWidth={0.4}>
                  <animate attributeName="r" dur={isCore ? "3.5s" : "4.2s"} begin={del}
                    repeatCount="indefinite"
                    values={`${n.r + 2};${n.r + 6};${n.r + 2}`} />
                  <animate attributeName="opacity" dur={isCore ? "3.5s" : "4.2s"} begin={del}
                    repeatCount="indefinite" values="0.4;0;0.4" />
                </circle>
              )}
              {/* High risk extra warning ring */}
              {n.risk === "high" && (
                <circle cx={n.x} cy={n.y} fill="none" stroke={T.red} strokeWidth={0.35}>
                  <animate attributeName="r" dur="2.4s" begin={del} repeatCount="indefinite"
                    values={`${n.r + 1};${n.r + 5};${n.r + 1}`} />
                  <animate attributeName="opacity" dur="2.4s" begin={del} repeatCount="indefinite"
                    values="0.55;0;0.55" />
                </circle>
              )}
              {/* Breathing glow halo */}
              <circle cx={n.x} cy={n.y} r={n.r + 2.5} fill={n.color}>
                <animate attributeName="opacity" dur={dur} begin={del} repeatCount="indefinite"
                  values={`${minOp};${maxOp};${minOp}`} calcMode="spline"
                  keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />
              </circle>
              {/* Core node */}
              <circle cx={n.x} cy={n.y} r={n.r}
                fill={isCore ? "url(#core-grad)" : n.color} opacity={0.92} />
              {/* Core soft inner pulse */}
              {isCore && (
                <circle cx={n.x} cy={n.y} r={n.r - 2} fill="white">
                  <animate attributeName="opacity" dur="3.5s" begin="0s" repeatCount="indefinite"
                    values="0;0.15;0" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />
                </circle>
              )}
              <text x={n.x} y={n.y + n.r + 3.5} textAnchor="middle" fontSize={2.8}
                fill={T.textSub} fontFamily="JetBrains Mono">{n.label}</text>
            </g>
          )
        })}
      </svg>

      <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
        {[[T.red,"High Risk"],[T.amber,"Medium"],[T.emerald,"Low Risk"],[T.violet,"Cross Border Node"]].map(([c, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />
            <span style={{ fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>{l}</span>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

// ─── Credibility Strip ────────────────────────────────────────────────────────
function CredibilityStrip() {
  const { T } = useTheme()
  const items = [
    { icon: "trophy",    c: T.amber,   v: "Alibaba Hackathon",   l: "2026 Finalist Track" },
    { icon: "gear",      c: T.violet,  v: "POC → Prototype",     l: "Technical Stage" },
    { icon: "clipboard", c: T.cyan,    v: "B2B SaaS",            l: "Business Model" },
    { icon: "beaker",    c: T.indigo,  v: "Validasi",            l: "In Progress" },
    { icon: "cloud",     c: T.emerald, v: "Alibaba Cloud Ready", l: "Deployment Mapping" },
  ]
  return (
    <div style={{ background: T.glassSoft, backdropFilter: T.blur, WebkitBackdropFilter: T.blur,
      borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 28px",
        display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 36 }}>
        {items.map(i => (
          <div key={i.v} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ padding: 8, borderRadius: 10, background: i.c + "18", flexShrink: 0 }}>
              <Icon name={i.icon} size={16} color={i.c} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{i.v}</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>{i.l}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Problem ──────────────────────────────────────────────────────────────────
function ProblemSection() {
  const { T } = useTheme()
  const { ref, visible } = useInView()
  return (
    <section id="problem" ref={ref} style={{ padding: "96px 28px", background: T.sectionAlt }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <SectionLabel large>Masalah</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "start" }}>
          <FadeIn visible={visible}>
            <h2 className="aurora-title-slow" style={{ fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 800,
              lineHeight: 1.2, marginBottom: 20, letterSpacing: "-0.02em" }}>
              Fraud modern tidak cukup ditangani{" "}
              <span style={{ WebkitTextFillColor: T.red }}>dengan aturan statis.</span>
            </h2>
            <p style={{ fontSize: 15, color: T.textSub, lineHeight: 1.75, marginBottom: 28 }}>
              Problem statement: <strong style={{ color: T.text }}>Penguatan Ketahanan dan Inovasi Keuangan</strong>.
              Ancaman kejahatan finansial lintas negara semakin kompleks  sistem konvensional gagal
              mendeteksi pola relasi antar entitas secara real time.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { v: "USD 83B", l: "Online fraud losses projected 2024", note: "Statista 2024", c: T.red },
                { v: "1,243", l: "Laporan fraud Q3 2025 Indonesia", note: "KOMDIGI 2025", c: T.amber },
                { v: "#1", l: "Indonesia: fraud/hari tertinggi SEA", note: "KOMDIGI 2025", c: T.red },
                { v: "USD 6T", l: "Total dampak global cybercrime", note: "McAfee 2020", c: T.violet },
              ].map(s => (
                <GlassCard key={s.v} style={{ padding: 16 }} accent={s.c}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.c,
                    fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>{s.v}</div>
                  <div style={{ fontSize: 11, color: T.textSub, lineHeight: 1.5 }}>{s.l}</div>
                  <div style={{ fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace", marginTop: 4 }}>src: {s.note}</div>
                </GlassCard>
              ))}
            </div>
          </FadeIn>
          <FadeIn visible={visible} delay={150}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { icon: "zap",     t: "Real Time Detection Gap",          c: T.amber,  d: "Metode rule based konvensional tidak mampu mendeteksi pola fraud yang berevolusi secara real time." },
                { icon: "globe",   t: "Cross Border Fragmentation",        c: T.cyan,   d: "Fraud lintas negara meningkat pesat. Sistem saat ini tidak memiliki kemampuan intelligence sharing antar institusi." },
                { icon: "lock",    t: "Privacy vs. Collaboration Dilemma", c: T.violet, d: "Regulasi privasi membatasi pertukaran data mentah antar institusi, menciptakan blind spot deteksi." },
                { icon: "chart",   t: "Graph Complexity Ignored",           c: T.indigo, d: "ML tabular tradisional mengabaikan pola relasi antar akun, perangkat, merchant. Di sinilah sinyal fraud terkuat." },
              ].map(p => (
                <GlassCard key={p.t} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: 18 }}>
                  <div style={{ padding: 8, borderRadius: 10, background: p.c + "18", flexShrink: 0 }}>
                    <Icon name={p.icon} size={18} color={p.c} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 5 }}>{p.t}</div>
                    <div style={{ fontSize: 13, color: T.textSub, lineHeight: 1.65 }}>{p.d}</div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}

// ─── Solution ─────────────────────────────────────────────────────────────────
function SolutionSection() {
  const { T, G } = useTheme()
  const { ref, visible } = useInView()
  return (
    <section id="solution" ref={ref} style={{ padding: "96px 28px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <SectionLabel large>Solusi</SectionLabel>
        <FadeIn visible={visible}>
          <h2 className="aurora-title-slow" style={{ fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 800,
            textAlign: "center", marginBottom: 14, letterSpacing: "-0.02em" }}>
            Workflow fraud intelligence yang ringkas dan jelas.
          </h2>
          <p style={{ fontSize: 15, color: T.textSub, textAlign: "center", maxWidth: 560,
            margin: "0 auto 48px", lineHeight: 1.75 }}>
            Fraudora Sentriq TraceX membangun graph dari entitas transaksi dan menganalisis pola
            keterkaitannya menggunakan GraphSAGE  tanpa memusatkan data mentah antar institusi.
          </p>
        </FadeIn>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
          {[
            { icon: "shield",  t: "Skor Risiko Terpadu",      d: "Menggabungkan rule guard, sinyal ML, dan ensemble agar risiko kuat tetap terlihat jelas.", c: T.cyan },
            { icon: "network", t: "Analisis Relasi",           d: "Melihat hubungan akun, perangkat, merchant, transaksi, dan negara untuk investigasi mendalam.", c: T.violet },
            { icon: "refresh", t: "Pembelajaran Adaptif",      d: "Label dari analyst menjadi data umpan balik untuk model internal via continual learning.", c: T.indigo },
            { icon: "search",  t: "Alur Investigasi Analyst",  d: "Peringatan, pelabelan, simulasi, dan log audit sebagai workflow yang terintegrasi.", c: T.pink },
          ].map((c, i) => (
            <FadeIn key={c.t} visible={visible} delay={i * 80}>
              <GlassCard style={{ height: "100%" }} accent={c.c}>
                <div style={{ marginBottom: 16, padding: 10, borderRadius: 12, background: c.c + "18", display: "inline-flex" }}>
                  <Icon name={c.icon} size={22} color={c.c} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 8 }}>{c.t}</div>
                <div style={{ fontSize: 13, color: T.textSub, lineHeight: 1.65 }}>{c.d}</div>
              </GlassCard>
            </FadeIn>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
          <FadeIn visible={visible} delay={350}>
            <GlassCard accent={T.cyan}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={T.cyan} strokeWidth={1.5}>
                  <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                </svg>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text }}>AI yang kredibel, tanpa overclaim.</h3>
              </div>
              <p style={{ fontSize: 13, color: T.textSub, lineHeight: 1.7, marginBottom: 6 }}>
                <strong style={{ color: T.text }}>PaySim XGBoost</strong> — sinyal benchmark fraud tabular publik.
              </p>
              <p style={{ fontSize: 13, color: T.textSub, lineHeight: 1.7, marginBottom: 6 }}>
                <strong style={{ color: T.text }}>Model Adaptif FST</strong> — belajar dari label analyst di dalam MVP.
              </p>
              <p style={{ fontSize: 13, color: T.textSub, lineHeight: 1.7 }}>
                <strong style={{ color: T.text }}>GraphSAGE Elliptic</strong> — prototype pembelajaran graph.
                Keputusan MVP dijaga oleh risk aware ensemble.
              </p>
            </GlassCard>
          </FadeIn>
          <FadeIn visible={visible} delay={430}>
            <GlassCard accent={T.violet}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={T.violet} strokeWidth={1.5}>
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Cara kerja demo.</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {["Transaksi masuk via API","Skor dihitung (GraphSAGE + XGBoost)","Peringatan dibuat jika melewati threshold","Analyst memberi label (fraud/legit)","Model diperbarui via continual learning"].map((step, i) => (
                  <div key={step} style={{ display: "flex", alignItems: "center", gap: 10,
                    background: T.violetDim, borderRadius: 8, padding: "9px 12px",
                    border: `1px solid ${T.border}` }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: G.ctaBtn,
                      color: "#fff", fontSize: 11, fontWeight: 700, display: "flex",
                      alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <span style={{ fontSize: 13, color: T.textSub }}>{step}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorksSection() {
  const { T } = useTheme()
  const { ref, visible } = useInView()
  const steps = [
    { n: "01", t: "Input Data Transaksi", d: "Data dikirim via API JSON: transaction_id, timestamp, sender/receiver account, nominal, device_id, IP address, merchant, channel, origin/dest country." },
    { n: "02", t: "Preprocessing & Validasi", d: "Data cleaning, normalization, feature engineering  memastikan kualitas data sebelum konstruksi graph." },
    { n: "03", t: "Graph Construction", d: "Membangun node (akun, perangkat, merchant) dan edge (transaksi). Neo4j menyimpan relational graph untuk analisis GNN." },
    { n: "04", t: "GraphSAGE Inference", d: "GNN menganalisis pola neighborhood lintas graph transaksi  mendeteksi subgraph anomali yang mengindikasikan fraud ring." },
    { n: "05", t: "Federated Model Update", d: "Update model lokal diagregasi lintas institusi via FedAvg  tidak ada data mentah yang keluar dari batas institusi." },
    { n: "06", t: "Risk Score + Alert", d: "Output: fraud_score (0-1), risk level (low/medium/high), alert, decision (approve/block). Human in the loop untuk investigasi." },
  ]
  const colors = [T.cyan, T.violet, T.indigo, T.pink, T.cyan, T.emerald]
  return (
    <section ref={ref} style={{ padding: "96px 28px", background: T.sectionAlt }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <SectionLabel large>Cara Kerja</SectionLabel>
        <h2 className="aurora-title-slow" style={{ fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 800,
          textAlign: "center", marginBottom: 48, letterSpacing: "-0.02em" }}>
          Pipeline Deteksi End to End
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {steps.map((s, i) => (
            <FadeIn key={s.n} visible={visible} delay={i * 70}>
              <GlassCard style={{ height: "100%" }} accent={colors[i]}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 38, fontWeight: 800,
                  color: `${colors[i]}18`, marginBottom: 10 }}>{s.n}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 8 }}>{s.t}</div>
                <div style={{ fontSize: 13, color: T.textSub, lineHeight: 1.65 }}>{s.d}</div>
              </GlassCard>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Technology ───────────────────────────────────────────────────────────────
function TechnologySection() {
  const { T } = useTheme()
  const { ref, visible } = useInView()
  const layers = [
    { name: "Layer 1 — Data Ingestion", color: T.cyan, items: ["Kafka / Redis","Real time streaming","Multi institution input"] },
    { name: "Layer 2 — Data Storage", color: T.violet, items: ["PostgreSQL","Neo4j (Graph DB)","MinIO (Artifacts)"] },
    { name: "Layer 3 — ML / AI Core", color: T.emerald, items: ["PyTorch + PyTorch Geometric","Scikit-learn (Baseline)","Flower / FedML","MLflow (Experiment Tracking)"] },
    { name: "Layer 4 — Backend / API", color: T.amber, items: ["FastAPI","Python (Orchestration)","REST API"] },
    { name: "Layer 5 — Frontend", color: T.pink, items: ["Next.js","Cytoscape.js (Graph Viz)","Dashboard & Monitoring"] },
    { name: "Layer 6 — Deployment", color: T.indigo, items: ["Docker","Kubernetes","Prometheus + Grafana"] },
  ]
  return (
    <section id="technology" ref={ref} style={{ padding: "96px 28px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <SectionLabel large>Teknologi</SectionLabel>
        <h2 className="aurora-title-slow" style={{ fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 800,
          textAlign: "center", marginBottom: 14, letterSpacing: "-0.02em" }}>
          Federated Graph Fraud Detection Architecture
        </h2>
        <p style={{ fontSize: 15, color: T.textSub, textAlign: "center", marginBottom: 48,
          maxWidth: 560, margin: "0 auto 48px" }}>
          Arsitektur 6 layer menggabungkan graph intelligence, federated privacy, dan real time streaming.
        </p>
        <FadeIn visible={visible}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {layers.map(l => (
              <GlassCard key={l.name} accent={l.color} style={{ padding: 20 }}>
                <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace",
                  color: l.color, marginBottom: 14, letterSpacing: "0.05em" }}>{l.name}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {l.items.map(i => (
                    <span key={i} style={{ fontSize: 11, padding: "3px 9px",
                      background: T.violetDim, color: T.textSub,
                      borderRadius: 8, border: `1px solid ${T.border}` }}>{i}</span>
                  ))}
                </div>
              </GlassCard>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Technical Validation ─────────────────────────────────────────────────────
function TechnicalValidationSection() {
  const { T } = useTheme()
  const { ref, visible } = useInView()
  const datasets = [
    { name: "PaySim", type: "Synthetic Mobile Money",
      desc: "Dataset transaksi mobile money sintetis berbasis pola nyata. Training pipeline: baseline + GNN.",
      graphRep: "Account to account transaction graph", cls: "Binary (fraud / legitimate)", file: "train_paysim.py" },
    { name: "Elliptic Bitcoin", type: "Real world Blockchain",
      desc: "Graph transaksi Bitcoin dengan label illicit/licit. Menguji deteksi fraud GNN pada struktur graph nyata.",
      graphRep: "Transaction to transaction Bitcoin graph", cls: "Binary (illicit / licit)", file: "train_elliptic_graphsage.py" },
    { name: "FST Synthetic", type: "Internal Simulation",
      desc: "Dataset sintetis dari simulation engine, selaras dengan ERD termasuk skenario cross border.",
      graphRep: "Heterogeneous: akun, device, merchant, negara", cls: "Multi class risk level", file: "train_trustlens.py" },
  ]
  const colors = [T.cyan, T.violet, T.indigo]
  return (
    <section id="validation" ref={ref} style={{ padding: "96px 28px", background: T.sectionAlt }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <SectionLabel large>Validasi Teknis</SectionLabel>
        <h2 className="aurora-title-slow" style={{ fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 800,
          textAlign: "center", marginBottom: 14, letterSpacing: "-0.02em" }}>
          Apa yang sudah ada di codebase?
        </h2>
        <p style={{ fontSize: 15, color: T.textSub, textAlign: "center", maxWidth: 560,
          margin: "0 auto 48px", lineHeight: 1.75 }}>
          Training pipeline sudah diimplementasikan untuk 3 dataset. Hasil benchmark menunggu evaluasi penuh.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 16 }}>
          {datasets.map((d, i) => (
            <FadeIn key={d.name} visible={visible} delay={i * 90}>
              <GlassCard style={{ height: "100%" }} accent={colors[i]}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{d.name}</div>
                    <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: colors[i], marginTop: 3 }}>{d.type}</div>
                  </div>
                  <StatusBadge status="target" />
                </div>
                <p style={{ fontSize: 13, color: T.textSub, lineHeight: 1.65, marginBottom: 14 }}>{d.desc}</p>
                <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
                  {[
                    ["Graph Representation", d.graphRep, false, false],
                    ["Classification", d.cls, false, false],
                    ["Validation Status", "Validation in progress", false, true],
                    ["Source file", d.file, true, false],
                  ].map(([k, v, isFile, isStatus]) => (
                    <div key={String(k)} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 11, color: T.textMuted }}>{k}</span>
                      <span style={{ fontSize: 11, textAlign: "right", maxWidth: "56%",
                        color: isFile ? colors[i] : isStatus ? T.amber : T.textSub,
                        fontFamily: isFile ? "'JetBrains Mono',monospace" : "inherit" }}>{String(v)}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </FadeIn>
          ))}
        </div>

        <FadeIn visible={visible} delay={280}>
          <GlassCard>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Model Benchmark Comparison</h3>
              <StatusBadge status="in progress" />
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    <th style={{ textAlign: "left", padding: "8px 14px 12px 0",
                      color: T.textMuted, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 500 }}>Model</th>
                    {["ROC AUC","Precision","Recall","F1 Score","False Positive Rate"].map(m => (
                      <th key={m} style={{ textAlign: "center", padding: "8px 12px 12px",
                        color: T.textMuted, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 500 }}>{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "Logistic Regression", note: "Baseline" },
                    { name: "XGBoost", note: "Tabular ML" },
                    { name: "GraphSAGE (GNN)", note: "Graph based" },
                    { name: "FST Full System (Graph + FL)", note: "Full System", hi: true },
                  ].map(m => (
                    <tr key={m.name} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: "11px 14px 11px 0" }}>
                        <div style={{ fontWeight: m.hi ? 600 : 400, color: m.hi ? T.violet : T.text }}>{m.name}</div>
                        <div style={{ fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>{m.note}</div>
                      </td>
                      {[0,1,2,3,4].map(idx => (
                        <td key={idx} style={{ textAlign: "center", padding: 11 }}>
                          <span style={{ fontSize: 11, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>
                            Not yet benchmarked
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 14, padding: "11px 14px", background: T.amberDim,
              border: `1px solid rgba(251,191,36,0.2)`, borderRadius: 8 }}>
              <p style={{ fontSize: 12, color: T.amber }}>
                Training pipelines implemented. Benchmark evaluation planned post POC validation.
              </p>
            </div>
          </GlassCard>
        </FadeIn>

        <FadeIn visible={visible} delay={370}>
          <GlassCard style={{ marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Confusion Matrix</h3>
              <StatusBadge status="projected" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 13, color: T.textSub, lineHeight: 1.7, marginBottom: 16 }}>
                  POC evaluation pending. Matrix akan diisi setelah evaluasi dataset selesai.
                </p>
                {[["TP","True Positive — fraud correctly flagged", T.emerald],
                  ["TN","True Negative — legitimate correctly passed", T.emerald],
                  ["FP","False Positive — legitimate falsely flagged", T.amber],
                  ["FN","False Negative — fraud missed", T.red]].map(([k,v,c]) => (
                  <div key={String(k)} style={{ display: "flex", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700,
                      color: String(c), width: 24, flexShrink: 0 }}>{k}</span>
                    <span style={{ fontSize: 13, color: T.textSub }}>{String(v)}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: 5,
                fontFamily: "'JetBrains Mono',monospace", fontSize: 11, maxWidth: 240, margin: "0 auto" }}>
                <div /><div style={{ textAlign: "center", color: T.textMuted, padding: "4px 0" }}>Pred Fraud</div>
                <div style={{ textAlign: "center", color: T.textMuted, padding: "4px 0" }}>Pred Legit</div>
                <div style={{ color: T.textMuted, display: "flex", alignItems: "center", fontSize: 10 }}>Actual Fraud</div>
                <div style={{ height: 60, background: T.emeraldDim, border: `1px solid ${T.emerald}47`,
                  borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, color: T.emerald }}>TP</div>
                <div style={{ height: 60, background: T.redDim, border: `1px solid ${T.red}38`,
                  borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, color: T.red }}>FN</div>
                <div style={{ color: T.textMuted, display: "flex", alignItems: "center", fontSize: 10 }}>Actual Legit</div>
                <div style={{ height: 60, background: T.amberDim, border: `1px solid ${T.amber}38`,
                  borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, color: T.amber }}>FP</div>
                <div style={{ height: 60, background: T.emeraldDim, border: `1px solid ${T.emerald}47`,
                  borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, color: T.emerald }}>TN</div>
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Performance Targets ──────────────────────────────────────────────────────
function PerformanceTargetsSection() {
  const { T } = useTheme()
  const { ref, visible } = useInView()
  const metrics: { name: string; value: string; cat: string; color: string }[] = [
    { name: "ROC AUC",              value: "≥ 0.95",         cat: "MODEL",     color: T.violet },
    { name: "Recall",               value: "≥ 0.90",         cat: "MODEL",     color: T.violet },
    { name: "Precision",            value: "≥ 0.90",         cat: "MODEL",     color: T.violet },
    { name: "F1 Score",             value: "≥ 0.90",         cat: "MODEL",     color: T.indigo },
    { name: "False Positive Rate",  value: "≤ 5%",           cat: "MODEL",     color: T.indigo },
    { name: "Detection Latency",    value: "≤ 2 sec",        cat: "DETECTION", color: T.cyan },
    { name: "Streaming Throughput", value: "≥ 1,000 tx/sec", cat: "STREAMING", color: T.cyan },
    { name: "Raw Data Exchanged",   value: "Zero",           cat: "PRIVACY",   color: T.emerald },
  ]
  return (
    <section ref={ref} style={{ padding: "96px 28px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <SectionLabel large>Performance Targets</SectionLabel>
        <h2 className="aurora-title-slow" style={{ fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 800,
          textAlign: "center", marginBottom: 14, letterSpacing: "-0.02em" }}>
          FST Engineering Targets
        </h2>
        <p style={{ fontSize: 14, color: T.textSub, textAlign: "center", marginBottom: 10,
          maxWidth: 520, margin: "0 auto 10px" }}>
          Semua metric adalah engineering target  bukan hasil benchmark aktual.
          Nilai aktual akan diisi setelah validasi eksperimen.
        </p>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 40 }}>
          <StatusBadge status="target" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {metrics.map((m, i) => (
            <FadeIn key={m.name} visible={visible} delay={i * 55}>
              <GlassCard style={{ textAlign: "center", padding: 20 }} accent={m.color}>
                <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace",
                  color: T.textMuted, letterSpacing: "0.16em", marginBottom: 10 }}>{m.cat}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: m.color,
                  fontFamily: "'JetBrains Mono',monospace", marginBottom: 6, letterSpacing: "-0.02em" }}>{m.value}</div>
                <div style={{ fontSize: 12, color: T.textSub, marginBottom: 12, lineHeight: 1.4 }}>{m.name}</div>
                <StatusBadge status="target" />
              </GlassCard>
            </FadeIn>
          ))}
        </div>
        <div style={{ marginTop: 18, padding: "12px 20px", border: `1px solid ${T.borderCyan}`,
          borderRadius: 10, background: T.cyanDim, textAlign: "center" }}>
          <p style={{ fontSize: 11, color: T.textSub, fontFamily: "'JetBrains Mono',monospace" }}>
            Engineering defined targets untuk production readiness. Tidak ada actual benchmark yang diklaim.
          </p>
        </div>
      </div>
    </section>
  )
}

// ─── Cross Border ─────────────────────────────────────────────────────────────
function CrossBorderSection() {
  const { T } = useTheme()
  const { ref, visible } = useInView()
  return (
    <section id="crossborder" ref={ref} style={{ padding: "96px 28px", background: T.sectionAlt }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <SectionLabel large>Cross Border Financial Intelligence</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}>
          <FadeIn visible={visible}>
            <h2 className="aurora-title-slow" style={{ fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 800,
              lineHeight: 1.2, marginBottom: 20, letterSpacing: "-0.02em" }}>
              Federated Intelligence Lintas Batas
            </h2>
            <p style={{ fontSize: 15, color: T.textSub, lineHeight: 1.75, marginBottom: 16 }}>
              Data transaksi keuangan mentah tetap berada di dalam institusi atau yurisdiksi asal.
              Federated learning hanya menukar <strong style={{ color: T.text }}>model updates</strong>,
              bukan catatan transaksi terpusat.
            </p>
            <div style={{ marginBottom: 24, padding: "12px 16px",
              borderLeft: `2px solid ${T.cyan}`, background: T.cyanDim, borderRadius: "0 10px 10px 0" }}>
              <p style={{ fontSize: 13, color: T.textSub, lineHeight: 1.7, fontStyle: "italic" }}>
                "Dirancang untuk mendukung data residency yang sadar yurisdiksi dan persyaratan privasi.
                Federated Learning tidak otomatis menjamin compliance penuh."
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { icon: "building", c: T.cyan,   l: "Data stays local",        d: "Transaksi tidak pernah keluar dari batas institusi" },
                { icon: "refresh",  c: T.violet,  l: "Model updates shared",    d: "Hanya gradient updates via secure aggregation" },
                { icon: "globe",    c: T.indigo,  l: "Fraud patterns global",   d: "Fraud ring lintas negara terdeteksi meski data terisolasi" },
                { icon: "lock",     c: T.emerald, l: "Privacy by design",       d: "Dirancang selaras UU PDP No. 27/2022" },
              ].map(i => (
                <GlassCard key={i.l} style={{ padding: 14 }}>
                  <div style={{ marginBottom: 8, padding: 7, borderRadius: 9, background: i.c + "18", display: "inline-flex" }}>
                    <Icon name={i.icon} size={16} color={i.c} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 4, fontFamily: "'Playfair Display',serif" }}>{i.l}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.5, fontFamily: "'Playfair Display',serif" }}>{i.d}</div>
                </GlassCard>
              ))}
            </div>
          </FadeIn>
          <FadeIn visible={visible} delay={180}>
            <FederatedFlowDiagram />
          </FadeIn>
        </div>
      </div>
    </section>
  )
}

function FederatedFlowDiagram() {
  const { T } = useTheme()
  const nodeColors = [T.cyan, T.violet, T.emerald]
  const nodes = [
    { label: "🇮🇩 Indonesia", sub: "Financial Institution" },
    { label: "🇸🇬 Singapore", sub: "Financial Node" },
    { label: "🇨🇳 China", sub: "Financial Node" },
  ]
  return (
    <GlassCard style={{ padding: 24 }}>
      <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: T.violet,
        letterSpacing: "0.2em", marginBottom: 20 }}>FEDERATED LEARNING ARCHITECTURE</div>
      <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
          {nodes.map((n, i) => (
            <div key={n.label} style={{ borderRadius: 10, border: `1px solid ${nodeColors[i]}25`,
              background: `${nodeColors[i]}08`, padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{n.label}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{n.sub}</div>
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace",
                  color: nodeColors[i], background: `${nodeColors[i]}15`,
                  border: `1px solid ${nodeColors[i]}22`, padding: "2px 8px", borderRadius: 10 }}>
                  Local GNN
                </span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 90, gap: 8 }}>
          <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: T.textMuted, textAlign: "center" }}>model update ↕</span>
          <div style={{ flex: 1, width: 1, borderLeft: `1px dashed ${T.violet}30` }} />
          <GlassCard style={{ padding: "10px 12px", textAlign: "center" }} accent={T.violet}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.violet }}>Federated</div>
            <div style={{ fontSize: 10, color: T.violet }}>Aggregation</div>
            <div style={{ fontSize: 9, color: T.textMuted, marginTop: 3, fontFamily: "'JetBrains Mono',monospace" }}>FedAvg</div>
          </GlassCard>
          <div style={{ flex: 1, width: 1, borderLeft: `1px dashed ${T.violet}30` }} />
          <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: T.textMuted, textAlign: "center" }}>model update ↕</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 10, flex: 1 }}>
          <GlassCard style={{ padding: 14, textAlign: "center" }} accent={T.emerald}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.emerald }}>Global Model</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>Aggregated intelligence</div>
          </GlassCard>
          <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: T.textMuted, textAlign: "center" }}>↓ fraud risk score</div>
          <GlassCard style={{ padding: 14, textAlign: "center" }} accent={T.red}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.red }}>⚠ Alert</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>Investigator notified</div>
          </GlassCard>
        </div>
      </div>
      <div style={{ marginTop: 16, padding: "10px 14px", background: T.violetDim,
        border: `1px solid ${T.border}`, borderRadius: 8 }}>
        <p style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.6, fontStyle: "italic" }}>
          Raw transaction data tidak pernah melewati batas institusi. Hanya model weight updates via secure aggregation.
        </p>
      </div>
    </GlassCard>
  )
}

// ─── Alibaba Cloud ────────────────────────────────────────────────────────────
function AlibabaCloudSection() {
  const { T } = useTheme()
  const { ref, visible } = useInView()
  const mappings = [
    { curr: "Docker / Kubernetes", ali: "Alibaba Cloud ACK", desc: "Container orchestration & auto scaling" },
    { curr: "MinIO / Object Storage", ali: "Alibaba Cloud OSS", desc: "Model checkpoints, artifacts, audit logs" },
    { curr: "PostgreSQL", ali: "Alibaba Cloud PolarDB", desc: "Transactional data, high availability" },
    { curr: "PyTorch / GNN Training", ali: "Alibaba Cloud PAI", desc: "Distributed GPU training for GNN" },
    { curr: "Prometheus / Grafana", ali: "ARMS + CloudMonitor", desc: "Real time metrics & anomaly detection" },
    { curr: "Kafka / Streaming", ali: "Message Queue for Apache Kafka", desc: "High throughput transaction streaming" },
  ]
  return (
    <section ref={ref} style={{ padding: "96px 28px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <SectionLabel large>Alibaba Cloud Ready</SectionLabel>
        <h2 className="aurora-title-slow" style={{ fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 800,
          textAlign: "center", marginBottom: 14, letterSpacing: "-0.02em" }}>
          Alibaba Cloud Deployment Architecture
        </h2>
        <p style={{ fontSize: 15, color: T.textSub, textAlign: "center", marginBottom: 14,
          maxWidth: 560, margin: "0 auto 14px", lineHeight: 1.75 }}>
          Fraudora Sentriq TraceX dipetakan ke layanan Alibaba Cloud. Konfigurasi deployment siap migrasi.
        </p>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 40 }}>
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace",
            color: T.amber, background: T.amberDim, border: `1px solid ${T.amber}40`,
            padding: "4px 14px", borderRadius: 20 }}>
            Deployment ready mapping — belum di deploy
          </span>
        </div>
        <FadeIn visible={visible}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
            {mappings.map(m => (
              <GlassCard key={m.ali} style={{ position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3,
                  background: "linear-gradient(to bottom, #ff6a00, #a855f7)", borderRadius: "16px 0 0 16px" }} />
                <div style={{ paddingLeft: 12 }}>
                  <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3 }}>Current</div>
                  <div style={{ fontSize: 13, color: T.textSub, marginBottom: 10 }}>{m.curr}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,106,0,0.2)" }} />
                    <span style={{ fontSize: 10, color: "#ff8c42", fontFamily: "'JetBrains Mono',monospace" }}>→ Alibaba Cloud</span>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,106,0,0.2)" }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#ff8c42", marginBottom: 4 }}>{m.ali}</div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>{m.desc}</div>
                </div>
              </GlassCard>
            ))}
          </div>
          <GlassCard>
            <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace",
              color: "#ff8c42", letterSpacing: "0.2em", marginBottom: 18 }}>CLOUD PIPELINE ARCHITECTURE</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              {[
                { l: "Ingest",   t: "Kafka (MQ)",          c: "Alibaba MQ" },
                { l: "Store",    t: "PostgreSQL + Neo4j",   c: "PolarDB + Graph" },
                { l: "Train",    t: "PyTorch + Flower",     c: "PAI + ECS GPU" },
                { l: "Serve",    t: "FastAPI + K8s",        c: "ACK + SLB" },
                { l: "Monitor",  t: "Prometheus + Grafana", c: "ARMS + CloudMonitor" },
                { l: "Storage",  t: "MinIO",                c: "OSS" },
                { l: "Frontend", t: "Next.js",              c: "CDN + OSS" },
                { l: "Security", t: "JWT + TLS",            c: "IDaaS + SSL" },
              ].map(i => (
                <div key={i.l} style={{ background: T.violetDim, borderRadius: 8,
                  padding: "12px 14px", border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: T.textMuted, marginBottom: 4 }}>{i.l}</div>
                  <div style={{ fontSize: 12, color: T.textSub, marginBottom: 6 }}>{i.t}</div>
                  <div style={{ fontSize: 11, color: "#ff8c42" }}>→ {i.c}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Compliance ───────────────────────────────────────────────────────────────
function ComplianceSection() {
  const { T } = useTheme()
  const { ref, visible } = useInView()
  const regs = [
    { name: "UU No. 27/2022 — PDP", desc: "Perlindungan Data Pribadi Indonesia", color: T.cyan, badge: "Compliance ready architecture",
      pts: ["Data minimization by design","Privacy by design via Federated Learning","Role based access control","Full audit trail","Tidak ada sentralisasi data mentah"] },
    { name: "POJK", desc: "Peraturan OJK — Financial Services Regulation", color: T.emerald, badge: "Alignment in design",
      pts: ["Consumer protection architecture","Information security controls","Risk management framework","Digital financial services readiness","Human in the loop oversight"] },
    { name: "ISO/IEC 27001", desc: "Information Security Management", color: T.violet, badge: "Security alignment",
      pts: ["Security management alignment","Access control policies","Incident response readiness","Asset management structure"] },
    { name: "PCI DSS", desc: "Payment Card Industry Data Security", color: T.amber, badge: "Design consideration",
      pts: ["Payment data security consideration","Encrypted communication","Audit logging","Vulnerability management"] },
  ]
  return (
    <section ref={ref} style={{ padding: "96px 28px", background: T.sectionAlt }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <SectionLabel large>Privacy, Security &amp; Regulatory Readiness</SectionLabel>
        <h2 className="aurora-title-slow" style={{ fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 800,
          textAlign: "center", marginBottom: 14, letterSpacing: "-0.02em" }}>
          Dirancang untuk Kepatuhan Indonesia &amp; Global
        </h2>
        <p style={{ fontSize: 14, color: T.textSub, textAlign: "center", marginBottom: 12,
          maxWidth: 560, margin: "0 auto 12px" }}>
          FST belum menerima approval OJK, sertifikasi ISO, atau PCI DSS.
          Sistem dirancang untuk memfasilitasi kepatuhan — bukan mengklaimnya.
        </p>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 40 }}>
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace",
            color: T.cyan, background: T.cyanDim, border: `1px solid ${T.borderCyan}`,
            padding: "4px 14px", borderRadius: 20 }}>
            Compliance ready architecture — certification pending
          </span>
        </div>
        <FadeIn visible={visible}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {regs.map(r => (
              <GlassCard key={r.name} accent={r.color}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: r.color }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{r.desc}</div>
                  </div>
                  <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600,
                    color: r.color, background: `${r.color}12`, border: `1px solid ${r.color}25`,
                    padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" as const, flexShrink: 0 }}>
                    {r.badge}
                  </span>
                </div>
                <ul style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {r.pts.map(p => (
                    <li key={p} style={{ display: "flex", gap: 8, fontSize: 13, color: T.textSub }}>
                      <span style={{ color: r.color, flexShrink: 0 }}>✓</span>{p}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Risk & Mitigation ────────────────────────────────────────────────────────
function RiskMitigationSection() {
  const { T } = useTheme()
  const { ref, visible } = useInView()
  const risks = [
    { id:"R1", name:"Federated Learning Bias", sev:"HIGH", color:T.amber,
      risk:"Distribusi data antar institusi tidak identik — model bias terhadap institusi dominan.",
      mits:["FedProx / robust aggregation","Cross institution evaluation","Distribution shift monitoring"] },
    { id:"R2", name:"GNN Adversarial Attack", sev:"HIGH", color:T.amber,
      risk:"Aktor jahat dapat memanipulasi struktur graph transaksi untuk menghindari deteksi.",
      mits:["Graph anomaly monitoring","Robust adversarial training","Input validation & sanitization"] },
    { id:"R3", name:"Malicious Federated Client", sev:"CRITICAL", color:T.red,
      risk:"Institusi yang dikompromikan dapat menginjeksi poisoned model updates.",
      mits:["Secure aggregation protocol","Client update validation","Gradient anomaly detection"] },
    { id:"R4", name:"Partner Adoption", sev:"MEDIUM", color:T.violet,
      risk:"Institusi keuangan mungkin enggan bergabung ke jaringan federated.",
      mits:["API first integration","SDK onboarding","Minimal data movement","Phased pilot"] },
    { id:"R5", name:"High Compute Cost", sev:"MEDIUM", color:T.violet,
      risk:"Training GNN dan inference real time pada skala besar sangat mahal secara komputasi.",
      mits:["GPU acceleration (PAI)","Model quantization","Batch inference","Alibaba Cloud autoscaling"] },
    { id:"R6", name:"Model Drift", sev:"MEDIUM", color:T.indigo,
      risk:"Pola fraud berevolusi — model dapat terdegradasi tanpa retraining berkala.",
      mits:["Continuous monitoring","Periodic retraining pipeline","Human feedback","Drift detection"] },
    { id:"R7", name:"False Positive Rate", sev:"HIGH", color:T.amber,
      risk:"Terlalu banyak false alert mengganggu transaksi legitimate dan mengikis kepercayaan.",
      mits:["Threshold tuning per institusi","Risk scoring (tidak binary)","Human in the loop review"] },
  ]
  return (
    <section ref={ref} style={{ padding: "96px 28px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <SectionLabel large>Risk &amp; Mitigation</SectionLabel>
        <h2 className="aurora-title-slow" style={{ fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 800,
          textAlign: "center", marginBottom: 48, letterSpacing: "-0.02em" }}>
          Risiko yang Diketahui &amp; Strategi Mitigasinya
        </h2>
        <FadeIn visible={visible}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {risks.map(r => (
              <GlassCard key={r.id} accent={r.color}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: T.textMuted }}>{r.id}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{r.name}</span>
                  </div>
                  <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700,
                    letterSpacing: "0.1em", color: r.color, background: `${r.color}14`,
                    border: `1px solid ${r.color}28`, padding: "3px 8px", borderRadius: 4, flexShrink: 0 }}>
                    {r.sev}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: T.textSub, marginBottom: 12, lineHeight: 1.65 }}>{r.risk}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {r.mits.map(m => (
                    <span key={m} style={{ fontSize: 11, padding: "3px 9px", background: T.violetDim,
                      color: T.textSub, borderRadius: 8, border: `1px solid ${T.border}` }}>{m}</span>
                  ))}
                </div>
              </GlassCard>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Competitive Differentiation ──────────────────────────────────────────────
function CompetitiveDiffSection() {
  const { T, G } = useTheme()
  const { ref, visible } = useInView()
  const caps = ["Real Time Detection","Adaptive Learning Loop","Privacy Preserving AI",
    "Graph Based Detection","GNN Powered","Cross Border Focus","Human Investigation Support"]
  const comps = [
    { name: "Fraudora Sentriq TraceX", hi: true,  vals: [true,true,true,true,true,true,true] },
    { name: "SEON",                    hi: false, vals: [true,false,false,false,false,true,false] },
    { name: "Feedzai",                 hi: false, vals: [true,false,false,false,false,true,false] },
    { name: "FeatureSpace",            hi: false, vals: [true,false,false,false,false,false,false] },
    { name: "DataVisor",               hi: false, vals: [true,false,false,true,false,false,false] },
  ]
  return (
    <section ref={ref} style={{ padding: "96px 28px", background: T.sectionAlt }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <SectionLabel large>Competitive Differentiation</SectionLabel>
        <h2 className="aurora-title-slow" style={{ fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 800,
          textAlign: "center", marginBottom: 48, letterSpacing: "-0.02em" }}>
          Mengapa Fraudora Sentriq TraceX Berbeda?
        </h2>
        <FadeIn visible={visible}>
          <GlassCard style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 14px 16px 0",
                    color: T.textMuted, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 500 }}>Capability</th>
                  {comps.map(c => (
                    <th key={c.name} style={{ padding: "8px 12px 16px", textAlign: "center" }}>
                      <div style={{ fontSize: c.hi ? 12 : 11, fontWeight: c.hi ? 700 : 500, color: c.hi ? T.violet : T.textSub }}>
                        {c.hi ? "FST" : c.name}
                      </div>
                      {c.hi && <div style={{ width: 32, height: 2, background: G.ctaBtn, margin: "4px auto 0", borderRadius: 1 }} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {caps.map((cap, ci) => (
                  <tr key={cap} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: "11px 14px 11px 0", color: T.textSub, fontSize: 13 }}>{cap}</td>
                    {comps.map(c => (
                      <td key={c.name} style={{ textAlign: "center", padding: 11 }}>
                        {c.vals[ci]
                          ? <span style={{ color: T.emerald, fontSize: 16 }}>✓</span>
                          : <span style={{ color: T.textMuted, fontSize: 16 }}>✗</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 11, color: T.textMuted, marginTop: 14, fontFamily: "'JetBrains Mono',monospace" }}>
              Analisis berdasarkan dokumentasi produk publik. Setiap claim sesuai dengan implementasi FST.
            </p>
          </GlassCard>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Investigation Copilot ────────────────────────────────────────────────────
function InvestigationCopilotSection() {
  const { T } = useTheme()
  const { ref, visible } = useInView()
  return (
    <section ref={ref} style={{ padding: "96px 28px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <SectionLabel large>AI Fraud Investigation Copilot</SectionLabel>
        <h2 className="aurora-title-slow" style={{ fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 800,
          textAlign: "center", marginBottom: 14, letterSpacing: "-0.02em" }}>
          Decision Support untuk Investigator
        </h2>
        <p style={{ fontSize: 14, color: T.textSub, textAlign: "center", marginBottom: 12,
          maxWidth: 520, margin: "0 auto 12px" }}>
          Output AI adalah decision support dan tidak menggantikan review manusia.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 40, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace",
            color: T.amber, background: T.amberDim, border: `1px solid ${T.amber}40`,
            padding: "4px 14px", borderRadius: 20 }}>Konsep — belum diintegrasikan</span>
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace",
            color: T.violet, background: T.violetDim, border: `1px solid ${T.borderHi}`,
            padding: "4px 14px", borderRadius: 20 }}>Alibaba Cloud Model Studio — Optional</span>
        </div>
        <FadeIn visible={visible}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <GlassCard accent={T.cyan}>
              <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace",
                color: T.textMuted, letterSpacing: "0.15em", marginBottom: 16 }}>INPUT</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { icon: "alert",   c: T.red,    l: "Fraud Alert",        d: "Alert dengan risk level dan fraud score" },
                  { icon: "network", c: T.violet,  l: "Transaction Graph",  d: "Subgraph entitas terkait" },
                  { icon: "chart",   c: T.cyan,    l: "Risk Score",         d: "Output dari GNN inference (0-1)" },
                  { icon: "search",  c: T.indigo,  l: "Evidence",           d: "Pattern yang terdeteksi dari graph" },
                ].map(item => (
                  <div key={item.l} style={{ display: "flex", gap: 12, alignItems: "flex-start",
                    background: T.cyanDim, borderRadius: 8, padding: "10px 12px",
                    border: `1px solid ${T.border}` }}>
                    <div style={{ padding: 6, borderRadius: 8, background: item.c + "18", flexShrink: 0 }}>
                      <Icon name={item.icon} size={14} color={item.c} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{item.l}</div>
                      <div style={{ fontSize: 12, color: T.textMuted }}>{item.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
            <GlassCard accent={T.red}>
              <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace",
                color: T.textMuted, letterSpacing: "0.15em", marginBottom: 16 }}>INVESTIGATOR OUTPUT</div>
              <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Risk Level:</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.red, background: T.redDim,
                  border: `1px solid ${T.red}40`, padding: "3px 10px", borderRadius: 6 }}>HIGH</span>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>Observed Signals:</div>
                {["Unusual transaction velocity","Connected suspicious accounts",
                  "Cross border anomaly detected","Abnormal graph neighborhood"].map(s => (
                  <div key={s} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 13, color: T.textSub }}>
                    <span style={{ color: T.amber }}>→</span>{s}
                  </div>
                ))}
              </div>
              <div style={{ background: T.violetDim, borderRadius: 8, padding: "11px 14px", border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Recommended Action:</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Manual investigation required</div>
              </div>
              <div style={{ marginTop: 12, padding: "8px 12px", background: T.amberDim,
                border: `1px solid ${T.amber}26`, borderRadius: 8 }}>
                <p style={{ fontSize: 11, color: T.amber, fontStyle: "italic" }}>
                  AI generated output is decision support and does not replace human review.
                </p>
              </div>
            </GlassCard>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Business Model ───────────────────────────────────────────────────────────
function BusinessModelSection() {
  const { T, G } = useTheme()
  const { ref, visible } = useInView()
  const tiers = [
    { name: "Pilot", price: "Custom", period: "", status: "illustrative" as MetricStatus, color: T.textSub,
      desc: "Untuk POC terkontrol dengan institusi keuangan terpilih.",
      features: ["Up to 100K tx/month","Basic graph analytics","Email support","Manual labeling UI","API access (limited)"] },
    { name: "Enterprise", price: "USD 5K–15K", period: "/month", status: "illustrative" as MetricStatus, color: T.violet, hi: true,
      desc: "Platform penuh untuk bank dan institusi fintech.",
      features: ["Unlimited transactions","Full graph intelligence","Federated Learning node","24/7 monitoring","Dedicated SLA","Custom integration"] },
    { name: "Cross Border", price: "USD 20K–50K", period: "/month", status: "illustrative" as MetricStatus, color: T.cyan,
      desc: "Jaringan federated intelligence multi yurisdiksi.",
      features: ["Multi country node","Secure aggregation","Cross border analytics","Regulatory reporting","Alibaba Cloud hosted","Premium SLA"] },
  ]
  const projections = [
    { year: "Year 1", arr: "USD 60K–120K", customers: "1–2 pilot partners", margin: "N/A",   status: "projected" as MetricStatus },
    { year: "Year 2", arr: "USD 500K–1.5M", customers: "5–10 enterprise",  margin: "~40%",  status: "projected" as MetricStatus },
    { year: "Year 3", arr: "USD 2M–5M",     customers: "20+ institutions", margin: "~55%",  status: "projected" as MetricStatus },
  ]
  return (
    <section id="business" ref={ref} style={{ padding: "96px 28px", background: T.sectionAlt }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <SectionLabel large>Business Model</SectionLabel>
        <h2 className="aurora-title-slow" style={{ fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 800,
          textAlign: "center", marginBottom: 14, letterSpacing: "-0.02em" }}>
          B2B SaaS — Fokus Institusi Keuangan
        </h2>
        <p style={{ fontSize: 14, color: T.textSub, textAlign: "center", marginBottom: 40,
          maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.75 }}>
          Semua pricing dan proyeksi adalah ilustrasi — berdasarkan asumsi pasar, bukan kontrak yang dikonfirmasi.
        </p>
        <FadeIn visible={visible}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 14 }}>
            {tiers.map(t => (
              <GlassCard key={t.name} accent={t.hi ? T.violet : undefined}
                style={{ position: "relative", borderColor: t.hi ? `${T.violet}28` : T.border }}>
                {t.hi && (
                  <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                    background: G.ctaBtn, color: "#fff", fontSize: 10, fontWeight: 700,
                    padding: "3px 14px", borderRadius: 12 }}>RECOMMENDED</div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                  marginBottom: 12, marginTop: t.hi ? 8 : 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: t.color }}>{t.name}</div>
                  <StatusBadge status={t.status} />
                </div>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{t.price}</span>
                  <span style={{ fontSize: 12, color: T.textMuted }}>{t.period}</span>
                </div>
                <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 16, lineHeight: 1.55 }}>{t.desc}</p>
                <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {t.features.map(f => (
                    <li key={f} style={{ display: "flex", gap: 8, fontSize: 13, color: T.textSub }}>
                      <span style={{ color: t.hi ? T.violet : T.cyan, flexShrink: 0 }}>→</span>{f}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            ))}
          </div>
          <GlassCard>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Revenue Projection Model (Illustrative)</h3>
              <StatusBadge status="projected" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
              {projections.map(p => (
                <div key={p.year} style={{ textAlign: "center", padding: 20,
                  background: T.violetDim, borderRadius: 12, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: T.textMuted, marginBottom: 10 }}>{p.year}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 4, letterSpacing: "-0.02em" }}>{p.arr}</div>
                  <div style={{ fontSize: 12, color: T.textSub, marginBottom: 4 }}>Estimated ARR</div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>{p.customers}</div>
                  <div style={{ fontSize: 12, color: T.emerald }}>Gross Margin {p.margin}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: T.textMuted, marginTop: 14,
              fontFamily: "'JetBrains Mono',monospace", textAlign: "center" }}>
              Semua proyeksi adalah ilustrasi asumsi bisnis. Tidak ada revenue atau customer yang dikonfirmasi.
            </p>
          </GlassCard>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Market Validation ────────────────────────────────────────────────────────
function MarketValidationSection() {
  const { T, G } = useTheme()
  const [contactOpen, setContactOpen] = useState(false)
  const { ref, visible } = useInView()
  const targets = [
    { name: "Commercial Banks", icon: "🏦", desc: "Bank Tier 1 & 2 dengan operasi internasional" },
    { name: "Digital Banks", icon: "📱", desc: "Neo banks dengan volume transaksi tinggi" },
    { name: "Payment Processors", icon: "💳", desc: "Payment gateway volume tinggi" },
    { name: "Fintech Companies", icon: "gear", desc: "Startup fintech technology forward" },
    { name: "E Wallet Providers", icon: "👝", desc: "Operator dompet digital" },
    { name: "Remittance Providers", icon: "globe", desc: "Layanan transfer uang lintas negara" },
  ]
  const colors = [T.cyan, T.violet, T.indigo, T.pink, T.emerald, T.amber]
  return (
    <section ref={ref} style={{ padding: "96px 28px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <SectionLabel large>Market Validation</SectionLabel>
        <h2 className="aurora-title-slow" style={{ fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 800,
          textAlign: "center", marginBottom: 14, letterSpacing: "-0.02em" }}>
          Target Pasar &amp; Pilot Pipeline
        </h2>
        <p style={{ fontSize: 14, color: T.textSub, textAlign: "center", marginBottom: 40,
          maxWidth: 520, margin: "0 auto 40px" }}>
          Saat ini sedang mencari pilot partner untuk POC fraud detection terkontrol.
          Tidak ada kemitraan institusional yang dikonfirmasi pada tahap ini.
        </p>
        <FadeIn visible={visible}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
            {targets.map((t, i) => (
              <GlassCard key={t.name} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: 18 }}
                accent={colors[i]}>
                <span style={{ fontSize: 22 }}>{t.icon === "globe" ? <Icon name="globe" size={18} color={colors[i]} /> : t.icon}</span>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t.name}</span>
                    <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace",
                      color: T.textSub, background: T.glassSoft,
                      border: `1px solid ${T.border}`, padding: "2px 7px", borderRadius: 4 }}>
                      TARGET
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>{t.desc}</div>
                </div>
              </GlassCard>
            ))}
          </div>
          <GlassCard style={{ textAlign: "center" }} accent={T.pink}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>🤝</div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 8 }}>Mencari Pilot Partners</h3>
            <p style={{ fontSize: 14, color: T.textSub, maxWidth: 480, margin: "0 auto 20px", lineHeight: 1.75 }}>
              Seeking pilot partners for controlled fraud detection POC. Integrasi minimal via REST API.
              Data transaksi mentah tetap di dalam institusi Anda.
            </p>
            <button onClick={() => setContactOpen(true)} className="fst-btn"
              style={{ padding: "10px 28px", background: G.pinkBtn, color: "#fff",
                fontWeight: 700, fontSize: 14, borderRadius: 10, border: "none",
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 6px 24px rgba(244,114,182,0.28)" }}>
              Hubungi untuk Pilot Partnership
            </button>
            <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
          </GlassCard>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Roadmap ──────────────────────────────────────────────────────────────────
function RoadmapSection() {
  const { T } = useTheme()
  const { ref, visible } = useInView()
  const phases = [
    { p:"Phase 1", name:"POC", status:"active",
      items:["Dataset validation (PaySim + Elliptic)","Baseline model (XGBoost + LogReg)","Graph construction pipeline","GraphSAGE training","Fraud scoring API","Dashboard prototype"] },
    { p:"Phase 2", name:"Federated Prototype", status:"next",
      items:["Multi node federated simulation","Secure aggregation (FedAvg)","Privacy evaluation","Cross institution testing","Model versioning (MLflow)"] },
    { p:"Phase 3", name:"Alibaba Cloud Deploy", status:"roadmap",
      items:["ACK (container orchestration)","OSS (artifact storage)","PolarDB (transactional DB)","PAI (GPU GNN training)","ARMS + CloudMonitor"] },
    { p:"Phase 4", name:"Pilot", status:"roadmap",
      items:["Financial institution onboarding","Real time Kafka streaming","Investigator workflow","SLA backed API","Feedback loop & retraining"] },
    { p:"Phase 5", name:"Cross Border Expansion", status:"roadmap",
      items:["Indonesia → Singapore node","Singapore → China node","Multi jurisdiction compliance","Global model aggregation","Cross border fraud ring detection"] },
  ]
  const sc: Record<string, { btext: string; badge: string; text: string }> = {
    active:  { btext: T.emerald, badge: T.emeraldDim, text: "In Progress" },
    next:    { btext: T.cyan,    badge: T.cyanDim,    text: "Next Phase" },
    roadmap: { btext: T.textMuted, badge: "rgba(154,163,196,0.15)", text: "Roadmap" },
  }
  return (
    <section ref={ref} style={{ padding: "96px 28px", background: T.sectionAlt }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <SectionLabel large>Roadmap</SectionLabel>
        <h2 className="aurora-title-slow" style={{ fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 800,
          textAlign: "center", marginBottom: 48, letterSpacing: "-0.02em" }}>
          Development Roadmap
        </h2>
        <FadeIn visible={visible}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16 }}>
            {phases.map(ph => {
              const s = sc[ph.status]
              return (
                <div key={ph.p}>
                  <div style={{ height: 3, borderRadius: 2, background: "rgba(154,163,196,0.25)", marginBottom: 14 }}>
                    {ph.status === "active" && (
                      <div style={{ width: "60%", height: "100%", background: T.emerald, borderRadius: 2 }} />
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: T.textMuted }}>{ph.p}</span>
                    <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600,
                      color: s.btext, background: s.badge, padding: "2px 7px", borderRadius: 4 }}>{s.text}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 10 }}>{ph.name}</div>
                  <ul style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {ph.items.map(item => (
                      <li key={item} style={{ display: "flex", gap: 6, fontSize: 11, color: T.textMuted }}>
                        <span style={{ color: ph.status === "active" ? T.emerald : T.textMuted, flexShrink: 0 }}>▸</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Contact Modal ─────────────────────────────────────────────────────────────
function ContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { T, G } = useTheme()
  const [name, setName] = useState("")
  const [org, setOrg] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [sent, setSent] = useState(false)

  function handleSubmit() {
    if (!name || !email) return
    setSent(true)
    setTimeout(() => { setSent(false); setName(""); setOrg(""); setEmail(""); setMessage(""); onClose() }, 2800)
  }

  if (!open) return null

  const inputSt: CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: `1.5px solid ${T.border}`, background: T.glassCard,
    color: T.text, fontSize: 14, fontFamily: "inherit", outline: "none",
    transition: "border-color 0.2s",
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24,
      background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
      animation: "fadeIn 0.2s ease" }}>
      <div style={{ width: "100%", maxWidth: 500, background: T.glassCard,
        backdropFilter: T.blur, WebkitBackdropFilter: T.blur,
        border: `1px solid ${T.border}`, borderRadius: 18,
        boxShadow: "0 24px 80px rgba(0,0,0,0.22)", padding: 32,
        animation: "fadeInUp 0.3s ease", position: "relative" }}>

        {/* Close */}
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16,
          background: "none", border: "none", cursor: "pointer", color: T.textMuted,
          fontSize: 20, lineHeight: 1, padding: 4, borderRadius: 6 }}>✕</button>

        {sent ? (
          <div style={{ textAlign: "center", padding: "40px 0", animation: "fadeInUp 0.3s ease" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>Terima kasih!</h3>
            <p style={{ fontSize: 14, color: T.textSub }}>
              Kami akan menghubungi Anda di <strong>{email}</strong> secepatnya.
            </p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <LogoMark size={26} />
                <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Request Pilot Demo</span>
              </div>
              <p style={{ fontSize: 13, color: T.textSub, lineHeight: 1.65 }}>
                Isi formulir ini dan tim Fraudora Sentriq TraceX akan menghubungi Anda untuk demo terjadwal.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: T.textSub, display: "block", marginBottom: 6 }}>Nama *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama Anda"
                  style={inputSt}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = T.violet}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = T.border} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: T.textSub, display: "block", marginBottom: 6 }}>Institusi / Organisasi</label>
                <input value={org} onChange={e => setOrg(e.target.value)} placeholder="Nama bank / fintech / perusahaan"
                  style={inputSt}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = T.violet}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = T.border} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: T.textSub, display: "block", marginBottom: 6 }}>Email *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@institusi.com"
                  style={inputSt}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = T.violet}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = T.border} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: T.textSub, display: "block", marginBottom: 6 }}>Pesan (opsional)</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Ceritakan kebutuhan Anda, skala transaksi, atau pertanyaan spesifik..."
                  rows={3} style={{ ...inputSt, resize: "vertical", minHeight: 80 }}
                  onFocus={e => (e.target as HTMLTextAreaElement).style.borderColor = T.violet}
                  onBlur={e => (e.target as HTMLTextAreaElement).style.borderColor = T.border} />
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={handleSubmit} className="fst-btn"
                  style={{ flex: 1, padding: "11px", background: G.pinkBtn, color: "#fff",
                    fontWeight: 700, fontSize: 14, borderRadius: 10, border: "none",
                    cursor: "pointer", fontFamily: "inherit",
                    opacity: !name || !email ? 0.55 : 1 }}>
                  Kirim Request
                </button>
                <button onClick={onClose} style={{ padding: "11px 18px", background: "none",
                  border: `1.5px solid ${T.border}`, color: T.textSub, fontSize: 14,
                  borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>
                  Batal
                </button>
              </div>

              <p style={{ fontSize: 11, color: T.textMuted, textAlign: "center" }}>
                Atau email langsung ke{" "}
                <a href="mailto:Azxmand1506@gmail.com" style={{ color: T.violet, textDecoration: "none" }}>
                  Azxmand1506@gmail.com
                </a>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── CTA ──────────────────────────────────────────────────────────────────────
function CTASection() {
  const { T, G } = useTheme()
  const { setView } = useAuth()
  const [contactOpen, setContactOpen] = useState(false)
  return (
    <section style={{ padding: "96px 28px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0,
        background: `radial-gradient(ellipse 60% 70% at 50% 0%, ${T.violet}1e, transparent 70%)` }} />
      <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center", position: "relative" }}>
        <SectionLabel large>Get Involved</SectionLabel>
        <h2 className="aurora-title" style={{ fontSize: "clamp(28px,4.5vw,56px)", fontWeight: 800,
          lineHeight: 1.12, marginBottom: 20, letterSpacing: "-0.02em" }}>
          Siap Mengamankan Keuangan Lintas Batas?
        </h2>
        <p style={{ fontSize: 16, color: T.textSub, marginBottom: 36, lineHeight: 1.75 }}>
          Fraudora Sentriq TraceX mencari pilot partner, technical advisor, dan investor yang
          sejalan dengan membangun platform fraud intelligence yang privacy preserving dan AI native.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => setView("login")} className="fst-btn" style={{ padding: "13px 32px", background: G.ctaBtn,
            color: "#fff", fontWeight: 700, fontSize: 14, borderRadius: 10, border: "none",
            cursor: "pointer", boxShadow: "0 8px 32px rgba(139,92,246,0.32)", fontFamily: "inherit" }}>
            Mulai Sekarang
          </button>
          <button onClick={() => setContactOpen(true)} className="fst-btn"
            style={{ padding: "13px 32px", background: G.pinkBtn, color: "#fff",
              fontWeight: 700, fontSize: 14, borderRadius: 10, border: "none",
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 6px 24px rgba(244,114,182,0.26)" }}>
            Request Pilot Demo
          </button>
        </div>
        <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
        <p style={{ marginTop: 24, fontSize: 11, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>
        </p>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  const { T } = useTheme()
  const { setView } = useAuth()
  return (
    <footer style={{ borderTop: `1px solid ${T.border}`, padding: "24px 28px",
      background: T.navBg, backdropFilter: T.blur, WebkitBackdropFilter: T.blur }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex",
        flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LogoMark size={22} />
          <WordMark size={12} />
        </div>
        <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace", textAlign: "center" }}>
          ALIBABA HACKATHON 2026 · Fraud Intelligence Platform
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button onClick={() => setView("login")} style={{ fontSize: 12, color: T.textSub, background: "none",
            border: "none", cursor: "pointer", fontFamily: "inherit" }}>Masuk</button>
          <button onClick={() => setView("login")} style={{ fontSize: 12, color: T.textSub, background: "none",
            border: "none", cursor: "pointer", fontFamily: "inherit" }}>Daftar</button>
          <span style={{ fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>
            POC Stage — data claims labeled Target/Pending
          </span>
        </div>
      </div>
    </footer>
  )
}

// ─── Login Page ───────────────────────────────────────────────────────────────
function LoginPage() {
  const { T, G } = useTheme()
  const { setView, loginWithCredentials, registerAccount, loginGuest } = useAuth()
  const [mode, setMode] = useState<"login" | "register">("login")

  // Login state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msgForgot, setMsgForgot] = useState(false)

  // Register state
  const [regName, setRegName] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regRole, setRegRole] = useState<BackendRole>("ANALYST")
  const [regInstitution, setRegInstitution] = useState("")
  const [regError, setRegError] = useState("")
  const [regSuccess, setRegSuccess] = useState("")
  const [regLoading, setRegLoading] = useState(false)

  async function handleLogin() {
    setError("")
    if (!email || !password) {
      setError("Email dan kata sandi wajib diisi.")
      return
    }
    setLoading(true)
    try {
      await loginWithCredentials(email, password)
      setSuccess(true)
      setTimeout(() => setView("dashboard"), 900)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Email atau kata sandi salah.")
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister() {
    setRegError("")
    setRegSuccess("")
    if (!regName || !regEmail || !regPassword) {
      setRegError("Nama, email, dan kata sandi wajib diisi.")
      return
    }
    if (regPassword.length < 6) {
      setRegError("Kata sandi minimal 6 karakter.")
      return
    }
    setRegLoading(true)
    try {
      await registerAccount({
        full_name: regName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        institution_name: regInstitution || undefined,
      })
      setRegSuccess("Akun berhasil dibuat. Silakan masuk.")
      setEmail(regEmail)
      setPassword("")
      setTimeout(() => setMode("login"), 1200)
    } catch (err) {
      setRegError(err instanceof ApiError ? err.message : "Gagal mendaftar. Coba lagi.")
    } finally {
      setRegLoading(false)
    }
  }

  function handleGuestLogin() {
    loginGuest()
    setView("dashboard")
  }

  const inputStyle: CSSProperties = {
    width: "100%", background: T.glassCard, border: `1.5px solid ${T.border}`,
    borderRadius: 12, padding: "11px 14px", fontSize: 14, color: T.text,
    outline: "none", fontFamily: "inherit", transition: "border-color 0.2s, box-shadow 0.2s",
    boxShadow: "0 1px 6px rgba(100,80,200,0.06)",
  }

  const benefits = [
    { icon: "shield",  c: T.cyan,   t: "Skor fraud berbasis risiko",          d: "Menggabungkan GNN, XGBoost, dan rule guard menjadi satu skor risiko yang actionable." },
    { icon: "tag",     c: T.violet,  t: "Pelabelan oleh analyst",              d: "Analyst dapat memberi label langsung dari dashboard. Feedback loop untuk model." },
    { icon: "globe",   c: T.indigo,  t: "Intelijen relasi dan lintas negara",  d: "Graph transaksi antar akun, device, merchant, dan negara divisualisasikan secara interaktif." },
  ]

  return (
    <div className="login-shell" style={{ minHeight: "100vh", display: "flex", alignItems: "center",
      position: "relative", overflow: "hidden", background: G.pageBg }}>
      <div style={{ position: "absolute", top: "10%", left: "5%", width: 500, height: 500,
        background: `radial-gradient(circle, ${T.violet}1e 0%, transparent 65%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "10%", right: "5%", width: 400, height: 400,
        background: `radial-gradient(circle, ${T.cyan}1a 0%, transparent 65%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0,
        backgroundImage: `linear-gradient(${T.violet}0f 1px, transparent 1px), linear-gradient(90deg, ${T.violet}0f 1px, transparent 1px)`,
        backgroundSize: "56px 56px" }} />

      <button onClick={() => setView("marketing")} style={{ position: "absolute", top: 24, left: 28,
        display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.textSub,
        background: T.violetDim, border: `1px solid ${T.border}`,
        padding: "6px 14px", borderRadius: 8, cursor: "pointer", zIndex: 10, fontFamily: "inherit" }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Beranda
      </button>

      <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 10, zIndex: 10 }}>
        <LogoMark size={28} />
        <WordMark size={13} />
      </div>

      <div style={{ position: "absolute", top: 20, right: 28, zIndex: 10 }}>
        <ThemeToggle />
      </div>

      <div className="login-grid" style={{ width: "100%", maxWidth: 1100, margin: "0 auto", padding: "100px 28px 60px",
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>

        {/* Left benefits */}
        <div className="login-benefits">
          <div style={{ marginBottom: 10 }}>
            <Tag color={T.indigo}>AKSES ANALYST</Tag>
          </div>
          <h1 className="aurora-title" style={{ fontSize: "clamp(28px,3.5vw,44px)", fontWeight: 800,
            lineHeight: 1.2, marginBottom: 16, letterSpacing: "-0.02em", marginTop: 20 }}>
            Masuk ke Fraudora Sentriq TraceX
          </h1>
          <p style={{ fontSize: 15, color: T.textSub, lineHeight: 1.75, marginBottom: 40 }}>
            Pantau risiko transaksi dan investigasi fraud dari satu tempat.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {benefits.map(b => (
              <GlassCard key={b.t} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: 18 }}>
                <div style={{ padding: 8, borderRadius: 10, background: b.c + "18", flexShrink: 0 }}>
                  <Icon name={b.icon} size={16} color={b.c} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>{b.t}</div>
                  <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.6 }}>{b.d}</div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Right form */}
        <div className="login-form">
          <GlassCard style={{ padding: 32, maxWidth: 420, margin: "0 auto", animation: "fadeInUp 0.4s ease" }}>
            {mode === "login" ? (
              <>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8 }}>
                  Masuk ke Fraudora Sentriq TraceX
                </h2>
                <p style={{ fontSize: 13, color: T.textSub, marginBottom: 28, lineHeight: 1.6 }}>
                  Pantau risiko transaksi dan investigasi fraud dari satu tempat.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: T.textSub, display: "block", marginBottom: 6 }}>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="analyst@trustlens.dev"
                      style={inputStyle}
                      onFocus={e => { (e.target as HTMLInputElement).style.borderColor = T.violet }}
                      onBlur={e => { (e.target as HTMLInputElement).style.borderColor = T.border }}
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: T.textSub }}>Kata sandi</label>
                      <button onClick={() => setMsgForgot(true)} style={{ fontSize: 12, color: T.violet, background: "none", border: "none",
                        cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                        Lupa kata sandi?
                      </button>
                    </div>
                    {msgForgot && (
                      <div style={{ marginBottom: 6, padding: "7px 12px", background: T.cyanDim,
                        border: `1px solid ${T.borderCyan}`, borderRadius: 8 }}>
                        <p style={{ fontSize: 12, color: T.cyan }}>Email reset kata sandi akan segera tersedia.</p>
                      </div>
                    )}
                    <PasswordInput value={password} onChange={setPassword} />
                  </div>

                  {error && (
                    <div style={{ padding: "10px 14px", background: T.redDim,
                      border: `1px solid ${T.red}40`, borderRadius: 8 }}>
                      <p style={{ fontSize: 13, color: T.red }}>{error}</p>
                    </div>
                  )}

                  {success && (
                    <div style={{ padding: "10px 14px", background: T.emeraldDim,
                      border: `1px solid ${T.emerald}40`, borderRadius: 8, textAlign: "center" }}>
                      <p style={{ fontSize: 13, color: T.emerald, fontWeight: 600 }}>✓ Login berhasil! Mengarahkan...</p>
                    </div>
                  )}

                  <button onClick={handleLogin} disabled={loading} className="fst-btn" style={{ width: "100%", padding: "12px", background: G.ctaBtn,
                    color: "#fff", fontWeight: 700, fontSize: 15, borderRadius: 10, border: "none",
                    cursor: loading ? "default" : "pointer", marginTop: 4, boxShadow: "0 6px 24px rgba(139,92,246,0.30)",
                    fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}>
                    {loading ? "Memproses..." : "Masuk"}
                  </button>

                  <div onClick={() => { setEmail("analyst@trustlens.dev"); setPassword("password123") }}
                    style={{ padding: "10px 14px", background: T.violetDim, borderRadius: 8,
                      border: `1px solid ${T.border}`, textAlign: "center", cursor: "pointer" }}>
                    <span style={{ fontSize: 12, color: T.textMuted }}>Klik untuk isi akun demo:{" "}</span>
                    <span style={{ fontSize: 12, color: T.text, fontFamily: "'JetBrains Mono',monospace" }}>
                      analyst@trustlens.dev / password123
                    </span>
                  </div>

                  <p style={{ textAlign: "center", fontSize: 13, color: T.textSub, marginTop: 4 }}>
                    Belum punya akun?{" "}
                    <button onClick={() => { setMode("register"); setError(""); setSuccess(false) }} style={{ fontSize: 13, color: T.violet, fontWeight: 600,
                      background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                      Daftar
                    </button>
                  </p>

                  <button onClick={handleGuestLogin} style={{
                    width: "100%", padding: "10px",
                    background: "none",
                    color: T.amber, fontWeight: 600, fontSize: 14,
                    borderRadius: 10, border: `1px solid ${T.amber}50`,
                    cursor: "pointer", fontFamily: "inherit",
                    marginTop: 4,
                  }}>
                    Masuk sebagai Tamu
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8 }}>
                  Buat Akun Baru
                </h2>
                <p style={{ fontSize: 13, color: T.textSub, marginBottom: 24, lineHeight: 1.6 }}>
                  Daftar sebagai analyst, admin, atau institusi untuk mengakses dashboard TrustLens.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: T.textSub, display: "block", marginBottom: 6 }}>Nama Lengkap</label>
                    <input value={regName} onChange={e => setRegName(e.target.value)} placeholder="Nama Anda" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: T.textSub, display: "block", marginBottom: 6 }}>Email</label>
                    <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="nama@institusi.dev" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: T.textSub, display: "block", marginBottom: 6 }}>Kata Sandi</label>
                    <PasswordInput value={regPassword} onChange={setRegPassword} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: T.textSub, display: "block", marginBottom: 6 }}>Peran</label>
                    <select value={regRole} onChange={e => setRegRole(e.target.value as BackendRole)}
                      style={{ ...inputStyle, cursor: "pointer" }}>
                      <option value="ANALYST">Analyst</option>
                      <option value="ADMIN">Admin</option>
                      <option value="INSTITUTION">Institution</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: T.textSub, display: "block", marginBottom: 6 }}>
                      Nama Institusi <span style={{ color: T.textMuted, fontWeight: 400 }}>(opsional)</span>
                    </label>
                    <input value={regInstitution} onChange={e => setRegInstitution(e.target.value)} placeholder="Bank ABC" style={inputStyle} />
                  </div>

                  {regError && (
                    <div style={{ padding: "10px 14px", background: T.redDim,
                      border: `1px solid ${T.red}40`, borderRadius: 8 }}>
                      <p style={{ fontSize: 13, color: T.red }}>{regError}</p>
                    </div>
                  )}
                  {regSuccess && (
                    <div style={{ padding: "10px 14px", background: T.emeraldDim,
                      border: `1px solid ${T.emerald}40`, borderRadius: 8, textAlign: "center" }}>
                      <p style={{ fontSize: 13, color: T.emerald, fontWeight: 600 }}>✓ {regSuccess}</p>
                    </div>
                  )}

                  <button onClick={handleRegister} disabled={regLoading} className="fst-btn" style={{ width: "100%", padding: "12px", background: G.ctaBtn,
                    color: "#fff", fontWeight: 700, fontSize: 15, borderRadius: 10, border: "none",
                    cursor: regLoading ? "default" : "pointer", marginTop: 4, boxShadow: "0 6px 24px rgba(139,92,246,0.30)",
                    fontFamily: "inherit", opacity: regLoading ? 0.7 : 1 }}>
                    {regLoading ? "Memproses..." : "Daftar"}
                  </button>

                  <p style={{ textAlign: "center", fontSize: 13, color: T.textSub, marginTop: 4 }}>
                    Sudah punya akun?{" "}
                    <button onClick={() => { setMode("login"); setRegError(""); setRegSuccess("") }} style={{ fontSize: 13, color: T.violet, fontWeight: 600,
                      background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                      Masuk
                    </button>
                  </p>
                </div>
              </>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  )
}

// ─── Marketing Page ───────────────────────────────────────────────────────────
function MarketingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <CredibilityStrip />
        <ProblemSection />
        <SolutionSection />
        <HowItWorksSection />
        <TechnologySection />
        <TechnicalValidationSection />
        <PerformanceTargetsSection />
        <CrossBorderSection />
        <AlibabaCloudSection />
        <ComplianceSection />
        <RiskMitigationSection />
        <CompetitiveDiffSection />
        <InvestigationCopilotSection />
        <BusinessModelSection />
        <MarketValidationSection />
        <RoadmapSection />
        <CTASection />
      </main>
      <Footer />
    </>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard() {
  const { auth } = useAuth()
  const [activeTab, setActiveTab] = useState<string>("overview")
  return (
    <RealtimeProvider enabled={auth.type !== "unauthenticated"}>
      <DashboardInner activeTab={activeTab} setActiveTab={setActiveTab} />
    </RealtimeProvider>
  )
}

function DashboardInner({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (t: string) => void }) {
  const { T, G } = useTheme()
  const { auth, setView } = useAuth()
  const live = useRealtime()
  const { toasts, dismiss } = useAlertToasts(live.lastEvent)

  const userName = auth.user?.name ?? (auth.type === "guest" ? "Tamu" : "Analyst")

  return (
    <div className="dashboard-shell" style={{ minHeight: "100vh", background: G.pageBg, backgroundAttachment: "fixed", color: T.text }}>
      <DashboardNavbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <GuestBanner />

      <div className="dashboard-content" style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 28px", animation: "fadeInUp 0.35s ease" }}>
        {/* Welcome + live status */}
        <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 className="aurora-title-slow" style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>
              Selamat datang, {userName} 👋
            </h1>
            <p style={{ fontSize: 13, color: T.textSub }}>
              Fraudora Sentriq TraceX · Real-time Fraud Monitoring ·{" "}
              {auth.type === "guest" ? "Guest Mode — polling" : "Data langsung dari backend TrustLens"}
            </p>
          </div>
          <LiveBadge status={live.status} lastUpdated={live.lastUpdated} />
        </div>

        {/* DEMO DATA banner */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 14px", background: T.amberDim,
            border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8 }}>
            <StatusBadge status="simulation" />
            <span style={{ fontSize: 11, color: T.amber, fontFamily: "'JetBrains Mono',monospace" }}>
              CONTROLLED DEMO PIPELINE — data dibuat &amp; diproses oleh backend sendiri (bukan data keuangan sungguhan)
            </span>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === "overview" && <OverviewTab onNavigate={setActiveTab} />}

        {/* Alerts are analyst-only; the other tabs work for guests too (public API + polling). */}
        {activeTab === "alerts" && auth.type === "authenticated" && <AlertsTab />}
        {activeTab === "transactions" && <TransactionsTab />}
        {activeTab === "graph" && <GraphTab />}
        {activeTab === "crossborder" && <CrossBorderTab />}
        {activeTab === "ml" && <MLTab />}
        {activeTab === "audit" && <AuditTab />}

        {/* Fallback for unknown tabs */}
        {!["overview","alerts","transactions","graph","crossborder","ml","audit"].includes(activeTab) && (
          <GlassCard style={{ textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🧭</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8 }}>Halaman tidak ditemukan</h3>
            <p style={{ fontSize: 13, color: T.textSub }}>Modul tidak dikenal — kembali ke dashboard.</p>
            <button onClick={() => setActiveTab("overview")} style={{
              marginTop: 14, padding: "8px 18px", background: G.ctaBtn, color: "#fff",
              fontWeight: 600, fontSize: 13, borderRadius: 8, border: "none",
              cursor: "pointer", fontFamily: "inherit",
            }}>Kembali ke Dashboard</button>
          </GlassCard>
        )}

        <div style={{ marginTop: 24, padding: "12px 20px", background: T.violetDim,
          border: `1px solid ${T.borderHi}`, borderRadius: 12, textAlign: "center" }}>
          <p style={{ fontSize: 11, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>
            REAL-TIME CONTROLLED DEMO — transaksi dibuat &amp; discoring oleh backend sendiri, dikirim ke UI via SSE.
            Fraudora Sentriq TraceX · POC Stage · Tidak ada data keuangan sungguhan.
          </p>
        </div>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismiss} onOpenAlerts={() => setActiveTab("alerts")} />
    </div>
  )
}

// ─── Settings Page ────────────────────────────────────────────────────────────
const AVATAR_COLORS = ["violet", "cyan", "coral", "emerald", "indigo"] as const
type AvatarColorName = typeof AVATAR_COLORS[number]

function SettingsPage() {
  const { T, G, toggleTheme, theme } = useTheme()
  const { auth, setView, updateUser } = useAuth()
  const user = auth.user!

  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [accountMsg, setAccountMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [curPw, setCurPw] = useState("")
  const [newPw, setNewPw] = useState("")
  const [confPw, setConfPw] = useState("")
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [avatarColor, setAvatarColor] = useState<AvatarColorName>(
    (user.avatarColor as AvatarColorName | undefined) ?? "violet"
  )

  const avatarGrad: Record<AvatarColorName, string> = {
    violet:  G.ctaBtn,
    cyan:    "linear-gradient(135deg,#06b6d4,#22d3ee)",
    coral:   "linear-gradient(135deg,#f05478,#ec4899)",
    emerald: "linear-gradient(135deg,#10b981,#34d399)",
    indigo:  "linear-gradient(135deg,#6366f1,#818cf8)",
  }

  function saveAccount() {
    updateUser({ name, email, avatarColor })
    setAccountMsg({ ok: true, text: "Perubahan berhasil disimpan." })
    setTimeout(() => setAccountMsg(null), 3000)
  }

  function changePassword() {
    if (!curPw) { setPwMsg({ ok: false, text: "Masukkan kata sandi saat ini." }); return }
    if (newPw.length < 6) { setPwMsg({ ok: false, text: "Kata sandi baru minimal 6 karakter." }); return }
    if (newPw !== confPw) { setPwMsg({ ok: false, text: "Konfirmasi kata sandi tidak cocok." }); return }
    // No password-change endpoint exists on the demo backend, so this is
    // intentionally local-only and clearly labeled — it must not pretend
    // the change was persisted server-side.
    setPwMsg({ ok: true, text: "Validasi OK (demo) — endpoint ganti kata sandi backend belum tersedia, perubahan tidak dipersist." })
    setCurPw(""); setNewPw(""); setConfPw("")
    setTimeout(() => setPwMsg(null), 5000)
  }

  const inputStyle: CSSProperties = {
    width: "100%", background: T.glassCard, border: `1.5px solid ${T.border}`,
    borderRadius: 10, padding: "10px 14px", fontSize: 14, color: T.text,
    outline: "none", fontFamily: "inherit",
  }

  const section: CSSProperties = { marginBottom: 28 }
  const sectionTitle: CSSProperties = { fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }
  const label: CSSProperties = { fontSize: 12, fontWeight: 600, color: T.textSub, display: "block", marginBottom: 6 }

  return (
    <div style={{ minHeight: "100vh", background: G.pageBg, backgroundAttachment: "fixed", color: T.text }}>
      <DashboardNavbar activeTab="" setActiveTab={() => undefined} />
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 28px", animation: "fadeInUp 0.35s ease" }}>
        <button onClick={() => setView("dashboard")} style={{
          display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.textSub,
          background: T.violetDim, border: `1px solid ${T.border}`, padding: "6px 14px",
          borderRadius: 8, cursor: "pointer", fontFamily: "inherit", marginBottom: 28,
        }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Kembali ke Dashboard
        </button>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, marginBottom: 8 }}>Pengaturan</h1>
        <p style={{ fontSize: 13, color: T.textSub, marginBottom: 32, lineHeight: 1.6 }}>Kelola akun dan preferensi Anda.</p>

        {/* Akun */}
        <GlassCard style={section}>
          <div style={sectionTitle}>Akun</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={label}>Nama</label>
              <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={label}>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={label}>Role</label>
              <div style={{ ...inputStyle, background: T.glassSoft, color: T.textSub, cursor: "default" }}>{user.role}</div>
            </div>
            {accountMsg && (
              <div style={{ padding: "8px 12px", borderRadius: 8,
                background: accountMsg.ok ? T.emeraldDim : T.redDim,
                border: `1px solid ${accountMsg.ok ? T.emerald : T.red}40` }}>
                <p style={{ fontSize: 13, color: accountMsg.ok ? T.emerald : T.red }}>{accountMsg.text}</p>
              </div>
            )}
            <button onClick={saveAccount} className="fst-btn" style={{
              padding: "10px 24px", background: G.ctaBtn, color: "#fff", fontWeight: 700,
              fontSize: 14, borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit",
              alignSelf: "flex-start",
            }}>Simpan Perubahan</button>
          </div>
        </GlassCard>

        {/* Keamanan */}
        <GlassCard style={section}>
          <div style={sectionTitle}>Keamanan</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={label}>Password saat ini</label>
              <PasswordInput value={curPw} onChange={setCurPw} placeholder="Password saat ini" />
            </div>
            <div>
              <label style={label}>Password baru</label>
              <PasswordInput value={newPw} onChange={setNewPw} placeholder="Minimal 6 karakter" />
            </div>
            <div>
              <label style={label}>Konfirmasi password baru</label>
              <PasswordInput value={confPw} onChange={setConfPw} placeholder="Ulangi password baru" />
            </div>
            {pwMsg && (
              <div style={{ padding: "8px 12px", borderRadius: 8,
                background: pwMsg.ok ? T.emeraldDim : T.redDim,
                border: `1px solid ${pwMsg.ok ? T.emerald : T.red}40` }}>
                <p style={{ fontSize: 13, color: pwMsg.ok ? T.emerald : T.red }}>{pwMsg.text}</p>
              </div>
            )}
            <button onClick={changePassword} className="fst-btn" style={{
              padding: "10px 24px", background: G.ctaBtn, color: "#fff", fontWeight: 700,
              fontSize: 14, borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit",
              alignSelf: "flex-start",
            }}>Ubah Kata Sandi</button>
          </div>
        </GlassCard>

        {/* Profil */}
        <GlassCard style={section}>
          <div style={sectionTitle}>Profil</div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%",
              background: avatarGrad[avatarColor],
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 800, color: "#fff" }}>
              {user.avatar}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 8 }}>Ganti warna avatar</div>
              <div style={{ display: "flex", gap: 8 }}>
                {AVATAR_COLORS.map(c => (
                  <button key={c} onClick={() => setAvatarColor(c)} style={{
                    width: 28, height: 28, borderRadius: "50%", background: avatarGrad[c],
                    border: avatarColor === c ? `2px solid ${T.text}` : `2px solid transparent`,
                    cursor: "pointer", padding: 0, transition: "border-color 0.15s",
                  }} aria-label={c} />
                ))}
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Preferensi */}
        <GlassCard>
          <div style={sectionTitle}>Preferensi</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Tema</div>
              <div style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>
                {theme === "dark" ? "Mode Gelap aktif" : "Mode Terang aktif"}
              </div>
            </div>
            <button onClick={toggleTheme} style={{
              fontSize: 13, padding: "7px 18px", borderRadius: 20, border: `1px solid ${T.border}`,
              background: T.glassSoft, cursor: "pointer", fontFamily: "inherit",
              color: T.textSub, transition: "all 0.3s ease",
            }}>
              {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}

// ─── App Shell ────────────────────────────────────────────────────────────────
function AppShell() {
  const { T, G } = useTheme()
  const { view } = useAuth()
  useEffect(() => { if (view === "marketing") window.scrollTo({ top: 0 }) }, [view])
  return (
    <div style={{ minHeight: "100vh", background: G.pageBg, backgroundAttachment: "fixed", color: T.text, transition: "background 0.4s ease, color 0.3s ease" }}>
      {view === "login" ? <LoginPage /> : view === "dashboard" ? <Dashboard /> : view === "settings" ? <SettingsPage /> : <MarketingPage />}
    </div>
  )
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  )
}
