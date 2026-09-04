"use client"

import { createContext, useContext, useEffect, useState } from "react"

import { INITIAL_STAFF } from "@/lib/mock-data"
import type { StaffMember } from "@/lib/types"

const SESSION_KEY = "paradiso-session-staff-id"

/**
 * Dummy, backend-free auth: "signing in" means picking a name from the seed staff
 * roster (lib/mock-data.ts INITIAL_STAFF), matching how a real backend would
 * eventually work (login = a specific employee, with a role). Session is a staff id
 * in sessionStorage — tab-scoped, resets on close, consistent with the rest of this
 * prototype's session-only data model. Staff added later via Staff Management live
 * only in that session's React state and won't appear here on a fresh sign-in — this
 * whole layer is expected to be replaced once a real backend exists.
 */
interface AuthContextValue {
  currentUser: StaffMember | null
  isLoading: boolean
  signIn: (staffId: string) => boolean
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<StaffMember | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      const storedId = sessionStorage.getItem(SESSION_KEY)
      const found = storedId ? INITIAL_STAFF.find((member) => member.id === storedId) : undefined
      if (found) setCurrentUser(found)
    } catch {
      // sessionStorage unavailable (e.g. private browsing) — just stay signed out.
    }
    setIsLoading(false)
  }, [])

  function signIn(staffId: string) {
    const found = INITIAL_STAFF.find((member) => member.id === staffId)
    if (!found) return false
    setCurrentUser(found)
    try {
      sessionStorage.setItem(SESSION_KEY, staffId)
    } catch {
      // ignore — session just won't survive a reload
    }
    return true
  }

  function signOut() {
    setCurrentUser(null)
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      // ignore
    }
  }

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, signIn, signOut }}>
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
