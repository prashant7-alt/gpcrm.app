import { useEffect, useRef } from 'react'

// ── Global "don't refresh right now" hold ────────────────────────────────────
// Any component can pause every auto-refresh on the page (e.g. while a modal or
// an edit form is open) so a background reload can't wipe work in progress.
let holds = 0

export function holdRefresh() {
  holds += 1
  let released = false
  return function release() {
    if (released) return
    released = true
    holds = Math.max(0, holds - 1)
  }
}

export function isRefreshHeld() {
  return holds > 0
}

/**
 * Pause all auto-refresh while `active` is true. Call it from any page that has
 * a modal / edit form open:
 *
 *   useRefreshHold(showAdd || !!editTask)
 */
export function useRefreshHold(active) {
  useEffect(() => {
    if (!active) return
    const release = holdRefresh()
    return release
  }, [active])
}

/**
 * Keeps a page's data fresh WITHOUT a background timer. By default it only
 * re-runs `fn` when the user returns to the tab (window focus / tab becomes
 * visible) — never while they're mid-task — and even then it skips if:
 *   - focus is in an input / textarea / select / contenteditable
 *   - text is selected
 *   - a modal/edit form registered a hold via useRefreshHold()
 *
 * Pass `intervalMs > 0` to also poll on a timer (opt-in, off by default).
 *
 *   useEffect(() => { load() }, [])
 *   useRefetchOnFocus(load)
 *
 * @param {Function} fn          the loader to re-run (usually `load`)
 * @param {number}   intervalMs  optional background poll interval; 0 = disabled
 */
export function useRefetchOnFocus(fn, intervalMs = 0) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    const mountedAt = Date.now()
    let lastRun = 0

    function isBusy() {
      if (document.visibilityState !== 'visible') return true
      if (isRefreshHeld()) return true

      const el = document.activeElement
      if (el) {
        const tag = el.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
        if (el.isContentEditable) return true
      }

      const sel = window.getSelection && window.getSelection()
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed && String(sel).trim()) return true

      return false
    }

    function run() {
      const now = Date.now()
      if (now - mountedAt < 1500) return   // ignore the focus event right after mount
      if (now - lastRun   < 1500) return   // debounce rapid repeats
      if (isBusy()) return
      lastRun = now
      fnRef.current?.()
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') run()
    }

    window.addEventListener('focus', run)
    document.addEventListener('visibilitychange', onVisibility)

    let timer = null
    if (intervalMs > 0) {
      timer = setInterval(() => {
        if (isBusy()) return
        lastRun = Date.now()
        fnRef.current?.()
      }, intervalMs)
    }

    return () => {
      window.removeEventListener('focus', run)
      document.removeEventListener('visibilitychange', onVisibility)
      if (timer) clearInterval(timer)
    }
  }, [intervalMs])
}
