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
const hoveredQuantityControl = ref('')

watch(() => [props.inCart, props.busy], ([inCart, busy]) => {
  if (!busy) displayInCart.value = inCart
}, { immediate: true })
watch(() => props.product.image, () => {
  imageFailed.value = false
})
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
    </template>

    <template #content>
      <div class="product-body">
      <div class="meta-row">
        <Tag :value="product.category" severity="primary" rounded />
        <small class="product-price-base">
          ${{ product.pricePerType.toFixed(2) }} / {{ product.productType === 'weight' ? 'kg' : 'u' }}
        </small>
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

  .product-image-fallback i {
    color: var(--primary-color);
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
    display: flex;
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
    background: color-mix(in srgb, var(--secondary-color) 20%, #fff);
    border: 1px solid color-mix(in srgb, var(--secondary-color) 52%, #fff);
    font-weight: 700;
  }

  .product-quantity :deep(.p-button) {
    width: 2rem;
    height: 2rem;
    color: var(--primary-color);
  }

  .product-quantity :deep(.p-button:focus-visible) {
    box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--primary-color) 26%, transparent);
  }

  .meta-row :deep(.p-tag) {
    flex-shrink: 0;
    font-size: 0.72rem;
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
    color: #fff;
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
    flex: 0 0 170px;
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
    .product-card.is-list :deep(.p-card-header) {
      display: none;
    }
  }
</style>