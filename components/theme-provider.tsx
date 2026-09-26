"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * Theme switching, class-based.
 *
 * globals.css declares `@custom-variant dark (&:is(.dark *))`, so every `dark:`
 * utility in the app keys off a `.dark` class on <html> rather than the OS
 * setting. next-themes is what puts that class there, and it writes it from an
 * inline script before paint so the first frame is already the right theme
 * instead of flashing cream and then going dark.
 *
 * The default is `light`, not `system`, on purpose. The brand is a light-mode
 * pairing — maroon on cream — and globals.css was explicit that it should be
 * what a visitor sees regardless of their OS setting. A client opening the demo
 * on a dark-mode laptop should still get the look that was signed off.
 *
 * `enableSystem` keeps "System" available in the toggle, so anyone who wants
 * their OS preference followed can pick it and it sticks. Change `defaultTheme`
 * to "system" if you would rather that be the first-run behaviour — it is a
 * one-word change and nothing else depends on it.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      // The sidebar and cards animate on their own; letting next-themes suppress
      // transitions during a switch stops every one of them firing at once.
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
