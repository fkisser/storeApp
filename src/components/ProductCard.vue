<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  product: { type: Object, required: true },
  layout: { type: String, default: 'cards' },
  quantityLabel: { type: String, required: true },
  subtotal: { type: Number, default: 0 },
  busy: { type: Boolean, default: false },
  inCart: { type: Boolean, default: false },
  decreaseRemovesItem: { type: Boolean, default: false },
  unavailable: { type: Boolean, default: false },
  decreaseDisabled: { type: Boolean, default: false },
  increaseDisabled: { type: Boolean, default: false }
})

defineEmits(['change-quantity', 'add-to-cart', 'remove-from-cart'])

const displayInCart = ref(props.inCart)
const imageFailed = ref(false)
const hoveredQuantityControl = ref('')

watch(() => [props.inCart, props.busy], ([inCart, busy]) => {
  if (!busy) displayInCart.value = inCart
}, { immediate: true })
watch(() => props.product.image, () => {
  imageFailed.value = false
})

const unitPriceLabel = computed(() =>
  `$${props.product.pricePerType.toFixed(2)} / ${props.product.productType === 'weight' ? 'kg' : 'u'}`)

const addAriaLabel = computed(() => props.busy
  ? 'Procesando producto'
  : props.inCart
    ? `Añadido ${props.product.name}`
    : props.product.isSoldOut
      ? `Agotado ${props.product.name}`
      : `Añadir ${props.product.name}`)
</script>

<template>
  <Card class="product-card" :class="{ 'is-list': layout === 'list' }">
    <template #header>
      <img
        v-if="product.image && !imageFailed"
        class="product-image"
        :src="product.image"
        :alt="product.name"
        loading="lazy"
        @error="imageFailed = true"
      />
      <div v-else class="product-image product-image-fallback" role="img" :aria-label="`Imagen de ${product.name} no disponible`">
        <i :class="product.imageFallback === 'pastry' ? 'pi pi-sparkles' : product.imageFallback === 'accessory' ? 'pi pi-gift' : 'pi pi-shopping-bag'" aria-hidden="true"></i>
      </div>
      <Tag :value="product.category" severity="primary" rounded class="category-badge" />
      <small class="product-price-base image-price">{{ unitPriceLabel }}</small>
      <Button
        v-if="layout !== 'list'"
        class="add-fab"
        type="button"
        rounded
        :disabled="busy || inCart || unavailable"
        :aria-label="addAriaLabel"
        :icon="busy ? undefined : displayInCart ? 'pi pi-check' : 'pi pi-cart-plus'"
        :loading="busy"
        @click="$emit('add-to-cart')"
      />
    </template>

    <template #content>
      <div class="product-body">
      <div class="meta-row">
        <small class="product-price-base">{{ unitPriceLabel }}</small>
      </div>

      <h3>{{ product.name }}</h3>
      <p class="product-description">{{ product.description }}</p>

      <div class="product-quantity" aria-label="Seleccionar cantidad">
        <Button
          type="button"
          :disabled="busy || (unavailable && !decreaseRemovesItem) || decreaseDisabled"
          :aria-label="decreaseRemovesItem ? `Eliminar ${product.name} del carrito` : `Reducir cantidad de ${product.name}`"
          :icon="decreaseRemovesItem ? 'pi pi-trash' : 'pi pi-minus'"
          severity="secondary"
          :text="hoveredQuantityControl !== 'decrease'"
          rounded
          @mouseenter="hoveredQuantityControl = 'decrease'"
          @mouseleave="hoveredQuantityControl = ''"
          @click="decreaseRemovesItem ? $emit('remove-from-cart') : $emit('change-quantity', -product.step)"
        />
        <span>{{ quantityLabel }}</span>
        <Button
          type="button"
          :disabled="busy || unavailable || increaseDisabled"
          :aria-label="`Aumentar cantidad de ${product.name}`"
          icon="pi pi-plus"
          severity="secondary"
          :text="hoveredQuantityControl !== 'increase'"
          rounded
          @mouseenter="hoveredQuantityControl = 'increase'"
          @mouseleave="hoveredQuantityControl = ''"
          @click="$emit('change-quantity', product.step)"
        />
      </div>

      <div class="product-footer">
        <strong class="product-subtotal">${{ subtotal.toFixed(2) }}</strong>
        <Button
          class="add-product-button"
          type="button"
          :disabled="busy || inCart || unavailable"
          :aria-label="busy ? 'Procesando producto' : inCart ? `Añadido ${product.name}` : product.isSoldOut ? `Agotado ${product.name}` : `Añadir ${product.name}`"
          :label="product.isSoldOut ? 'Agotado' : displayInCart ? 'Añadido' : 'Añadir'"
          :icon="busy ? undefined : displayInCart ? 'pi pi-check' : 'pi pi-plus'"
          :loading="busy"
          @click="$emit('add-to-cart')"
        />
      </div>
      </div>
    </template>
  </Card>
</template>

<style scoped>
  .product-card {
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 16px 32px rgba(17, 24, 39, 0.08), 0 4px 12px rgba(17, 24, 39, 0.04);
    transition: box-shadow 0.2s ease;
  }

  .product-card :deep(.p-card-body) {
    display: flex;
    flex: 1;
    flex-direction: column;
    padding: 0;
  }

  .product-card :deep(.p-card-header),
  .product-card :deep(.p-card-content) {
    padding: 0;
  }

  .product-card :deep(.p-card-content) {
    display: flex;
    flex: 1;
  }

  .product-card:hover {
    box-shadow: 0 22px 40px rgba(17, 24, 39, 0.12), 0 8px 16px rgba(17, 24, 39, 0.06);
  }

  .product-card:not(.is-list) {
    width: 100%;
    max-width: 350px;
    justify-self: center;
  }

  .product-image {
    width: 100%;
    height: 220px;
    object-fit: cover;
    background: #f4f4f4;
  }

  .product-card:not(.is-list) :deep(.p-card-header) {
    position: relative;
    aspect-ratio: 1 / 1;
    overflow: hidden;
  }

  .product-card:not(.is-list) :deep(.p-card-header)::after {
    position: absolute;
    inset: 66.667% 0 0;
    background: linear-gradient(to bottom, transparent 0%, var(--secondary-color) 100%);
    content: '';
    pointer-events: none;
  }

  .product-card:not(.is-list) .product-image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
  }

  .product-image-fallback {
    display: grid;
    place-items: center;
    background: #edf2ee;
    color: #496650;
  }

  .product-image-fallback svg {
    width: 4rem;
    height: 4rem;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
  }

  .product-image-fallback i {
    color: var(--primary-text-color);
    font-size: 3.5rem;
  }

  .product-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 0.9rem;
    padding: 1rem;
  }

  .meta-row {
    display: none;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    color: #4b5563;
    font-size: 0.85rem;
  }

  .product-price-base {
    color: #4b5563;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .image-price {
    position: absolute;
    left: 0.6rem;
    bottom: 0.6rem;
    z-index: 1;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    background: var(--secondary-color);
    color: var(--secondary-contrast-color);
    font-size: 0.8rem;
  }

  .product-subtotal {
    color: #111827;
    font-size: 1.5rem;
    font-weight: 800;
  }

  .product-card h3 {
    margin: 0;
    font-size: 1.2rem;
    line-height: 1.3;
    color: #111827;
  }

  .product-description {
    margin: 0;
    max-height: 3em;
    overflow-y: auto;
    overscroll-behavior: contain;
    color: #4b5563;
    line-height: 1.5;
  }

  .product-quantity {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    padding: 0.5rem 0.7rem;
    border-radius: 12px;
    background: color-mix(in srgb, var(--secondary-color) 20%, #fff);
    border: 1px solid color-mix(in srgb, var(--secondary-color) 52%, #fff);
    font-weight: 700;
  }

  .product-quantity :deep(.p-button) {
    width: 2rem;
    height: 2rem;
    color: var(--primary-text-color);
  }

  .product-quantity :deep(.p-button:focus-visible) {
    box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--primary-color) 26%, transparent);
  }

  .category-badge {
    position: absolute;
    top: 0.6rem;
    right: 0.6rem;
    z-index: 1;
    font-size: 0.72rem;
  }

  .product-card .add-fab.p-button {
    position: absolute;
    right: 0.75rem;
    bottom: 0.75rem;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 3.5rem;
    height: 3.5rem;
    flex: none;
    aspect-ratio: 1 / 1;
    padding: 0;
    border-radius: 50%;
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.25);
  }

  .add-fab :deep(.p-button-icon) {
    font-size: 1.4rem;
  }

  .product-card:not(.is-list) .product-footer :deep(.add-product-button) {
    display: none;
  }

  .product-card:not(.is-list) .product-footer {
    justify-content: center;
  }

  .product-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    margin-top: auto;
    color: #4b5563;
    font-size: 0.8rem;
  }

  .product-footer :deep(.add-product-button) {
    min-width: 8.4rem;
    min-height: 2.9rem;
    border-radius: 8px;
    background: var(--p-primary-color);
    color: var(--p-primary-contrast-color);
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.12);
    transition: transform 0.2s ease, filter 0.2s ease, box-shadow 0.2s ease;
  }

  .product-footer :deep(.add-product-button:hover:not(:disabled)) {
    transform: translateY(-1px);
    filter: brightness(1.04);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.14);
  }

  .product-footer :deep(.add-product-button:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .product-card.is-list {
    flex-direction: row;
    align-items: stretch;
  }

  .product-card.is-list :deep(.p-card-body) {
    flex-direction: row;
  }

  .product-card.is-list :deep(.p-card-header) {
    flex: 0 0 auto;
    width: auto;
    height: auto;
    aspect-ratio: 2 / 3;
    align-self: stretch;
    position: relative;
    overflow: hidden;
  }

  .product-card.is-list :deep(.p-card-header)::after {
    position: absolute;
    inset: 0 0 0 66.667%;
    background: linear-gradient(to right, transparent 0%, var(--secondary-color) 100%);
    content: '';
    pointer-events: none;
  }

  .product-card.is-list .product-image {
    position: absolute;
    inset: 0;
    width: 100%;
    min-width: 0;
    height: 100%;
    min-height: 0;
    object-fit: cover;
    object-position: center;
  }

  .product-card.is-list .product-body {
    padding: 1rem 1.2rem;
  }

  @media (max-width: 900px) {
    .product-card:not(.is-list) .product-body {
      justify-content: center;
      align-items: center;
      gap: 0.6rem;
      padding: 0.7rem;
      text-align: center;
    }

    .product-card:not(.is-list) .category-badge {
      top: 0.4rem;
      right: 0.4rem;
      padding: 0.1rem 0.45rem;
      font-size: 0.6rem;
    }

    .product-card:not(.is-list) .add-fab.p-button {
      right: 0.5rem;
      bottom: 0.5rem;
      width: 2.5rem;
      height: 2.5rem;
    }

    .product-card:not(.is-list) .add-fab :deep(.p-button-icon) {
      font-size: 1.1rem;
    }

    .product-card:not(.is-list) .image-price {
      left: 0.4rem;
      bottom: 0.4rem;
      padding: 0.15rem 0.45rem;
      font-size: 0.65rem;
    }

    .product-card:not(.is-list) .product-description {
      font-size: 0.8rem;
      line-height: 1.4;
      max-height: 2.8em;
    }

    .product-card:not(.is-list) .meta-row {
      justify-content: center;
    }

    .product-card:not(.is-list) .product-footer {
      justify-content: center;
      margin-top: 0;
    }

    .product-card:not(.is-list) .product-footer :deep(.add-product-button) {
      display: none;
    }

    .product-card:not(.is-list) h3 {
      font-size: 1rem;
      overflow-wrap: anywhere;
    }

    .product-card:not(.is-list) .product-quantity {
      width: 100%;
      gap: 0.3rem;
      padding: 0.35rem 0.4rem;
      font-size: 0.85rem;
    }

    .product-card:not(.is-list) .product-quantity :deep(.p-button) {
      flex: 0 0 auto;
      width: 1.8rem;
      height: 1.8rem;
    }

    .product-card:not(.is-list) .product-footer {
      flex-direction: column;
      align-items: stretch;
      gap: 0.5rem;
    }

    .product-card:not(.is-list) .product-subtotal {
      font-size: 1.2rem;
    }
  }

  @media (max-width: 499px) {
    .product-card.is-list .meta-row {
      display: flex;
    }

    .product-card.is-list .product-image {
      display: none;
    }
    .product-card.is-list :deep(.p-card-header) {
      display: none;
    }
  }
</style>