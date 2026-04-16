'use client'

import { useState, useEffect, useCallback } from 'react'

interface GalleryImage { filename: string; caption: string; order?: number }
interface Props { images: GalleryImage[] }

export default function GalleryCarousel({ images }: Props) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)

  const prev = useCallback(() => setCurrent(i => (i - 1 + images.length) % images.length), [images.length])
  const next = useCallback(() => setCurrent(i => (i + 1) % images.length), [images.length])

  useEffect(() => {
    if (paused || images.length <= 1) return
    const id = setInterval(next, 5000)
    return () => clearInterval(id)
  }, [paused, next, images.length])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next])

  if (images.length === 0) return null

  const img = images[current]

  return (
    <div
      className="gallery-wrap"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <button
        className="gallery-arrow"
        onClick={prev}
        aria-label="Forrige billede"
        style={{ visibility: images.length <= 1 ? 'hidden' : 'visible' }}
      >
        ←
      </button>

      <div className="gallery-img-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={img.filename}
          src={`/gallery/${img.filename}`}
          alt={img.caption}
          className="gallery-img"
        />
        {img.caption && (
          <p className="gallery-caption">{img.caption}</p>
        )}
        {images.length > 1 && (
          <div className="gallery-dots" role="tablist" aria-label="Billednavigation">
            {images.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === current}
                aria-label={`Billede ${i + 1}`}
                className={`gallery-dot${i === current ? ' active' : ''}`}
                onClick={() => setCurrent(i)}
              />
            ))}
          </div>
        )}
      </div>

      <button
        className="gallery-arrow"
        onClick={next}
        aria-label="Næste billede"
        style={{ visibility: images.length <= 1 ? 'hidden' : 'visible' }}
      >
        →
      </button>
    </div>
  )
}
