<template>
  <div class="eco-container">
    <header class="header">
      <h1>Выбор кровельной системы</h1>
      <p>Выберите готовую систему из базы или создайте расчет с нуля</p>
    </header>

    <div class="systems-grid">
      <div class="system-card custom-card" @click="goToCalculator(null)">
        <div class="card-image-placeholder custom-bg">
          <span class="icon">🏗️</span>
        </div>
        <div class="card-content">
          <h3 class="system-title">Свой вариант</h3>
          <p class="system-desc">Создать пустую смету и самостоятельно добавить нужные работы и материалы.</p>
          <div class="system-features">
            <span class="badge badge-custom">Свободная конфигурация</span>
          </div>
        </div>
        <div class="card-footer">
          <button class="btn-calculate">Начать с нуля ➔</button>
        </div>
      </div>

      <div 
        class="system-card" 
        v-for="(system, index) in roofSystems" 
        :key="system.идентификатор"
        @click="goToCalculator(system.идентификатор)"
      >
        <div class="card-image-placeholder" :style="{ background: getGradient(index) }">
          <span class="icon">{{ getIcon(system.название) }}</span>
        </div>
        
        <div class="card-content">
          <h3 class="system-title">{{ system.название }}</h3>
          <p class="system-desc">
            {{ system.название.includes('Смарт') ? 'Оптимальное решение для складских комплексов.' : 'Профессиональная система повышенной надежности.' }}
          </p>
          
          <div class="system-features">
            <span class="badge badge-insul">Шаблон из справочника</span>
          </div>
        </div>

        <div class="card-footer">
          <button class="btn-calculate">Рассчитать систему ➔</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getDb } from '../database.js';

const router = useRouter();
const roofSystems = ref([]);

onMounted(async () => {
  try {
    const db = await getDb();
    
    roofSystems.value = await db.select('SELECT * FROM Справочник_шаблонов');
  } catch (e) {
    console.error("Ошибка загрузки шаблонов:", e);
  }
});


function goToCalculator(systemId) {
  router.push({ 
    path: '/calculator', 
    query: systemId ? { preset: systemId } : {} 
  });
}


function getGradient(index) {
  const gradients = [
    'linear-gradient(135deg, #1976d2 0%, #64b5f6 100%)',
    'linear-gradient(135deg, #2e7d32 0%, #81c784 100%)',
    'linear-gradient(135deg, #f57c00 0%, #ffb74d 100%)',
    'linear-gradient(135deg, #d32f2f 0%, #ef5350 100%)'
  ];
  return gradients[index % gradients.length];
}

function getIcon(name) {
  if (name.toLowerCase().includes('смарт')) return '🏭';
  if (name.toLowerCase().includes('классик')) return '🏢';
  if (name.toLowerCase().includes('эксперт')) return '⚡';
  return '🏠';
}
</script>

<style scoped>

.eco-container { max-width: 1400px; margin: 0 auto; padding: 2rem; font-family: 'Inter', sans-serif; }
.header { text-align: center; margin-bottom: 3rem; }
.header h1 { color: #1f2937; font-size: 2.2rem; margin-bottom: 0.5rem; }

.systems-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2rem;
}

.system-card {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
  transition: all 0.3s ease;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  border: 1px solid #f3f4f6;
}

.system-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.custom-bg { background: #374151 !important; }
.badge-custom { background: #e2e8f0; color: #475569; }

.card-image-placeholder {
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.card-image-placeholder .icon { font-size: 4rem; }

.card-content { padding: 1.5rem; flex-grow: 1; }
.system-title { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.75rem; }
.system-desc { font-size: 0.9rem; color: #4b5563; min-height: 60px; }

.system-features { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem;}
.badge { font-size: 0.8rem; font-weight: 600; padding: 0.4rem 0.8rem; border-radius: 6px; }
.badge-base { background: #e0f2fe; color: #0369a1; }
.badge-insul { background: #f0fdf4; color: #166534; }

.card-footer { padding: 1rem 1.5rem; background: #f9fafb; border-top: 1px solid #f3f4f6; }
.btn-calculate { width: 100%; background: none; border: none; color: #2e7d32; font-weight: 700; cursor: pointer; text-align: right; }
</style>