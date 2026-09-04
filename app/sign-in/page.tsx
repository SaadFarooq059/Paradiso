"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { LogIn } from "lucide-react"

import { useAuth } from "@/components/auth/auth-context"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { INITIAL_STAFF } from "@/lib/mock-data"

export default function SignInPage() {
  const router = useRouter()
  const { signIn } = useAuth()
  const [staffId, setStaffId] = useState(INITIAL_STAFF[0]?.id ?? "")
  const [password, setPassword] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const member = INITIAL_STAFF.find((m) => m.id === staffId)
    if (!member || !signIn(staffId)) {
      toast.error("Couldn't sign in — pick a staff member.")
      return
    }
    toast.success(`Welcome back, ${member.name}!`)
    router.push("/")
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="flex flex-col items-center space-y-1.5 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="Paradiso" className="mb-2 h-14 w-auto object-contain" />
          <h1 className="text-2xl font-semibold text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Sign in to Paradiso CRM to keep the ovens running.</p>
        </div>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="staff-picker">Sign in as</FieldLabel>
            <Select value={staffId} onValueChange={(value) => setStaffId(value as string)}>
              <SelectTrigger id="staff-picker" className="w-full">
                <SelectValue placeholder="Choose your name">
                  {(value: string | null) => {
                    const member = INITIAL_STAFF.find((m) => m.id === value)
                    return member ? `${member.name} · ${member.role === "admin" ? "Admin" : "Staff"}` : "Choose your name"
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {INITIAL_STAFF.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name} · {member.role === "admin" ? "Admin" : "Staff"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              Dummy auth for now — this will connect to real accounts once the backend is ready.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        </FieldGroup>

        <Button type="submit" className="w-full" disabled={!staffId}>
          <LogIn data-icon="inline-start" />
          Sign in
        </Button>
      </form>
    </AuthShell>
  )
}
