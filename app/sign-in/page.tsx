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

export default function SignInPage() {
  const router = useRouter()
  const { signIn, isConfigured } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    // Checked on the server. This component never learns anything about the
    // password beyond the answer that comes back.
    const error = await signIn(email, password)
    setIsSubmitting(false)
    if (error) {
      toast.error(error)
      return
    }
    router.push("/")
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="space-y-7">
        <div className="flex flex-col items-center space-y-1.5 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="Paradiso" className="mb-2 h-14 w-auto object-contain" />
          <h1 className="text-2xl font-semibold text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to Paradiso CRM to keep the ovens running.
          </p>
        </div>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@paradiso.test"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FieldDescription>
              {isConfigured
                ? "Each staff member has their own account. What you can see and do depends on your role."
                : "This deployment has no AUTH_SECRET configured, so sign-in is disabled."}
            </FieldDescription>
          </Field>
        </FieldGroup>

        <Button type="submit" className="w-full" disabled={isSubmitting || !isConfigured}>
          <LogIn data-icon="inline-start" />
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  )
}
