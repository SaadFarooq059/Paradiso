/**
 * Hands bytes to the browser as a file.
 *
 * The object URL is revoked on a timer rather than straight after the click:
 * revoking synchronously races the download in some browsers and produces an
 * empty file.
 */
export function downloadBytes(bytes: Uint8Array, filename: string, mime: string): void {
  // Copy into a plain ArrayBuffer — a Uint8Array can be backed by a
  // SharedArrayBuffer, which Blob will not take.
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)

  const url = URL.createObjectURL(new Blob([buffer], { type: mime }))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** "Stock Levels" -> "stock-levels-2026-09-26.xlsx" */
export function exportFilename(title: string, extension: string, now = new Date()): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "export"
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-")
  return `${slug}-${stamp}.${extension}`
}

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
export const PDF_MIME = "application/pdf"
