export const formatCurrency = (amount, currency = 'ARS') => new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency
}).format(Number(amount) || 0)