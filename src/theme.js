// ── Global colour system ────────────────────────────────────────────────
// One place for every colour in the app. Import `theme` for flat tokens
// (theme.primary, theme.textMid, …); import { palette, status } for the
// grouped values.
//
// Palette — professional navy / blue / teal:
//   Primary   Deep Navy          #0B1F33   navbar, sidebar, major headings
//   Secondary Professional Blue  #1E5AA8   buttons, active nav, links
//   Accent    Teal               #159A9C   status dots, icons, highlights
//   Surface   Off White          #F6F8FA   page background
//   Card      White              #FFFFFF   cards, forms, tables
//   Text      Dark Slate         #243447   body text
//   Muted     Slate Grey         #6B7785   secondary text
//   Border    Light Grey         #E2E7EC   inputs, cards, tables
//
// Semantic states — always use these for status, never a raw hex:
//   success  green   paid / confirmed / payment success
//   warning  amber   pending / awaiting action
//   danger   red     failed / rejected / overdue / destructive
//   info     blue    in review / pending verification / neutral-active

const palette = {
  navy:        '#0B1F33',
  navyDark:    '#081726',
  navySoft:    '#13314D',   // hover / raised surface on navy
  navyLine:    '#1C3A57',   // borders on navy surfaces

  blue:        '#1E5AA8',
  blueHover:   '#194B8C',
  blueSoft:    '#E9F1FA',

  teal:        '#159A9C',
  tealHover:   '#127E80',
  tealSoft:    '#E3F4F4',

  white:        '#FFFFFF',
  surface:      '#F6F8FA',
  surfaceAlt:   '#F1F3F5',   // light-grey chips, toggles, inert rows
  card:         '#FFFFFF',
  border:       '#E2E7EC',
  borderStrong: '#CBD3DB',
  inputBorder:  '#D1D5DB',   // form field outlines

  textStrong:      '#111827',   // near-black — strong body / names
  text:            '#243447',
  textMuted:       '#465059',   // secondary text — darkened for readability
  textFaint:       '#5C6772',   // labels / placeholders / timestamps — darkened
  textOnDark:      '#EAF0F6',
  textOnDarkMuted: '#BFCDDB',

  purple:      '#6D4AA8',
  purpleSoft:  '#EAE4F4',
  pink:        '#9D2A63',
  pinkSoft:    '#F7E4EE',
}

// Each state carries: main (solid fill / icon), bg + border + text (soft chip)
const status = {
  success: { main: '#15803D', bg: '#E6F4EA', border: '#BEE3C8', text: '#15803D' },
  warning: { main: '#B45309', bg: '#FBEEDD', border: '#F0D5AE', text: '#92400E' },
  danger:  { main: '#DC2626', bg: '#FCEBEB', border: '#F3C6C6', text: '#B91C1C' },
  info:    { main: '#1E5AA8', bg: '#E9F1FA', border: '#C4D9F0', text: '#1B4E8F' },
  neutral: { main: '#6B7785', bg: '#EEF1F4', border: '#E2E7EC', text: '#586371' },
}

const theme = {
  // grouped
  palette,
  status,

  // surfaces
  white:      palette.white,
  pageBg:     palette.surface,
  surfaceAlt: palette.surfaceAlt,
  cardBg:     palette.card,
  navbarBg:   palette.navy,
  sidebarBg:  palette.navy,

  // borders
  border:       palette.border,
  borderStrong: palette.borderStrong,
  inputBorder:  palette.inputBorder,

  // text
  textStrong:      palette.textStrong, // near-black body / names
  textDark:        palette.navy,        // major headings
  textMid:         palette.text,        // body text
  textLight:       palette.textMuted,   // labels, subtitles
  textMuted:       palette.textFaint,   // placeholder, faint
  textOnDark:      palette.textOnDark,
  textOnDarkMuted: palette.textOnDarkMuted,
  black:           palette.textStrong,  // legacy typo-key callers
  primaryblack:    palette.textStrong,

  // brand
  primary:      palette.blue,
  primaryHover: palette.blueHover,
  primaryLight: palette.blueSoft,
  primaryText:  palette.blue,
  navy:         palette.navy,
  accent:       palette.teal,
  accentHover:  palette.tealHover,
  accentLight:  palette.tealSoft,

  // extra hues (pipeline stages, avatars) — still one place to change
  purple:      palette.purple,
  purpleLight: palette.purpleSoft,
  pink:        palette.pink,
  pinkLight:   palette.pinkSoft,

  // legacy hue aliases — kept so older imports keep resolving
  blue:        palette.blue,
  blueLight:   palette.blueSoft,
  yellow:      status.warning.main,
  yellowLight: status.warning.bg,
  red:         status.danger.main,
  redLight:    status.danger.bg,
  green:       status.success.main,
  greenLight:  status.success.bg,
}

export default theme
export { palette, status }
