"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import type { DashboardState, SerializedOrder } from "@/lib/server/serialize"
import type { IngredientKey, Order, ProductVariant, RestockEntry, StaffMember } from "@/lib/types"

/** Client-side view of the dashboard: identical to the old useState shape. */
export interface DashboardData {
  variants: ProductVariant[]
  ingredients: { key: IngredientKey; label: string; unit: string }[]
  stock: Record<IngredientKey, number>
  capacity: Record<IngredientKey, number>
  staff: StaffMember[]
  orders: Order[]
  restockLog: RestockEntry[]
}

const EMPTY: DashboardData = {
  variants: [],
  ingredients: [],
  stock: {} as Record<IngredientKey, number>,
  capacity: {} as Record<IngredientKey, number>,
  staff: [],
  orders: [],
  restockLog: [],
}

function reviveOrder(order: SerializedOrder): Order {
  return { ...order, collectionDate: new Date(order.collectionDate) }
}

function revive(state: DashboardState): DashboardData {
  return { ...state, orders: state.orders.map(reviveOrder) }
}

interface MutationResponse {
  state?: DashboardState
  message?: string
  tone?: "success" | "warning" | "error"
  orderId?: string
}

/**
 * Owns all dashboard data. Every mutation posts to an API route and adopts the
 * full state the server returns, so the client never computes a result the
 * database disagrees with — the single source of truth moved from React state to
 * SQLite, but the shape every panel receives is unchanged.
 */
export function useDashboardData() {
  const [data, setData] = useState<DashboardData>(EMPTY)
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/state", { cache: "no-store" })
      if (!response.ok) throw new Error(`Failed to load (${response.status})`)
      setData(revive((await response.json()) as DashboardState))
    } catch {
      toast.error("Couldn't reach the server — data may be out of date.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /** Posts a mutation, applies the returned state, and raises its toast. */
  const mutate = useCallback(
    async (input: string, init?: RequestInit): Promise<string | undefined> => {
      setIsMutating(true)
      try {
        const response = await fetch(input, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          ...init,
        })
        const payload = (await response.json().catch(() => ({}))) as MutationResponse
        if (payload.state) setData(revive(payload.state))
        if (payload.message) {
          const tone = payload.tone ?? (response.ok ? "success" : "error")
          if (tone === "success") toast.success(payload.message)
          else if (tone === "warning") toast.warning(payload.message)
          else toast.error(payload.message)
        } else if (!response.ok) {
          toast.error("Something went wrong.")
        }
        return response.ok ? payload.orderId : undefined
      } catch {
        toast.error("Couldn't reach the server.")
        return undefined
      } finally {
        setIsMutating(false)
      }
    },
    []
  )

  const variantsById = useMemo(
    () => Object.fromEntries(data.variants.map((variant) => [variant.id, variant])),
    [data.variants]
  )

  return { data, variantsById, isLoading, isMutating, refresh, mutate }
}
