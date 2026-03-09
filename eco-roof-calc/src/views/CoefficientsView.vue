<template>
  <div class="coefficients-view">
    <h2>Справочник коэффициентов и норм расхода</h2>
    <p class="subtitle">Эти значения можно будет выбирать прямо по названию при создании формул.</p>

    <div class="table-container">
      <div class="toolbar">
        <button @click="addCoefficient" class="btn-add">+ Добавить коэффициент</button>
        <input 
          v-model="searchQuery" 
          placeholder="🔍 Поиск по категории или названию..." 
          class="search-input" 
        />
      </div>
      
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
              <input v-model="coef.заголовок" placeholder="Напр: Кровля" class="cell-input bold text-blue" />
            </td>
            <td>
              <input v-model="coef.название" placeholder="Напр: Запас на перехлесты ПВХ" class="cell-input" />
            </td>
            <td>
              <input type="number" v-model.number="coef.значение" step="0.001" class="cell-input center bold" />
            </td>
            <td class="center">
              <button @click="saveCoefficient(coef)" class="btn-icon" title="Сохранить">💾</button>
              <button @click="deleteCoefficient(coef)" class="btn-icon text-danger" title="Удалить">🗑️</button>
            </td>
          </tr>
          <tr v-if="filteredCoefficients.length === 0">
            <td colspan="4" class="center text-muted" style="padding: 20px;">Ничего не найдено</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getDb } from '../database.js'

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

const saveCoefficient = async (coef) => {
  if (!coef.название) {
    alert('Заполните название!')
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
  } catch (error) {
    console.error('Ошибка сохранения:', error)
  }
}

const deleteCoefficient = async (coef) => {
  if (!confirm('Удалить коэффициент?')) return
  if (!coef.идентификатор) {
    coefficients.value = coefficients.value.filter(c => c.tempId !== coef.tempId)
    return
  }
  try {
    const db = await getDb()
    await db.execute('DELETE FROM Справочник_коэффициентов WHERE идентификатор = $1', [coef.идентификатор])
    await loadCoefficients()
  } catch (error) {
    console.error('Ошибка удаления:', error)
  }
}
</script>

<style scoped>
.coefficients-view { padding: 20px; }
.subtitle { color: #666; margin-bottom: 20px; }
.table-container { background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }


.toolbar { display: flex; gap: 15px; margin-bottom: 1rem; align-items: center; }
.search-input { flex: 1; padding: 10px 15px; border: 1px solid #ced4da; border-radius: 4px; font-size: 1rem; outline: none; transition: border-color 0.2s; }
.search-input:focus { border-color: #4CAF50; box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2); }

.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
.data-table th { background-color: #f2f2f2; }
.cell-input { width: 100%; border: none; padding: 8px; outline: none; background: transparent; font-size: 1rem; }
.cell-input:focus { background: #f0f8ff; border-radius: 4px; }
.bold { font-weight: bold; }
.text-blue { color: #1976d2; }
.text-muted { color: #999; }
.col-category { width: 150px; }
.col-value { width: 120px; text-align: center; }
.col-actions { width: 100px; text-align: center; }
.center { text-align: center; }
.btn-add { background: #4CAF50; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap; }
.btn-icon { background: none; border: none; font-size: 1.2rem; cursor: pointer; padding: 0 5px; }
.text-danger { color: red; }
</style>