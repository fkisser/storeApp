<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import ProductCard from './components/ProductCard.vue'
import CheckoutPage from './components/CheckoutPage.vue'
import WelcomePage from './components/WelcomePage.vue'
import storeInfo from './data/store-info.json'
import { requestStoreApi } from './api/store.js'
import { IS_HOME, STORE_SLUG } from './config/store.js'
const isHome = IS_HOME
const storeName = ref('')
const storeNotFound = ref(false)
const storeError = ref('')
const bannerSlogan = ref('')
const branding = reactive({ primaryColor: '', secondaryColor: '', backgroundColor: '' })
const settingsLoading = ref(true)
watch(storeName, (name) => {
  if (typeof document !== 'undefined') document.title = name
}, { immediate: true })
watch(storeNotFound, (notFound) => {
  if (notFound && typeof document !== 'undefined') document.title = 'Tienda no encontrada | 404'
})
watch(storeError, (error) => {
  if (error && typeof document !== 'undefined') document.title = 'Algo salió mal | VitrinApp'
})
if (isHome && typeof document !== 'undefined') document.title = 'VitrinApp | Tiendas locales'
const storeLogoModules = import.meta.glob('./assets/**/*.{png,jpg,jpeg,svg,webp}', {
  query: '?url',
  import: 'default'
})
const logoUrl = ref('')
const logoFailed = ref(false)
const bannerImageUrl = ref('')
const bannerImageFailed = ref(true)
const loadStoreLogo = async (configuredLogo) => {
  logoUrl.value = ''
  logoFailed.value = false
  if (!configuredLogo) return

  const logoLoader = storeLogoModules[configuredLogo]
  logoUrl.value = logoLoader ? await logoLoader() : configuredLogo
}
const loadBannerImage = (configuredImage) => {
  bannerImageUrl.value = ''
  bannerImageFailed.value = true
  if (!configuredImage) return

  const image = new Image()
  image.onload = () => {
    bannerImageUrl.value = configuredImage
    bannerImageFailed.value = false
  }
  image.onerror = () => {
    bannerImageUrl.value = ''
    bannerImageFailed.value = true
  }
  image.src = configuredImage
}
/*
import productData from './data/products.json'
const products = reactive(productData.map((product) => {
  const step = product.productType === 'weight' ? 0.25 : 1
  const stockLimit = product.stock ?? step
  const orderLimit = product.maxQuantityPerOrder ?? step
  const initialQuantity = product.isSoldOut ? 0 : Math.min(step, stockLimit, orderLimit)

  return { ...product, step, quantity: initialQuantity }
}))
*/
const products = reactive([])
const categoryData = ref([])
const productsLoading = ref(true)
const productsLoadingMore = ref(false)
const productsError = ref('')
const productsMoreError = ref('')
const productsOffset = ref(0)
const productsHasMore = ref(true)
const loadMoreSentinel = ref(null)
const PRODUCTS_PAGE_SIZE = 20
let productsObserver = null
let storeRetryTimer = null
const CART_STORAGE_KEY = `vitrinapp-cart-${encodeURIComponent(STORE_SLUG)}`
const cartError = ref('')
const cartMutations = new Map()
let cartSyncPromise = null

watch(loadMoreSentinel, (sentinel) => {
  if (sentinel) productsObserver?.observe(sentinel)
}, { flush: 'post' })

const normalizeApiProduct = (product) => {
  const productType = product.unit?.symbol === 'kg' ? 'weight' : 'unit'
  const step = productType === 'weight' ? 0.25 : 1
  const maxQuantityPerOrder = product.maxQuantityPerOrder == null
    ? null
    : Number(product.maxQuantityPerOrder)
  const imageEntry = product.imageUrls?.[0]
  const image = typeof imageEntry === 'string' ? imageEntry : imageEntry?.url ?? imageEntry?.src ?? ''
  const category = product.category?.name ?? 'Otros'

  return {
    id: product.id,
    name: product.name,
    description: product.description ?? '',
    image,
    imageFallback: category.toLocaleLowerCase('es').includes('pasteler')
      ? 'pastry'
      : category.toLocaleLowerCase('es').includes('accesor')
        ? 'accessory'
        : 'coffee',
    category,
    productType,
    pricePerType: Number(product.pricePerUnit),
    maxQuantityPerOrder,
    isSoldOut: !product.available,
    isVisible: true,
    step,
    quantity: product.available
      ? Math.min(step, maxQuantityPerOrder ?? step)
      : 0
  }
}

const restoreSavedCart = () => {
  if (typeof window === 'undefined') return { token: '', revision: null, items: [] }

  try {
    const savedCart = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? 'null')
    if (!savedCart || typeof savedCart.token !== 'string' || !savedCart.token || !Array.isArray(savedCart.items)) {
      return { token: '', revision: null, items: [] }
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

    return { token: savedCart.token, revision: savedCart.revision ?? null, items }
  } catch {
    return { token: '', revision: null, items: [] }
  }
}

const hasSavedCartItems = () => {
  if (typeof window === 'undefined') return false

  try {
    return JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? 'null')?.items?.length > 0
  } catch {
    return false
  }
}

const scheduleStoreRetry = () => {
  if (storeRetryTimer) clearTimeout(storeRetryTimer)
  storeRetryTimer = setTimeout(() => {
    storeRetryTimer = null
    void retryStore()
  }, 5000)
}

const loadProducts = async ({ append = false } = {}) => {
  if (append) {
    if (productsLoadingMore.value || !productsHasMore.value) return
    productsLoadingMore.value = true
    productsMoreError.value = ''
  } else {
    productsLoading.value = true
    settingsLoading.value = true
    storeNotFound.value = false
    storeError.value = ''
    productsError.value = ''
    productsMoreError.value = ''
    productsOffset.value = 0
    productsHasMore.value = true
  }

  try {
    const fetchJson = async (url) => {
      return requestStoreApi(url)
    }
    const pageOffset = append ? productsOffset.value : 0
    const pageLimit = !append && hasSavedCartItems() ? 100 : PRODUCTS_PAGE_SIZE
    const [settingsResult, productsResult, categoriesResult] = await Promise.allSettled([
      append ? Promise.resolve(null) : fetchJson('/settings'),
      fetchJson(`/products?limit=${pageLimit}&offset=${pageOffset}`),
      append ? Promise.resolve(null) : fetchJson('/categories')
    ])

    if (!append) {
      const failures = [settingsResult, productsResult, categoriesResult]
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason)
      const notFound = failures.find((error) => error?.status === 404)

      if (notFound) {
        storeNotFound.value = true
        scheduleStoreRetry()
        return
      }

      if (failures.length > 0) {
        storeError.value = failures.some((error) => error?.status === 500)
          ? 'Algo salió mal. Inténtalo de nuevo más tarde.'
          : 'No pudimos cargar la tienda. Inténtalo de nuevo más tarde.'
        if (storeRetryTimer) clearTimeout(storeRetryTimer)
        storeRetryTimer = null
        return
      }

      storeNotFound.value = false
      storeError.value = ''
      if (storeRetryTimer) clearTimeout(storeRetryTimer)
      storeRetryTimer = null
    }

    if (!append) {
      const settings = settingsResult.status === 'fulfilled'
        ? settingsResult.value
        : {
            name: storeInfo.ecommerceName,
            description: storeInfo.bannerSlogan,
            theme: {}
          }
      const theme = settings.theme ?? {}
      storeName.value = settings.name ?? storeInfo.ecommerceName
      bannerSlogan.value = settings.description ?? storeInfo.bannerSlogan
      branding.primaryColor = theme.primaryColor ?? ''
      branding.secondaryColor = theme.secondaryColor ?? ''
      branding.backgroundColor = theme.backgroundColor ?? ''
      await loadStoreLogo(theme.logoImageUrl ?? storeInfo.logoUrl)
      loadBannerImage(theme.bannerImageUrl ?? storeInfo.bannerImg)
    }

    if (productsResult.status === 'rejected') throw productsResult.reason
    const payload = productsResult.value
    if (!Array.isArray(payload.products)) throw new Error('Invalid products payload')

    const loadedProducts = payload.products.map(normalizeApiProduct)
    if (append) {
      const knownProductIds = new Set(products.map((product) => product.id))
      products.push(...loadedProducts.filter((product) => !knownProductIds.has(product.id)))
    } else {
      products.splice(0, products.length, ...loadedProducts)
      const categoryPayload = categoriesResult.status === 'fulfilled' ? categoriesResult.value : []
      categoryData.value = Array.isArray(categoryPayload)
        ? categoryPayload
        : Array.isArray(categoryPayload?.categories)
          ? categoryPayload.categories
          : []
      const savedCart = restoreSavedCart()
      cartToken.value = savedCart.token
      cartRevision.value = savedCart.revision
      cart.value = savedCart.items
    }

    productsOffset.value = Number(payload.offset ?? pageOffset) + loadedProducts.length
    const totalProducts = Number(payload.total)
    productsHasMore.value = loadedProducts.length > 0 && (Number.isFinite(totalProducts)
      ? products.length < totalProducts
      : loadedProducts.length >= pageLimit)
  } catch {
    if (append) {
      productsMoreError.value = 'No se pudieron cargar más productos.'
    } else {
      productsError.value = 'No se pudieron cargar los productos. Comprueba la conexión y vuelve a intentarlo.'
    }
  } finally {
    if (append) {
      productsLoadingMore.value = false
    } else {
      productsLoading.value = false
      settingsLoading.value = false
    }
  }
}

const categories = computed(() => {
  const names = categoryData.value.length
    ? categoryData.value.map((category) => category.name).filter(Boolean)
    : products.filter((product) => product.isVisible).map((product) => product.category)
  return ['Todas', ...new Set(names)]
})

const search = ref('')
const selectedCategory = ref('Todas')
const layout = ref('cards')
const cartToken = ref('')
const cartRevision = ref(null)
const cart = ref([])
const cartTotals = reactive({
  subtotalAmount: null,
  discountAmount: null,
  totalAmount: null,
  currency: 'ARS',
  discounts: []
})
const cartOpen = ref(false)
const checkoutOpen = ref(false)
const viewMenuOpen = ref(false)
const cartLoading = ref(false)
const productQty = ref({})
const pendingRemoval = ref(null)
let cartDebounceTimer = null
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
    if (!cartToken.value) {
      window.localStorage.removeItem(CART_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
      token: cartToken.value,
      revision: cartRevision.value,
      items: cart.value.map(({ id, quantity }) => ({ id, quantity }))
    }))
  } catch {
    // Storage can be unavailable in private browsing contexts.
  }
}

watch(cart, persistCart, { deep: true })
watch([cartToken, cartRevision], persistCart)

const totalItems = computed(() =>
  cartItems.value.reduce((sum, item) =>
    sum + (item.productType === 'weight' ? 1 : item.quantity), 0
  , 0)
)

const localSubtotal = computed(() =>
  cartItems.value.reduce((sum, item) => sum + item.pricePerType * item.quantity, 0)
)

const subtotal = computed(() => cartTotals.subtotalAmount ?? localSubtotal.value)
const discountAmount = computed(() => cartTotals.discountAmount ?? 0)
const totalAmount = computed(() => cartTotals.totalAmount ?? Math.max(0, subtotal.value - discountAmount.value))

const formatCartAmount = (amount) => new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: cartTotals.currency || 'ARS'
}).format(Number(amount) || 0)

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

const cartData = (payload) => payload?.cart ?? payload?.data?.cart ?? payload?.data ?? payload ?? {}

const readCartToken = (payload) => {
  const data = cartData(payload)
  return payload?.accessToken ?? payload?.cartToken ?? payload?.token ??
    payload?.data?.accessToken ?? data.accessToken ?? data.cartToken ?? data.token ?? ''
}

const updateCartRevision = (payload) => {
  const data = cartData(payload)
  const revision = payload?.revision ?? payload?.cartRevision ?? data.revision ?? data.cartRevision
  if (revision !== undefined && revision !== null) cartRevision.value = revision
}

const updateCartTotals = (payload) => {
  const data = cartData(payload)
  for (const key of ['subtotalAmount', 'discountAmount', 'totalAmount']) {
    const amount = Number(data[key])
    if (data[key] !== undefined && data[key] !== null && Number.isFinite(amount)) {
      cartTotals[key] = amount
    }
  }
  if (data.currency) cartTotals.currency = data.currency
  if (Array.isArray(data.discounts)) cartTotals.discounts = data.discounts
}

const applyCartSnapshot = (payload) => {
  const data = cartData(payload)
  const token = readCartToken(payload)
  if (token) cartToken.value = token
  updateCartRevision(payload)
  updateCartTotals(payload)

  if (!Array.isArray(data.items)) return
  cart.value = data.items.flatMap((entry) => {
    const id = entry.productId ?? entry.product?.id ?? entry.id
    const quantity = Number(entry.quantity)
    return id != null && Number.isFinite(quantity) && quantity > 0
      ? [{ id, quantity }]
      : []
  })
  for (const item of cart.value) productQty.value[item.id] = item.quantity
}

const ensureCart = async () => {
  if (cartToken.value) return
  const createdCart = await requestStoreApi('/carts', { method: 'POST' })
  cartToken.value = readCartToken(createdCart)
  updateCartRevision(createdCart)
  updateCartTotals(createdCart)
  if (!cartToken.value) throw new Error('La API no devolvió el token del carrito.')
}

const refreshCurrentCart = async () => {
  const currentCart = await requestStoreApi('/carts/current', { cartToken: cartToken.value })
  applyCartSnapshot(currentCart)
}

const initializeCart = async () => {
  if (storeNotFound.value || storeError.value || cartLoading.value) return

  cartLoading.value = true
  cartError.value = ''
  try {
    if (cartToken.value) {
      await refreshCurrentCart()
    } else {
      await ensureCart()
    }
  } catch (error) {
    if (error.status === 404) {
      storeNotFound.value = true
      scheduleStoreRetry()
    } else if (error.status >= 500) {
      storeError.value = 'Algo salió mal. Inténtalo de nuevo más tarde.'
    } else {
      cartError.value = error.message || 'No se pudo crear o recuperar el carrito.'
    }
  } finally {
    cartLoading.value = false
    persistCart()
  }
}

const retryStore = async () => {
  await loadProducts()
  if (!storeNotFound.value && !storeError.value) await initializeCart()
}

const sendCartMutation = async (productId, quantity) => {
  if ((quantity === null || quantity <= 0) && !cartToken.value) return
  await ensureCart()
  if (cartRevision.value === null) await refreshCurrentCart()
  if (cartRevision.value === null) throw new Error('La API no devolvió la revisión del carrito.')

  const removing = quantity === null || quantity <= 0
  const response = await requestStoreApi(`/carts/current/items/${encodeURIComponent(productId)}`, {
    method: removing ? 'DELETE' : 'PUT',
    cartToken: cartToken.value,
    body: removing
      ? { revision: cartRevision.value }
      : { quantity: Number(quantity).toFixed(3), revision: cartRevision.value }
  })
  const previousRevision = cartRevision.value
  if (response) applyCartSnapshot(response)
  if (response == null || cartRevision.value === previousRevision) await refreshCurrentCart()
}

const flushCartRequests = () => {
  if (cartDebounceTimer) {
    clearTimeout(cartDebounceTimer)
    cartDebounceTimer = null
  }
  if (cartSyncPromise) return cartSyncPromise
  if (cartMutations.size === 0) return Promise.resolve()

  cartLoading.value = true
  cartError.value = ''
  cartSyncPromise = (async () => {
    try {
      while (cartMutations.size > 0) {
        const [productId, quantity] = cartMutations.entries().next().value
        cartMutations.delete(productId)
        await sendCartMutation(productId, quantity)
      }
    } catch (error) {
      cartError.value = error.message || 'No se pudo actualizar el carrito.'
      if (cartToken.value) {
        try {
          await refreshCurrentCart()
        } catch {
          // Keep the last locally saved cart visible when recovery is unavailable.
        }
      }
    } finally {
      cartLoading.value = false
      cartSyncPromise = null
      persistCart()
    }
  })()
  return cartSyncPromise
}

const queueCartRequest = (productId, quantity) => {
  cartMutations.set(productId, quantity)
  if (cartDebounceTimer) clearTimeout(cartDebounceTimer)
  cartDebounceTimer = setTimeout(() => void flushCartRequests(), 350)
}

onMounted(async () => {
  if (isHome) return

  if ('IntersectionObserver' in window) {
    productsObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !productsMoreError.value) {
        void loadProducts({ append: true })
      }
    }, { rootMargin: '400px 0px' })
    if (loadMoreSentinel.value) productsObserver.observe(loadMoreSentinel.value)
  }

  await loadProducts()
  if (!storeNotFound.value && !storeError.value) await initializeCart()
})

onBeforeUnmount(() => {
  productsObserver?.disconnect()
  if (storeRetryTimer) clearTimeout(storeRetryTimer)
})

const loadNextProducts = () => loadProducts({ append: true })

const updateProductQty = (product, delta) => {
  if (isUnavailable(product) || cartLoading.value) return

  const current = getProductQuantity(product)
  const limit = getProductLimit(product)
  const next = Math.min(limit, Math.max(product.step, Number((current + delta).toFixed(2))))
  productQty.value[product.id] = next

  const existing = cart.value.find((item) => item.id === product.id)
  if (existing) {
    existing.quantity = next
    queueCartRequest(product.id, next)
  }
}

const addToCart = (product) => {
  if (isUnavailable(product) || cartLoading.value) return

  const quantity = getProductQuantity(product)
  const existing = cart.value.find((item) => item.id === product.id)
  const nextQuantity = Math.min(getProductLimit(product), (existing?.quantity ?? 0) + quantity)
  if (nextQuantity <= (existing?.quantity ?? 0)) return

  if (existing) {
    existing.quantity = nextQuantity
    productQty.value[product.id] = nextQuantity
    queueCartRequest(product.id, nextQuantity)
    return
  }

  cart.value.push({ id: product.id, quantity: nextQuantity })
  productQty.value[product.id] = nextQuantity
  queueCartRequest(product.id, nextQuantity)
}

const updateCart = (productId, delta) => {
  if (cartLoading.value) return

  const item = cart.value.find((entry) => entry.id === productId)
  const product = products.find((entry) => entry.id === productId)
  if (!item || !product) return

  const nextQuantity = Number((item.quantity + product.step * delta).toFixed(2))
  if (nextQuantity === item.quantity) return

  if (nextQuantity <= 0) {
    cart.value = cart.value.filter((entry) => entry.id !== productId)
    productQty.value[productId] = product.quantity
    queueCartRequest(productId, null)
    return
  }

  item.quantity = Math.min(getProductLimit(product), nextQuantity)
  productQty.value[productId] = item.quantity
  queueCartRequest(productId, item.quantity)
}

const removeFromCart = (productId) => {
  if (cartLoading.value) return

  const product = products.find((entry) => entry.id === productId)
  if (!product) return

  cart.value = cart.value.filter((entry) => entry.id !== productId)
  productQty.value[productId] = product.step
  pendingRemoval.value = null
  queueCartRequest(productId, null)
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

const beginCheckout = async () => {
  if (cartItems.value.length === 0 || cartLoading.value) return

  await flushCartRequests()
  if (cartError.value) return
  if (cartRevision.value === null) {
    try {
      await refreshCurrentCart()
    } catch (error) {
      cartError.value = error.message || 'No se pudo verificar el carrito.'
      return
    }
  }
  cartOpen.value = false
  checkoutOpen.value = true
}

const returnToStore = () => {
  checkoutOpen.value = false
}

const clearCompletedCart = (order) => {
  if (!order || order.cartToken !== cartToken.value) return

  cart.value = []
  cartToken.value = ''
  cartRevision.value = null
  Object.assign(cartTotals, {
    subtotalAmount: null,
    discountAmount: null,
    totalAmount: null,
    currency: 'ARS',
    discounts: []
  })
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
    <title>{{ isHome ? 'VitrinApp | Tiendas locales' : storeNotFound ? 'Tienda no encontrada | 404' : storeError ? 'Algo salió mal | VitrinApp' : storeName || 'Cargando tienda' }}</title>
    <meta name="description" :content="isHome ? 'Descubre tiendas independientes en VitrinApp.' : `Bienvenido a ${storeName}, tu tienda en línea de confianza.`">
    <meta name="keywords" content="ecommerce, tienda online, compras, productos frescos, frutas, verduras">
    <meta name="author" :content="storeName">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body>
    <main id="app" :style="{
      '--primary-color': branding.primaryColor,
      '--secondary-color': branding.secondaryColor,
      '--background-color': branding.backgroundColor,
      '--banner-image': bannerImageUrl ? `url(${bannerImageUrl})` : 'none'
    }" :class="{ 'home-shell': isHome }">
      <WelcomePage v-if="isHome" />
      <section v-else-if="storeNotFound" class="store-status" aria-labelledby="store-status-title">
        <p class="store-status-code">Error 404</p>
        <h1 id="store-status-title">No encontramos esta tienda</h1>
        <p>No existe una tienda disponible con el identificador <strong>{{ STORE_SLUG }}</strong>.</p>
        <a href="/">Volver al inicio</a>
      </section>
      <section v-else-if="storeError" class="store-status" aria-labelledby="store-status-title">
        <p class="store-status-code">Error del servidor</p>
        <h1 id="store-status-title">Algo salió mal</h1>
        <p>Inténtalo de nuevo más tarde.</p>
        <button type="button" class="store-retry-button" @click="retryStore">Reintentar</button>
      </section>
      <CheckoutPage
        v-else-if="checkoutOpen"
        :items="cartItems"
        :cart-token="cartToken"
        :revision="cartRevision"
        :subtotal="subtotal"
        :discount-amount="discountAmount"
        :total-amount="totalAmount"
        :currency="cartTotals.currency"
        :store-name="storeName"
        @back="returnToStore"
        @complete="clearCompletedCart"
      />
      <template v-else>
      <section id="banner">
        <template v-if="settingsLoading || storeNotFound">
          <div class="identity identity-skeleton" aria-hidden="true">
            <span class="skeleton-block skeleton-logo"></span>
            <span class="skeleton-block skeleton-store-name"></span>
          </div>
          <span class="skeleton-block skeleton-banner-slogan" aria-hidden="true"></span>
        </template>
        <template v-else>
          <div v-if="bannerImageFailed" class="banner-fallback-icon" aria-hidden="true">
            <svg viewBox="0 0 64 64" fill="none">
              <path d="M14 24h32l-3 27H17l-3-27Zm31 5h5a7 7 0 0 1 0 14h-7M21 17c0-4 5-4 5-9m7 9c0-4 5-4 5-9" />
            </svg>
          </div>
          <div class="identity">
            <img v-if="logoUrl && !logoFailed" :src="logoUrl" :alt="storeName + ' Logo'" class="logo" @error="logoFailed = true" />
            <div v-else class="logo logo-fallback" role="img" :aria-label="`Logo de ${storeName}`">
              <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 12h16l-1.5 14h-13L6 12Zm16 3h2a4 4 0 0 1 0 8h-3M10 8c0-2 3-2 3-5m4 5c0-2 3-2 3-5" /></svg>
            </div>
            <h1>{{ storeName }}</h1>
          </div>
          <h2>{{ bannerSlogan }}</h2>
        </template>
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
          <ul v-if="productsLoading || storeNotFound" class="category-skeletons" aria-hidden="true">
            <li v-for="placeholder in 4" :key="placeholder" class="skeleton-block"></li>
          </ul>
          <ul v-else>
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
        <div v-if="productsLoading || storeNotFound" class="product-skeleton-grid" role="status" aria-label="Cargando productos">
          <article v-for="placeholder in 8" :key="placeholder" class="skeleton-product-card" :class="{ 'is-list': layout === 'list' }" aria-hidden="true">
            <span class="skeleton-block skeleton-product-image"></span>
            <div class="skeleton-product-body">
              <div class="skeleton-meta-row">
                <span class="skeleton-block skeleton-category"></span>
                <span class="skeleton-block skeleton-price"></span>
              </div>
              <span class="skeleton-block skeleton-product-name"></span>
              <div class="skeleton-description">
                <span class="skeleton-block"></span>
                <span class="skeleton-block"></span>
              </div>
              <span class="skeleton-block skeleton-quantity"></span>
              <div class="skeleton-footer">
                <span class="skeleton-block skeleton-subtotal"></span>
                <span class="skeleton-block skeleton-add-button"></span>
              </div>
            </div>
          </article>
        </div>
        <div v-else-if="productsError" class="empty-state">
          <p>{{ productsError }}</p>
          <button type="button" class="retry-products" @click="loadProducts">Reintentar</button>
        </div>
        <div v-else-if="filteredProducts.length === 0" class="empty-state">No se encontraron productos.</div>
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
        <div v-if="productsHasMore && !storeNotFound && !settingsLoading" class="load-more-region">
          <p v-if="productsMoreError" class="load-more-error" role="alert">{{ productsMoreError }}</p>
          <p v-else-if="productsLoadingMore" class="load-more-status" role="status">Cargando más productos...</p>
          <button v-else type="button" class="load-more-button" @click="loadNextProducts">
            Cargar más productos
          </button>
          <span ref="loadMoreSentinel" class="load-more-sentinel" aria-hidden="true"></span>
        </div>
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
        v-if="!storeNotFound && !settingsLoading"
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

      <div v-if="cartOpen && !storeNotFound && !settingsLoading" class="cart-backdrop" @click="toggleCart"></div>

      <aside v-if="!storeNotFound && !settingsLoading" class="cart-panel" :class="{ open: cartOpen }" @click.stop>
        <div class="cart-header">
          <div>
            <p class="cart-eyebrow">Mi compra</p>
            <h3>Carrito</h3>
          </div>
          <button type="button" class="close-cart" @click="toggleCart">✕</button>
        </div>

        <div v-if="!cartToken && cartError" class="cart-empty" role="alert">
          No pudo crearse el carrito, contáctese con el proveedor del servicio
        </div>

        <div v-else-if="!cartToken" class="cart-empty" role="status">
          Creando tu carrito...
        </div>

        <div v-else-if="cartItems.length === 0" class="cart-empty">
          Tu carrito está vacío.
        </div>

        <p v-if="cartError && cartToken" class="cart-error" role="alert">{{ cartError }}</p>

        <div v-if="cartToken && !cartError" class="cart-items">
          <article v-for="item in cartItems" :key="item.id" class="cart-item">
            <div class="cart-item-body">
              <div class="cart-item-header">
                <h4>{{ item.name }}</h4>
                <strong>{{ formatCartAmount(item.pricePerType * item.quantity) }}</strong>
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

        <div v-if="cartToken" class="cart-footer">
          <div class="cart-total">
            <span>Subtotal</span>
            <strong>{{ formatCartAmount(subtotal) }}</strong>
          </div>
          <div v-if="discountAmount > 0" class="cart-total cart-discount">
            <span>Descuentos</span>
            <strong>-{{ formatCartAmount(discountAmount) }}</strong>
          </div>
          <div class="cart-total">
            <span>Total</span>
            <strong>{{ formatCartAmount(totalAmount) }}</strong>
          </div>
          <button
            type="button"
            class="checkout-btn"
            :disabled="cartLoading || cartItems.length === 0"
            :aria-label="cartLoading ? 'Procesando carrito' : 'Finalizar compra'"
            @click="beginCheckout"
          >
            <span class="checkout-button-content" :class="{ 'is-loading': cartLoading }" aria-hidden="true">Finalizar compra</span>
            <span v-if="cartLoading" class="loading-spinner" aria-hidden="true"></span>
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

  #app.home-shell {
    min-height: 100vh;
    gap: 0;
    padding: 0;
    background: #f6f5ef;
  }

  .store-status {
    display: grid;
    min-height: 70vh;
    align-content: center;
    justify-items: center;
    gap: 0.8rem;
    text-align: center;
  }

  .store-status-code {
    margin: 0;
    color: var(--primary-color, #315d36);
    font-size: 0.78rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  .store-status h1 {
    margin: 0;
    font-size: clamp(1.8rem, 5vw, 2.6rem);
  }

  .store-status p:not(.store-status-code) {
    max-width: 42ch;
    margin: 0;
    color: #59665b;
    line-height: 1.6;
  }

  .store-status a,
  .store-retry-button {
    display: inline-flex;
    min-height: 2.8rem;
    align-items: center;
    justify-content: center;
    margin-top: 0.6rem;
    padding: 0.65rem 1rem;
    border: 0;
    border-radius: 6px;
    background: var(--primary-color, #315d36);
    color: #fff;
    font: inherit;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }

  section {
    padding: 20px;
    width: clamp(300px, 90vw, var(--content-max-width));
    margin: 0 auto;
    border-radius: 20px;
  }
  #banner {
    position: relative;
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

  .identity-skeleton {
    gap: 0.8rem;
  }

  .skeleton-block {
    position: relative;
    display: block;
    overflow: hidden;
    border-radius: 6px;
    background: #e4e9e5;
  }

  .skeleton-block::after {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.62), transparent);
    content: '';
    transform: translateX(-100%);
    animation: skeleton-shimmer 1.35s ease-in-out infinite;
  }

  @keyframes skeleton-shimmer {
    to { transform: translateX(100%); }
  }

  .skeleton-logo {
    width: 100px;
    height: 100px;
    border-radius: 50%;
  }

  .skeleton-store-name {
    width: min(15rem, 70vw);
    height: 1.6rem;
  }

  .skeleton-banner-slogan {
    width: min(24rem, 75vw);
    height: 1rem;
    margin-top: 1rem;
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

  .logo-fallback {
    align-items: center;
    justify-content: center;
    color: var(--primary-color);
  }

  .logo-fallback svg {
    width: 3rem;
    height: 3rem;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.8;
  }

  .banner-fallback-icon {
    position: absolute;
    top: 50%;
    right: clamp(1rem, 8vw, 7rem);
    color: rgba(255, 255, 255, 0.2);
    pointer-events: none;
    transform: translateY(-50%);
  }

  .banner-fallback-icon svg {
    width: clamp(6rem, 14vw, 12rem);
    height: auto;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
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

  .categories ul.category-skeletons li {
    width: 6.5rem;
    height: 2.5rem;
    padding: 0;
    list-style: none;
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

  .product-skeleton-grid {
    display: grid;
    width: 100%;
    grid-template-columns: inherit;
    gap: 1rem;
    grid-column: 1 / -1;
  }

  .skeleton-product-card {
    display: flex;
    min-width: 0;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.9);
  }

  .skeleton-product-image {
    width: 100%;
    height: 220px;
    flex: 0 0 auto;
    border-radius: 0;
  }

  .skeleton-product-body {
    display: flex;
    min-height: 100%;
    flex: 1;
    flex-direction: column;
    gap: 0.9rem;
    padding: 1rem;
  }

  .skeleton-meta-row,
  .skeleton-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .skeleton-category {
    width: 5rem;
    height: 1.7rem;
    border-radius: 999px;
  }

  .skeleton-price {
    width: 5.5rem;
    height: 0.8rem;
  }

  .skeleton-product-name {
    width: 72%;
    height: 1.35rem;
  }

  .skeleton-description {
    display: grid;
    gap: 0.45rem;
    min-height: 48px;
  }

  .skeleton-description .skeleton-block {
    width: 100%;
    height: 0.75rem;
  }

  .skeleton-description .skeleton-block:last-child {
    width: 68%;
  }

  .skeleton-quantity {
    height: 3rem;
    border-radius: 12px;
  }

  .skeleton-subtotal {
    width: 5.5rem;
    height: 1.65rem;
  }

  .skeleton-add-button {
    width: 6.5rem;
    height: 2.8rem;
    border-radius: 12px;
  }

  .skeleton-product-card.is-list {
    flex-direction: row;
  }

  .skeleton-product-card.is-list .skeleton-product-image {
    width: 170px;
    min-width: 170px;
    height: auto;
    min-height: 170px;
  }

  .skeleton-product-card.is-list .skeleton-product-body {
    padding: 1rem 1.2rem;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.8);
    color: #555;
    font-weight: 600;
  }

  .retry-products {
    border: 0;
    border-radius: 8px;
    padding: 0.65rem 0.9rem;
    background: var(--primary-color);
    color: white;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .load-more-region {
    position: relative;
    display: grid;
    min-height: 3.5rem;
    place-items: center;
    grid-column: 1 / -1;
    padding: 0.5rem;
  }

  .load-more-button {
    min-height: 2.75rem;
    padding: 0.65rem 1rem;
    border: 1px solid var(--primary-color);
    border-radius: 8px;
    background: white;
    color: var(--primary-color);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .load-more-status,
  .load-more-error {
    margin: 0;
    color: #4b5563;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .load-more-sentinel {
    position: absolute;
    bottom: 0;
    width: 1px;
    height: 1px;
    pointer-events: none;
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
    position: relative;
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

  .checkout-button-content.is-loading {
    visibility: hidden;
  }

  .loading-spinner {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 1em;
    height: 1em;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: loading-spin 0.75s linear infinite;
  }

  @keyframes loading-spin {
    to { transform: translate(-50%, -50%) rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-spinner {
      animation-duration: 1.5s;
    }
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

  @media (prefers-reduced-motion: reduce) {
    .skeleton-block::after {
      animation-duration: 2.8s;
    }
  }
</style>
