<script setup>
import { computed, onMounted, ref } from 'vue'
import { formatCurrency } from '../utils/formatCurrency.js'
import { canUploadTransferProof } from '../utils/canUploadTransferProof.js'
import { formatOrderStatus } from '../utils/formatOrderStatus.js'

const props = defineProps({
  orders: { type: Array, required: true },
  requestedOrderId: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  orderErrors: { type: Object, required: true },
  transferErrors: { type: Object, required: true },
  transferSuccess: { type: Object, required: true },
  uploadingProofs: { type: Object, required: true },
  refreshAll: { type: Function, required: true },
  refreshOrder: { type: Function, required: true },
  submitTransferProof: { type: Function, required: true },
  storeName: { type: String, required: true }
})

const emit = defineEmits(['back'])
const showAllOrders = ref(false)
const requestedOrder = computed(() => props.orders.find((order) =>
  String(order.orderId) === props.requestedOrderId
))
const visibleOrders = computed(() => props.requestedOrderId && requestedOrder.value && !showAllOrders.value
  ? [requestedOrder.value]
  : props.orders)

const formatMoney = (amount, currency) => formatCurrency(Number(amount ?? 0), currency || 'ARS')
const formatDate = (value) => value
  ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  : 'Fecha no disponible'

const handleProof = async (order, event) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  try {
    await props.submitTransferProof(order.orderId, file)
  } catch {
    // The composable exposes the actionable error beside this order.
  }
}

onMounted(async () => {
  if (requestedOrder.value) {
    await props.refreshOrder(requestedOrder.value.orderId)
    return
  }
  if (!props.requestedOrderId) await props.refreshAll()
})
</script>

<template>
  <div class="my-orders-page">
    <header class="orders-topbar">
      <Button class="orders-back-link" label="Volver a la tienda" icon="pi pi-arrow-left" text @click="emit('back')" />
      <p>{{ storeName }}</p>
    </header>

    <section class="orders-heading">
      <div>
        <p class="orders-eyebrow">Tu cuenta en esta tienda</p>
        <h1>Mis pedidos</h1>
      </div>
      <Button
        label="Actualizar"
        icon="pi pi-refresh"
        :loading="loading"
        :disabled="loading || !orders.length"
        @click="refreshAll"
      />
    </section>

    <Message v-if="requestedOrderId && !requestedOrder" severity="info" :closable="false" class="orders-empty">
      No hay un token de seguimiento guardado para el pedido #{{ requestedOrderId }} en este navegador. El enlace no incluye ese token; abrilo en el mismo navegador donde realizaste la compra para consultar el estado.
    </Message>

    <Message v-else-if="!orders.length && !requestedOrderId" severity="info" :closable="false" class="orders-empty">
      No tienes pedidos activos guardados en este navegador.
    </Message>

    <section v-if="visibleOrders.length" class="orders-list" aria-label="Pedidos activos">
      <Button
        v-if="requestedOrder && !showAllOrders && orders.length > 1"
        label="Ver todos mis pedidos"
        icon="pi pi-list"
        text
        @click="showAllOrders = true"
      />
      <article v-for="order in visibleOrders" :key="order.orderId" class="order-row">
        <div class="order-row-heading">
          <div>
            <p class="order-number">Pedido #{{ order.orderId }}</p>
            <p class="order-date">{{ formatDate(order.createdAt) }}</p>
          </div>
          <Tag :value="formatOrderStatus(order.orderStatus)" />
        </div>

        <dl class="order-details">
          <div>
            <dt>Modalidad</dt>
            <dd>{{ order.fulfillmentType === 'PICKUP' ? 'Retiro en tienda' : 'Envío a domicilio' }}</dd>
          </div>
          <div>
            <dt>Entrega</dt>
            <dd>{{ formatDate(order.scheduledDate) }}<template v-if="order.scheduledStartsAt">, {{ order.scheduledStartsAt }} a {{ order.scheduledEndsAt }}</template></dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd class="order-total">{{ formatMoney(order.totalAmount, order.currency) }}</dd>
          </div>
          <div>
            <dt>Pago</dt>
            <dd>{{ order.paymentProvider === 'TRANSFER' ? 'Transferencia' : 'Efectivo' }}</dd>
          </div>
        </dl>

        <Message v-if="orderErrors[order.orderId]" severity="error" :closable="false">
          {{ orderErrors[order.orderId] }}
          <Button label="Reintentar" icon="pi pi-refresh" text @click="refreshOrder(order.orderId)" />
        </Message>

        <div v-if="canUploadTransferProof(order)" class="proof-region">
          <p v-if="order.transferAlias" class="transfer-instructions">
            Transferí a <strong>{{ order.transferAlias }}</strong>
            <template v-if="order.transferAccountHolder">, titular <strong>{{ order.transferAccountHolder }}</strong></template>.
          </p>
          <label class="proof-input-label">
            <i class="pi pi-upload" aria-hidden="true"></i>
            <span>{{ uploadingProofs[order.orderId] ? 'Enviando comprobante...' : 'Adjuntar comprobante' }}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              :disabled="uploadingProofs[order.orderId]"
              :aria-label="`Adjuntar comprobante para el pedido ${order.orderId}`"
              @change="handleProof(order, $event)"
            >
          </label>
          <Message v-if="transferSuccess[order.orderId]" severity="success" :closable="false" class="transfer-success-message">
            {{ transferSuccess[order.orderId] }}
          </Message>
          <Message v-if="transferErrors[order.orderId]" severity="error" :closable="false">
            {{ transferErrors[order.orderId] }}
          </Message>
          <small>JPEG, PNG o WebP, hasta 5 MiB.</small>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.my-orders-page {
  width: min(90vw, 900px);
  min-height: 100vh;
  margin: 0 auto;
  padding: 1.25rem 0 3rem;
  color: #18251c;
}

.orders-topbar,
.orders-heading,
.order-row-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.orders-topbar {
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(24, 37, 28, 0.12);
}

.orders-topbar p {
  margin: 0;
  color: var(--primary-color);
  font-size: 0.9rem;
  font-weight: 700;
}

.orders-heading {
  align-items: end;
  padding: 2rem 0 1.4rem;
}

.orders-eyebrow {
  margin: 0 0 0.35rem;
  color: var(--primary-color);
  font-size: 0.76rem;
  font-weight: 800;
  text-transform: uppercase;
}

.orders-heading h1 {
  margin: 0;
  font-size: 1.9rem;
}

.orders-back-link {
  --p-button-text-primary-color: var(--primary-color);
  --p-button-text-primary-hover-background: transparent;
  --p-button-text-primary-active-background: transparent;
  border: 0;
  background: transparent;
  color: var(--primary-color);
  box-shadow: none;
  transform: none;
  transition: none;
}

:deep(.p-button.orders-back-link:not(:disabled):hover) {
  border: 0;
  background: transparent;
  color: var(--primary-color);
  box-shadow: none;
  transform: none;
}

.orders-empty {
  margin-top: 1rem;
}

.transfer-success-message {
  --p-message-success-background: var(--secondary-color);
  --p-message-success-border-color: var(--secondary-color);
  --p-message-success-color: var(--secondary-contrast-color);
  --p-message-text-color: var(--secondary-contrast-color);
}

.orders-list {
  border-top: 1px solid rgba(24, 37, 28, 0.14);
}

.order-row {
  display: grid;
  gap: 1rem;
  padding: 1.25rem 0;
  border-bottom: 1px solid rgba(24, 37, 28, 0.14);
}

.order-number,
.order-date {
  margin: 0;
}

.order-number {
  font-weight: 800;
}

.order-date,
.order-details dt,
.proof-region small {
  color: #647167;
  font-size: 0.82rem;
}

.order-details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem 1.5rem;
  margin: 0;
}

.order-details div {
  min-width: 0;
}

.order-details dt,
.order-details dd {
  margin: 0;
}

.order-details dd {
  margin-top: 0.2rem;
  font-size: 0.9rem;
  font-weight: 700;
}

.order-total,
.transfer-instructions strong {
  color: var(--primary-color);
}

.proof-region {
  display: grid;
  justify-items: start;
  gap: 0.65rem;
}

.transfer-instructions {
  margin: 0;
  font-size: 0.9rem;
}

.proof-input-label {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.7rem;
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--primary-color);
  border-radius: 6px;
  color: var(--primary-color);
  font-weight: 700;
  cursor: pointer;
}

.proof-input-label:focus-within {
  outline: 3px solid var(--p-focus-ring-color);
}

.proof-input-label input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

@media (max-width: 560px) {
  .orders-heading,
  .order-row-heading {
    align-items: flex-start;
  }

  .orders-heading {
    flex-direction: column;
  }

  .order-details {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>