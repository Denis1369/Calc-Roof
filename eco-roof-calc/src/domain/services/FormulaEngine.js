export function evaluateFormula({ expression, context = {} }) {
  // TODO: сюда потом добавим безопасный движок формул
  // Пока минимальная заглушка
  if (!expression) return 0
  if (typeof expression === 'number') return expression

  const area = Number(context.area ?? 0)
  if (expression === 'AREA') return area

  return 0
}
