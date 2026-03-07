<template>
  <div class="eco-container">
    <header class="header">
      <h1>Управление справочниками</h1>
      <p>База данных номенклатуры материалов и расценок на монтажные работы</p>
    </header>

    <div class="tabs">
      <button 
        :class="['tab-btn', { active: activeTab === 'materials' }]" 
        @click="activeTab = 'materials'"
      >
        Справочник материалов
      </button>
      <button 
        :class="['tab-btn', { active: activeTab === 'works' }]" 
        @click="activeTab = 'works'"
      >
        Справочник видов работ
      </button>
    </div>

    <div v-if="activeTab === 'materials'" class="tab-content">
      <section class="controls-card form-section">
        <h3>Добавить новый материал</h3>
        <form @submit.prevent="addMaterial" class="form-grid">
          <div class="input-group">
            <label>Артикул товара *</label>
            <input v-model="newMaterial.артикул_товара" type="text" placeholder="Например: 082122" required />
          </div>
          <div class="input-group name-group">
            <label>Полное наименование материала *</label>
            <input v-model="newMaterial.полное_наименование_материала" type="text" placeholder="ПВХ-мембрана LogicROOF..." required />
          </div>
          <div class="input-group short-input">
            <label>Ед. изм. *</label>
            <select v-model="newMaterial.единица_измерения" required>
              <option value="м2">м²</option>
              <option value="м3">м³</option>
              <option value="шт">шт</option>
              <option value="пог.м">пог. м</option>
              <option value="кг">кг</option>
              <option value="л">л</option>
              <option value="рул.">рул.</option>
            </select>
          </div>
          <div class="input-group short-input">
            <label>Базовая цена (₽)</label>
            <input v-model.number="newMaterial.базовая_цена" type="number" step="0.01" min="0" required />
          </div>
          <div class="button-group">
            <button type="submit" class="btn-success">+ Добавить</button>
          </div>
        </form>
      </section>

      <section class="result-card">
        <table class="modern-table">
          <thead>
            <tr>
              <th class="col-id">ID</th>
              <th class="col-article">Артикул товара</th>
              <th class="col-name">Наименование материала</th>
              <th class="col-unit">Ед. изм.</th>
              <th class="col-price">Цена (₽)</th>
              <th class="col-action">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="materials.length === 0">
              <td colspan="6" class="empty-state">Справочник материалов пока пуст.</td>
            </tr>
            <tr v-for="mat in materials" :key="mat.идентификатор">
              <td class="col-id">{{ mat.идентификатор }}</td>
              <td class="col-article">{{ mat.артикул_товара }}</td>
              <td>{{ mat.полное_наименование_материала }}</td>
              <td class="center">{{ mat.единица_измерения }}</td>
              <td class="right bold">{{ mat.базовая_цена.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }}</td>
              <td class="center">
                <button @click="deleteMaterial(mat.идентификатор)" class="btn-danger">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <div v-if="activeTab === 'works'" class="tab-content">
      <section class="controls-card form-section work-theme">
        <h3>Добавить новую расценку на работы</h3>
        <form @submit.prevent="addWork" class="form-grid work-grid">
          <div class="input-group name-group">
            <label>Наименование монтажной работы *</label>
            <input v-model="newWork.наименование_работы" type="text" placeholder="Устройство пароизоляции..." required />
          </div>
          <div class="input-group short-input">
            <label>Ед. изм. *</label>
            <select v-model="newWork.единица_измерения_работы" required>
              <option value="м2">м²</option>
              <option value="м/п">м/п</option>
              <option value="шт">шт</option>
              <option value="ед">ед</option>
            </select>
          </div>
          <div class="input-group short-input">
            <label>Стоимость (₽)</label>
            <input v-model.number="newWork.базовая_стоимость_работы" type="number" step="0.01" min="0" required />
          </div>
          <div class="button-group">
            <button type="submit" class="btn-primary">+ Добавить</button>
          </div>
        </form>
      </section>

      <section class="result-card">
        <table class="modern-table">
          <thead>
            <tr>
              <th class="col-id">ID</th>
              <th class="col-name">Наименование работы</th>
              <th class="col-unit">Ед. изм.</th>
              <th class="col-price">Цена за ед. (₽)</th>
              <th class="col-action">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="works.length === 0">
              <td colspan="5" class="empty-state">Справочник работ пока пуст.</td>
            </tr>
            <tr v-for="work in works" :key="work.идентификатор">
              <td class="col-id">{{ work.идентификатор }}</td>
              <td>{{ work.наименование_работы }}</td>
              <td class="center">{{ work.единица_измерения_работы }}</td>
              <td class="right bold">{{ work.базовая_стоимость_работы.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }}</td>
              <td class="center">
                <button @click="deleteWork(work.идентификатор)" class="btn-danger">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getDb } from '../database.js';


const activeTab = ref('materials'); 


const materials = ref([]);
const works = ref([]);


const newMaterial = ref({
  артикул_товара: '',
  полное_наименование_материала: '',
  единица_измерения: 'м2',
  базовая_цена: 0
});


const newWork = ref({
  наименование_работы: '',
  единица_измерения_работы: 'м2',
  базовая_стоимость_работы: 0
});




async function loadMaterials() {
  try {
    const db = await getDb();
    materials.value = await db.select('SELECT * FROM Справочник_материалов ORDER BY идентификатор DESC');
  } catch (error) {
    console.error('Ошибка загрузки материалов:', error);
  }
}

async function addMaterial() {
  try {
    const db = await getDb();
    await db.execute(
      `INSERT INTO Справочник_материалов (артикул_товара, полное_наименование_материала, единица_измерения, базовая_цена) 
       VALUES ($1, $2, $3, $4)`,
      [
        newMaterial.value.артикул_товара,
        newMaterial.value.полное_наименование_материала,
        newMaterial.value.единица_измерения,
        newMaterial.value.базовая_цена
      ]
    );

    
    newMaterial.value.артикул_товара = '';
    newMaterial.value.полное_наименование_материала = '';
    newMaterial.value.базовая_цена = 0;

    await loadMaterials();
  } catch (error) {
    console.error('Ошибка добавления материала:', error);
    alert('Не удалось добавить материал. Возможно, такой артикул товара уже существует!');
  }
}

async function deleteMaterial(id) {
  if (!confirm('Удалить этот материал из базы?')) return;
  try {
    const db = await getDb();
    await db.execute('DELETE FROM Справочник_материалов WHERE идентификатор = $1', [id]);
    await loadMaterials();
  } catch (error) {
    console.error('Ошибка удаления материала:', error);
    alert('Ошибка удаления. Возможно, материал используется в сохраненных пресетах систем.');
  }
}




async function loadWorks() {
  try {
    const db = await getDb();
    works.value = await db.select('SELECT * FROM Справочник_видов_работ ORDER BY идентификатор DESC');
  } catch (error) {
    console.error('Ошибка загрузки работ:', error);
  }
}

async function addWork() {
  try {
    const db = await getDb();
    await db.execute(
      `INSERT INTO Справочник_видов_работ (наименование_работы, единица_измерения_работы, базовая_стоимость_работы) 
       VALUES ($1, $2, $3)`,
      [
        newWork.value.наименование_работы,
        newWork.value.единица_измерения_работы,
        newWork.value.базовая_стоимость_работы
      ]
    );

    
    newWork.value.наименование_работы = '';
    newWork.value.базовая_стоимость_работы = 0;

    await loadWorks();
  } catch (error) {
    console.error('Ошибка добавления работы:', error);
  }
}

async function deleteWork(id) {
  if (!confirm('Удалить эту расценку из базы?')) return;
  try {
    const db = await getDb();
    await db.execute('DELETE FROM Справочник_видов_работ WHERE идентификатор = $1', [id]);
    await loadWorks();
  } catch (error) {
    console.error('Ошибка удаления работы:', error);
  }
}


onMounted(() => {
  loadMaterials();
  loadWorks();
});
</script>

<style scoped>
.eco-container { max-width: 1200px; margin: 0 auto; padding: 2rem; font-family: 'Arial', sans-serif; color: #2c3e50; }
.header h1 { color: #1e3a8a; margin-bottom: 0.5rem; }
.header p { color: #64748b; margin-bottom: 2rem; }


.tabs { display: flex; gap: 1rem; margin-bottom: 1.5rem; border-bottom: 2px solid #e2e8f0; }
.tab-btn { padding: 0.8rem 1.5rem; background: none; border: none; font-size: 1.1rem; font-weight: bold; color: #64748b; cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -2px; transition: 0.2s; }
.tab-btn:hover { color: #1e3a8a; }
.tab-btn.active { color: #1e3a8a; border-bottom-color: #1e3a8a; }

.tab-content { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }


.controls-card { background: #fff; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-bottom: 2rem; border-left: 5px solid #10b981; }
.work-theme { border-left-color: #3b82f6; }
.form-section h3 { margin-top: 0; margin-bottom: 1.5rem; color: #334155; }

.form-grid { display: grid; grid-template-columns: 1fr 2fr 100px 120px 120px; gap: 1rem; align-items: end; }
.work-grid { grid-template-columns: 2fr 100px 150px 120px; }

.input-group { display: flex; flex-direction: column; gap: 0.4rem; }
.input-group label { font-size: 0.85rem; font-weight: bold; color: #475569; }
.input-group input, .input-group select { padding: 0.7rem; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.95rem; }
.input-group input:focus, .input-group select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }

.button-group { display: flex; align-items: flex-end; }
.btn-success { background: #10b981; color: white; border: none; padding: 0.75rem 1rem; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%; transition: 0.2s; }
.btn-success:hover { background: #059669; }
.btn-primary { background: #3b82f6; color: white; border: none; padding: 0.75rem 1rem; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%; transition: 0.2s; }
.btn-primary:hover { background: #2563eb; }
.btn-danger { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; transition: 0.2s; }
.btn-danger:hover { background: #fca5a5; }


.result-card { background: #fff; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.modern-table { width: 100%; border-collapse: collapse; text-align: left; }
.modern-table th { background-color: #f8fafc; color: #475569; padding: 1rem; font-size: 0.9rem; border-bottom: 2px solid #e2e8f0; }
.modern-table td { padding: 1rem; border-bottom: 1px solid #e2e8f0; font-size: 0.95rem; }
.modern-table tbody tr:hover { background-color: #f1f5f9; }

.col-id { width: 60px; color: #94a3b8; font-size: 0.85rem; }
.col-article { font-family: 'Courier New', Courier, monospace; font-weight: bold; color: #10b981; width: 150px; }
.col-unit { width: 100px; text-align: center; }
.col-price { width: 150px; text-align: right; }
.col-action { width: 100px; text-align: center; }

.center { text-align: center; }
.right { text-align: right; }
.bold { font-weight: bold; }
.empty-state { text-align: center; color: #94a3b8; padding: 3rem !important; font-style: italic; }
</style>