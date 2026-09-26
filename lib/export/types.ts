/**
 * One shape, both formats.
 *
 * The three screens that export (Stock Levels, Reports, Production Calendar)
 * each describe what they hold as plain tables, and the xlsx and pdf writers
 * consume that description without knowing which screen produced it. A screen
 * that wants a new export builds an ExportDocument; nothing else changes.
 *
 * Deliberately not a render of the screen. A stacked bar and a proportion ring
 * are ways of reading numbers, not the numbers themselves — what belongs in a
 * spreadsheet is the figures behind them, which is what these tables carry.
 */

/**
 * A date cell. Written as a real Excel date rather than text, because a
 * dd/mm/yyyy string sorts alphabetically — "03/10" above "09/09" — which
 * defeats the main reason to want a spreadsheet at all.
 */
export interface ExportDate {
  date: Date
}

/** Marks a value as a date cell. */
export function asDate(date: Date): ExportDate {
  return { date }
}

export function isExportDate(cell: ExportCell): cell is ExportDate {
  return typeof cell === "object" && cell !== null && "date" in cell
}

/** A number stays a number so Excel can sum it; everything else is text. */
export type ExportCell = string | number | null | ExportDate

export interface ExportColumn {
  label: string
  /** Right-align in the PDF. Numeric cells default to right. */
  align?: "left" | "right"
  /** Column width in characters, for the spreadsheet. */
  width?: number
}

export interface ExportTable {
  /**
   * Worksheet tab name and PDF section heading. Sanitised before use —
   * Excel rejects []:*?/\ and anything over 31 characters.
   */
  name: string
  /** Sits under the heading in the PDF; becomes a note row in the sheet. */
  caption?: string
  columns: ExportColumn[]
  rows: ExportCell[][]
  /** Shown in place of the table when there are no rows. */
  emptyMessage?: string
}

export interface ExportDocument {
  /** Drives the filename and the PDF cover heading. */
  title: string
  /** One line of context under the title — what the figures cover. */
  subtitle?: string
  tables: ExportTable[]
}
