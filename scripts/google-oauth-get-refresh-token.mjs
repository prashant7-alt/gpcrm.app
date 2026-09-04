#!/usr/bin/env node
/**
 * google-oauth-get-refresh-token.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time helper to obtain a Google OAuth **refresh token** for the
 * consultancy's Google account, so the `google-drive` Edge Function can talk to
 * Drive without anyone re-authenticating after a restart.
 *
 * You only ever run this locally, once (or again if the token is revoked).
 * Nothing here is committed with real values and no secret is sent anywhere
 * except Google's own token endpoint.
 *
 * ── Prerequisites (Google Cloud Console) ────────────────────────────────────
 *  1. Create / pick a project.
 *  2. APIs & Services → Enable "Google Drive API".
 *  3. OAuth consent screen: User type "External" (or "Internal" for Workspace),
 *     add your own Google account under "Test users" if it stays in "Testing".
 *  4. Credentials → Create credentials → OAuth client ID → type **Desktop app**.
 *     (Desktop clients allow the http://localhost loopback redirect used below.)
 *  5. Copy the Client ID and Client secret.
 *
 * ── Run ────────────────────────────────────────────────────────────────────
 *   GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy node scripts/google-oauth-get-refresh-token.mjs
 *
 *   # or pass flags:
 *   node scripts/google-oauth-get-refresh-token.mjs --id xxx --secret yyy
 *
 *   # broader scope (only if you must point the function at a folder the app
 *   # did NOT create itself, e.g. a pre-existing/shared "Global Pathway CRM"):
 *   node scripts/google-oauth-get-refresh-token.mjs --id xxx --secret yyy --scope drive
 *
 * A browser tab opens, you approve access with the account that should OWN the
 * student folders, and the refresh token is printed. Then set the Supabase
 * function secrets (see the final report / README).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import http from 'node:http'
import { URL, URLSearchParams } from 'node:url'
import { exec } from 'node:child_process'

function arg(name, envName) {
  const i = process.argv.indexOf(`--${name}`)
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1]
  return process.env[envName] || ''
}

const CLIENT_ID = arg('id', 'GOOGLE_CLIENT_ID')
const CLIENT_SECRET = arg('secret', 'GOOGLE_CLIENT_SECRET')
const SCOPE_KEY = (arg('scope', 'GOOGLE_OAUTH_SCOPE') || 'drive.file').replace(/^.*\//, '')
const SCOPE = SCOPE_KEY === 'drive'
  ? 'https://www.googleapis.com/auth/drive'
  : 'https://www.googleapis.com/auth/drive.file'

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing client id / secret.\n' +
    'Pass --id / --secret or set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.')
  process.exit(1)
}

const PORT = 53682
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`

const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: SCOPE,
  access_type: 'offline',
  prompt: 'consent',              // force a refresh_token even on re-auth
  include_granted_scopes: 'true',
})

function open(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`
  exec(cmd, () => {})
}

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/oauth2callback')) { res.writeHead(404); res.end(); return }
  const q = new URL(req.url, REDIRECT_URI).searchParams
  const code = q.get('code')
  const err = q.get('error')

  const done = (msg) => {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(`<html><body style="font-family:system-ui;padding:40px">${msg}</body></html>`)
  }

  if (err) { done(`<h2>Authorisation failed</h2><p>${err}</p>`); console.error('Error:', err); server.close(); process.exit(1) }
  if (!code) { done('<p>No code received.</p>'); return }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })
    const tok = await tokenRes.json()
    if (!tokenRes.ok || !tok.refresh_token) {
      done('<h2>No refresh token returned</h2><p>Revoke the app at myaccount.google.com/permissions and retry.</p>')
      console.error('\nResponse:', tok)
      server.close(); process.exit(1)
    }

    done('<h2>Done ✅</h2><p>Refresh token printed in your terminal. You can close this tab.</p>')
    console.log('\n──────────────────────────────────────────────────────────────')
    console.log('  GOOGLE_REFRESH_TOKEN=' + tok.refresh_token)
    console.log('  (scope: ' + SCOPE + ')')
    console.log('──────────────────────────────────────────────────────────────\n')
    console.log('Next: set the Supabase Edge Function secrets, e.g.\n')
    console.log('  supabase secrets set \\')
    console.log(`    GOOGLE_CLIENT_ID=${CLIENT_ID} \\`)
    console.log('    GOOGLE_CLIENT_SECRET=**** \\')
    console.log(`    GOOGLE_REFRESH_TOKEN=${tok.refresh_token} \\`)
    console.log('    GOOGLE_DRIVE_MAX_UPLOAD_MB=10\n')
    server.close(); process.exit(0)
  } catch (e) {
    done(`<h2>Token exchange failed</h2><p>${e.message}</p>`)
    console.error(e); server.close(); process.exit(1)
  }
})

server.listen(PORT, () => {
  console.log('\nOpening Google consent screen…')
  console.log('If it does not open, paste this into your browser:\n\n' + authUrl + '\n')
  open(authUrl)
})
