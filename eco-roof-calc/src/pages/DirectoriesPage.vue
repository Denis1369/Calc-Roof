<template>
  <div class="directories-page">
    <header class="page-header">
      <div>
        <h1 class="ui-title">Управление справочниками</h1>
        <p class="page-subtitle">База материалов, работ, формул, коэффициентов и систем</p>
      </div>

      <div class="database-actions">
        <button class="ui-btn ui-btn-primary" type="button" @click="exportFullDatabase">
          Экспорт всей базы
        </button>
        <button class="ui-btn ui-btn-secondary" type="button" @click="openDatabaseImportDialog">
          Импорт всей базы
        </button>
      </div>
    </header>

    <input
      ref="databaseImportInput"
      type="file"
      accept=".roofcalcdb,.json,application/json"
      class="hidden-file-input"
      @change="handleDatabaseImportFile"
    />

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
import { useDirectories } from '@/modules/directories/useDirectories'
import { exportDatabaseBackup, importDatabaseBackupFile } from '@/core/services/databaseBackup'
import DirectoryMaterialsTab from '../components/DirectoryMaterialsTab.vue'
import DirectoryWorksTab from '../components/DirectoryWorksTab.vue'

const activeTab = ref('materials')
const databaseImportInput = ref(null)
const dir = reactive(useDirectories())

onMounted(() => {
  dir.loadData()
})

async function exportFullDatabase() {
  try {
    const savedPath = await exportDatabaseBackup()
    window.alert(`База выгружена: ${savedPath}\n\nЭтот файл можно передать на другой ПК и импортировать в установленной программе.`)
  } catch (error) {
    console.error(error)
    window.alert('Не удалось выгрузить базу.')
  }
}

function openDatabaseImportDialog() {
  databaseImportInput.value?.click()
}

async function handleDatabaseImportFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  const approved = window.confirm(
    'Импорт всей базы полностью заменит текущие материалы, работы, формулы, коэффициенты, системы, сохранённые конфигурации и сохранённые сметы. Продолжить?'
  )

  if (!approved) return

  let importedResult = null

  try {
    importedResult = await importDatabaseBackupFile(file)
    const totalRows = Object.values(importedResult?.counts || {}).reduce((sum, value) => sum + Number(value || 0), 0)

    try {
      await dir.loadData()
    } catch (refreshError) {
      console.warn('База импортирована, но экран справочника не обновился автоматически.', refreshError)
      window.alert(`База импортирована. Загружено строк: ${totalRows}.\n\nЕсли таблица не обновилась, перейдите на другую вкладку или перезапустите программу.`)
      return
    }

    window.alert(`База импортирована. Загружено строк: ${totalRows}.`)
  } catch (error) {
    console.error(error)
    const message = error?.message || 'Неизвестная ошибка'
    const isLocked = /database is locked|database table is locked|code:\s*5/i.test(message)
    const suffix = isLocked
      ? '\n\nЗакройте все остальные окна RoofCalc и попробуйте импорт ещё раз. Если программа была открыта дважды, SQLite блокирует запись.'
      : importedResult
      ? '\n\nДанные могли быть записаны, но финальное обновление не завершилось. Перезапустите программу и проверьте справочник.'
      : '\n\nПроверьте, что выбран файл экспорта базы .roofcalcdb, а не файл расчёта .roofcalc.'
    window.alert(`Не удалось импортировать базу.\n\nПричина: ${message}${suffix}`)
  }
}
</script>

<style scoped>
.directories-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  margin-bottom: 24px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 18px;
}

.page-subtitle {
  margin: 10px 0 0;
  color: var(--text-soft);
  font-size: 15px;
}

.database-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.hidden-file-input {
  display: none;
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

  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .database-actions {
    justify-content: stretch;
  }

  .database-actions > * {
    flex: 1 1 auto;
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
