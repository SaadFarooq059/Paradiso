"use client"

import { useState } from "react"
import { Pencil, Plus, Trash2, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getStaffColor } from "@/lib/mock-data"
import { ROLE_LABEL, ROLE_SUMMARY, STAFF_ROLES } from "@/lib/auth/roles"
import type { StaffMember, StaffRole } from "@/lib/types"
import { cn, slugify } from "@/lib/utils"

interface StaffManagementPanelProps {
  staff: StaffMember[]
  currentUserId: string
  onSave: (member: StaffMember, password: string) => void
  onDelete: (id: string) => void
}

type FormState = {
  id: string
  name: string
  role: StaffRole
  email: string
  /** Blank on an edit means "leave the password alone". */
  password: string
}

function toFormState(member: StaffMember | null): FormState {
  if (!member) return { id: "", name: "", role: "ShopFloor", email: "", password: "" }
  return {
    id: member.id,
    name: member.name,
    role: member.role,
    email: member.email ?? "",
    password: "",
  }
}

export function StaffManagementPanel({ staff, currentUserId, onSave, onDelete }: StaffManagementPanelProps) {
  const [editing, setEditing] = useState<FormState | null>(null)

  function startEdit(member: StaffMember | null) {
    setEditing(toFormState(member))
  }

  function handleSave() {
    if (!editing || !editing.name.trim()) return

    let id = editing.id
    let orderCount = 0
    if (id) {
      orderCount = staff.find((m) => m.id === id)?.orderCount ?? 0
    } else {
      const base = slugify(editing.name) || "staff"
      id = base
      let suffix = 2
      while (staff.some((m) => m.id === id)) {
        id = `${base}-${suffix}`
        suffix += 1
      }
    }

    onSave(
      {
        id,
        name: editing.name.trim(),
        role: editing.role,
        orderCount,
        email: editing.email.trim(),
      },
      editing.password
    )
    setEditing(null)
  }

  return (
    <div className="space-y-4">
      {!editing && (
        <Button onClick={() => startEdit(null)}>
          <Plus data-icon="inline-start" />
          Add staff member
        </Button>
      )}

      {editing && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{editing.id ? "Edit staff member" : "New staff member"}</CardTitle>
            <CardDescription>
              Role controls access: Admin can manage staff, recipes, and restock. Staff can schedule and
              track orders.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 @sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="staff-name">Name</FieldLabel>
                  <Input
                    id="staff-name"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="staff-role">Role</FieldLabel>
                  <Select
                    value={editing.role}
                    onValueChange={(value) => setEditing({ ...editing, role: value as StaffRole })}
                  >
                    <SelectTrigger id="staff-role" className="w-full">
                      <SelectValue placeholder="Select a role">
                        {(value: string | null) =>
                          value ? ROLE_LABEL[value as StaffRole] : "Select a role"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABEL[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>{ROLE_SUMMARY[editing.role]}</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="staff-email">Email</FieldLabel>
                  <Input
                    id="staff-email"
                    type="email"
                    autoComplete="off"
                    value={editing.email}
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  />
                  <FieldDescription>What they sign in with. One address per person.</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="staff-password">
                    {editing.id ? "New password" : "Password"}
                  </FieldLabel>
                  <Input
                    id="staff-password"
                    type="password"
                    autoComplete="new-password"
                    value={editing.password}
                    onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                  />
                  <FieldDescription>
                    {editing.id
                      ? "Leave blank to keep the current one. Setting a new password signs them out everywhere."
                      : "At least 8 characters. Stored hashed — nobody, including an admin, can read it back."}
                  </FieldDescription>
                </Field>
              </div>
            </FieldGroup>
          </CardContent>
          <CardFooter className="gap-2">
            <Button onClick={handleSave} disabled={!editing.name.trim()}>
              Save
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)}>
              <X data-icon="inline-start" />
              Cancel
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* The roster uses whatever width there is; the editor above it stays
          narrow, because a form stretched across a wide monitor is worse than
          one that is slightly too small. */}
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))]">
        {staff.map((member) => (
          <Card key={member.id}>
            <CardContent className="flex items-center gap-3 pt-4">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
                  getStaffColor(member.name)
                )}
              >
                {member.name.charAt(0)}
              </span>
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{member.name}</p>
                  {member.id === currentUserId && (
                    <Badge variant="secondary" className="font-normal">
                      You
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={member.role === "Admin" ? "default" : "outline"} className="font-normal">
                    {ROLE_LABEL[member.role]}
                  </Badge>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {member.orderCount} order{member.orderCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => startEdit(member)}>
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => onDelete(member.id)}>
                  <Trash2 />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
