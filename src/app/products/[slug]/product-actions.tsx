'use client'

/**
 * Client component for the "Add to cart" and "Buy now" buttons on the
 * product detail page. Reads/writes the cart in localStorage.
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ShoppingCart, Zap, Check } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { addToCart } from "@/lib/cart"

interface Props {
  product: {
    id: string
    slug: string
    name: string
    priceMinor: number
    imageUrl: string | null
    outOfStock: boolean
  }
}

export function ProductActions({ product }: Props) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  function handleAddToCart() {
    setAdding(true)
    addToCart({
      id: product.id,
      slug: product.slug,
      name: product.name,
      priceMinor: product.priceMinor,
      imageUrl: product.imageUrl,
    })
    setAdding(false)
    setAdded(true)
    toast.success(`Added "${product.name}" to cart`)
    setTimeout(() => setAdded(false), 2000)
  }

  function handleBuyNow() {
    addToCart({
      id: product.id,
      slug: product.slug,
      name: product.name,
      priceMinor: product.priceMinor,
      imageUrl: product.imageUrl,
    })
    router.push("/checkout")
  }

  if (product.outOfStock) {
    return (
      <div className="space-y-2">
        <Button disabled className="w-full h-12">
          Out of stock
        </Button>
        <p className="text-xs text-slate-500 text-center">This product is currently unavailable.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={handleAddToCart}
          disabled={adding}
          variant="outline"
          className="h-12"
        >
          {adding ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : added ? (
            <Check className="h-4 w-4 mr-2 text-emerald-600" />
          ) : (
            <ShoppingCart className="h-4 w-4 mr-2" />
          )}
          {added ? "Added" : "Add to cart"}
        </Button>
        <Button
          onClick={handleBuyNow}
          disabled={adding}
          className="h-12 bg-[#007cdc] hover:bg-[#0068b8]"
        >
          <Zap className="h-4 w-4 mr-2" />
          Buy now
        </Button>
      </div>
    </div>
  )
}
