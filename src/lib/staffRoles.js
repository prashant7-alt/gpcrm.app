// Shared staff role list — used by the Staff page (add/edit) and the
// staff profile modal's role picker. Keep this the single source of
// truth so both stay in sync.
//
// IMPORTANT: only list roles that are fully wired up end-to-end:
//   1. accepted by supabase/functions/create-staff-user (STAFF_ROLES)
//   2. have route access in src/App.jsx
//   3. have a sidebar menu in src/components/Navbar/Navbar.jsx (MENUS)
// A role missing any of these can't actually log in / open pages, so it
// must NOT appear in the picker.
export const ROLES = [
  { label: 'Admin',            value: 'admin',            access: 'Full access to everything' },
  { label: 'Staff',            value: 'staff',            access: 'Dashboard, Applications, Students, Visitors, Appointments, Payments, Documents, Tasks, Chat' },
  { label: 'Counselor',        value: 'counselor',        access: 'Dashboard, Students, Appointments, Tasks, Chat' },
  { label: 'Visa Officer',     value: 'visa_officer',     access: 'Dashboard, Applications, Students, Appointments, Documents, Tasks, Chat' },
  { label: 'Receptionist',     value: 'receptionist',     access: 'Dashboard, Applications, Students, Visitors, Appointments, Payments, Tasks, Chat' },
  { label: 'Finance Officer',  value: 'finance_officer',  access: 'Dashboard, Payments, Reports, Students, Appointments, Tasks, Chat' },
  { label: 'Document Handler', value: 'document_handler', access: 'Dashboard, Appointments, Documents, Tasks, Chat' },
]
