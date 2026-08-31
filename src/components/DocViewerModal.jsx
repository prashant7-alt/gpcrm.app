// ─────────────────────────────────────────────────────────────────────────────
// DocViewerModal.jsx
// Popup viewer for an uploaded student document (image or PDF). Full-screen
// overlay with: zoom in / out / reset (wheel + drag-to-pan for images),
// download, open-in-new-tab, and an optional "Replace file" section.
//
// Props:
//   fileUrl      string   public URL of the file to show            (required)
//   title        string   heading (usually the doc type)
//   onClose      fn()      close the modal                           (required)
//   onReplace    fn(file)  async — upload a replacement; omit to hide the
//                          Replace section. Should resolve once done.
//   replaceNote  string    shown instead of the Replace box (e.g. "Verified —
//                          contact your counsellor to replace")
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  X, ZoomIn, ZoomOut, Maximize2, Download, ExternalLink, Upload, Loader2, FileText,
} from 'lucide-react'
import theme from '../theme'

const IMG_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif']
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

function extOf(url = '') {
  const clean = url.split('?')[0].split('#')[0]
  const dot = clean.lastIndexOf('.')
  return dot === -1 ? '' : clean.slice(dot + 1).toLowerCase()
}

export default function DocViewerModal({ fileUrl, title, onClose, onReplace, replaceNote }) {
  const ext    = extOf(fileUrl)
  const isImg  = IMG_EXT.includes(ext)
  const isPdf  = ext === 'pdf'

  const [zoom, setZoom]       = useState(1)
  const [pos, setPos]         = useState({ x: 0, y: 0 })
  const [dragging, setDrag]   = useState(false)
  const [pickedFile, setPick] = useState(null)
  const [replacing, setRep]   = useState(false)
  const [downloading, setDl]  = useState(false)

  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 })
  const fileInput = useRef(null)

  // reset view whenever the file changes (e.g. after a replace)
  useEffect(() => { setZoom(1); setPos({ x: 0, y: 0 }); setPick(null) }, [fileUrl])

  // Esc to close
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const zoomIn    = () => setZoom(z => clamp(+(z * 1.25).toFixed(3), 0.25, 6))
  const zoomOut   = () => setZoom(z => clamp(+(z * 0.8).toFixed(3),  0.25, 6))
  const resetView = () => { setZoom(1); setPos({ x: 0, y: 0 }) }

  const onWheel = useCallback(e => {
    if (!isImg) return
    e.preventDefault()
    setZoom(z => clamp(+(z * (e.deltaY < 0 ? 1.12 : 0.89)).toFixed(3), 0.25, 6))
  }, [isImg])

  function onMouseDown(e) {
    if (!isImg || zoom <= 1) return
    setDrag(true)
    dragStart.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }
  }
  function onMouseMove(e) {
    if (!dragging) return
    setPos({
      x: dragStart.current.px + (e.clientX - dragStart.current.x),
      y: dragStart.current.py + (e.clientY - dragStart.current.y),
    })
  }
  const stopDrag = () => setDrag(false)

  async function download() {
    setDl(true)
    const name = (fileUrl.split('/').pop() || 'document').split('?')[0]
    try {
      const res  = await fetch(fileUrl)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = decodeURIComponent(name)
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch {
      window.open(fileUrl, '_blank', 'noopener')   // fallback
    } finally {
      setDl(false)
    }
  }

  async function doReplace() {
    if (!pickedFile || !onReplace) return
    setRep(true)
    try {
      await onReplace(pickedFile)
      setPick(null)
    } catch (err) {
      alert('Replace failed: ' + (err?.message || err))
    } finally {
      setRep(false)
    }
  }

  const iconBtn = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 34, padding: '0 12px', borderRadius: 8, border: `1px solid ${theme.border}`,
    background: theme.white, color: theme.textMid, fontSize: 12.5, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  }

  return createPortal(
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      onMouseMove={onMouseMove}
      onMouseUp={stopDrag}
      style={{
        position: 'fixed', inset: 0, zIndex: 4000,
        background: 'rgba(10,15,25,0.78)',
        display: 'flex', flexDirection: 'column',
        padding: 'clamp(8px, 3vw, 32px)',
      }}
    >
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        background: theme.white, borderRadius: '10px 10px 0 0',
        padding: '10px 14px', borderBottom: `1px solid ${theme.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <FileText size={16} style={{ color: theme.primary, flexShrink: 0 }} />
          <span style={{
            fontSize: 14, fontWeight: 700, color: theme.textStrong,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title || 'Document'}
          </span>
          <span style={{ fontSize: 11, color: theme.textMuted, textTransform: 'uppercase', flexShrink: 0 }}>
            {ext || 'file'}
          </span>
        </div>

        {(isImg || isPdf) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button title="Zoom out" onClick={zoomOut} style={{ ...iconBtn, padding: '0 9px' }}><ZoomOut size={15} /></button>
            <span style={{ fontSize: 12, fontWeight: 700, color: theme.textMid, width: 46, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button title="Zoom in" onClick={zoomIn} style={{ ...iconBtn, padding: '0 9px' }}><ZoomIn size={15} /></button>
            <button title="Reset" onClick={resetView} style={{ ...iconBtn, padding: '0 9px' }}><Maximize2 size={14} /></button>
          </div>
        )}

        <button onClick={download} disabled={downloading} style={iconBtn}>
          {downloading ? <Loader2 size={14} className="spin" /> : <Download size={14} />} Download
        </button>
        <a href={fileUrl} target="_blank" rel="noreferrer" style={{ ...iconBtn, textDecoration: 'none' }}>
          <ExternalLink size={14} /> New tab
        </a>
        <button onClick={onClose} style={{ ...iconBtn, borderColor: theme.status.danger.border, color: theme.status.danger.text }}>
          <X size={15} /> Close
        </button>
      </div>

      {/* Stage */}
      <div
        onWheel={onWheel}
        style={{
          flex: 1, minHeight: 0, background: '#1c2230',
          overflow: 'hidden', position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {isImg && (
          <img
            src={fileUrl}
            alt={title || 'document'}
            draggable={false}
            onMouseDown={onMouseDown}
            style={{
              maxWidth: '100%', maxHeight: '100%', userSelect: 'none',
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})`,
              transition: dragging ? 'none' : 'transform 0.12s ease-out',
              cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
            }}
          />
        )}

        {isPdf && (
          <div style={{ width: '100%', height: '100%', overflow: 'auto', background: '#1c2230' }}>
            <div style={{
              width: `${100 / zoom}%`, height: `${100 / zoom}%`,
              transform: `scale(${zoom})`, transformOrigin: 'top left',
            }}>
              <iframe
                title={title || 'PDF'}
                src={`${fileUrl}#toolbar=1&navpanes=0`}
                style={{ width: '100%', height: '100%', border: 'none', background: theme.white }}
              />
            </div>
          </div>
        )}

        {!isImg && !isPdf && (
          <div style={{ textAlign: 'center', color: theme.white, padding: 32 }}>
            <FileText size={44} style={{ opacity: 0.7, marginBottom: 12 }} />
            <div style={{ fontSize: 14, marginBottom: 16 }}>
              This file type can't be previewed here.
            </div>
            <button onClick={download} style={{ ...iconBtn, height: 38 }}>
              <Download size={15} /> Download file
            </button>
          </div>
        )}
      </div>

      {/* Replace section */}
      {(onReplace || replaceNote) && (
        <div style={{
          background: theme.white, borderRadius: '0 0 10px 10px',
          borderTop: `1px solid ${theme.border}`, padding: '12px 14px',
        }}>
          {replaceNote ? (
            <div style={{ fontSize: 12.5, color: theme.status.success.main, fontWeight: 600 }}>
              {replaceNote}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: theme.textStrong }}>Replace file:</span>
              <input
                ref={fileInput}
                type="file"
                accept="image/*,application/pdf"
                style={{ display: 'none' }}
                onChange={e => setPick(e.target.files?.[0] || null)}
              />
              <button onClick={() => fileInput.current?.click()} style={iconBtn}>
                <Upload size={14} /> Choose file
              </button>
              {pickedFile && (
                <span style={{ fontSize: 12, color: theme.textMid, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pickedFile.name}
                </span>
              )}
              <button
                onClick={doReplace}
                disabled={!pickedFile || replacing}
                style={{
                  ...iconBtn, background: theme.primary, borderColor: theme.primary, color: theme.white,
                  opacity: (!pickedFile || replacing) ? 0.55 : 1,
                  cursor: (!pickedFile || replacing) ? 'not-allowed' : 'pointer',
                }}
              >
                {replacing ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                {replacing ? 'Uploading…' : 'Upload replacement'}
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 0.9s linear infinite}`}</style>
    </div>,
    document.body,
  )
}
