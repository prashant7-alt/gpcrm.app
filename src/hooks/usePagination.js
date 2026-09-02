import { useEffect, useMemo, useState } from 'react'

/**
 * Client-side pagination for an already-filtered array.
 *
 *   const { pageItems, page, setPage, totalPages, total, from, to } =
 *     usePagination(filtered, { pageSize: 20, resetKey: search + filter })
 *
 * - `resetKey` — when it changes (search/filter/tab), jump back to page 1.
 * - Page auto-clamps when the list shrinks (e.g. after a delete).
 */
export function usePagination(items, { pageSize = 20, resetKey = '' } = {}) {
  const [page, setPage] = useState(1)

  const list = Array.isArray(items) ? items : []
  const total = list.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => { setPage(1) }, [resetKey])
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return list.slice(start, start + pageSize)
  }, [list, page, pageSize])

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  return { pageItems, page, setPage, totalPages, total, from, to, pageSize }
}
