<template>
  <div class="coefficients-view">
    <div class="page-header">
      <h2 class="ui-title">Справочник коэффициентов и норм расхода</h2>
      <p class="subtitle">Эти значения можно будет выбирать прямо по названию при создании формул.</p>
    </div>

    <div class="table-container page-card">
      <div class="toolbar">
        <button @click="addCoefficient" class="ui-btn ui-btn-primary">+ Добавить коэффициент</button>
        <input
          v-model="searchQuery"
          placeholder="🔍 Поиск по категории или названию..."
          class="ui-input search-input"
        />
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-category">Категория</th>
              <th>Понятное название (для поиска в формулах)</th>
              <th class="col-value">Значение</th>
              <th class="col-actions">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="coef in filteredCoefficients" :key="coef.идентификатор || coef.tempId">
              <td>
                <input v-model="coef.заголовок" placeholder="Напр: Кровля" class="cell-input bold accent-text" />
              </td>
              <td>
                <input v-model="coef.название" placeholder="Напр: Запас на перехлесты ПВХ" class="cell-input" />
              </td>
              <td>
                <input type="number" v-model.number="coef.значение" step="0.001" class="cell-input center bold" />
              </td>
              <td class="center">
                <button @click="saveCoefficient(coef)" class="btn-icon" title="Сохранить">💾</button>
                <button @click="deleteCoefficient(coef)" class="btn-icon danger-text" title="Удалить">🗑️</button>
              </td>
            </tr>
            <tr v-if="filteredCoefficients.length === 0">
              <td colspan="4" class="center text-muted empty-cell">Ничего не найдено</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getDb } from '../database.js'
import { alerts } from '../utils/alerts.js'

const coefficients = ref([])
const searchQuery = ref('')

onMounted(async () => {
  await loadCoefficients()
})

async function loadCoefficients() {
  try {
    const db = await getDb()
    coefficients.value = await db.select('SELECT * FROM Справочник_коэффициентов ORDER BY заголовок, название')
  } catch (error) {
    console.error('Ошибка загрузки коэффициентов:', error)
  }
}

const filteredCoefficients = computed(() => {
  if (!searchQuery.value) return coefficients.value
  const q = searchQuery.value.toLowerCase()
  return coefficients.value.filter(c =>
    (c.название && c.название.toLowerCase().includes(q)) ||
    (c.заголовок && c.заголовок.toLowerCase().includes(q))
  )
})

const addCoefficient = () => {
  coefficients.value.unshift({ tempId: Date.now(), заголовок: '', название: '', значение: 1 })
  searchQuery.value = ''
}

const saveCoefficient = async coef => {
  if (!coef.название) {
    alerts.showWarning('Внимание', 'Заполните название коэффициента!')
    return
  }

  try {
    const db = await getDb()
    if (coef.идентификатор) {
      await db.execute(
        'UPDATE Справочник_коэффициентов SET заголовок = $1, название = $2, значение = $3 WHERE идентификатор = $4',
        [coef.заголовок, coef.название, coef.значение, coef.идентификатор]
      )
    } else {
      await db.execute(
        'INSERT INTO Справочник_коэффициентов (заголовок, название, значение) VALUES ($1, $2, $3)',
        [coef.заголовок, coef.название, coef.значение]
      )
    }
    await loadCoefficients()
    alerts.success('Коэффициент сохранен!')
  } catch (error) {
    console.error('Ошибка сохранения:', error)
    alerts.error('Ошибка при сохранении')
  }
}

const deleteCoefficient = async coef => {
  const { isConfirmed } = await alerts.confirmDelete('Удалить коэффициент?')

  if (!isConfirmed) return

  if (!coef.идентификатор) {
    coefficients.value = coefficients.value.filter(c => c.tempId !== coef.tempId)
    alerts.info('Коэффициент удален')
    return
  }

  try {
    const db = await getDb()
    await db.execute('DELETE FROM Справочник_коэффициентов WHERE идентификатор = $1', [coef.идентификатор])
    await loadCoefficients()
    alerts.info('Коэффициент удален')
  } catch (error) {
    console.error('Ошибка удаления:', error)
    alerts.error('Ошибка при удалении')
  }
}
</script>

<style scoped>
.coefficients-view {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.subtitle {
  color: var(--text-soft);
  margin: 10px 0 0;
}

.table-container {
  padding: 20px;
}

.toolbar {
  display: flex;
  gap: 15px;
  margin-bottom: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 260px;
}

.table-wrap {
  width: 100%;
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;
}

.data-table th,
.data-table td {
  border: 1px solid var(--border-color);
  padding: 8px;
  text-align: left;
  color: var(--text-main);
}

.data-table th {
  background: var(--bg-card-soft);
  color: var(--text-soft);
  font-size: 0.85rem;
  border-bottom: 2px solid var(--accent);
}

.cell-input {
  width: 100%;
  border: none;
  padding: 8px;
  outline: none;
  background: transparent;
  font-size: 1rem;
  color: var(--text-main);
  transition: background var(--transition-fast), box-shadow var(--transition-fast);
  box-sizing: border-box;
}

.cell-input:focus {
  background: var(--bg-hover);
  border-radius: 6px;
  box-shadow: inset 0 0 0 2px var(--accent);
}

.bold {
  font-weight: 700;
}

.accent-text {
  color: var(--accent);
}

.text-muted {
  color: var(--text-soft);
}

.danger-text {
  color: var(--danger);
}

.col-category {
  width: 150px;
}

.col-value {
  width: 120px;
  text-align: center;
}

.col-actions {
  width: 100px;
  text-align: center;
}

.center {
  text-align: center;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0 5px;
  color: var(--text-soft);
  opacity: 0.8;
  transition: transform var(--transition-fast), opacity var(--transition-fast), color var(--transition-fast);
}

.btn-icon:hover {
  opacity: 1;
  transform: scale(1.15);
  color: var(--accent);
}

.empty-cell {
  padding: 20px;
}

input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  -moz-appearance: textfield;
}

@media (max-width: 700px) {
  .coefficients-view {
    padding: 16px;
  }

  .table-container {
    padding: 16px;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input {
    min-width: 0;
  }
}
</style>