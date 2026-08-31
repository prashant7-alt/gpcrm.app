// ── CSV export ──────────────────────────────────────────────────────────
// Turns an array of row objects into a .csv file the browser downloads.
// Opens cleanly in Excel / Google Sheets (UTF-8 BOM + CRLF line endings).
//
//   exportRows('payments', rows, [
//     { header: 'Student', value: r => r.student_name },
//     { header: 'Amount',  value: r => r.amount },
//     { header: 'Status',  value: r => r.status },
//   ])

// Quote a value only when it needs it (comma, quote, newline, leading/trailing space).
function csvCell(val) {
  if (val == null) return ''
  let s = String(val)
  if (val instanceof Date && !Number.isNaN(val.getTime())) s = val.toISOString().slice(0, 10)
  if (/[",\r\n]/.test(s) || s !== s.trim()) {
    s = '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')

/**
 * @param {string} name      base filename (a date-time stamp + .csv is appended)
 * @param {object[]} rows    data rows
 * @param {{header:string, value:(row)=>any}[]} columns  column definitions
 * @returns {number} how many data rows were written
 */
export function exportRows(name, rows, columns) {
  const list = Array.isArray(rows) ? rows : []
  if (list.length === 0) {
    alert('Nothing to export — the list is empty.')
    return 0
  }

  const headerLine = columns.map(c => csvCell(c.header)).join(',')
  const dataLines = list.map(row =>
    columns.map(c => {
      let v
      try { v = c.value(row) } catch { v = '' }
      return csvCell(v)
    }).join(','),
  )

  // BOM so Excel reads UTF-8 (Nepali names, ₹, etc.) correctly.
  const csv = '﻿' + [headerLine, ...dataLines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `${name}-${stamp()}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  return list.length
}

// Small helper for date columns — formats to YYYY-MM-DD, blank if missing/invalid.
export function asDate(v) {
  if (!v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}
