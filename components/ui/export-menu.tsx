"use client"

import { useState } from "react"
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { downloadBytes, exportFilename, PDF_MIME, XLSX_MIME } from "@/lib/export/download"
import type { ExportDocument } from "@/lib/export/types"
import { cn } from "@/lib/utils"

/**
 * Download-as menu, shared by every screen that exports.
 *
 * `build` is a function rather than a value: assembling the tables means walking
 * every order, and a screen re-renders on each keystroke of its filter box.
 * Nothing is built until someone actually picks a format.
 *
 * Both writers are pulled in with a dynamic import. jsPDF and its canvas
 * dependency are around half a megabyte, and a dashboard that nobody exports
 * from should not pay for them — this keeps them out of the initial bundle and
 * off the critical path, which is the pattern Next documents for on-demand
 * libraries.
 */
export function ExportMenu({
  build,
  label = "Export",
  className,
}: {
  build: () => ExportDocument
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null)

  async function run(format: "xlsx" | "pdf") {
    setBusy(format)
    setOpen(false)
    try {
      const doc = build()
      if (format === "xlsx") {
        const { buildXlsx } = await import("@/lib/export/xlsx")
        downloadBytes(buildXlsx(doc), exportFilename(doc.title, "xlsx"), XLSX_MIME)
      } else {
        const { buildPdf } = await import("@/lib/export/pdf")
        downloadBytes(buildPdf(doc), exportFilename(doc.title, "pdf"), PDF_MIME)
      }
      toast.success(`${doc.title} exported as ${format === "xlsx" ? "Excel" : "PDF"}.`)
    } catch (error) {
      // A failed export must say so. Silently doing nothing reads as a dead
      // button, and the user has no other signal that the file is missing.
      console.error("Export failed", error)
      toast.error("That export could not be generated.", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className={cn("shrink-0", className)} disabled={busy !== null}>
            {busy ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Download data-icon="inline-start" />
            )}
            {busy ? "Preparing…" : label}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-56 gap-1 p-1.5">
        <FormatButton
          icon={<FileSpreadsheet className="size-4 shrink-0" />}
          title="Excel"
          hint=".xlsx spreadsheet"
          onClick={() => run("xlsx")}
        />
        <FormatButton
          icon={<FileText className="size-4 shrink-0" />}
          title="PDF"
          hint="Printable document"
          onClick={() => run("pdf")}
        />
      </PopoverContent>
    </Popover>
  )
}

function FormatButton({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  )
}
