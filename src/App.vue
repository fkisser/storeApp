<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import ProductCard from './components/ProductCard.vue'
import CheckoutPage from './components/CheckoutPage.vue'
import WelcomePage from './components/WelcomePage.vue'
import storeInfo from './data/store-info.json'
import { requestStoreApi } from './api/store.js'
import { IS_HOME, STORE_SLUG } from './config/store.js'
import { useVisitorCart } from './composables/useVisitorCart.js'
import { resolveStoreAssetUrl } from './utils/resolveStoreAssetUrl.js'
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
watch(() => branding.backgroundColor, (backgroundColor) => {
  if (isHome || typeof document === 'undefined') return
  document.documentElement.style.setProperty(
    '--store-background-color',
    backgroundColor || storeInfo.branding.backgroundColor
  )
}, { immediate: true })
if (isHome && typeof document !== 'undefined') document.title = 'VitrinApp | Tiendas locales'
const storeLogoModules = import.meta.glob('./assets/**/*.{png,jpg,jpeg,svg,webp}', {
  query: '?url',
  import: 'default'
})
const logoUrl = ref('')
const logoFailed = ref(false)
const bannerImageUrl = ref('')
const bannerImageFailed = ref(true)
const getContrastColor = (color) => {
  const hex = color.replace('#', '')
  const normalizedHex = hex.length === 3
    ? hex.split('').map((channel) => channel + channel).join('')
    : hex

  if (!/^[\da-f]{6}$/i.test(normalizedHex)) return '#fff'

  const channels = normalizedHex.match(/[\da-f]{2}/gi).map((channel) => {
    const value = Number.parseInt(channel, 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  const whiteContrast = 1.05 / (luminance + 0.05)
  const darkTextLuminance = 0.0331
  const darkContrast = (luminance + 0.05) / (darkTextLuminance + 0.05)
  return darkContrast >= whiteContrast ? '#333333' : '#fff'
}
const storeSecondaryContrastColor = computed(() => getContrastColor(
  branding.secondaryColor || storeInfo.branding.secondaryColor
))
const storeThemeStyle = computed(() => {
  const primaryColor = branding.primaryColor || storeInfo.branding.primaryColor
  const secondaryColor = branding.secondaryColor || storeInfo.branding.secondaryColor
  const hoverColor = `color-mix(in srgb, ${primaryColor} 86%, #000)`
  const activeColor = `color-mix(in srgb, ${primaryColor} 76%, #000)`
  const secondaryHoverColor = `color-mix(in srgb, ${secondaryColor} 86%, #000)`
  const secondaryActiveColor = `color-mix(in srgb, ${secondaryColor} 76%, #000)`
  const contrastColor = getContrastColor(primaryColor)
  const secondaryContrastColor = getContrastColor(secondaryColor)

  return {
    '--primary-color': primaryColor,
    '--secondary-color': secondaryColor,
    '--secondary-contrast-color': secondaryContrastColor,
    '--background-color': branding.backgroundColor || storeInfo.branding.backgroundColor,
    '--banner-image': bannerImageUrl.value ? `url(${bannerImageUrl.value})` : 'none',
    '--banner-overlay': `color-mix(in srgb, ${primaryColor} 25%, transparent)`,
    '--banner-text-color': contrastColor,
    '--p-primary-color': primaryColor,
    '--p-primary-hover-color': hoverColor,
    '--p-primary-active-color': activeColor,
    '--p-primary-contrast-color': contrastColor,
    '--p-focus-ring-color': `color-mix(in srgb, ${primaryColor} 28%, transparent)`,
    '--p-button-primary-background': primaryColor,
    '--p-button-primary-hover-background': hoverColor,
    '--p-button-primary-active-background': activeColor,
    '--p-button-primary-border-color': primaryColor,
    '--p-button-primary-hover-border-color': hoverColor,
    '--p-button-primary-active-border-color': activeColor,
    '--p-button-primary-color': contrastColor,
    '--p-button-primary-hover-color': contrastColor,
    '--p-button-primary-active-color': contrastColor,
    '--p-button-primary-focus-ring-color': primaryColor,
    '--p-button-secondary-background': secondaryColor,
    '--p-button-secondary-hover-background': secondaryHoverColor,
    '--p-button-secondary-active-background': secondaryActiveColor,
    '--p-button-secondary-border-color': secondaryColor,
    '--p-button-secondary-hover-border-color': secondaryHoverColor,
    '--p-button-secondary-active-border-color': secondaryActiveColor,
    '--p-button-secondary-color': secondaryContrastColor,
    '--p-button-secondary-hover-color': secondaryContrastColor,
    '--p-button-secondary-active-color': secondaryContrastColor,
    '--p-button-secondary-focus-ring-color': secondaryColor,
    '--p-badge-primary-background': primaryColor,
    '--p-badge-primary-color': contrastColor,
    '--p-inputtext-focus-border-color': primaryColor,
    '--p-inputtext-focus-ring-color': primaryColor,
    '--p-textarea-focus-border-color': primaryColor,
    '--p-textarea-focus-ring-color': primaryColor,
    '--p-tag-primary-background': primaryColor,
    '--p-tag-primary-color': contrastColor,
    '--p-togglebutton-checked-background': primaryColor,
    '--p-togglebutton-checked-hover-background': hoverColor,
    '--p-togglebutton-checked-border-color': primaryColor,
    '--p-togglebutton-checked-color': contrastColor,
    '--p-radiobutton-checked-background': primaryColor,
    '--p-radiobutton-checked-hover-background': hoverColor,
    '--p-radiobutton-checked-border-color': primaryColor,
    '--p-radiobutton-checked-hover-border-color': hoverColor
  }
})

const loadStoreLogo = async (configuredLogo) => {
  logoUrl.value = ''
  logoFailed.value = false
  if (!configuredLogo) return

  const logoLoader = storeLogoModules[configuredLogo]
  logoUrl.value = logoLoader ? await logoLoader() : resolveStoreAssetUrl(configuredLogo)
}
const loadBannerImage = (configuredImage) => {
  bannerImageUrl.value = ''
  bannerImageFailed.value = true
  if (!configuredImage) return

  const imageUrl = resolveStoreAssetUrl(configuredImage)
  if (!imageUrl) return

  const image = new Image()
  image.onload = () => {
    bannerImageUrl.value = imageUrl
    bannerImageFailed.value = false
  }
  image.onerror = () => {
    bannerImageUrl.value = ''
    bannerImageFailed.value = true
  }
  image.src = imageUrl
}
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

const {
  addToCart,
  cart,
  cartError,
  cartItems,
  cartLoading,
  cartRevision,
  cartToken,
  cartTotals,
  clearCompletedCart,
  discountAmount,
  flushCartRequests,
  formatCartAmount,
  formatCartQuantity,
  formatQuantityLabel,
  getCartQuantity,
  getProductLimit,
  getProductQuantity,
  hasSavedCartItems,
  initializeCart,
  isProductLimitReached,
  isUnavailable,
  productQty,
  refreshCurrentCart,
  removeItem: removeCartItem,
  restoreCart,
  subtotal,
  totalAmount,
  totalItems,
  updateCart,
  updateProductQuantity: updateProductQty
} = useVisitorCart({ products })

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
    image: resolveStoreAssetUrl(image),
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
  }

  try {
    const pageOffset = append ? productsOffset.value : 0
    const pageLimit = !append && hasSavedCartItems() ? 100 : PRODUCTS_PAGE_SIZE
    const [settingsResult, productsResult, categoriesResult] = await Promise.allSettled([
      append ? Promise.resolve(null) : requestStoreApi('/settings'),
      requestStoreApi(`/products?limit=${pageLimit}&offset=${pageOffset}`),
      append ? Promise.resolve(null) : requestStoreApi('/categories')
    ])

    if (!append) {
      const failures = [settingsResult, productsResult, categoriesResult]
        .filter((result) => result.status === 'rejected')
      const notFound = failures.find((error) => error?.status === 404)

      if (notFound) {
        return
      }

      if (failures.length > 0) {
        storeError.value = failures.some((error) => error?.status === 500)
          ? 'Algo salió mal. Inténtalo de nuevo más tarde.'
          : 'No pudimos cargar la tienda. Inténtalo de nuevo más tarde.'
        return
      }

      storeNotFound.value = false
      storeError.value = ''
    }

    if (!append) {
      const settings = settingsResult.value
      const theme = settings.theme ?? {}
      storeName.value = settings.name ?? storeInfo.ecommerceName
      bannerSlogan.value = settings.description ?? storeInfo.bannerSlogan
      branding.primaryColor = theme.primaryColor ?? storeInfo.branding.primaryColor
      branding.secondaryColor = theme.secondaryColor ?? storeInfo.branding.secondaryColor
      branding.backgroundColor = theme.backgroundColor ?? storeInfo.branding.backgroundColor
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
      restoreCart()
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
const isListLayout = computed({
  get: () => layout.value === 'list',
  set: (isList) => { layout.value = isList ? 'list' : 'cards' }
})
const cartOpen = ref(false)
const checkoutOpen = ref(false)
const pendingRemoval = ref(null)
const removeDialogVisible = ref(false)
const viewSwitchPt = {
  root: {
    style: {
      '--p-toggleswitch-checked-background': 'var(--primary-color)',
      '--p-toggleswitch-checked-hover-background': 'var(--primary-color)',
      '--p-toggleswitch-checked-border-color': 'var(--primary-color)'
    }
  }
}
const sortOptions = [
  { value: 'name-asc', label: 'Nombre A-Z', icon: 'pi pi-sort-alpha-up' },
  { value: 'name-desc', label: 'Nombre Z-A', icon: 'pi pi-sort-alpha-down' },
  { value: 'price-asc', label: 'Precio menor a mayor', icon: 'pi pi-sort-amount-up' },
  { value: 'price-desc', label: 'Precio mayor a menor', icon: 'pi pi-sort-amount-down' }
]
const sortOption = ref(sortOptions.find((option) => option.value === 'name-asc'))
const sortSelectPt = computed(() => {
  const secondaryColor = branding.secondaryColor || storeInfo.branding.secondaryColor
  const contrastColor = storeSecondaryContrastColor.value

  return {
    option: ({ context }) => context.selected
      ? {
          style: {
            backgroundColor: secondaryColor,
            color: contrastColor,
            fontWeight: '700'
          }
        }
      : undefined
  }
})
const hoveredCategory = ref('')

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

const sortedProducts = computed(() => {
  const [field, direction] = sortOption.value.value.split('-')
  const sorted = [...filteredProducts.value]
  sorted.sort((first, second) => {
    const comparison = field === 'name'
      ? first.name.localeCompare(second.name, 'es', { sensitivity: 'base' })
      : first.pricePerType - second.pricePerType
    return direction === 'desc' ? -comparison : comparison
  })
  return sorted
})

const retryStore = async () => {
  await loadProducts()
  if (!storeNotFound.value && !storeError.value) await initializeCart()
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
})

const loadNextProducts = () => loadProducts({ append: true })

const removeFromCart = (productId) => {
  removeCartItem(productId)
  pendingRemoval.value = null
  removeDialogVisible.value = false
}

const promptRemoveFromCart = (productId) => {
  const product = products.find((entry) => entry.id === productId)
  if (!product) return

  pendingRemoval.value = product
  removeDialogVisible.value = true
}

const cancelRemoval = () => {
  pendingRemoval.value = null
  removeDialogVisible.value = false
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
  const storePath = `/${encodeURIComponent(STORE_SLUG)}`
  if (window.location.pathname !== storePath) {
    window.location.assign(storePath)
    return
  }

  checkoutOpen.value = false
}

const filterByCategory = (category) => {
  selectedCategory.value = category
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
    <main id="app" :style="storeThemeStyle" :class="{ 'home-shell': isHome }">
      <WelcomePage v-if="isHome" />
      <section v-else-if="storeNotFound" class="store-status">
        <Message severity="error" :closable="false" class="store-status-message">
          <div>
            <strong>Error 404: No encontramos esta tienda</strong>
            <p>No existe una tienda disponible con el identificador <strong>{{ STORE_SLUG }}</strong>.</p>
            <Button as="a" href="/" label="Volver al inicio" severity="secondary" />
          </div>
        </Message>
      </section>
      <section v-else-if="storeError" class="store-status">
        <Message severity="error" :closable="false" class="store-status-message">
          <div>
            <strong>Error del servidor</strong>
            <p>Algo salió mal. Inténtalo de nuevo más tarde.</p>
            <Button label="Reintentar" icon="pi pi-refresh" @click="retryStore" />
          </div>
        </Message>
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
            <Skeleton shape="circle" size="6.25rem" />
            <Skeleton width="15rem" height="1.6rem" />
          </div>
          <Skeleton width="min(24rem, 75vw)" height="1rem" class="banner-skeleton-slogan" />
        </template>
        <template v-else>
          <div v-if="bannerImageFailed" class="banner-fallback-icon" aria-hidden="true">
            <i class="pi pi-shop"></i>
          </div>
          <div class="identity">
            <img v-if="logoUrl && !logoFailed" :src="logoUrl" :alt="storeName + ' Logo'" class="logo" @error="logoFailed = true" />
            <div v-else class="logo logo-fallback" role="img" :aria-label="`Logo de ${storeName}`">
              <i class="pi pi-shop" aria-hidden="true"></i>
            </div>
            <h1>{{ storeName }}</h1>
          </div>
          <h3 class="store-slogan">{{ bannerSlogan }}</h3>
        </template>
      </section>
      
      <section id="tools">
        <div class="toolbar">
          <InputText class="toolbar-search" v-model="search" type="search" placeholder="Buscar productos..." aria-label="Buscar productos" />
          <div class="toolbar-selectors">
            <div class="view-select" aria-label="Elegir tipo de vista">
              <span class="view-mode-label" :class="{ 'is-active': !isListLayout }">Tarjetas</span>
              <ToggleSwitch v-model="isListLayout" aria-label="Alternar entre vista de tarjetas y lista" :pt="viewSwitchPt" />
              <span class="view-mode-label" :class="{ 'is-active': isListLayout }">Lista</span>
            </div>
            <label class="sort-select">
              <span>Ordenar</span>
              <Select v-model="sortOption" :options="sortOptions" option-label="label" aria-label="Ordenar productos" :pt="sortSelectPt">
                <template #value="{ value, placeholder }">
                  <span v-if="value" class="sort-value"><i :class="value.icon" aria-hidden="true"></i>{{ value.label }}</span>
                  <span v-else>{{ placeholder }}</span>
                </template>
                <template #option="{ option }">
                  <span class="sort-value"><i :class="option.icon" aria-hidden="true"></i>{{ option.label }}</span>
                </template>
              </Select>
            </label>
          </div>
        </div>

        <div class="categories">
          <h3>Categorías</h3>
          <ul v-if="productsLoading || storeNotFound" class="category-skeletons" aria-hidden="true">
            <li v-for="placeholder in 4" :key="placeholder"><Skeleton width="5rem" height="2rem" /></li>
          </ul>
          <div v-else class="category-options">
            <Button
              v-for="category in categories"
              :key="category"
              :label="category"
              :severity="selectedCategory === category ? 'primary' : 'secondary'"
              :outlined="selectedCategory !== category && hoveredCategory !== category"
              rounded
              @mouseenter="hoveredCategory = category"
              @mouseleave="hoveredCategory = ''"
              @click="filterByCategory(category)"
            />
          </div>
        </div>
      </section>
  
      <section id="products" :class="layout === 'list' ? 'products-list' : 'products-grid'">
        <div v-if="productsLoading || storeNotFound" class="product-skeleton-grid" role="status" aria-label="Cargando productos">
          <Card v-for="placeholder in 8" :key="placeholder" class="skeleton-product-card" :class="{ 'is-list': layout === 'list' }" aria-hidden="true">
            <template #header><Skeleton class="skeleton-product-image" /></template>
            <template #content>
              <div class="skeleton-product-body">
                <div class="skeleton-meta-row">
                  <Skeleton width="5rem" height="1.5rem" />
                  <Skeleton width="4rem" height="1rem" />
                </div>
                <Skeleton width="75%" height="1.4rem" />
                <div class="skeleton-description">
                  <Skeleton width="100%" height="0.8rem" />
                  <Skeleton width="68%" height="0.8rem" />
                </div>
                <Skeleton width="100%" height="2.75rem" />
                <div class="skeleton-footer">
                  <Skeleton width="5rem" height="1.8rem" />
                  <Skeleton width="7rem" height="2.8rem" />
                </div>
              </div>
            </template>
          </Card>
        </div>
        <div v-else-if="productsError" class="empty-state">
          <Message severity="error" :closable="false">{{ productsError }}</Message>
          <Button label="Reintentar" icon="pi pi-refresh" @click="loadProducts" />
        </div>
        <Message v-else-if="filteredProducts.length === 0" severity="info" :closable="false" class="empty-state">
          No se encontraron productos.
        </Message>
        <ProductCard
          v-for="product in sortedProducts"
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
          <Message v-if="productsMoreError" severity="error" :closable="false">{{ productsMoreError }}</Message>
          <Button v-else label="Cargar más productos" icon="pi pi-chevron-down" :loading="productsLoadingMore" @click="loadNextProducts" />
          <span ref="loadMoreSentinel" class="load-more-sentinel" aria-hidden="true"></span>
        </div>
      </section>

      <Dialog
        v-model:visible="removeDialogVisible"
        modal
        header="Eliminar producto"
        :style="{ width: 'min(92vw, 28rem)' }"
        @hide="cancelRemoval"
      >
        <p v-if="pendingRemoval">¿Deseas quitar <strong>{{ pendingRemoval.name }}</strong> del carrito?</p>
        <template #footer>
          <Button label="Cancelar" severity="secondary" text @click="cancelRemoval" />
          <Button label="Eliminar" icon="pi pi-trash" severity="danger" @click="removeFromCart(pendingRemoval.id)" />
        </template>
      </Dialog>

      <Button
        v-if="!storeNotFound && !settingsLoading"
        type="button"
        class="cart-fab"
        icon="pi pi-shopping-cart"
        :badge="String(totalItems)"
        severity="secondary"
        badge-severity="primary"
        @click="cartOpen = true"
        :disabled="cartLoading"
        :aria-label="cartLoading ? 'Procesando carrito' : 'Abrir carrito'"
        :aria-busy="cartLoading"
        title="Carrito"
      />

      <Drawer
        v-if="!storeNotFound && !settingsLoading"
        v-model:visible="cartOpen"
        position="right"
        class="cart-drawer"
        :style="storeThemeStyle"
        :modal="true"
        :dismissable="!cartLoading"
        :show-close-icon="false"
      >
        <template #header>
          <div class="cart-header">
            <div>
              <p class="cart-eyebrow">Mi compra</p>
              <h3>Carrito</h3>
            </div>
            <Button icon="pi pi-times" text rounded severity="secondary" aria-label="Cerrar carrito" @click="cartOpen = false" />
          </div>
        </template>

        <Message v-if="cartError" severity="error" :closable="false" class="cart-error">
          <div class="cart-error-content">
            <span>{{ cartError }}</span>
            <Button label="Reintentar" icon="pi pi-refresh" :loading="cartLoading" @click="initializeCart" />
          </div>
        </Message>

        <div v-else-if="!cartToken" class="cart-empty-state" role="status">
          <ProgressSpinner stroke-width="4" />
          <span>Creando tu carrito...</span>
        </div>

        <Message v-else-if="cartItems.length === 0" severity="info" :closable="false" class="cart-empty-message">
          Tu carrito está vacío.
        </Message>

        <div v-if="cartToken && !cartError" class="cart-items">
          <article v-for="item in cartItems" :key="item.id" class="cart-item">
            <div class="cart-item-body">
              <div class="cart-item-header">
                <h4>{{ item.name }}</h4>
                <strong>{{ formatCartAmount(item.pricePerType * item.quantity) }}</strong>
              </div>
              <div class="cart-item-controls">
                <Button
                  type="button"
                  :icon="item.quantity <= item.step ? 'pi pi-trash' : 'pi pi-minus'"
                  text
                  rounded
                  :disabled="cartLoading"
                  :aria-label="item.quantity <= item.step ? `Eliminar ${item.name} del carrito` : `Disminuir cantidad de ${item.name}`"
                  @click="item.quantity <= item.step ? promptRemoveFromCart(item.id) : updateCart(item.id, -1)"
                />
                <span>{{ formatCartQuantity(item.quantity, item.productType) }}</span>
                <Button type="button" icon="pi pi-plus" text rounded :disabled="cartLoading || item.quantity + item.step > getProductLimit(item)" :aria-label="`Aumentar cantidad de ${item.name}`" @click="updateCart(item.id, 1)" />
              </div>
            </div>
          </article>
        </div>

        <div v-if="cartToken && !cartError" class="cart-footer">
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
          <Button
            type="button"
            class="checkout-btn"
            :disabled="cartLoading || cartItems.length === 0"
            label="Finalizar compra"
            icon="pi pi-arrow-right"
            icon-pos="right"
            :loading="cartLoading"
            :aria-label="cartLoading ? 'Procesando carrito' : 'Finalizar compra'"
            @click="beginCheckout"
          />
        </div>
      </Drawer>
      </template>
    </main>
  </body>
</template>

<style scoped>
  :global(html),
  :global(body) {
    background-color: var(--store-background-color, #f6f5ef);
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

  .store-status-message {
    display: flex;
    justify-content: center;
    width: min(100%, 38rem);
  }

  .store-status-message p {
    max-width: 42ch;
    margin: 0.7rem 0 1rem;
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
      linear-gradient(var(--banner-overlay), var(--banner-overlay)),
      var(--banner-image);
    background-repeat: no-repeat;
    background-size: cover;
    background-position: center;
    background-attachment: fixed;
    min-height: 25vh;
    color: var(--banner-text-color);
  }

  .store-slogan {
    margin: 0.75rem 0 0;
    color: inherit;
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.45;
  }
  .identity {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .identity-skeleton {
    gap: 0.8rem;
  }

  .banner-skeleton-slogan {
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

  .logo-fallback i {
    font-size: 3rem;
  }

  .banner-fallback-icon {
    position: absolute;
    top: 50%;
    right: clamp(1rem, 8vw, 7rem);
    color: rgba(255, 255, 255, 0.2);
    pointer-events: none;
    transform: translateY(-50%);
  }

  .banner-fallback-icon i {
    font-size: clamp(6rem, 14vw, 12rem);
  }
  #tools {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.2rem 1.4rem;
    border: 3px solid var(--primary-color);
    background: rgba(255, 255, 255, 0.8);
    box-shadow: 0 12px 30px color-mix(in srgb, var(--primary-color) 16%, transparent);
  }

  .toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    justify-content: stretch;
    gap: 1rem;
  }

  #tools :deep(.toolbar-search.p-inputtext) {
    width: 100%;
    min-width: 0;
    min-height: 3.25rem;
    box-shadow: 0 6px 18px color-mix(in srgb, var(--primary-color) 18%, transparent);
  }

  #tools :deep(.toolbar-search.p-inputtext:enabled:focus) {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--primary-color) 22%, transparent);
  }

  .toolbar-selectors {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: flex-end;
    gap: 1.25rem;
  }

  .view-select {
    display: inline-flex;
    min-width: 0;
    height: 3.25rem;
    align-items: center;
    gap: 0.75rem;
    padding: 0 0.6rem;
    font-weight: 500;
    color: var(--primary-color);
    white-space: nowrap;
  }

  .view-mode-label {
    font-size: 0.9rem;
    white-space: nowrap;
    color: color-mix(in srgb, var(--primary-color) 48%, #64748b);
  }

  .view-mode-label.is-active {
    color: var(--primary-color);
    font-weight: 600;
  }

  .view-select :deep(.p-toggleswitch) {
    flex: 0 0 auto;
  }

  .sort-select {
    display: flex;
    min-width: 0;
    padding: 0 0.6rem;
    align-items: center;
    align-content: center;
    gap: 0.65rem;
    color: var(--primary-color);
    font-size: 0.9rem;
    font-weight: 500;
  }

  .sort-select :deep(.p-select) {
    min-width: 12rem;
    max-width: 16rem;
    height: 3.25rem;
    border-color: color-mix(in srgb, var(--primary-color) 48%, #fff);
    background: #fff;
    color: var(--primary-color);
  }

  .sort-select :deep(.p-select-label),
  .sort-select :deep(.p-select-dropdown) {
    color: var(--primary-color);
  }

  .sort-select :deep(.p-select-label) {
    display: flex;
    height: 100%;
    align-items: center;
    padding-block: 0;
  }

  .sort-select :deep(.p-select:not(.p-disabled).p-focus) {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--primary-color) 24%, transparent);
  }

  .sort-value {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    white-space: nowrap;
  }

  .categories {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.7rem;
  }

  .categories h3 {
    margin: 0;
    color: var(--primary-color);
  }

  .category-options {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.7rem;
  }

  .category-options :deep(.p-button) {
    min-height: 2.5rem;
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
    border-radius: 20px;
  }

  .skeleton-product-card :deep(.p-card-body) {
    display: flex;
    flex: 1;
    flex-direction: column;
    padding: 0;
  }

  .skeleton-product-card :deep(.p-card-header),
  .skeleton-product-card :deep(.p-card-content) {
    padding: 0;
  }

  .skeleton-product-card :deep(.p-card-content) {
    display: flex;
    flex: 1;
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

  .skeleton-description {
    display: grid;
    gap: 0.45rem;
    min-height: 48px;
  }

  .skeleton-product-card.is-list {
    flex-direction: row;
  }

  .skeleton-product-card.is-list :deep(.p-card-body) {
    flex-direction: row;
  }

  .skeleton-product-card.is-list :deep(.p-card-header) {
    flex: 0 0 170px;
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
    border: 2px solid var(--secondary-color);
    background: rgba(255, 255, 255, 0.8);
    color: #555;
    font-weight: 600;
  }

  .load-more-region {
    position: relative;
    display: grid;
    min-height: 3.5rem;
    place-items: center;
    grid-column: 1 / -1;
    padding: 0.5rem;
  }

  .load-more-region :deep(.p-button) {
    min-width: 13rem;
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
    display: flex;
    align-items: center;
    justify-content: center;
    width: 4.25rem;
    height: 4.25rem;
    border-radius: 1rem;
    box-shadow: 0 18px 30px rgba(0, 0, 0, 0.18);
  }

  .cart-fab :deep(.p-button-icon) {
    margin: 0;
    font-size: 1.8rem;
    color: var(--primary-color) !important;
  }

  .cart-fab :deep(.p-badge) {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    min-width: 1.35rem;
    height: 1.35rem;
    padding: 0 0.25rem;
    border-radius: 999px;
    font-size: 0.68rem;
  }

  .cart-drawer :deep(.p-drawer) {
    width: min(90vw, 420px);
    max-width: 100vw;
    border-left: 3px solid var(--primary-color);
    background: var(--background-color);
  }

  .cart-drawer :deep(.p-drawer-content) {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .cart-drawer :deep(.p-drawer-header) {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid color-mix(in srgb, var(--primary-color) 35%, transparent);
  }

  .cart-header {
    display: flex;
    align-items: center;
    width: 100%;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .cart-header > div {
    flex: 1;
  }

  .cart-eyebrow {
    margin: 0 0 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.7rem;
    color: var(--primary-color);
  }

  .cart-header h3 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--primary-color);
  }

  .cart-empty-state {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: #4b5563;
    font-weight: 600;
  }

  .cart-empty-message {
    --p-message-info-background: var(--secondary-color);
    --p-message-info-border-color: var(--secondary-color);
    --p-message-info-color: var(--secondary-contrast-color);
    --p-message-text-color: var(--secondary-contrast-color);
    flex: 1;
    align-items: center;
    justify-content: center;
  }

  .cart-error {
    width: 100%;
  }

  .cart-error-content {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
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
    border: 1px solid color-mix(in srgb, var(--primary-color) 30%, transparent);
    background: rgba(255, 255, 255, 0.8);
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
    border: 1px solid color-mix(in srgb, var(--primary-color) 30%, transparent);
  }

  .cart-item-controls :deep(.p-button) {
    width: 1.8rem;
    height: 1.8rem;
  }

  .cart-footer {
    margin-top: auto;
    padding-top: 1rem;
    border-top: 1px solid color-mix(in srgb, var(--primary-color) 35%, transparent);
  }

  .cart-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.8rem;
    font-size: 0.95rem;
    color: #111827;
  }

  .cart-footer :deep(.checkout-btn) {
    width: 100%;
    justify-content: center;
    box-shadow: 0 12px 26px rgba(0, 0, 0, 0.12);
  }

  @media (max-width: 500px) {
    .skeleton-product-card.is-list :deep(.p-card-header) {
      display: none;
    }

    .skeleton-product-card.is-list :deep(.p-card-body) {
      flex-direction: column;
    }
  }

  @media (max-width: 1050px) {
    .toolbar {
      grid-template-columns: minmax(0, 1fr);
    }

    #tools :deep(.toolbar-search.p-inputtext) {
      width: 100%;
    }

    .toolbar-selectors {
      width: 100%;
      justify-content: space-between;
    }

  }

  @media (max-width: 700px) {
    .toolbar-selectors {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      width: 100%;
      justify-items: stretch;
      gap: 0.75rem;
    }

    .view-select,
    .sort-select {
      width: 100%;
      min-width: 0;
      min-height: 3.25rem;
      align-items: center;
      flex-direction: row;
      gap: 0.65rem;
      padding: 0;
      justify-content: flex-start;
    }

    .sort-select :deep(.p-select) {
      flex: 1 1 auto;
      width: 100%;
      max-width: none;
      min-width: 0;
    }
  }

  @media (max-width: 768px) {
    .cart-fab {
      right: 1rem;
      bottom: 1rem;
      top: auto;
    }
  }

</style>
