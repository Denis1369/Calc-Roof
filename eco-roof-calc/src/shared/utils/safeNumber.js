export function safeNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function safeNullableNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}