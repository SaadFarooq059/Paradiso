"use client"

import { useEffect, useState } from "react"
import { Lottie } from "lottie-react"

import { cn } from "@/lib/utils"

const FALLBACK_DISMISS_MS = 3500
const FADE_OUT_MS = 300

export function SplashScreen() {
  const [visible, setVisible] = useState(true)
  const [leaving, setLeaving] = useState(false)

  function dismiss() {
    setLeaving(true)
    window.setTimeout(() => setVisible(false), FADE_OUT_MS)
  }

  useEffect(() => {
    // Safety net in case the animation never reports completion (slow load, bad file, etc).
    const timer = window.setTimeout(dismiss, FALLBACK_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background px-8 transition-opacity duration-300",
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      )}
    >
      <div className="size-72 shrink-0 sm:size-96">
        <Lottie
          src="/animation.json"
          loop={false}
          autoplay
          className="size-full"
          subscriptions={{ complete: dismiss, error: dismiss }}
        />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.webp"
        alt="Paradiso"
        className="h-20 w-auto max-w-full object-contain sm:h-24"
      />
    </div>
  )
}
