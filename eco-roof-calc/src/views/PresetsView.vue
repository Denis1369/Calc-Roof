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
    'linear-gradient(135deg, #2A3439 0%, #37444B 100%)',
    'linear-gradient(135deg, #F29A2E 0%, #D98826 100%)',
    'linear-gradient(135deg, #37444B 0%, #4A5A63 100%)',
    'linear-gradient(135deg, #21292E 0%, #2A3439 100%)'
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
.eco-container { max-width: 1400px; margin: 0 auto; padding: 2rem; font-family: 'Inter', sans-serif; color: #FFFFFF; }
.header { text-align: center; margin-bottom: 3rem; }
.header h1 { color: #FFFFFF; font-size: 2.2rem; margin-bottom: 0.5rem; }
.header p { color: #A0B1BA; }

.systems-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2rem;
}

.system-card {
  background: #37444B;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  transition: all 0.3s ease;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  border: 1px solid #4A5A63;
}

.system-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 24px rgba(242, 154, 46, 0.15);
  border-color: #F29A2E;
}

.custom-bg { background: #21292E !important; }

.card-image-placeholder {
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
  border-bottom: 1px solid #4A5A63;
}

.card-image-placeholder .icon { font-size: 4rem; }

.card-content { padding: 1.5rem; flex-grow: 1; }
.system-title { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.75rem; color: #FFFFFF; }
.system-desc { font-size: 0.9rem; color: #A0B1BA; min-height: 60px; line-height: 1.4; }

.system-features { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem;}
.badge { font-size: 0.8rem; font-weight: 600; padding: 0.4rem 0.8rem; border-radius: 6px; display: inline-block; width: fit-content; }
.badge-custom { background: #21292E; color: #A0B1BA; border: 1px solid #4A5A63; }
.badge-insul { background: rgba(242, 154, 46, 0.1); color: #F29A2E; border: 1px solid #F29A2E; }

.card-footer { padding: 1rem 1.5rem; background: #21292E; border-top: 1px solid #4A5A63; }
.btn-calculate { width: 100%; background: none; border: none; color: #F29A2E; font-weight: 700; cursor: pointer; text-align: right; transition: 0.2s; font-size: 0.95rem; }
.system-card:hover .btn-calculate { color: #D98826; }
</style>