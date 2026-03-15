<template>
  <div class="directories-page">
    <header class="page-header">
      <h1 class="ui-title">Управление справочниками</h1>
      <p class="page-subtitle">База материалов и расценок на работы</p>
    </header>

    <div class="tabs-wrap">
      <div class="tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'materials' }"
          @click="activeTab = 'materials'"
        >
          Материалы (Каталог)
        </button>

        <button
          class="tab-btn"
          :class="{ active: activeTab === 'works' }"
          @click="activeTab = 'works'"
        >
          Работы (Сгруппированные)
        </button>
      </div>
    </div>

    <DirectoryMaterialsTab v-if="activeTab === 'materials'" :dir="dir" />
    <DirectoryWorksTab v-if="activeTab === 'works'" :dir="dir" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useDirectories } from '../composables/useDirectories.js'
import DirectoryMaterialsTab from '../components/DirectoryMaterialsTab.vue'
import DirectoryWorksTab from '../components/DirectoryWorksTab.vue'

const activeTab = ref('materials')
const dir = reactive(useDirectories())

onMounted(() => {
  dir.loadData()
})
</script>

<style scoped>
.directories-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  margin-bottom: 24px;
}

.page-subtitle {
  margin: 10px 0 0;
  color: var(--text-soft);
  font-size: 15px;
}

.tabs-wrap {
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border-color);
}

.tabs {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding-bottom: 10px;
}

.tab-btn {
  background: transparent;
  border: 1px solid transparent;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-soft);
  cursor: pointer;
  padding: 10px 14px;
  border-radius: 10px;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
}

.tab-btn:hover {
  background: var(--bg-hover);
  color: var(--text-main);
}

.tab-btn.active {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent);
}

@media (max-width: 700px) {
  .directories-page {
    padding: 16px;
  }

  .tabs {
    flex-direction: column;
    align-items: stretch;
  }

  .tab-btn {
    width: 100%;
    text-align: left;
  }
}
</style>