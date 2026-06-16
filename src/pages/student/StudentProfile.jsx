import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import StudentLayout from './StudentLayout'

export default function StudentProfile() {

  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState('')
  const [form,    setForm]    = useState({
    name: '', phone: '', course: '', country: '',
  })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: p } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profile.id)
      .single()

    if (p) {
      setData(p)
      setForm({
        name:    p.name    || '',
        phone:   p.phone   || '',
        course:  p.course  || '',
        country: p.country || '',
      })
    }
    setLoading(false)
  }

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  async function save() {
    if (!form.name.trim()) return alert('Name is required')
    setSaving(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        name:    form.name.trim(),
        phone:   form.phone.trim()   || null,
        course:  form.course.trim()  || null,
        country: form.country.trim() || null,
      })
      .eq('id', profile.id)

    setSaving(false)

    if (error) {
      setMsg('Error: ' + error.message)
      return
    }

    // update localStorage name
    localStorage.setItem('profile', JSON.stringify({ ...profile, name: form.name.trim() }))
    setMsg('Profile saved!')
    setEditing(false)
    load()
    setTimeout(() => setMsg(''), 3000)
  }

  const initials = data?.name
    ? data.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'S'

  if (loading) return (
    <StudentLayout>
      <p style={{ color: '#6b7280', fontSize: 13 }}>Loading...</p>
    </StudentLayout>
  )

  return (
    <StudentLayout>
      <div style={{ maxWidth: 580 }}>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
          My Profile
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
          Your personal information
        </p>

        {/* success / error message */}
        {msg && (
          <div style={{
            padding: '9px 14px',
            background: msg.startsWith('Error') ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${msg.startsWith('Error') ? '#fca5a5' : '#86efac'}`,
            color: msg.startsWith('Error') ? '#b91c1c' : '#15803d',
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 16,
          }}>
            {msg}
          </div>
        )}

        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 24,
        }}>

          {/* avatar + name */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 24,
            paddingBottom: 20,
            borderBottom: '1px solid #f3f4f6',
          }}>
            <div style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>
                {data?.name || '—'}
              </div>
              {data?.student_id && (
                <div style={{
                  fontSize: 12,
                  color: '#15803d',
                  fontWeight: 600,
                  marginTop: 3,
                }}>
                  🎓 {data.student_id}
                </div>
              )}
            </div>
          </div>

          {/* read mode */}
          {!editing && (
            <div>
              {[
                { label: 'Email',               value: data?.email,      icon: '📧' },
                { label: 'Phone',               value: data?.phone,      icon: '📱' },
                { label: 'Course',              value: data?.course,     icon: '📚' },
                { label: 'Destination Country', value: data?.country,    icon: '🌍' },
                { label: 'Student ID',          value: data?.student_id, icon: '🪪' },
              ].map((row, i, arr) => (
                <div key={row.label} style={{
                  display: 'flex',
                  gap: 14,
                  padding: '12px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none',
                }}>
                  <span style={{ fontSize: 18, width: 24, flexShrink: 0 }}>{row.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {row.label}
                    </div>
                    <div style={{ fontSize: 14, color: row.value ? '#111827' : '#d1d5db', marginTop: 2 }}>
                      {row.value || 'Not set'}
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={() => setEditing(true)}
                style={{
                  marginTop: 20,
                  padding: '9px 18px',
                  background: '#16a34a',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Edit Profile
              </button>
            </div>
          )}

          {/* edit mode */}
          {editing && (
            <div>
              <div style={{
                padding: '9px 12px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 8,
                fontSize: 13,
                color: '#1d4ed8',
                marginBottom: 18,
              }}>
                You can edit name, phone, course and country. Email and Student ID are set by admin.
              </div>

              {[
                { label: 'Full Name',           key: 'name',    placeholder: 'Your full name' },
                { label: 'Phone',               key: 'phone',   placeholder: '98XXXXXXXX' },
                { label: 'Course',              key: 'course',  placeholder: 'e.g. BSc Computer Science' },
                { label: 'Destination Country', key: 'country', placeholder: 'e.g. UK, Australia' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: 5,
                  }}>
                    {f.label}
                  </label>
                  <input
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={e => set(f.key, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: 8,
                      fontSize: 13,
                      color: '#111827',
                      outline: 'none',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                      background: '#fff',
                    }}
                  />
                </div>
              ))}

              {/* email read only */}
              <div style={{ marginBottom: 14 }}>
                <label style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: 5,
                }}>
                  Email (read only)
                </label>
                <input
                  value={data?.email || ''}
                  disabled
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 13,
                    color: '#9ca3af',
                    background: '#f9fafb',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    cursor: 'not-allowed',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button
                  onClick={() => setEditing(false)}
                  style={{
                    padding: '9px 18px',
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 13,
                    color: '#374151',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  style={{
                    padding: '9px 20px',
                    background: saving ? '#9ca3af' : '#16a34a',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#fff',
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </StudentLayout>
  )
}