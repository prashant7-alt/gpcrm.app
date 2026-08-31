import { useEffect, useRef } from 'react'

/**
 * Re-runs `fn` when the tab regains focus / becomes visible again, and on a
 * slow background interval. Lets a page that only loads once on mount pick up
 * changes made elsewhere — another browser tab, another staff member, or the
 * student portal — without the user hitting the browser refresh button.
 *
 *   useEffect(() => { load() }, [])
 *   useRefetchOnFocus(load)
 *
 * @param {Function} fn           the loader to re-run (usually `load`)
 * @param {number}   intervalMs   background poll interval; 0 disables it
 */
export function useRefetchOnFocus(fn, intervalMs = 60000) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    const mountedAt = Date.now()
    let lastRun = 0

    function run() {
      const now = Date.now()
      if (now - mountedAt < 1500) return   // ignore the focus event that fires right after mount
      if (now - lastRun   < 1500) return   // debounce rapid repeats
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
        if (document.visibilityState === 'visible') {
          lastRun = Date.now()
          fnRef.current?.()
        }
      }, intervalMs)
    }

    return () => {
      window.removeEventListener('focus', run)
      document.removeEventListener('visibilitychange', onVisibility)
      if (timer) clearInterval(timer)
    }
  }, [intervalMs])
}
