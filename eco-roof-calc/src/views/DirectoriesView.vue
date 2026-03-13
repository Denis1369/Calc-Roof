<template>
  <div class="eco-container">
    <header class="header">
      <h1>Управление справочниками</h1>
      <p>База материалов и расценок на работы</p>
    </header>

    <div class="tabs">
      <button :class="{ active: activeTab === 'materials' }" @click="activeTab = 'materials'">Материалы (Каталог)</button>
      <button :class="{ active: activeTab === 'works' }" @click="activeTab = 'works'">Работы (Сгруппированные)</button>
    </div>

    <DirectoryMaterialsTab v-if="activeTab === 'materials'" :dir="dir" />
    <DirectoryWorksTab v-if="activeTab === 'works'" :dir="dir" />

  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useDirectories } from '../composables/useDirectories.js';
import DirectoryMaterialsTab from '../components/DirectoryMaterialsTab.vue';
import DirectoryWorksTab from '../components/DirectoryWorksTab.vue';

const activeTab = ref('materials');


const dir = reactive(useDirectories());

onMounted(() => {
  dir.loadData();
});
</script>

<style scoped>
.eco-container { 
  max-width: 1400px; 
  margin: 0 auto; 
  padding: 2rem; 
  font-family: 'Inter', sans-serif; 
}
.header h1 { 
  color: #FFFFFF; 
  margin-bottom: 0.5rem; 
}
.tabs { 
  display: flex; 
  gap: 1rem; 
  margin-bottom: 2rem; 
  border-bottom: 2px solid #4A5A63; 
  padding-bottom: 0.5rem; 
}
.tabs button { 
  background: none; 
  border: none; 
  font-size: 1.1rem; 
  font-weight: 600; 
  color: #A0B1BA; 
  cursor: pointer; 
  padding: 0.5rem 1rem; 
  border-radius: 6px; 
  transition: 0.2s; 
}
.tabs button:hover { 
  background: rgba(255, 255, 255, 0.05); 
}
.tabs button.active { 
  color: #F29A2E; 
  background: rgba(242, 154, 46, 0.1); 
}
</style>