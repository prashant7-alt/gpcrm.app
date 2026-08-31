// ─────────────────────────────────────────────────────────────────────────────
// announcements.js
// Data helpers for the admin-posted news feed shown on the staff and student
// dashboards. Reads are open to any signed-in user; writes are admin-only
// (enforced by RLS — see `supabase sql code/announcements.sql`).
//
// Every function is defensive: if the table doesn't exist yet (SQL not run) or
// a request fails, reads return [] and writes return { error } instead of
// throwing, so the dashboards never break.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '../supabase'

// audience: 'staff' | 'students'  → returns rows targeted at that group plus
// the ones targeted at everyone ('all'). Pinned first, then newest first.
export async function fetchAnnouncements(audience) {
  try {
    const wanted = audience === 'staff' ? ['all', 'staff'] : ['all', 'students']
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .in('audience', wanted)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('[announcements] fetch failed:', error.message)
      return []
    }
    return data || []
  } catch (err) {
    console.warn('[announcements] fetch threw:', err?.message)
    return []
  }
}

export async function createAnnouncement({ title, body, audience = 'all', pinned = false }) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title: title.trim(),
        body: body.trim(),
        audience,
        pinned,
        created_by: user?.id || null,
      })
      .select()
      .single()
    if (error) return { error: error.message }
    return { data }
  } catch (err) {
    return { error: err?.message || 'Failed to post announcement' }
  }
}

export async function updateAnnouncement(id, { title, body, audience, pinned }) {
  try {
    const patch = {}
    if (title    !== undefined) patch.title    = title.trim()
    if (body     !== undefined) patch.body     = body.trim()
    if (audience !== undefined) patch.audience = audience
    if (pinned   !== undefined) patch.pinned   = pinned

    const { data, error } = await supabase
      .from('announcements')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) return { error: error.message }
    return { data }
  } catch (err) {
    return { error: err?.message || 'Failed to update announcement' }
  }
}

export async function deleteAnnouncement(id) {
  try {
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) return { error: error.message }
    return { ok: true }
  } catch (err) {
    return { error: err?.message || 'Failed to delete announcement' }
  }
}

export function timeAgo(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const secs = Math.max(1, Math.floor((Date.now() - then) / 1000))
  const mins = Math.floor(secs / 60)
  const hrs  = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (secs < 60) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hrs  < 24) return `${hrs}h ago`
  if (days < 7)  return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}
