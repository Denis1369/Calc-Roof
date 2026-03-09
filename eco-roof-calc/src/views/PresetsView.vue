<template>
  <div class="eco-container">
    <header class="header">
      <h1>Выбор кровельной системы</h1>
      <p>Выберите готовый пресет (систему) для быстрого расчета сметы</p>
    </header>

    <div class="systems-grid">
      <div 
        class="system-card" 
        v-for="system in roofSystems" 
        :key="system.id"
        @click="goToCalculator(system.id)"
      >
        <div class="card-image-placeholder" :style="{ background: system.color }">
          <span class="icon">{{ system.icon }}</span>
        </div>
        
        <div class="card-content">
          <h3 class="system-title">{{ system.title }}</h3>
          <p class="system-desc">{{ system.description }}</p>
          
          <div class="system-features">
            <span class="badge badge-base" title="Несущее основание">Основание: {{ system.base }}</span>
            <span class="badge badge-insul" title="Тип теплоизоляции">Утеплитель: {{ system.insulation }}</span>
            <span class="badge badge-top" title="Гидроизоляционный ковер">Покрытие: {{ system.topCoat }}</span>
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
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();


const roofSystems = ref([
  {
    id: 'tn-krovlya-smart',
    title: 'ТН-КРОВЛЯ Смарт',
    description: 'Традиционная система неэксплуатируемой крыши по стальному профилированному настилу с кровельным ковром из полимерной мембраны.',
    base: 'Профлист',
    insulation: 'Каменная вата',
    topCoat: 'ПВХ мембрана',
    icon: '🏭',
    color: 'linear-gradient(135deg, #1976d2 0%, #64b5f6 100%)'
  },
  {
    id: 'tn-krovlya-classic',
    title: 'ТН-КРОВЛЯ Классик',
    description: 'Система неэксплуатируемой крыши по бетонному основанию с кровельным ковром из битумно-полимерных материалов.',
    base: 'Железобетон',
    insulation: 'Каменная вата',
    topCoat: 'Битумная гидроизоляция',
    icon: '🏢',
    color: 'linear-gradient(135deg, #2e7d32 0%, #81c784 100%)'
  },
  {
    id: 'tn-krovlya-expert-pir',
    title: 'ТН-КРОВЛЯ Эксперт PIR',
    description: 'Система плоской крыши по стальному профнастилу с утеплением из плит теплоизоляционных PIR и кровельным ковром из ПВХ мембраны.',
    base: 'Профлист',
    insulation: 'PIR-плиты',
    topCoat: 'ПВХ мембрана',
    icon: '⚡',
    color: 'linear-gradient(135deg, #f57c00 0%, #ffb74d 100%)'
  },
  {
    id: 'tn-krovlya-trotuar',
    title: 'ТН-КРОВЛЯ Тротуар',
    description: 'Эксплуатируемая крыша под пешеходную нагрузку с финишным покрытием из тротуарной плитки.',
    base: 'Железобетон',
    insulation: 'XPS (Экструзия)',
    topCoat: 'Тротуарная плитка',
    icon: '🚶',
    color: 'linear-gradient(135deg, #5d4037 0%, #a1887f 100%)'
  }
]);


function goToCalculator(systemId) {
  router.push({ 
    path: '/calculator', 
    query: { preset: systemId } 
  });
}
</script>

<style scoped>
.eco-container { max-width: 1400px; margin: 0 auto; padding: 2rem; font-family: 'Inter', sans-serif; }
.header { text-align: center; margin-bottom: 3rem; }
.header h1 { color: #1f2937; font-size: 2.2rem; margin-bottom: 0.5rem; }
.header p { color: #6b7280; font-size: 1.1rem; }

.systems-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2rem;
}

.system-card {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  border: 1px solid #f3f4f6;
}

.system-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.card-image-placeholder {
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.card-image-placeholder .icon {
  font-size: 4rem;
  filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.2));
}

.card-content {
  padding: 1.5rem;
  flex-grow: 1;
}

.system-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  margin-top: 0;
  margin-bottom: 0.75rem;
}

.system-desc {
  font-size: 0.9rem;
  color: #4b5563;
  line-height: 1.5;
  margin-bottom: 1.5rem;
  min-height: 65px; 
}

.system-features {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.badge {
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badge-base { background: #e5e7eb; color: #374151; }
.badge-insul { background: #fef3c7; color: #92400e; }
.badge-top { background: #e0f2fe; color: #0369a1; }

.card-footer {
  padding: 1rem 1.5rem;
  background: #f9fafb;
  border-top: 1px solid #f3f4f6;
}

.btn-calculate {
  width: 100%;
  background: none;
  border: none;
  color: #2e7d32;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  text-align: right;
  transition: color 0.2s;
}

.system-card:hover .btn-calculate {
  color: #1b5e20;
}
</style>