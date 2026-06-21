'use client'

import { useId, useRef, useState } from 'react'
import { Upload, User, X, Check, ZoomIn, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AvatarUploadCropProps {
  value: string | null
  onChange: (url: string | null) => void
  placeholder?: React.ReactNode
}

export function AvatarUploadCrop({ value, onChange, placeholder }: AvatarUploadCropProps) {
  const maskId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [displaySize, setDisplaySize] = useState(260)
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 })
  const [minScale, setMinScale] = useState(1)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [offsetSnap, setOffsetSnap] = useState({ x: 0, y: 0 })

  const fileRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cropRef = useRef<HTMLDivElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImageSrc(ev.target?.result as string)
      setNaturalSize({ w: 0, h: 0 })
      setOffset({ x: 0, y: 0 })
      setIsOpen(true)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    // Use getBoundingClientRect for sub-pixel accurate width
    const rect = cropRef.current?.getBoundingClientRect()
    const ds = rect ? Math.round(rect.width) : 260
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget
    const ms = Math.max(ds / w, ds / h)
    setDisplaySize(ds)
    setNaturalSize({ w, h })
    setMinScale(ms)
    setScale(ms)
    setOffset({ x: 0, y: 0 })
  }

  function clamp(ox: number, oy: number, s: number, ds = displaySize) {
    if (naturalSize.w === 0 || ds === 0) return { x: ox, y: oy }
    const hw = Math.max(0, (naturalSize.w * s - ds) / 2)
    const hh = Math.max(0, (naturalSize.h * s - ds) / 2)
    return {
      x: Math.max(-hw, Math.min(hw, ox)),
      y: Math.max(-hh, Math.min(hh, oy)),
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    setOffsetSnap({ ...offset })
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    setOffset(clamp(offsetSnap.x + dx, offsetSnap.y + dy, scale))
  }

  function handlePointerUp() {
    setIsDragging(false)
  }

  function handleScaleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newScale = Number(e.target.value)
    const ratio = scale > 0 ? newScale / scale : 1
    setOffset((prev) => clamp(prev.x * ratio, prev.y * ratio, newScale))
    setScale(newScale)
  }

  function handleConfirm() {
    if (!imageSrc || !canvasRef.current || naturalSize.w === 0 || displaySize === 0) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const OUT = 200
    canvas.width = OUT
    canvas.height = OUT

    const img = new Image()
    img.onload = () => {
      const imgLeft = displaySize / 2 - (naturalSize.w * scale) / 2 + offset.x
      const imgTop = displaySize / 2 - (naturalSize.h * scale) / 2 + offset.y
      ctx.drawImage(
        img,
        -imgLeft / scale,
        -imgTop / scale,
        displaySize / scale,
        displaySize / scale,
        0, 0, OUT, OUT,
      )
      onChange(canvas.toDataURL('image/jpeg', 0.88))
      handleClose()
    }
    img.src = imageSrc
  }

  function handleClose() {
    setIsOpen(false)
    setImageSrc(null)
  }

  const imgX = displaySize / 2 - (naturalSize.w * scale) / 2 + offset.x
  const imgY = displaySize / 2 - (naturalSize.h * scale) / 2 + offset.y

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
      <canvas ref={canvasRef} className="sr-only" />

      {/* Trigger: clickable avatar circle with persistent pencil badge.
          Self-contained — no external margin; spacing is the parent's job.
          A little padding keeps the overflowing badges off neighbouring text. */}
      <div className="relative inline-block p-1">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group relative h-20 w-20 overflow-hidden rounded-full border-2 border-slate-400 bg-slate-100 shadow-sm transition-all hover:border-slate-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
              {placeholder ?? <User className="h-8 w-8" />}
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Upload className="h-5 w-5 text-white" />
          </div>
        </button>

        {/* Pencil edit badge — always visible */}
        <div className="pointer-events-none absolute -bottom-1 -right-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 shadow ring-2 ring-white">
          <Pencil className="h-3 w-3 text-white" />
        </div>

        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-1 -right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Crop modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div className="w-full max-w-[320px] space-y-5 rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Bild zuschneiden</h3>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Crop preview — image moves under fixed circular SVG mask */}
            <div
              ref={cropRef}
              className="relative mx-auto aspect-square w-full max-w-[260px] overflow-hidden rounded-xl bg-slate-200 select-none"
              style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {imageSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageSrc}
                  alt=""
                  draggable={false}
                  onLoad={handleImageLoad}
                  style={
                    naturalSize.w > 0
                      ? {
                          position: 'absolute',
                          left: imgX,
                          top: imgY,
                          width: naturalSize.w * scale,
                          height: naturalSize.h * scale,
                          maxWidth: 'none',
                          maxHeight: 'none',
                          pointerEvents: 'none',
                          userSelect: 'none',
                        }
                      : { display: 'none' }
                  }
                />
              )}

              {/* SVG circular overlay — explicitly centered at 50% 50% to avoid any CSS rounding drift */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="pointer-events-none absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                <defs>
                  <mask id={maskId}>
                    <rect width="100%" height="100%" fill="white" />
                    <circle cx="50%" cy="50%" r="50%" fill="black" />
                  </mask>
                </defs>
                {/* Dark overlay outside the circle */}
                <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask={`url(#${maskId})`} />
                {/* Dashed circle border */}
                <circle
                  cx="50%"
                  cy="50%"
                  r="49.5%"
                  fill="none"
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth="1.5"
                  strokeDasharray="5 3"
                />
              </svg>
            </div>

            {/* Zoom */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ZoomIn className="h-3.5 w-3.5" />
                Zoom
              </div>
              <input
                type="range"
                min={minScale}
                max={minScale * 4}
                step={0.001}
                value={scale}
                onChange={handleScaleChange}
                className="w-full accent-slate-900"
              />
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
                Abbrechen
              </Button>
              <Button
                type="button"
                className="flex-1 bg-slate-900 text-white hover:bg-slate-800"
                onClick={handleConfirm}
                disabled={naturalSize.w === 0}
              >
                <Check className="mr-2 h-4 w-4" />
                Übernehmen
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
