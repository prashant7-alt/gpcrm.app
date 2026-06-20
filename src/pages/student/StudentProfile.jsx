import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import StudentLayout from './StudentLayout'

// ─────────────────────────────────────────────────────────────────────────────
// Student profile page — shows their own details
// ─────────────────────────────────────────────────────────────────────────────

export default function StudentProfile() {

  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      // pull the freshest profile row from supabase
      // (in case admin updated something since they logged in)
      const { data: row } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profile.id)
        .single()

      setData(row || profile)
    } catch (err) {
      console.log('profile refresh skipped:', err.message)
      setData(profile)
    }
    setLoading(false)
  }

  const initials = (data?.name || profile.name || '?')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  if (loading) {
    return (
      <StudentLayout>
        <p style={{ color: '#6b7280', fontSize: 13 }}>Loading profile...</p>
      </StudentLayout>
    )
  }

  const info = data || profile

  return (
    <StudentLayout>

      <h1 style={{ fontSize: 40, fontWeight: 700, color: '#0c2f7ce3', margin: '0 0 4px' }}>
        Profile
      </h1>
      <p style={{ fontSize: 19, color: '#6b7280', marginBottom: 20 }}>
        Here are your details
      </p>

      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 28,
      }}>

        {/* avatar + name */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          marginBottom: 28,
          paddingBottom: 24,
          borderBottom: '1px solid #e5e7eb',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: '#16a34a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#111827' }}>
              {info.name || '—'}
            </div>
            <div style={{
              display: 'inline-block',
              marginTop: 6,
              padding: '3px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              background: '#dcfce7',
              color: '#15803d',
            }}>
              Student
            </div>
          </div>
        </div>

        {/* details grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
        }}>
          {[
            { label: 'Email',   value: info.email   || '—', icon: '' },
            { label: 'Phone',   value: info.phone || info.phone_no || '—', icon: '' },
            { label: 'Country', value: info.country || '—', icon: '' },
            { label: 'Status',  value: info.status  || 'Active', icon: '' },
          ].map(item => (
            <div key={item.label}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#9ca3af',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 6,
              }}>
                {item.icon} {item.label}
              </div>
              <div style={{ fontSize: 15, color: '#111827', fontWeight: 500 }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

      </div>

      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 14, textAlign: 'center' }}>
        Need to update your details? Contact your counselor.
      </p>

    </StudentLayout>
  )
}