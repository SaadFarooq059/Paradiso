import { cn } from "@/lib/utils"

const CREAM = "#F4E9D6"
const CREAM_TOP = "#FBF4E6"
const SPONGE = "#9C6B3E"
const COCOA = "#4A2E1A"
const BEAN = "#3B2415"
const LEAF = "#5A8A55"

interface Topping {
  top: string
  dust: string
}

interface TiramisuArtProps {
  layers: number
  garnish?: "bean" | "bean-leaf"
  topping: Topping
  className?: string
}

function TiramisuArt({ layers, garnish, topping, className }: TiramisuArtProps) {
  const stripeHeight = 7
  const width = 30
  const top = 58 - layers * stripeHeight
  const stripes = Array.from({ length: layers }, (_, i) => i)
  const dust = Array.from({ length: 8 }, (_, i) => ({
    cx: 32 - width / 2 + 4 + (i % 4) * 7.3,
    cy: top + 2 + Math.floor(i / 4) * 3,
  }))

  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="32" cy="58" rx="27" ry="4.5" className="fill-foreground/10" />
      <ellipse cx="32" cy="56" rx="25" ry="4" className="fill-card stroke-border" strokeWidth="1" />

      {stripes.map((i) => {
        const y = top + i * stripeHeight
        const isSponge = i % 2 === 1
        const isBase = i === stripes.length - 1
        return (
          <rect
            key={i}
            x={32 - width / 2}
            y={y}
            width={width}
            height={stripeHeight}
            rx={isBase ? 2 : 0}
            fill={isSponge ? SPONGE : CREAM}
          />
        )
      })}

      <rect x={32 - width / 2} y={top} width={width} height={5} rx={2.5} fill={topping.top} />

      <g fill={topping.dust} opacity={0.55}>
        {dust.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r={0.8} />
        ))}
      </g>

      {garnish && (
        <ellipse
          cx={42}
          cy={top - 2}
          rx={2.6}
          ry={3.6}
          fill={BEAN}
          transform={`rotate(24 42 ${top - 2})`}
        />
      )}
      {garnish && (
        <line
          x1={42}
          y1={top - 5.4}
          x2={42}
          y2={top + 1.4}
          stroke="#1F1209"
          strokeWidth="0.6"
          transform={`rotate(24 42 ${top - 2})`}
        />
      )}
      {garnish === "bean-leaf" && (
        <path
          d={`M 23 ${top - 1} Q 18.5 ${top - 5} 23 ${top - 8.5} Q 27.5 ${top - 5} 23 ${top - 1} Z`}
          fill={LEAF}
        />
      )}
    </svg>
  )
}

/** Layers and garnish by size, read from the id prefix. */
const SIZES: Record<string, { layers: number; garnish?: "bean" | "bean-leaf" }> = {
  mini: { layers: 2 },
  grande: { layers: 3, garnish: "bean" },
  suprema: { layers: 4, garnish: "bean-leaf" },
}

/**
 * The topping by flavour, read from the id. Vegan and GF Classico are Classico,
 * so they fall through to cocoa like it does.
 */
const TOPPINGS: { match: string; topping: Topping; coffee: boolean }[] = [
  { match: "biscoff", topping: { top: "#EBCB98", dust: "#A0612B" }, coffee: false },
  { match: "pistacchio", topping: { top: "#E3E8C2", dust: "#6E8F3A" }, coffee: false },
  { match: "oreo", topping: { top: "#FFFDF7", dust: "#262220" }, coffee: false },
]
const CLASSICO = { topping: { top: CREAM_TOP, dust: COCOA }, coffee: true }

/**
 * Art for any product, derived from its id rather than listed, so a new flavour
 * or a product staff create still gets a cake instead of an empty tile. An id
 * the rules do not recognise is drawn as a plain three-layer Classico.
 */
export function ProductArt({ productId, className }: { productId: string; className?: string }) {
  const size = SIZES[productId.split("-")[0]] ?? { layers: 3 }
  const flavour = TOPPINGS.find((t) => productId.includes(t.match)) ?? CLASSICO
  return (
    <TiramisuArt
      layers={size.layers}
      // The coffee bean only belongs on the coffee flavours.
      garnish={flavour.coffee ? size.garnish : undefined}
      topping={flavour.topping}
      className={cn(className)}
    />
  )
}
