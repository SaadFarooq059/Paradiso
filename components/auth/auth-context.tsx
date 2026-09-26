"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"

import type { StaffMember } from "@/lib/types"

/**
 * A demo gate, not an authentication system.
 *
 * Previously this was entirely client-side: a staff id in sessionStorage, no
 * password checked anywhere, so the "admin" screens were hidden rather than
 * protected and anyone could grant themselves the role from devtools. The
 * session now lives in an httpOnly signed cookie the server issues, and this
 * context only reflects what the server says — it cannot mint a session of its
 * own. The API routes enforce the same thing independently, so hiding a screen
 * is a convenience rather than the control.
 */
interface AuthContextValue {
  currentUser: StaffMember | null
  isLoading: boolean
  /** True when the deployment has a password configured at all. */
  isConfigured: boolean
  signIn: (staffId: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<StaffMember | null>(null)
  const [isConfigured, setIsConfigured] = useState(true)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth", { cache: "no-store" })
      const payload = (await response.json()) as {
        currentUser: StaffMember | null
        configured: boolean
      }
      setCurrentUser(payload.currentUser)
      setIsConfigured(payload.configured)
    } catch {
      setCurrentUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /** Returns an error message, or null on success. */
  async function signIn(staffId: string, password: string): Promise<string | null> {
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, password }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        currentUser?: StaffMember
        message?: string
      }
      if (!response.ok || !payload.currentUser) {
        return payload.message ?? "Couldn't sign in."
      }
      setCurrentUser(payload.currentUser)
      return null
    } catch {
      return "Couldn't reach the server."
    }
  }

  async function signOut() {
    try {
      await fetch("/api/auth", { method: "DELETE" })
    } catch {
      // Even if the call fails, drop the local view of the session.
    }
    setCurrentUser(null)
  }

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, isConfigured, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
