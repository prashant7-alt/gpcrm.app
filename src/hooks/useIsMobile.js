import { useState, useEffect } from 'react'

// Returns true when viewport width is <= breakpoint (default 768px = phone/tablet).
//
// Uses a matchMedia listener rather than a raw `resize` handler, so it only
// re-renders when the value actually flips — dragging a desktop window no
// longer fires a setState (and a re-render of every component that reads this)
// on every pixel.
export function useIsMobile(breakpoint = 768) {
  const query = `(max-width: ${breakpoint}px)`

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = e => setIsMobile(e.matches)

    // Sync in case the breakpoint prop changed between renders.
    setIsMobile(mql.matches)

    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return isMobile
}
