"use client"

import { useState } from "react"

export function AuthImagePanel() {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <div className="relative hidden shrink-0 overflow-hidden bg-gradient-to-br from-primary/30 via-muted to-background lg:block lg:w-[45%]">
      {!imageFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/front.png"
          alt=""
          onError={() => setImageFailed(true)}
          className="absolute inset-0 size-full object-contain"
        />
      )}

      {imageFailed && (
        <div className="absolute inset-0 flex items-center justify-center px-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="Paradiso" className="w-full max-w-xs object-contain" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/10 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-10">
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          Scheduling, stock, and staffing for artisan tiramisù — all in one place.
        </p>
      </div>
    </div>
  )
}
