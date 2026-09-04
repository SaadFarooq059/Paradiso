"use client"

import { useState } from "react"
import { Pencil, Plus, Trash2, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getStaffColor } from "@/lib/mock-data"
import type { StaffMember, StaffRole } from "@/lib/types"
import { cn, slugify } from "@/lib/utils"

interface StaffManagementPanelProps {
  staff: StaffMember[]
  currentUserId: string
  onSave: (member: StaffMember) => void
  onDelete: (id: string) => void
}

type FormState = {
  id: string
  name: string
  role: StaffRole
}

function toFormState(member: StaffMember | null): FormState {
  if (!member) return { id: "", name: "", role: "staff" }
  return { id: member.id, name: member.name, role: member.role }
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

    onSave({ id, name: editing.name.trim(), role: editing.role, orderCount })
    setEditing(null)
  }

  return (
    <div className="max-w-2xl space-y-4">
      {!editing && (
        <Button onClick={() => startEdit(null)}>
          <Plus data-icon="inline-start" />
          Add staff member
        </Button>
      )}

      {editing && (
        <Card>
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
                        {(value: string | null) => (value === "admin" ? "Admin" : "Staff")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
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

      <div className="grid gap-3 @sm:grid-cols-2">
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
                  <Badge variant={member.role === "admin" ? "default" : "outline"} className="font-normal">
                    {member.role === "admin" ? "Admin" : "Staff"}
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
