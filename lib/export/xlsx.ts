import { zipSync, strToU8 } from "fflate"

import { isExportDate } from "./types"
import type { ExportCell, ExportDocument, ExportTable } from "./types"

/**
 * A real .xlsx, written by hand.
 *
 * An .xlsx is a zip of XML parts, and for plain tables that is little enough
 * work to be worth doing directly: the npm `xlsx` package has been unmaintained
 * on the registry for years, and exceljs drags a Node-shaped dependency tree
 * into the browser bundle. fflate does the zipping and nothing else.
 *
 * Numbers are written as numbers (`<v>`), not text, so totals and averages work
 * in the spreadsheet. Strings go inline rather than through a sharedStrings
 * table — marginally larger, and it removes a whole part and its index.
 */

const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
const CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
const SHEET_CT =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"

/** XML text escaping, plus stripping control characters XML forbids outright. */
function xml(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/** 0 -> A, 25 -> Z, 26 -> AA. */
function columnLetter(index: number): string {
  let n = index + 1
  let out = ""
  while (n > 0) {
    const remainder = (n - 1) % 26
    out = String.fromCharCode(65 + remainder) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

/**
 * Excel refuses []:*?/\ in a tab name, caps it at 31 characters, and will not
 * open a workbook with two tabs of the same name — so collisions get a suffix
 * rather than silently producing a file that cannot be opened.
 */
function sheetNames(tables: ExportTable[]): string[] {
  const used = new Set<string>()
  return tables.map((table, index) => {
    const base = (table.name || `Sheet ${index + 1}`).replace(/[\\/?*[\]:]/g, "-").slice(0, 31)
    let name = base || `Sheet ${index + 1}`
    let suffix = 2
    while (used.has(name.toLowerCase())) {
      const tail = ` (${suffix++})`
      name = base.slice(0, 31 - tail.length) + tail
    }
    used.add(name.toLowerCase())
    return name
  })
}

/**
 * Excel counts days from 1899-12-30. Built from the local Y/M/D rather than the
 * epoch millisecond count so a UK summer-time date does not land a day early.
 */
function excelSerial(date: Date): number {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.round((utc - Date.UTC(1899, 11, 30)) / 86_400_000)
}

function cellXml(cell: ExportCell, ref: string, styleId: number): string {
  const style = styleId ? ` s="${styleId}"` : ""
  if (cell === null || cell === undefined || cell === "") return `<c r="${ref}"${style}/>`
  if (isExportDate(cell)) {
    // Style 3 carries the dd/mm/yyyy number format.
    return `<c r="${ref}" s="3"><v>${excelSerial(cell.date)}</v></c>`
  }
  if (typeof cell === "number" && Number.isFinite(cell)) {
    return `<c r="${ref}"${style}><v>${cell}</v></c>`
  }
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xml(String(cell))}</t></is></c>`
}

function sheetXml(table: ExportTable): string {
  const rows: string[] = []
  let rowIndex = 1

  const pushRow = (cells: ExportCell[], styleId: number) => {
    const xmlCells = cells
      .map((cell, i) => cellXml(cell, `${columnLetter(i)}${rowIndex}`, styleId))
      .join("")
    rows.push(`<row r="${rowIndex}">${xmlCells}</row>`)
    rowIndex++
  }

  // Style 2 is italic grey: the caption is context, not data, and should not
  // look like the first row of the table.
  if (table.caption) {
    pushRow([table.caption], 2)
    pushRow([], 0)
  }

  pushRow(table.columns.map((column) => column.label), 1)

  if (table.rows.length === 0) {
    if (table.emptyMessage) pushRow([table.emptyMessage], 2)
  } else {
    for (const row of table.rows) pushRow(row, 0)
  }

  const cols = table.columns
    .map((column, i) => `<col min="${i + 1}" max="${i + 1}" width="${column.width ?? 18}" customWidth="1"/>`)
    .join("")

  // freezePane keeps the header visible when the caption has pushed it down.
  const headerRow = table.caption ? 3 : 1
  const pane =
    `<sheetViews><sheetView workbookViewId="0">` +
    `<pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/>` +
    `</sheetView></sheetViews>`

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="${MAIN_NS}">${pane}<cols>${cols}</cols>` +
    `<sheetData>${rows.join("")}</sheetData></worksheet>`
  )
}

/**
 * Excel validates this part strictly: it wants at least two fills (the first
 * `none`, the second `gray125`) and one border, whether or not they are used.
 * cellXfs: 0 plain, 1 bold header, 2 italic grey note.
 */
const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="${MAIN_NS}">` +
  `<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>` +
  `<fonts count="3">` +
  `<font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><sz val="11"/><name val="Calibri"/><b/></font>` +
  `<font><sz val="10"/><name val="Calibri"/><i/><color rgb="FF6B6B6B"/></font>` +
  `</fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill>` +
  `<fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="4">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`

/** Builds the workbook and returns it as bytes. */
export function buildXlsx(document: ExportDocument): Uint8Array {
  const tables = document.tables.length
    ? document.tables
    : [{ name: "Empty", columns: [{ label: "No data" }], rows: [] } satisfies ExportTable]
  const names = sheetNames(tables)

  const sheets = names
    .map((name, i) => `<sheet name="${xml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("")

  const sheetRels = names
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="${REL_NS}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
    )
    .join("")

  const overrides = names
    .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${SHEET_CT}"/>`)
    .join("")

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="${CT_NS}">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        overrides +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        `</Types>`
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="${PKG_REL_NS}">` +
        `<Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><sheets>${sheets}</sheets></workbook>`
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="${PKG_REL_NS}">` +
        sheetRels +
        `<Relationship Id="rId${names.length + 1}" Type="${REL_NS}/styles" Target="styles.xml"/>` +
        `</Relationships>`
    ),
    "xl/styles.xml": strToU8(STYLES_XML),
  }

  tables.forEach((table, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(table))
  })

  return zipSync(files, { level: 6 })
}
