<template>
  <div class="report-shell">
    <header class="report-toolbar">
      <button class="toolbar-btn" type="button" @click="goBack">← Назад к смете</button>
      <button class="toolbar-btn" type="button" @click="exportXlsx" :disabled="!reportPayload">XLSX</button>
      <button class="toolbar-btn" type="button" @click="printReport" :disabled="!reportHtml">Печать</button>
    </header>

    <div v-if="reportHtml" class="report-frame-wrap">
      <iframe ref="reportFrame" class="report-frame" :srcdoc="reportHtml" title="Отчёт SmartPir" />
    </div>

    <div v-else class="report-empty">
      <h2>Отчёт ещё не создан</h2>
      <p>Вернись в калькулятор, нажми «Создать отчет», и он откроется здесь.</p>
      <button class="toolbar-btn" type="button" @click="goBack">Вернуться</button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { loadSmartPirReportHtml, loadSmartPirReportPayload } from '@/core/report/smartPirReport'
import { exportSmartPirReportXlsx } from '@/core/report/smartPirReportXlsx'

const router = useRouter()
const reportFrame = ref(null)
const reportHtml = computed(() => loadSmartPirReportHtml())
const reportPayload = computed(() => loadSmartPirReportPayload())

function goBack() {
  router.push('/calculator')
}


async function exportXlsx() {
  if (!reportPayload.value) {
    window.alert('Нет данных для экспорта XLSX.')
    return
  }

  try {
    await exportSmartPirReportXlsx(reportPayload.value)
  } catch (error) {
    console.error(error)
    window.alert('Не удалось экспортировать XLSX-отчёт.')
  }
}

function printReport() {
  const frameWindow = reportFrame.value?.contentWindow
  if (!frameWindow) {
    window.alert('Не удалось подготовить печать отчёта.')
    return
  }

  frameWindow.focus()
  frameWindow.print()
}
</script>

<style scoped>
.report-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-main, #eef2f7);
}

.report-toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #d8dee8);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
}

.toolbar-btn {
  border: 1px solid var(--border-color, #c9d3e1);
  background: #ffffff;
  color: var(--text-main, #1f2937);
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
}

.toolbar-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.report-frame-wrap {
  flex: 1;
  min-height: calc(100vh - 73px);
}

.report-frame {
  width: 100%;
  min-height: calc(100vh - 73px);
  border: 0;
  background: white;
}

.report-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 16px;
  text-align: center;
  padding: 40px 20px;
}

.report-empty h2 {
  margin: 0;
}

.report-empty p {
  margin: 0;
  color: var(--text-soft, #64748b);
}
</style>
