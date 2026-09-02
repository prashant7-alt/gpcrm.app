import { ChevronLeft, ChevronRight } from 'lucide-react'
import theme from '../theme'

// Compact pager: "21–40 of 137" + Prev / page numbers / Next.
// Renders nothing when everything fits on one page.
export default function Pagination({ page, totalPages, total, from, to, onPage, noun = 'rows' }) {
  if (totalPages <= 1) return null

  const go = (p) => onPage(Math.min(Math.max(1, p), totalPages))

  // Window of page numbers around the current page (max 5).
  const nums = []
  const start = Math.max(1, Math.min(page - 2, totalPages - 4))
  const end   = Math.min(totalPages, start + 4)
  for (let i = start; i <= end; i++) nums.push(i)

  const btn = (active, disabled) => ({
    minWidth: 32, height: 32, padding: '0 8px',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${active ? theme.primary : theme.border}`,
    background: active ? theme.primary : theme.white,
    color: active ? theme.white : disabled ? theme.textMuted : theme.textMid,
    borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  })

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, flexWrap: 'wrap',
      padding: '12px 4px 2px',
    }}>
      <span style={{ fontSize: 12.5, color: theme.textLight }}>
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()} {noun}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button style={btn(false, page === 1)} disabled={page === 1}
          onClick={() => go(page - 1)} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>

        {start > 1 && (
          <>
            <button style={btn(false, false)} onClick={() => go(1)}>1</button>
            {start > 2 && <span style={{ color: theme.textMuted, padding: '0 2px' }}>…</span>}
          </>
        )}

        {nums.map(n => (
          <button key={n} style={btn(n === page, false)} onClick={() => go(n)}>{n}</button>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span style={{ color: theme.textMuted, padding: '0 2px' }}>…</span>}
            <button style={btn(false, false)} onClick={() => go(totalPages)}>{totalPages}</button>
          </>
        )}

        <button style={btn(false, page === totalPages)} disabled={page === totalPages}
          onClick={() => go(page + 1)} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
