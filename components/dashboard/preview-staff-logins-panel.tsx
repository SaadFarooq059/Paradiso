import { ChefHat, Lock, ShieldCheck, Store, UserCog } from "lucide-react"

import { FakeButton, FakeField, PreviewFrame, PreviewNote } from "@/components/dashboard/preview-frame"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const ROLES = [
  {
    id: "admin",
    label: "Admin",
    icon: ShieldCheck,
    blurb: "Everything, including recipes, staff and reports.",
    selected: false,
  },
  {
    id: "manager",
    label: "Manager",
    icon: UserCog,
    blurb: "Orders, calendar and stock. No recipe or staff edits.",
    selected: false,
  },
  {
    id: "kitchen",
    label: "Kitchen",
    icon: ChefHat,
    blurb: "Today's production list only. Nothing else.",
    selected: true,
  },
  {
    id: "shop-floor",
    label: "Shop floor",
    icon: Store,
    blurb: "Take an order, check collection times.",
    selected: false,
  },
]

const TODAYS_MAKES = [
  { product: "Suprema Classico", qty: 2, forTime: "Collection 11:00", who: "Aisha" },
  { product: "Grande Classico", qty: 3, forTime: "Collection 14:30", who: "Tom" },
  { product: "Mini Classico", qty: 6, forTime: "Collection 16:00", who: "Aisha" },
]

export function PreviewStaffLoginsPanel() {
  return (
    <PreviewFrame note="Illustrative only — there is no real sign-in, no accounts and no permissions engine behind this yet.">
      <div className="grid gap-4 @3xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-4 shrink-0 text-muted-foreground" />
              Sign in
            </CardTitle>
            <CardDescription>Each person gets their own login instead of one shared account.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FakeField label="Email" value="kitchen@paradiso.co.uk" />
            <FakeField label="Password" value="••••••••••" />
            <FakeButton>Continue</FakeButton>
            <PreviewNote>
              Today everyone shares one account, so the app cannot tell who did what. Individual logins are what make
              the rest of this screen possible.
            </PreviewNote>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
            <CardDescription>What each person can see once they sign in.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {ROLES.map((role) => {
              const Icon = role.icon
              return (
                <div
                  key={role.id}
                  className={[
                    "flex items-start gap-3 rounded-lg border border-dashed p-3",
                    role.selected
                      ? "border-amber-500/60 bg-amber-500/10"
                      : "border-border bg-card",
                  ].join(" ")}
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">
                      {role.label}
                      {role.selected && (
                        <span className="ml-2 text-[0.7rem] font-normal text-amber-700 dark:text-amber-400">
                          shown below
                        </span>
                      )}
                    </span>
                    <span className="text-xs leading-relaxed text-muted-foreground">{role.blurb}</span>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="size-4 shrink-0 text-muted-foreground" />
            Kitchen view
          </CardTitle>
          <CardDescription>
            The same system, stripped back to one question: what needs making today.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 sm:p-6">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Make today</p>
            <ul className="mt-4 flex flex-col gap-3">
              {TODAYS_MAKES.map((item) => (
                <li
                  key={item.product}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">×{item.qty}</span>
                    <span className="text-base font-medium text-foreground">{item.product}</span>
                  </div>
                  <div className="flex flex-col items-end leading-tight">
                    <span className="text-xs text-muted-foreground">{item.forTime}</span>
                    <span className="text-xs text-muted-foreground">{item.who}</span>
                  </div>
                </li>
              ))}
            </ul>
            <PreviewNote>
              No pricing, no customer details, no navigation — a kitchen screen should be readable across the room with
              flour on your hands.
            </PreviewNote>
          </div>
        </CardContent>
      </Card>
    </PreviewFrame>
  )
}
