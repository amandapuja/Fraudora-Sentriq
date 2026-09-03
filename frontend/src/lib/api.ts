// ─── API Client ────────────────────────────────────────────────────────────────
// Menghubungkan frontend (Fraudora Sentriq TraceX / alibaba_fiks) dengan backend
// FastAPI TrustLens. Base URL bisa dioverride lewat env var VITE_API_URL.

const configuredApiUrl = ((import.meta as any).env?.VITE_API_URL as string | undefined)?.trim()

// Default ke same-origin. Vite dev/preview akan mem-proxy /api ke backend,
// sehingga hasil clone tetap bekerja dari localhost maupun IP/LAN tanpa
// menanam hostname mesin tertentu ke bundle frontend.
export const API_URL: string = (configuredApiUrl || "/api/v1").replace(/\/$/, "")

export const TOKEN_KEY = "trustlens_token"
export const USER_KEY = "trustlens_user"

export type BackendRole = "ADMIN" | "ANALYST" | "INSTITUTION"

export interface BackendUser {
  id: string
  full_name: string
  email: string
  role: BackendRole
  institution_name?: string | null
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: BackendUser
}

export type RegisterResponse = BackendUser

export interface ApiErrorPayload {
  detail?: string
  message?: string
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = "ApiError"
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): BackendUser | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as BackendUser
  } catch {
    return null
  }
}

export function clearSession() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(USER_KEY)
}

export function saveSession(result: LoginResponse) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(TOKEN_KEY, result.access_token)
  window.localStorage.setItem(USER_KEY, JSON.stringify(result.user))
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers = new Headers(options.headers)

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json")
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers })
  } catch (err) {
    throw new ApiError(
      "Tidak dapat menghubungi server. Pastikan backend berjalan di " + API_URL,
      0,
    )
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as ApiErrorPayload
    throw new ApiError(
      errorBody.detail || errorBody.message || `Permintaan gagal (${response.status})`,
      response.status,
    )
  }

  return response.json() as Promise<T>
}

export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  const result = await apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  })
  saveSession(result)
  return result
}

export async function apiRegister(payload: {
  full_name: string
  email: string
  password: string
  role: BackendRole
  institution_name?: string | null
}): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ ...payload, email: payload.email.trim().toLowerCase() }),
  })
}

export async function apiMe(): Promise<BackendUser> {
  return apiFetch<BackendUser>("/auth/me", { method: "GET" })
}
