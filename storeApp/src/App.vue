<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import ProductCard from './components/ProductCard.vue'
import CheckoutPage from './components/CheckoutPage.vue'
import storeInfo from './data/store-info.json'
const { storeId, slug, ecommerceName, updatedAt, bannerImg, bannerSlogan } = storeInfo
const { primaryColor, secondaryColor, backgroundColor } = storeInfo.branding
const storeLogoModules = import.meta.glob('./assets/**/*.{png,jpg,jpeg,svg,webp}', {
  query: '?url',
  import: 'default'
})
const logoUrl = ref('')
const loadStoreLogo = async () => {
  const configuredLogo = storeInfo.logoUrl
  if (!configuredLogo) return

  const logoLoader = storeLogoModules[configuredLogo]
  logoUrl.value = logoLoader ? await logoLoader() : configuredLogo
}
import productData from './data/products.json'
const products = reactive(productData.map((product) => {
  const step = product.productType === 'weight' ? 0.25 : 1
  const stockLimit = product.stock ?? step
  const orderLimit = product.maxQuantityPerOrder ?? step
  const initialQuantity = product.isSoldOut ? 0 : Math.min(step, stockLimit, orderLimit)

  return { ...product, step, quantity: initialQuantity }
}))
const CART_STORAGE_KEY = 'verduleria-del-patio-cart'

const restoreSavedCart = () => {
  if (typeof window === 'undefined') return { id: '', items: [] }

  try {
    const savedCart = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? 'null')
    if (!savedCart || typeof savedCart.id !== 'string' || !savedCart.id || !Array.isArray(savedCart.items)) {
      return { id: '', items: [] }
    }

    const items = savedCart.items.flatMap((entry) => {
      const product = products.find((item) => item.id === entry.id)
      const quantity = Number(entry.quantity)
      if (!product || !Number.isFinite(quantity) || quantity <= 0) return []

      const limit = Math.min(
        product.stock ?? Number.POSITIVE_INFINITY,
        product.maxQuantityPerOrder ?? Number.POSITIVE_INFINITY
      )
      if (limit < product.step) return []

      return [{ id: product.id, quantity: Math.min(limit, Math.max(product.step, quantity)) }]
    })

    return items.length ? { id: savedCart.id, items } : { id: '', items: [] }
  } catch {
    return { id: '', items: [] }
  }
}

const savedCart = restoreSavedCart()
const categories = computed(() => [
  'Todas',
  ...new Set(products.filter((product) => product.isVisible).map((product) => product.category))
])

const search = ref('')
const selectedCategory = ref('Todas')
const layout = ref('cards')
const cartId = ref(savedCart.id)
const cart = ref(savedCart.items)
const cartOpen = ref(false)
const checkoutOpen = ref(false)
const viewMenuOpen = ref(false)
const cartLoading = ref(false)
const productQty = ref({})
const pendingRemoval = ref(null)
let cartDebounceTimer = null
let cartRequestTimer = null
const viewOptions = [
  { value: 'cards', icon: '▦', label: 'Tarjetas' },
  { value: 'list', icon: '☰', label: 'Lista' }
]

const currentView = computed(
  () => viewOptions.find((option) => option.value === layout.value) ?? viewOptions[0]
)

const filteredProducts = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('es')

  return products.filter((product) => {
    const matchesCategory =
      selectedCategory.value === 'Todas' || product.category === selectedCategory.value
    const matchesSearch =
      !term ||
      product.name.toLocaleLowerCase('es').includes(term) ||
      product.category.toLocaleLowerCase('es').includes(term)

    return product.isVisible && matchesCategory && matchesSearch
  })
})

const cartItems = computed(() =>
  cart.value
    .map((entry) => {
      const product = products.find((item) => item.id === entry.id)
      return product ? { ...product, quantity: entry.quantity } : null
    })
    .filter(Boolean)
)

const persistCart = () => {
  if (typeof window === 'undefined') return

  try {
    if (!cartId.value || cart.value.length === 0) {
      window.localStorage.removeItem(CART_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
      id: cartId.value,
      items: cart.value.map(({ id, quantity }) => ({ id, quantity }))
    }))
  } catch {
    // Storage can be unavailable in private browsing contexts.
  }
}

watch(cart, () => {
  if (cart.value.length === 0) cartId.value = ''
  persistCart()
}, { deep: true })
watch(cartId, persistCart)

const totalItems = computed(() =>
  cartItems.value.reduce((sum, item) =>
    sum + (item.productType === 'weight' ? 1 : item.quantity), 0
  , 0)
)

const subtotal = computed(() =>
  cartItems.value.reduce((sum, item) => sum + item.pricePerType * item.quantity, 0)
)

const getProductLimit = (product) => Math.min(
  product.stock ?? Number.POSITIVE_INFINITY,
  product.maxQuantityPerOrder ?? Number.POSITIVE_INFINITY
)

const isUnavailable = (product) => product.isSoldOut || getProductLimit(product) <= 0

const isProductLimitReached = (product) => {
  return getProductQuantity(product) + product.step > getProductLimit(product)
}

const getCartQuantity = (productId) => {
  const cartEntry = cart.value.find((item) => item.id === productId)
  return cartEntry?.quantity ?? 0
}

const getProductQuantity = (product) => {
  const value = productQty.value[product.id]
  if (value === undefined) {
    const cartQuantity = getCartQuantity(product.id)
    const nextValue = cartQuantity > 0 ? cartQuantity : product.quantity
    productQty.value[product.id] = nextValue
    return nextValue
  }

  return value
}

const formatQuantityLabel = (product) => {
  const quantity = getProductQuantity(product)
  if (product.productType === 'weight') {
    return quantity >= 1
      ? `${Number(quantity.toFixed(2))} kg`
      : `${Math.round(quantity * 1000)} g`
  }

  return `${quantity.toFixed(0)} u`
}

const formatCartQuantity = (quantity, productType) => {
  if (productType === 'weight') {
    return quantity >= 1
      ? `${Number(quantity.toFixed(2))} kg`
      : `${Math.round(quantity * 1000)} g`
  }

  return `${quantity.toFixed(0)} u`
}

const createCartId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16)
    return (character === 'x' ? value : (value & 0x3) | 0x8).toString(16)
  })
}

const simulateServerCartSync = async ({ id, items }) => {
  await new Promise((resolve) => window.setTimeout(resolve, 800))
  return { id, items: items.map((item) => ({ ...item })) }
}

onMounted(async () => {
  void loadStoreLogo()

  if (!cartId.value || cart.value.length === 0) {
    persistCart()
    return
  }

  cartLoading.value = true
  const request = {
    id: cartId.value,
    items: cart.value.map(({ id, quantity }) => ({ id, quantity }))
  }

  try {
    const response = await simulateServerCartSync(request)
    if (response.id === cartId.value) cart.value = response.items
  } finally {
    cartLoading.value = false
    persistCart()
  }
})

const updateProductQty = (product, delta) => {
  if (isUnavailable(product) || cartLoading.value) return

  const current = getProductQuantity(product)
  const limit = getProductLimit(product)
  const next = Math.min(limit, Math.max(product.step, Number((current + delta).toFixed(2))))
  productQty.value[product.id] = next

  const existing = cart.value.find((item) => item.id === product.id)
  if (existing) {
    existing.quantity = next
    queueCartRequest()
  }
}

const queueCartRequest = () => {
  if (cartDebounceTimer) {
    clearTimeout(cartDebounceTimer)
  }

  cartDebounceTimer = setTimeout(() => {
    cartDebounceTimer = null
    simulateCartRequest()
  }, 1000)
}

const simulateCartRequest = () => {
  if (cartDebounceTimer) {
    clearTimeout(cartDebounceTimer)
    cartDebounceTimer = null
  }

  cartLoading.value = true
  cartRequestTimer = setTimeout(() => {
    cartLoading.value = false
    cartRequestTimer = null
  }, 1000)
}

const addToCart = (product) => {
  if (isUnavailable(product) || cartLoading.value) return

  const quantity = getProductQuantity(product)
  const existing = cart.value.find((item) => item.id === product.id)
  const nextQuantity = Math.min(getProductLimit(product), (existing?.quantity ?? 0) + quantity)
  if (nextQuantity <= (existing?.quantity ?? 0)) return

  simulateCartRequest()
  if (!cartId.value) cartId.value = createCartId()

  if (existing) {
    existing.quantity = nextQuantity
    productQty.value[product.id] = nextQuantity
    return
  }

  cart.value.push({ id: product.id, quantity: nextQuantity })
  productQty.value[product.id] = nextQuantity
}

const updateCart = (productId, delta) => {
  if (cartLoading.value) return

  const item = cart.value.find((entry) => entry.id === productId)
  const product = products.find((entry) => entry.id === productId)
  if (!item || !product) return

  const nextQuantity = Number((item.quantity + product.step * delta).toFixed(2))
  if (nextQuantity === item.quantity) return

  queueCartRequest()

  if (nextQuantity <= 0) {
    cart.value = cart.value.filter((entry) => entry.id !== productId)
    productQty.value[productId] = product.quantity
    return
  }

  item.quantity = Math.min(getProductLimit(product), nextQuantity)
  productQty.value[productId] = item.quantity
}

const removeFromCart = (productId) => {
  if (cartLoading.value) return

  const product = products.find((entry) => entry.id === productId)
  if (!product) return

  simulateCartRequest()
  cart.value = cart.value.filter((entry) => entry.id !== productId)
  productQty.value[productId] = product.step
  pendingRemoval.value = null
}

const promptRemoveFromCart = (productId) => {
  const product = products.find((entry) => entry.id === productId)
  if (!product) return

  pendingRemoval.value = product
}

const cancelRemoval = () => {
  pendingRemoval.value = null
}

const toggleCart = () => {
  cartOpen.value = !cartOpen.value
}

const beginCheckout = () => {
  if (cartItems.value.length === 0 || cartLoading.value) return

  cartOpen.value = false
  checkoutOpen.value = true
}

const returnToStore = () => {
  checkoutOpen.value = false
}

const clearCompletedCart = (order) => {
  if (!order || order.cartId !== cartId.value) return

  cart.value = []
  cartId.value = ''
  productQty.value = {}
  persistCart()
}

const filterByCategory = (category) => {
  selectedCategory.value = category
}

const selectView = (value) => {
  layout.value = value
  viewMenuOpen.value = false
}

</script>

<template>
  <head>
    <title>{{ ecommerceName }}</title>
    <meta name="description" :content="`Bienvenido a ${ecommerceName}, tu tienda en línea de confianza.`">
    <meta name="keywords" content="ecommerce, tienda online, compras, productos frescos, frutas, verduras">
    <meta name="author" :content="`${ecommerceName}`">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body>
    <main id="app" :style="{
      '--primary-color': primaryColor,
      '--secondary-color': secondaryColor,
      '--background-color': backgroundColor,
      '--banner-image': `url(${bannerImg})`
    }">
      <CheckoutPage
        v-if="checkoutOpen"
        :items="cartItems"
        :cart-id="cartId"
        :subtotal="subtotal"
        :store-name="ecommerceName"
        @back="returnToStore"
        @complete="clearCompletedCart"
      />
      <template v-else>
      <section id="banner">
        <div class="identity">
          <img v-if="logoUrl" :src="logoUrl" :alt="ecommerceName + ' Logo'" class="logo" />
          <h1>{{ ecommerceName }}</h1>
        </div>
        <h2>{{ bannerSlogan }}</h2>
      </section>
      
      <section id="tools">
        <div class="toolbar">
          <input v-model="search" type="text" placeholder="Buscar productos..." />
          <div class="view-select" aria-label="Elegir tipo de vista">
            <span class="view-label">Vista</span>
            <div class="view-options" role="tablist" aria-label="Opciones de vista">
              <button
                v-for="option in viewOptions"
                :key="option.value"
                type="button"
                :class="{ active: layout === option.value }"
                :title="option.label"
                @click="selectView(option.value)"
              >
                <span class="view-icon">{{ option.icon }}</span>
                <span>{{ option.label }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="categories">
          <h3>Categorías</h3>
          <ul>
            <li
              v-for="category in categories"
              :key="category"
              @click="filterByCategory(category)"
              :class="{ selected: selectedCategory === category }"
            >
              {{ category }}
            </li>
          </ul>
        </div>
      </section>
  
      <section id="products" :class="layout === 'list' ? 'products-list' : 'products-grid'">
        <div v-if="filteredProducts.length === 0" class="empty-state">No se encontraron productos.</div>
        <ProductCard
          v-for="product in filteredProducts"
          :key="product.id"
          :product="product"
          :layout="layout"
          :quantity-label="formatQuantityLabel(product)"
          :subtotal="product.pricePerType * getProductQuantity(product)"
          :busy="cartLoading"
          :in-cart="Boolean(cart.find((item) => item.id === product.id))"
          :decrease-removes-item="getCartQuantity(product.id) > 0 && getCartQuantity(product.id) <= product.step"
          :unavailable="isUnavailable(product)"
          :decrease-disabled="getProductQuantity(product) <= product.step && !getCartQuantity(product.id)"
          :increase-disabled="isProductLimitReached(product) || cartLoading"
          @change-quantity="updateProductQty(product, $event)"
          @add-to-cart="addToCart(product)"
          @remove-from-cart="promptRemoveFromCart(product.id)"
        />
      </section>

      <div v-if="pendingRemoval" class="confirm-modal" @click.self="cancelRemoval">
        <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title">
          <h3 id="confirm-delete-title">Eliminar producto</h3>
          <p>¿Deseas quitar <strong>{{ pendingRemoval.name }}</strong> del carrito?</p>
          <div class="confirm-actions">
            <button type="button" class="cancel-btn" @click="cancelRemoval">Cancelar</button>
            <button type="button" class="confirm-btn" @click="removeFromCart(pendingRemoval.id)">Eliminar</button>
          </div>
        </div>
      </div>

      <button
        type="button"
        class="cart-fab"
        :class="{ open: cartOpen }"
        @click="toggleCart"
        :disabled="cartLoading"
        :aria-label="cartLoading ? 'Procesando carrito' : 'Abrir carrito'"
        :aria-busy="cartLoading"
        title="Carrito"
      >
        <svg class="cart-fab-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 4h2l2.3 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H6" />
          <circle cx="10" cy="20" r="1.2" />
          <circle cx="18" cy="20" r="1.2" />
        </svg>
        <span class="cart-fab-badge">{{ totalItems }}</span>
      </button>

      <div v-if="cartOpen" class="cart-backdrop" @click="toggleCart"></div>

      <aside class="cart-panel" :class="{ open: cartOpen }" @click.stop>
        <div class="cart-header">
          <div>
            <p class="cart-eyebrow">Mi compra</p>
            <h3>Carrito</h3>
          </div>
          <button type="button" class="close-cart" @click="toggleCart">✕</button>
        </div>

        <div v-if="cartItems.length === 0" class="cart-empty">
          Tu carrito está vacío.
        </div>

        <div v-else class="cart-items">
          <article v-for="item in cartItems" :key="item.id" class="cart-item">
            <div class="cart-item-body">
              <div class="cart-item-header">
                <h4>{{ item.name }}</h4>
                <strong>${{ (item.pricePerType * item.quantity).toFixed(2) }}</strong>
              </div>
              <div class="cart-item-controls">
                <button
                  type="button"
                  :disabled="cartLoading"
                  :aria-label="item.quantity <= item.step ? `Eliminar ${item.name} del carrito` : `Disminuir cantidad de ${item.name}`"
                  @click="item.quantity <= item.step ? promptRemoveFromCart(item.id) : updateCart(item.id, -1)"
                >
                  <svg v-if="item.quantity <= item.step" class="delete-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 3h10l1 2h4v2H2V5h4l1-2Zm-1 6h12l-1 12H7L6 9Z" />
                  </svg>
                  <template v-else>−</template>
                </button>
                <span>{{ formatCartQuantity(item.quantity, item.productType) }}</span>
                <button type="button" :disabled="cartLoading || item.quantity + item.step > getProductLimit(item)" @click="updateCart(item.id, 1)">+</button>
              </div>
            </div>
          </article>
        </div>

        <div class="cart-footer">
          <div class="cart-total">
            <span>Total</span>
            <strong>${{ subtotal.toFixed(2) }}</strong>
          </div>
          <button type="button" class="checkout-btn" :disabled="cartLoading || cartItems.length === 0" @click="beginCheckout">
            {{ cartLoading ? 'Procesando...' : 'Finalizar compra' }}
          </button>
        </div>
      </aside>
      </template>
    </main>
  </body>
</template>

<style scoped>
  body {
    background-color: var(--background-color);
  }
  :global(html) {
    background: var(--background-color);
  }

  #app {
    --content-max-width: 1200px;
    --content-gutter: 5vw;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1rem 0 2rem;
    background: var(--background-color);
    color: #1d1d1d;
  }
  section {
    padding: 20px;
    width: clamp(300px, 90vw, var(--content-max-width));
    margin: 0 auto;
    border-radius: 20px;
  }
  #banner {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    background-image: 
      linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)),
      var(--banner-image);
    background-repeat: no-repeat;
    background-size: cover;
    background-position: center;
    background-attachment: fixed;
    min-height: 25vh;
    color: white;
  }
  .identity {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .logo {
    display: flex;
    width: 100px;
    height: 100px;
    padding: 10px;
    object-fit: contain;
    background-color: #fff;
    border: 3px solid var(--primary-color);
    border-radius: 50%;
  }
  #tools {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.2rem 1.4rem;
    border: 3px solid var(--primary-color);
    background: rgba(255, 255, 255, 0.8);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08);
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }

  #tools input {
    width: min(100%, 420px);
    padding: 0.9rem 1rem;
    border-radius: 12px;
    border: 2px solid var(--secondary-color);
    background: #fff;
    font-size: 1rem;
    outline: none;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
    transition: border-color 0.2s ease, box-shadow 0.2s ease
  }

  #tools input:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.04), 0 8px 20px rgba(0, 0, 0, 0.08);
  }

  .view-select {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.45rem 0.6rem;
    font-weight: 700;
    color: var(--primary-color);
  }

  .view-label {
    font-size: 0.9rem;
    letter-spacing: 0.02em;
  }

  .view-options {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.15rem;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.03);
  }

  .view-options button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: none;
    background: transparent;
    color: #4a4a4a;
    border-radius: 10px;
    padding: 0.55rem 0.8rem;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .view-options button:hover {
    background: rgba(0, 0, 0, 0.04);
  }

  .view-options button.active {
    background: var(--primary-color);
    color: white;
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.12);
  }

  .view-icon {
    font-size: 1rem;
    line-height: 1;
  }

  .categories {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.7rem;
  }

  .categories h3 {
    margin: 0;
    color: #222;
  }

  .categories ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.7rem;
  }

  .categories li {
    cursor: pointer;
    padding: 0.6rem 1rem;
    border-radius: 999px;
    background-color: var(--secondary-color);
    color: #222;
    font-weight: 600;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease, filter 0.2s ease;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
  }

  .categories li:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.14);
    filter: brightness(1.02);
  }

  .categories li.selected {
    background-color: var(--primary-color);
    color: white;
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
  }

  #products {
    width: clamp(300px, 90vw, var(--content-max-width));
    display: grid;
    gap: 1rem;
    padding: 0;
  }

  #products.products-grid {
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  }

  #products.products-list {
    grid-template-columns: 1fr;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.8);
    color: #555;
    font-weight: 600;
  }

  .cart-fab {
    position: fixed;
    right: calc(max(var(--content-gutter), (100vw - var(--content-max-width)) / 2) + 0.5rem);
    top: 1.5rem;
    z-index: 30;
    display: grid;
    align-items: center;
    justify-items: center;
    width: 4.25rem;
    height: 4.25rem;
    padding: 0;
    border: none;
    border-radius: 1.35rem;
    background: var(--secondary-color);
    color: #111;
    box-shadow: 0 18px 30px rgba(0, 0, 0, 0.18);
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  }

  .cart-fab:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 22px 34px rgba(0, 0, 0, 0.2);
  }

  .cart-fab:disabled {
    opacity: 0.7;
    cursor: wait;
  }

  .cart-fab-badge {
    position: absolute;
    top: -0.4rem;
    right: -0.4rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.65rem;
    height: 1.65rem;
    padding: 0 0.4rem;
    border-radius: 999px;
    background: var(--primary-color);
    color: #fff;
    font-size: 1rem;
    font-weight: 700;
    line-height: 1;
  }

  .cart-fab-icon {
    width: 2.25rem;
    height: 2.25rem;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .cart-backdrop {
    position: fixed;
    inset: 0;
    z-index: 25;
    background: rgba(15, 23, 42, 0.4);
    backdrop-filter: blur(2px);
  }

  .cart-panel {
    position: fixed;
    top: 0;
    right: 0;
    z-index: 40;
    width: min(90vw, 420px);
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.98);
    box-shadow: -20px 0 45px rgba(15, 23, 42, 0.18);
    transform: translateX(110%);
    transition: transform 0.28s ease;
    padding: 1.1rem 1rem 1rem;
  }

  .cart-panel.open {
    transform: translateX(0);
  }

  .cart-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  }

  .cart-eyebrow {
    margin: 0 0 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.7rem;
    color: #6b7280;
  }

  .cart-header h3 {
    margin: 0;
    font-size: 1.5rem;
    color: #111827;
  }

  .close-cart {
    width: 2.1rem;
    height: 2.1rem;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.05);
    color: #374151;
    font-size: 1.1rem;
    cursor: pointer;
  }

  .cart-empty {
    display: grid;
    place-items: center;
    flex: 1;
    color: #4b5563;
    font-weight: 600;
  }

  .cart-items {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    overflow: auto;
    padding: 1rem 0;
  }

  .cart-item {
    display: flex;
    padding: 0.7rem;
    border-radius: 14px;
    border: 1px solid rgba(0, 0, 0, 0.06);
    background: rgba(248, 249, 250, 0.8);
  }

  .cart-item-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 0.7rem;
  }

  .cart-item-header {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
    align-items: start;
  }

  .cart-item-header h4 {
    margin: 0;
    font-size: 0.95rem;
    color: #111827;
  }

  .cart-item-header strong {
    font-size: 0.85rem;
    color: #111827;
  }

  .cart-item-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    max-width: 150px;
    padding: 0.4rem 0.55rem;
    border-radius: 999px;
    background: white;
    border: 1px solid rgba(0, 0, 0, 0.06);
  }

  .cart-item-controls button {
    width: 1.8rem;
    height: 1.8rem;
    border: none;
    border-radius: 50%;
    background: var(--primary-color);
    color: white;
    font-size: 1.1rem;
    cursor: pointer;
  }

  .delete-icon {
    width: 1rem;
    height: 1rem;
    fill: currentColor;
    vertical-align: middle;
  }

  .confirm-modal {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    background: rgba(15, 23, 42, 0.45);
    padding: 1rem;
  }

  .confirm-dialog {
    width: min(92vw, 360px);
    background: white;
    border-radius: 18px;
    padding: 1.2rem 1rem 1rem;
    box-shadow: 0 26px 60px rgba(15, 23, 42, 0.22);
  }

  .confirm-dialog h3 {
    margin: 0 0 0.6rem;
  }

  .confirm-dialog p {
    margin: 0 0 1rem;
    color: #374151;
    line-height: 1.5;
  }

  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .cancel-btn,
  .confirm-btn {
    border: none;
    border-radius: 10px;
    padding: 0.7rem 1rem;
    font-weight: 700;
    cursor: pointer;
  }

  .cancel-btn {
    background: rgba(15, 23, 42, 0.06);
    color: #111827;
  }

  .confirm-btn {
    background: #dc2626;
    color: white;
  }

  .cart-item-controls button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .cart-footer {
    margin-top: auto;
    padding-top: 1rem;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
  }

  .cart-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.8rem;
    font-size: 1.1rem;
    color: #111827;
  }

  .checkout-btn {
    width: 100%;
    border: none;
    border-radius: 12px;
    background: var(--primary-color);
    color: white;
    padding: 0.9rem 1rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 12px 26px rgba(0, 0, 0, 0.12);
  }

  .checkout-btn:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  @media (max-width: 768px) {
    .cart-fab {
      right: 1rem;
      bottom: 1rem;
      top: auto;
    }
  }
</style>
