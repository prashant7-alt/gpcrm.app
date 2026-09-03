import { useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// useFormDraft
// Keeps an in-progress form alive when the user navigates to another page and
// comes back — or reloads the tab. Without this, a form that lives in component
// state is wiped the moment its page unmounts (see the Announcements bug).
//
// Backed by sessionStorage: the draft is scoped to the browser tab and is gone
// once that tab is closed, so it never lingers into a future session and is
// never shared between users.
//
//   const [showAdd, setShowAdd] = useState(() => hasFormDraft('tasks'))
//   const [form, setForm] = useFormDraft('tasks', EMPTY_FORM, showAdd, { omit: ['password'] })
//
// The draft is written while `active` is true and `form` differs from `empty`,
// and deleted the moment `active` turns false (cancel / save) or the form is
// back to `empty`. Keys listed in `omit` are never written to storage and come
// back as their `empty` value — use it for passwords and other secrets.
// ─────────────────────────────────────────────────────────────────────────────

const PREFIX = 'gpcrm:formdraft:'
const storeKey = (k) => PREFIX + k

// Synchronous — safe to call inside a useState initializer.
export function hasFormDraft(k) {
  try { return sessionStorage.getItem(storeKey(k)) != null } catch { return false }
}

// Synchronous read of the saved draft object (or null). Safe in a useState
// initializer — handy when the modal also needs a companion id restored.
export function readFormDraft(k) {
  try { return JSON.parse(sessionStorage.getItem(storeKey(k)) || 'null') } catch { return null }
}

const readDraft = readFormDraft

// Imperative write / clear — for modals that keep their fields in several
// separate useState hooks rather than one form object.
export function saveFormDraft(k, value) {
  try { sessionStorage.setItem(storeKey(k), JSON.stringify(value)) } catch { /* ignore */ }
}
export function clearFormDraft(k) {
  try { sessionStorage.removeItem(storeKey(k)) } catch { /* ignore */ }
}

export function useFormDraft(k, empty, active, { omit = [] } = {}) {
  const omitRef  = useRef(omit);  omitRef.current  = omit
  const emptyRef = useRef(empty); emptyRef.current = empty

  const [form, setForm] = useState(() => {
    const saved = readDraft(k)
    if (!saved || typeof saved !== 'object') return empty
    const merged = { ...empty, ...saved }
    for (const key of omit) merged[key] = empty[key]   // never restore secrets
    return merged
  })

  useEffect(() => {
    const strip = (obj) => {
      if (!omitRef.current.length) return obj
      const copy = { ...obj }
      for (const key of omitRef.current) delete copy[key]
      return copy
    }
    try {
      const bare      = JSON.stringify(strip(form))
      const bareEmpty = JSON.stringify(strip(emptyRef.current))
      if (active && bare !== bareEmpty) {
        sessionStorage.setItem(storeKey(k), bare)
      } else {
        sessionStorage.removeItem(storeKey(k))
      }
    } catch { /* private mode / quota — draft just won't survive navigation */ }
  }, [k, active, form])

  return [form, setForm]
}
