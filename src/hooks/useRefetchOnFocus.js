import { useEffect, useRef } from 'react'

/**
 * Keeps a page's data fresh without the user pressing refresh.
 *
 *   useEffect(() => { load() }, [])
 *   useRefetchOnFocus(load)
 *
 * Re-runs `fn`:
 *   - immediately when the tab regains focus / becomes visible, and
 *   - on a short background interval (default 5s).
 *
 * It deliberately SKIPS a tick while the user is actively working, so a
 * background reload never yanks something out from under them:
 *   - tab not visible
 *   - the user is typing in an input / textarea / select / contenteditable
 *   - the user has text selected (mid drag-select)
 *
 * @param {Function} fn          the loader to re-run (usually `load`)
 * @param {number}   intervalMs  background poll interval; 0 disables it
 */
export function useRefetchOnFocus(fn, intervalMs = 5000) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    const mountedAt = Date.now()
    let lastRun = 0

    function isBusy() {
      if (document.visibilityState !== 'visible') return true

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

    function run(force = false) {
      const now = Date.now()
      if (now - mountedAt < 1500) return   // ignore the focus event right after mount
      if (now - lastRun   < 1500) return   // debounce rapid repeats
      if (!force && isBusy()) return
      lastRun = now
      fnRef.current?.()
    }
    function onFocus() { run(true) }
    function onVisibility() {
      if (document.visibilityState === 'visible') run(true)
    }

    window.addEventListener('focus', onFocus)
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
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      if (timer) clearInterval(timer)
    }
  }, [intervalMs])
}
