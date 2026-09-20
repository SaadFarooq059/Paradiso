import { CalendarDays, Search, ShoppingBag } from "lucide-react"

import { PreviewFrame, PreviewNote } from "@/components/dashboard/preview-frame"

const SIZES = [
  { label: "Mini", serves: "Serves 1", price: "£8.50", selected: false },
  { label: "Grande", serves: "Serves 4–6", price: "£24.00", selected: true },
  { label: "Suprema", serves: "Serves 8–10", price: "£42.00", selected: false },
]

const FLAVOURS = [
  { label: "Classico", selected: true },
  { label: "Pistachio", selected: false },
  { label: "Limoncello", selected: false },
  { label: "Hazelnut", selected: false },
]

/**
 * Deliberately styled away from the internal dashboard — cream ground, serif
 * headings, softer radii — so the demo audience reads it as "the customer's
 * website", not another admin screen.
 */
export function PreviewCustomerWebsitePanel() {
  return (
    <PreviewFrame note="A customer-facing storefront concept. Not connected to the shop, no checkout, no payments.">
      <div className="overflow-hidden rounded-2xl border border-dashed border-border bg-[#faf6f0] text-[#2b2018] dark:bg-[#1c1815] dark:text-[#efe6da]">
        {/* storefront chrome */}
        <div className="flex items-center justify-between border-b border-[#e4d9c9] px-5 py-4 dark:border-[#332b25]">
          <span className="font-serif text-xl font-bold tracking-tight">Paradiso</span>
          <nav className="hidden gap-6 text-sm text-[#6d5c4b] sm:flex dark:text-[#a6968a]">
            <span>Cakes</span>
            <span>Weddings</span>
            <span>Our story</span>
            <span>Visit us</span>
          </nav>
          <div className="flex items-center gap-3 text-[#6d5c4b] dark:text-[#a6968a]">
            <Search className="size-4" />
            <ShoppingBag className="size-4" />
          </div>
        </div>

        <div className="grid gap-6 p-5 sm:p-7 @3xl:grid-cols-2">
          {/* product image stand-in */}
          <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-[#d9c9b4] bg-gradient-to-br from-[#f0e4d2] to-[#e2cfb6] dark:border-[#3b322b] dark:from-[#2a231e] dark:to-[#231d19]">
            <span className="font-serif text-sm text-[#a08a6f] dark:text-[#7b6a5c]">product photography</span>
          </div>

          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-medium tracking-[0.14em] text-[#a08a6f] uppercase">Tiramisù</p>
              <h3 className="mt-1.5 font-serif text-2xl font-bold sm:text-3xl">Grande Classico</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#6d5c4b] dark:text-[#a6968a]">
                Layered for sharing — our most popular size. Made to order the morning of collection.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold tracking-wide uppercase">Size</span>
              <div className="grid grid-cols-3 gap-2">
                {SIZES.map((size) => (
                  <div
                    key={size.label}
                    className={[
                      "flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-center select-none",
                      size.selected
                        ? "border-[#2b2018] bg-white shadow-sm dark:border-[#efe6da] dark:bg-[#2a231e]"
                        : "border-[#ded0bd] bg-transparent dark:border-[#3b322b]",
                    ].join(" ")}
                  >
                    <span className="text-sm font-semibold">{size.label}</span>
                    <span className="text-[0.65rem] text-[#8a7561] dark:text-[#8d7e72]">{size.serves}</span>
                    <span className="font-mono text-xs tabular-nums">{size.price}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold tracking-wide uppercase">Flavour</span>
              <div className="flex flex-wrap gap-2">
                {FLAVOURS.map((flavour) => (
                  <span
                    key={flavour.label}
                    className={[
                      "rounded-full border px-3.5 py-1.5 text-xs font-medium select-none",
                      flavour.selected
                        ? "border-[#2b2018] bg-[#2b2018] text-[#faf6f0] dark:border-[#efe6da] dark:bg-[#efe6da] dark:text-[#1c1815]"
                        : "border-[#ded0bd] text-[#6d5c4b] dark:border-[#3b322b] dark:text-[#a6968a]",
                    ].join(" ")}
                  >
                    {flavour.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold tracking-wide uppercase">Collection day</span>
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-[#ded0bd] px-3 py-2.5 text-sm select-none dark:border-[#3b322b]">
                <CalendarDays className="size-4 shrink-0 text-[#a08a6f]" />
                Saturday 14 June, from 10:00
              </div>
              <span className="text-[0.7rem] text-[#8a7561] dark:text-[#8d7e72]">
                48 hours&apos; notice — days the kitchen is full would grey out automatically.
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-[#e4d9c9] pt-4 dark:border-[#332b25]">
              <span className="font-mono text-xl font-semibold tabular-nums">£24.00</span>
              <span className="rounded-lg bg-[#2b2018]/70 px-5 py-2.5 text-sm font-medium text-[#faf6f0] select-none dark:bg-[#efe6da]/70 dark:text-[#1c1815]">
                Add to basket
              </span>
            </div>
          </div>
        </div>
      </div>

      <PreviewNote>
        The customer picks size, flavour and a collection day themselves. It would land in this dashboard as an ordinary
        order, checked against stock in exactly the same way as one taken over the counter — so nothing changes for the
        kitchen.
      </PreviewNote>
    </PreviewFrame>
  )
}
