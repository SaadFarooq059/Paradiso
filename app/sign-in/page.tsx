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
  const { signIn, isConfigured } = useAuth()
  const [staffId, setStaffId] = useState(INITIAL_STAFF[0]?.id ?? "")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    // The password is checked on the server; this component never sees whether
    // it was right beyond the answer that comes back.
    const error = await signIn(staffId, password)
    setIsSubmitting(false)
    if (error) {
      toast.error(error)
      return
    }
    const member = INITIAL_STAFF.find((m) => m.id === staffId)
    toast.success(`Welcome back, ${member?.name ?? "there"}!`)
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
              {isConfigured
                ? "Shared demo password — everyone signs in with the same one and picks who they are."
                : "This deployment has no password configured, so sign-in is disabled."}
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

        <Button type="submit" className="w-full" disabled={!staffId || !password || isSubmitting}>
          <LogIn data-icon="inline-start" />
          Sign in
        </Button>
      </form>
    </AuthShell>
  )
}
