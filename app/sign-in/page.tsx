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
import { DEMO_ACCOUNTS } from "@/lib/auth/demo-accounts"
import { ROLE_LABEL, ROLE_SUMMARY } from "@/lib/auth/roles"
import { cn } from "@/lib/utils"

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

        <DemoAccounts
          onPick={(account) => {
            setEmail(account.email)
            setPassword(account.password)
          }}
        />
      </form>
    </AuthShell>
  )
}

/**
 * The four demo logins, one per role.
 *
 * Published on purpose so the client can switch roles and see the difference —
 * which also means anyone reading this page can sign in as an Admin. Said out
 * loud on the screen rather than left for someone to work out.
 */
function DemoAccounts({ onPick }: { onPick: (account: (typeof DEMO_ACCOUNTS)[number]) => void }) {
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/30 p-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">Demo accounts</span>
        <span className="text-xs text-muted-foreground">
          One per role — pick one to fill the form in. These credentials are public, so this
          deployment is open to anyone with the link.
        </span>
      </div>

      <div className="grid gap-1.5">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            onClick={() => onPick(account)}
            className={cn(
              "flex flex-col gap-0.5 rounded-lg border border-border bg-card px-3 py-2 text-left",
              "transition-colors hover:border-primary/40 hover:bg-muted/60"
            )}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-foreground">
                {ROLE_LABEL[account.role]}
              </span>
              <span className="font-mono text-[0.65rem] text-muted-foreground">
                {account.email} · {account.password}
              </span>
            </span>
            <span className="text-xs leading-snug text-muted-foreground">
              {ROLE_SUMMARY[account.role]}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
