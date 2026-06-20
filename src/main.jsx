// React's StrictMode — a development tool that highlights potential problems.
// It runs certain checks twice in dev mode to catch bugs early.
// Has no effect in production build.
import { StrictMode } from 'react'

// createRoot is the modern React 18 way to mount your app into the HTML page.
// Replaces the old ReactDOM.render() from React 17.
import { createRoot } from 'react-dom/client'

// Your global CSS file — resets margins, sets font-family, box-sizing etc.
// Applied to the whole app because it is imported here at the top level.
import './index.css'

// Your main App component — contains all the routes (login, dashboard, student pages etc.)
import App from './App.jsx'

// document.getElementById('root') finds the <div id="root"></div> in your index.html
// createRoot() tells React to take control of that div
// .render() puts your App component inside it
// StrictMode wraps App to enable extra warnings during development
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)