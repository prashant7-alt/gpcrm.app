import StudentLayout from './StudentLayout'

export default function StudentVisaStatus() {
  return (
    <StudentLayout>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
        Visa Status
      </h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
        Track your visa application progress
      </p>
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 12, padding: 60, textAlign: 'center', color: '#9ca3af',
      }}>
        Coming soon
      </div>
    </StudentLayout>
  )
}