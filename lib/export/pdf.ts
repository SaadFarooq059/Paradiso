import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

import { formatDateShort } from "@/lib/format-date"

import { isExportDate } from "./types"
import type { ExportCell, ExportDocument, ExportTable } from "./types"

/**
 * The same ExportDocument the spreadsheet writer takes, laid out for print.
 *
 * Deliberately a document rather than a screenshot of the dashboard: the cream
 * background and the chart fills are a screen treatment, and printing them
 * costs ink and readability for nothing. What carries over is the brand maroon
 * on the header rows and the figures themselves.
 */

/** #3F0000 — --primary in globals.css. */
const MAROON: [number, number, number] = [63, 0, 0]
const INK: [number, number, number] = [38, 28, 24]
const MUTED: [number, number, number] = [110, 100, 95]
/** A barely-there cream for banded rows; #FFF6E1 at low strength. */
const BAND: [number, number, number] = [252, 248, 238]

const MARGIN = 14

/** jsPDF's own type does not declare what the autotable plugin attaches. */
type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } }

function cellText(cell: ExportCell): string {
  if (cell === null || cell === undefined) return ""
  if (isExportDate(cell)) return formatDateShort(cell.date)
  return String(cell)
}

function drawTable(doc: jsPDF, table: ExportTable, startY: number): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = startY

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.setTextColor(...MAROON)
  doc.text(table.name, MARGIN, y)
  y += 5

  if (table.caption) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    const lines = doc.splitTextToSize(table.caption, pageWidth - MARGIN * 2) as string[]
    doc.text(lines, MARGIN, y)
    y += lines.length * 4
  }

  y += 2

  if (table.rows.length === 0) {
    doc.setFont("helvetica", "italic")
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.text(table.emptyMessage ?? "No data.", MARGIN, y + 3)
    return y + 12
  }

  autoTable(doc, {
    startY: y,
    head: [table.columns.map((column) => column.label)],
    body: table.rows.map((row) => row.map(cellText)),
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2.5,
      textColor: INK,
      lineColor: [226, 216, 200],
      lineWidth: 0.1,
    },
    headStyles: { fillColor: MAROON, textColor: [255, 246, 225], fontStyle: "bold" },
    alternateRowStyles: { fillColor: BAND },
    columnStyles: Object.fromEntries(
      table.columns.map((column, i) => [i, { halign: column.align ?? "left" }])
    ),
  })

  const finalY = (doc as DocWithTable).lastAutoTable?.finalY
  return (finalY ?? y) + 10
}

/** Renders the document and returns it as bytes. */
export function buildPdf(document: ExportDocument): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  doc.setTextColor(...MAROON)
  doc.text(document.title, MARGIN, 22)

  let y = 30
  if (document.subtitle) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    const lines = doc.splitTextToSize(document.subtitle, pageWidth - MARGIN * 2) as string[]
    doc.text(lines, MARGIN, y)
    y += lines.length * 4.5
  }

  doc.setDrawColor(226, 216, 200)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y, pageWidth - MARGIN, y)
  y += 8

  for (const table of document.tables) {
    // Start a new page rather than orphan a heading in the last few millimetres.
    if (y > pageHeight - 45) {
      doc.addPage()
      y = 22
    }
    y = drawTable(doc, table, y)
  }

  // Page numbers last, once the total is known.
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(`Page ${page} of ${pages}`, pageWidth - MARGIN, pageHeight - 8, { align: "right" })
    doc.text("Paradiso CRM", MARGIN, pageHeight - 8)
  }

  return new Uint8Array(doc.output("arraybuffer"))
}
