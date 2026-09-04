"use client"

import { format } from "date-fns"
import { AlertTriangle, ChevronRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ProductArt } from "@/components/dashboard/product-art"
import { getStaffColor, INGREDIENT_INFO, STATUS_BADGE_CLASS } from "@/lib/mock-data"
import { formatShortageLabel } from "@/lib/order-engine"
import type { Order, ProductVariant } from "@/lib/types"
import { cn } from "@/lib/utils"

interface OrdersTableProps {
  orders: Order[]
  variantsById: Record<string, ProductVariant>
  onSelectOrder: (orderId: string) => void
}

export function OrdersTable({ orders, variantsById, onSelectOrder }: OrdersTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Orders</CardTitle>
        <CardDescription>Every order placed this session, newest first.</CardDescription>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <AlertTriangle />
            </EmptyMedia>
            <EmptyTitle>No orders yet</EmptyTitle>
            <EmptyDescription>Orders you schedule will show up here.</EmptyDescription>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Collection date</TableHead>
                <TableHead>Assigned staff</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const variant = variantsById[order.productId]
                return (
                  <TableRow
                    key={order.id}
                    onClick={() => onSelectOrder(order.id)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                          <ProductArt productId={order.productId} className="size-7" />
                        </div>
                        <div className="flex flex-col">
                          <span>{variant?.name ?? "Unknown"}</span>
                          {variant?.servings && (
                            <span className="text-xs font-normal text-muted-foreground">
                              {variant.servings}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono tabular-nums">{order.quantity}</TableCell>
                    <TableCell>{format(order.collectionDate, "PPP")}</TableCell>
                    <TableCell>
                      {order.assignedStaff ? (
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold text-white",
                              getStaffColor(order.assignedStaff)
                            )}
                          >
                            {order.assignedStaff.charAt(0)}
                          </span>
                          {order.assignedStaff}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className={STATUS_BADGE_CLASS[order.status]}>
                          {order.status}
                        </Badge>
                        {order.status === "On Hold" && order.shortages.length > 0 && (
                          <span className="text-xs leading-snug text-muted-foreground">
                            {order.shortages
                              .map((shortage) =>
                                formatShortageLabel(
                                  shortage,
                                  INGREDIENT_INFO[shortage.ingredient].label,
                                  INGREDIENT_INFO[shortage.ingredient].unit
                                )
                              )
                              .join(", ")}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
