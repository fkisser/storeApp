<script setup>
import { computed, reactive, ref } from 'vue'

const props = defineProps({
  items: { type: Array, required: true },
  subtotal: { type: Number, required: true },
  storeName: { type: String, required: true }
})

const emit = defineEmits(['back', 'complete'])

const form = reactive({
  name: '',
  phone: '',
  email: '',
  fulfillment: 'delivery',
  address: '',
  locality: '',
  notes: '',
  payment: 'cash'
})
const sending = ref(false)
const completed = ref(false)
const orderReference = ref('')

const itemCount = computed(() => props.items.reduce((count, item) =>
  count + (item.productType === 'weight' ? 1 : item.quantity), 0
, 0))

const formatQuantity = (item) => {
  if (item.productType === 'weight') {
    return item.quantity >= 1
      ? `${Number(item.quantity.toFixed(2))} kg`
      : `${Math.round(item.quantity * 1000)} g`
  }

  return `${item.quantity.toFixed(0)} u`
}

const confirmOrder = async () => {
  if (sending.value || props.items.length === 0) return

  sending.value = true
  orderReference.value = `VDP-${Math.floor(100000 + Math.random() * 900000)}`
  await new Promise((resolve) => window.setTimeout(resolve, 900))
  completed.value = true
  sending.value = false
  emit('complete')
}
</script>

<template>
  <div class="checkout-page">
    <header class="checkout-topbar">
      <button type="button" class="back-link" :disabled="sending" @click="emit('back')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6M9 12h12" /></svg>
        <span>Volver a la tienda</span>
      </button>
      <p class="checkout-store">{{ storeName }}</p>
    </header>

    <section v-if="completed" class="order-complete" aria-live="polite">
      <div class="success-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg>
      </div>
      <p class="checkout-eyebrow">Pedido confirmado</p>
      <h1>Gracias, {{ form.name }}</h1>
      <p>Registramos tu pedido. Guarda este número de referencia:</p>
      <strong class="order-reference">{{ orderReference }}</strong>
      <button type="button" class="primary-button" @click="emit('back')">Volver a la tienda</button>
    </section>

    <template v-else>
      <div class="checkout-heading">
        <div>
          <p class="checkout-eyebrow">Casi listo</p>
          <h1>Finalizar compra</h1>
        </div>
        <span class="item-count">{{ itemCount }} {{ itemCount === 1 ? 'producto' : 'productos' }}</span>
      </div>

      <form class="checkout-layout" @submit.prevent="confirmOrder">
        <div class="checkout-fields">
          <section class="checkout-section">
            <h2>Datos de contacto</h2>
            <label class="field">
              <span>Nombre y apellido</span>
              <input v-model.trim="form.name" name="name" autocomplete="name" required />
            </label>
            <div class="field-row">
              <label class="field">
                <span>Teléfono</span>
                <input v-model.trim="form.phone" name="phone" type="tel" autocomplete="tel" required />
              </label>
              <label class="field">
                <span>Email <small>Opcional</small></span>
                <input v-model.trim="form.email" name="email" type="email" autocomplete="email" />
              </label>
            </div>
          </section>

          <section class="checkout-section">
            <h2>Cómo recibir tu pedido</h2>
            <div class="choice-grid">
              <label class="choice-option" :class="{ selected: form.fulfillment === 'delivery' }">
                <input v-model="form.fulfillment" type="radio" name="fulfillment" value="delivery" />
                <span class="choice-copy"><strong>Envío a domicilio</strong><small>Coordinamos la entrega contigo</small></span>
              </label>
              <label class="choice-option" :class="{ selected: form.fulfillment === 'pickup' }">
                <input v-model="form.fulfillment" type="radio" name="fulfillment" value="pickup" />
                <span class="choice-copy"><strong>Retiro en tienda</strong><small>Retiras tu pedido personalmente</small></span>
              </label>
            </div>
            <div v-if="form.fulfillment === 'delivery'" class="field-row address-fields">
              <label class="field">
                <span>Dirección</span>
                <input v-model.trim="form.address" name="address" autocomplete="street-address" required />
              </label>
              <label class="field">
                <span>Localidad</span>
                <input v-model.trim="form.locality" name="locality" autocomplete="address-level2" required />
              </label>
              <label class="field field-full">
                <span>Indicaciones para la entrega <small>Opcional</small></span>
                <textarea v-model.trim="form.notes" name="notes" rows="2"></textarea>
              </label>
            </div>
          </section>

          <section class="checkout-section">
            <h2>Forma de pago</h2>
            <div class="choice-grid payment-grid">
              <label class="choice-option" :class="{ selected: form.payment === 'cash' }">
                <input v-model="form.payment" type="radio" name="payment" value="cash" />
                <span class="choice-copy"><strong>Efectivo</strong><small>Al recibir o retirar</small></span>
              </label>
              <label class="choice-option" :class="{ selected: form.payment === 'card' }">
                <input v-model="form.payment" type="radio" name="payment" value="card" />
                <span class="choice-copy"><strong>Tarjeta</strong><small>Al recibir o retirar</small></span>
              </label>
            </div>
          </section>
        </div>

        <aside class="order-summary">
          <h2>Resumen del pedido</h2>
          <ul class="summary-items">
            <li v-for="item in items" :key="item.id">
              <div class="summary-item-copy">
                <strong>{{ item.name }}</strong>
                <span>{{ formatQuantity(item) }}</span>
              </div>
              <strong>${{ (item.pricePerType * item.quantity).toFixed(2) }}</strong>
            </li>
          </ul>
          <div class="summary-totals">
            <div><span>Productos</span><strong>${{ subtotal.toFixed(2) }}</strong></div>
            <div v-if="form.fulfillment === 'delivery'"><span>Envío</span><span>A coordinar</span></div>
            <div v-else><span>Retiro en tienda</span><span>Sin cargo</span></div>
            <div class="summary-total"><span>Total de productos</span><strong>${{ subtotal.toFixed(2) }}</strong></div>
          </div>
          <p v-if="form.fulfillment === 'delivery'" class="delivery-note">El costo de envío se confirma al coordinar la entrega.</p>
          <button class="primary-button submit-order" type="submit" :disabled="sending || items.length === 0">
            {{ sending ? 'Enviando pedido...' : 'Confirmar pedido' }}
          </button>
        </aside>
      </form>
    </template>
  </div>
</template>

<style scoped>
.checkout-page {
  width: min(90vw, 1200px);
  min-height: 100vh;
  margin: 0 auto;
  padding: 1.25rem 0 3rem;
  color: #18251c;
}

.checkout-topbar,
.checkout-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.checkout-topbar {
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(24, 37, 28, 0.12);
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.4rem 0;
  border: 0;
  background: transparent;
  color: #315d36;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.back-link svg {
  width: 1.25rem;
  height: 1.25rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.back-link:disabled {
  opacity: 0.55;
  cursor: wait;
}

.checkout-store {
  margin: 0;
  color: #526256;
  font-size: 0.9rem;
  font-weight: 700;
}

.checkout-heading {
  padding: 2rem 0 1.4rem;
  align-items: end;
}

.checkout-eyebrow {
  margin: 0 0 0.35rem;
  color: #66816b;
  font-size: 0.76rem;
  font-weight: 800;
  text-transform: uppercase;
}

.checkout-heading h1,
.order-complete h1 {
  margin: 0;
  font-size: 1.9rem;
  line-height: 1.2;
}

.item-count {
  color: #617064;
  font-size: 0.9rem;
  font-weight: 700;
}

.checkout-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
  align-items: start;
  gap: clamp(1.5rem, 4vw, 3.5rem);
}

.checkout-fields {
  min-width: 0;
}

.checkout-section {
  padding: 1.35rem 0 1.5rem;
  border-top: 1px solid rgba(24, 37, 28, 0.12);
}

.checkout-section h2,
.order-summary h2 {
  margin: 0 0 1rem;
  font-size: 1.05rem;
}

.field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.4rem;
  color: #39483c;
  font-size: 0.87rem;
  font-weight: 700;
}

.field > span small {
  color: #7c897e;
  font-size: 0.76rem;
  font-weight: 500;
}

.field input,
.field textarea {
  width: 100%;
  min-height: 2.9rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid #cbd4cc;
  border-radius: 8px;
  background: #fff;
  color: #18251c;
  font: inherit;
  font-weight: 400;
  outline: none;
}

.field textarea {
  min-height: 5rem;
  resize: vertical;
}

.field input:focus,
.field textarea:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(46, 125, 50, 0.13);
}

.field-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.choice-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.choice-option {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.9rem;
  border: 1px solid #d7ded8;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
}

.choice-option.selected {
  border-color: var(--primary-color);
  background: rgba(46, 125, 50, 0.06);
}

.choice-option input {
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
  margin: 0.13rem 0 0;
  accent-color: var(--primary-color);
}

.choice-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.2rem;
}

.choice-copy strong {
  font-size: 0.86rem;
}

.choice-copy small {
  color: #667369;
  font-size: 0.76rem;
  line-height: 1.4;
}

.address-fields {
  margin-top: 1rem;
}

.field-full {
  grid-column: 1 / -1;
}

.order-summary {
  position: sticky;
  top: 1rem;
  padding: 1.2rem;
  border: 1px solid rgba(24, 37, 28, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.8);
}

.summary-items {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  max-height: 17rem;
  overflow: auto;
  margin: 0;
  padding: 0 0 1rem;
  list-style: none;
  border-bottom: 1px solid rgba(24, 37, 28, 0.12);
}

.summary-items li,
.summary-totals > div {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.84rem;
}

.summary-item-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.15rem;
}

.summary-item-copy strong {
  line-height: 1.35;
}

.summary-item-copy span,
.summary-totals span {
  color: #647167;
}

.summary-items li > strong {
  flex: 0 0 auto;
}

.summary-totals {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 0 0;
}

.summary-total {
  margin-top: 0.25rem;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(24, 37, 28, 0.12);
  font-size: 1rem !important;
}

.summary-total strong {
  color: #235c2a;
  font-size: 1.1rem;
}

.delivery-note {
  margin: 1rem 0 0;
  color: #67746a;
  font-size: 0.78rem;
  line-height: 1.5;
}

.primary-button {
  display: inline-flex;
  min-height: 2.9rem;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1rem;
  border: 0;
  border-radius: 8px;
  background: var(--primary-color);
  color: #fff;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
  transition: filter 0.2s ease, opacity 0.2s ease;
}

.primary-button:hover:not(:disabled) {
  filter: brightness(1.08);
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.submit-order {
  width: 100%;
  margin-top: 1.2rem;
}

.order-complete {
  display: flex;
  width: min(100%, 600px);
  min-height: 65vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  text-align: center;
}

.success-mark {
  display: grid;
  width: 4rem;
  height: 4rem;
  place-items: center;
  margin-bottom: 1.4rem;
  border-radius: 50%;
  background: rgba(46, 125, 50, 0.12);
  color: var(--primary-color);
}

.success-mark svg {
  width: 2rem;
  height: 2rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.2;
}

.order-complete > p:not(.checkout-eyebrow) {
  color: #59665c;
  line-height: 1.6;
}

.order-reference {
  margin: 0.4rem 0 1.5rem;
  padding: 0.7rem 1rem;
  border-radius: 8px;
  background: rgba(255, 183, 3, 0.2);
  color: #263329;
  font-size: 1.2rem;
  letter-spacing: 0.08em;
}

@media (max-width: 800px) {
  .checkout-layout {
    grid-template-columns: 1fr;
  }

  .order-summary {
    position: static;
  }
}

@media (max-width: 560px) {
  .checkout-page {
    width: min(92vw, 1200px);
  }

  .checkout-store {
    max-width: 45%;
    text-align: right;
  }

  .checkout-heading {
    align-items: flex-start;
  }

  .checkout-heading h1,
  .order-complete h1 {
    font-size: 1.55rem;
  }

  .field-row,
  .choice-grid {
    grid-template-columns: 1fr;
  }
}
</style>
