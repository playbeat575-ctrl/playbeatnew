/**
 * Cart helpers — shared between client (localStorage) and server (validation).
 *
 * The cart is stored CLIENT-SIDE in localStorage (no login required to browse
 * and add to cart). At checkout, the server re-validates each item against
 * the DB to compute the real total (never trust client-side prices).
 */

export interface CartItem {
  /** Product id from the DB. */
  productId: string
  /** Product slug (for display). */
  slug: string
  /** Product name (snapshot for display when cart is offline). */
  name: string
  /** Unit price in PKR decimal (snapshot — server re-checks). */
  price: number
  /** Quantity. */
  quantity: number
  /** Image URL (snapshot for display). */
  imageUrl: string | null
}

export const CART_STORAGE_KEY = "playbeat-cart"

/** Read the cart from localStorage (client-side only). */
export function readCartFromStorage(): CartItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x) =>
        x &&
        typeof x.productId === "string" &&
        typeof x.slug === "string" &&
        typeof x.name === "string" &&
        typeof x.price === "number" &&
        typeof x.quantity === "number" &&
        x.quantity > 0,
    )
  } catch {
    return []
  }
}

export function writeCartToStorage(cart: CartItem[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
    // Notify other tabs/components that the cart changed.
    window.dispatchEvent(new Event("playbeat-cart-changed"))
  } catch {
    // ignore quota errors
  }
}

/** Add a product to the cart (or increment quantity if already there). */
export function addToCart(product: {
  id: string
  slug: string
  name: string
  priceMinor: number
  imageUrl: string | null
}, quantity = 1): CartItem[] {
  const cart = readCartFromStorage()
  const existing = cart.find((x) => x.productId === product.id)
  if (existing) {
    existing.quantity += quantity
  } else {
    cart.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.priceMinor / 100,
      imageUrl: product.imageUrl,
      quantity,
    })
  }
  writeCartToStorage(cart)
  return cart
}

/** Set the quantity of a specific product (removes if qty <= 0). */
export function setQuantity(productId: string, quantity: number): CartItem[] {
  let cart = readCartFromStorage()
  if (quantity <= 0) {
    cart = cart.filter((x) => x.productId !== productId)
  } else {
    const item = cart.find((x) => x.productId === productId)
    if (item) item.quantity = Math.min(quantity, 99) // cap at 99 per item
  }
  writeCartToStorage(cart)
  return cart
}

/** Remove a product from the cart. */
export function removeFromCart(productId: string): CartItem[] {
  const cart = readCartFromStorage().filter((x) => x.productId !== productId)
  writeCartToStorage(cart)
  return cart
}

/** Clear the cart. */
export function clearCart(): void {
  writeCartToStorage([])
}

/** Sum the cart total in PKR decimal (snapshot prices — server re-validates). */
export function cartTotalSnapshot(cart: CartItem[]): number {
  return cart.reduce((sum, x) => sum + x.price * x.quantity, 0)
}

/** Count total items in cart. */
export function cartItemCount(cart: CartItem[]): number {
  return cart.reduce((sum, x) => sum + x.quantity, 0)
}
