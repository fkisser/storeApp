<script setup>
import { ref, watch } from 'vue'

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
watch(() => [props.inCart, props.busy], ([inCart, busy]) => {
  if (!busy) displayInCart.value = inCart
}, { immediate: true })
watch(() => props.product.image, () => {
  imageFailed.value = false
})
</script>

<template>
  <article class="product-card" :class="{ 'is-list': layout === 'list' }">
    <img
      v-if="product.image && !imageFailed"
      class="product-image"
      :src="product.image"
      :alt="product.name"
      loading="lazy"
      @error="imageFailed = true"
    />
    <div v-else class="product-image product-image-fallback" role="img" :aria-label="`Imagen de ${product.name} no disponible`">
      <svg v-if="product.imageFallback === 'pastry'" viewBox="0 0 64 64" aria-hidden="true"><path d="M10 48h44L48 21H16L10 48Zm7-27c0-7 7-7 7-14m8 14c0-7 7-7 7-14m-19 38v-9m12 9v-9m12 9v-9" /></svg>
      <svg v-else-if="product.imageFallback === 'accessory'" viewBox="0 0 64 64" aria-hidden="true"><path d="M15 25h30l-3 27H18l-3-27Zm30 5h4a8 8 0 0 1 0 16h-6M21 19h18m-15-7h12v7H24z" /></svg>
      <svg v-else viewBox="0 0 64 64" aria-hidden="true"><path d="M14 25h31l-3 27H17l-3-27Zm31 5h5a7 7 0 0 1 0 14h-7M21 18c0-5 6-5 6-11m5 11c0-5 6-5 6-11" /></svg>
    </div>

    <div class="product-body">
      <div class="meta-row">
        <span>{{ product.category }}</span>
        <small class="product-price-base">
          ${{ product.pricePerType.toFixed(2) }} / {{ product.productType === 'weight' ? 'kg' : 'u' }}
        </small>
      </div>

      <h3>{{ product.name }}</h3>
      <p class="product-description">{{ product.description }}</p>

      <div class="product-quantity" aria-label="Seleccionar cantidad">
        <button
          type="button"
          :disabled="busy || (unavailable && !decreaseRemovesItem) || decreaseDisabled"
          :aria-label="decreaseRemovesItem ? `Eliminar ${product.name} del carrito` : `Reducir cantidad de ${product.name}`"
          @click="decreaseRemovesItem ? $emit('remove-from-cart') : $emit('change-quantity', -product.step)"
        >
          <svg v-if="decreaseRemovesItem" class="delete-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 3h10l1 2h4v2H2V5h4l1-2Zm-1 6h12l-1 12H7L6 9Z" />
          </svg>
          <template v-else>−</template>
        </button>
        <span>{{ quantityLabel }}</span>
        <button
          type="button"
          :disabled="busy || unavailable || increaseDisabled"
          :aria-label="`Aumentar cantidad de ${product.name}`"
          @click="$emit('change-quantity', product.step)"
        >+</button>
      </div>

      <div class="product-footer">
        <strong class="product-subtotal">${{ subtotal.toFixed(2) }}</strong>
        <button
          type="button"
          :disabled="busy || inCart || unavailable"
          :aria-label="busy ? 'Procesando producto' : inCart ? `Añadido ${product.name}` : product.isSoldOut ? `Agotado ${product.name}` : `Añadir ${product.name}`"
          @click="$emit('add-to-cart')"
        >
          <span class="button-content" :class="{ 'is-loading': busy }" aria-hidden="true">
            <span class="button-icon">{{ displayInCart ? '✓' : '＋' }}</span>
            {{ product.isSoldOut ? 'Agotado' : displayInCart ? 'Añadido' : 'Añadir' }}
          </span>
          <span v-if="busy" class="loading-spinner" aria-hidden="true"></span>
        </button>
      </div>
    </div>
  </article>
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

  .product-card:hover {
    box-shadow: 0 22px 40px rgba(17, 24, 39, 0.12), 0 8px 16px rgba(17, 24, 39, 0.06);
  }

  .product-image {
    width: 100%;
    height: 220px;
    object-fit: cover;
    background: #f4f4f4;
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

  .product-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 0.9rem;
    padding: 1rem;
  }

  .meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    color: #4b5563;
    font-size: 0.85rem;
  }

  .meta-row span {
    background: #eefaf4;
    color: #1e7c55;
    border-radius: 999px;
    padding: 0.35rem 0.7rem;
    font-weight: 700;
  }

  .product-price-base {
    color: #4b5563;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.02em;
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
    color: #4b5563;
    line-height: 1.5;
    min-height: 48px;
  }

  .product-quantity {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    padding: 0.5rem 0.7rem;
    border-radius: 12px;
    background: #f5f5f5;
    border: 1px solid #e5e7eb;
    font-weight: 700;
  }

  .product-quantity button {
    width: 2rem;
    height: 2rem;
    border: none;
    border-radius: 50%;
    background: var(--secondary-color);
    color: white;
    font-size: 1.2rem;
    cursor: pointer;
  }

  .product-quantity button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .delete-icon {
    width: 1rem;
    height: 1rem;
    fill: currentColor;
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

  .product-footer button {
    border: none;
    border-radius: 12px;
    background: var(--primary-color);
    color: #fff;
    padding: 0.75rem 1rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.12);
    transition: transform 0.2s ease, filter 0.2s ease, box-shadow 0.2s ease;
  }

  .product-footer button {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
  }

  .button-icon {
    font-size: 1rem;
    line-height: 1;
  }

  .button-content.is-loading {
    visibility: hidden;
  }

  .loading-spinner {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 1rem;
    height: 1rem;
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

  .product-footer button:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: brightness(1.04);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.14);
  }

  .product-footer button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .product-card.is-list {
    flex-direction: row;
    align-items: stretch;
  }

  .product-card.is-list .product-image {
    width: 170px;
    min-width: 170px;
    height: 100%;
    min-height: 170px;
  }

  .product-card.is-list .product-body {
    padding: 1rem 1.2rem;
  }

  @media (max-width: 500px) {
    .product-description {
      display: none;
    }
    .product-card.is-list .product-image {
      display: none;
    }
  }
</style>