<template>
  <div class="app-shell">
    <AppSidebar />

    <main class="app-main">
      <RouterView />
    </main>

    <div class="app-zoom-controls hide-on-print" title="Ctrl + колесо мыши тоже меняет масштаб">
      <button type="button" @click="applyZoom(zoom - ZOOM_STEP, true)">−</button>
      <span>{{ zoomPercent }}%</span>
      <button type="button" @click="applyZoom(zoom + ZOOM_STEP, true)">+</button>
      <button type="button" @click="applyZoom(1, true)">100</button>
    </div>

    <div v-if="isZoomHintVisible" class="app-zoom-hint">
      Масштаб {{ zoomPercent }}%
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterView } from 'vue-router'
import AppSidebar from '@/app/components/AppSidebar.vue'

const ZOOM_STORAGE_KEY = 'roofcalc-ui-zoom'
const MIN_ZOOM = 0.65
const MAX_ZOOM = 1.25
const ZOOM_STEP = 0.05

const zoom = ref(1)
const isZoomHintVisible = ref(false)
let zoomHintTimer = null

const zoomPercent = computed(() => Math.round(zoom.value * 100))

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

function normalizeZoom(value) {
  return Math.round(clampZoom(value) * 100) / 100
}

function applyZoom(value, showHint = false) {
  zoom.value = normalizeZoom(value)
  document.documentElement.style.setProperty('--app-zoom', `${zoom.value}`)
  localStorage.setItem(ZOOM_STORAGE_KEY, `${zoom.value}`)

  if (showHint) {
    showZoomHint()
  }
}

function showZoomHint() {
  isZoomHintVisible.value = true
  window.clearTimeout(zoomHintTimer)
  zoomHintTimer = window.setTimeout(() => {
    isZoomHintVisible.value = false
  }, 900)
}

function handleWheel(event) {
  if (!event.ctrlKey) return

  event.preventDefault()
  const direction = event.deltaY > 0 ? -1 : 1
  applyZoom(zoom.value + direction * ZOOM_STEP, true)
}

function handleNumberInputWheel(event) {
  if (event.ctrlKey) return

  const target = event.target
  if (
    target instanceof HTMLInputElement &&
    target.type === 'number' &&
    target === document.activeElement
  ) {
    event.preventDefault()
    target.blur()
  }
}

function handleKeydown(event) {
  if (!event.ctrlKey) return

  if (event.key === '0') {
    event.preventDefault()
    applyZoom(1, true)
    return
  }

  if (event.key === '+' || event.key === '=') {
    event.preventDefault()
    applyZoom(zoom.value + ZOOM_STEP, true)
    return
  }

  if (event.key === '-' || event.key === '_') {
    event.preventDefault()
    applyZoom(zoom.value - ZOOM_STEP, true)
  }
}

onMounted(() => {
  const savedZoom = Number(localStorage.getItem(ZOOM_STORAGE_KEY))
  applyZoom(Number.isFinite(savedZoom) ? savedZoom : 1)

  window.addEventListener('wheel', handleWheel, { passive: false })
  window.addEventListener('wheel', handleNumberInputWheel, { capture: true, passive: false })
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('wheel', handleWheel)
  window.removeEventListener('wheel', handleNumberInputWheel, { capture: true })
  window.removeEventListener('keydown', handleKeydown)
  window.clearTimeout(zoomHintTimer)
})
</script>

<style scoped>
.app-zoom-controls {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-card) 92%, transparent);
  box-shadow: 0 10px 28px var(--shadow-color);
  backdrop-filter: blur(10px);
}

.app-zoom-controls button {
  min-width: 32px;
  height: 30px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--bg-card-soft);
  color: var(--text-main);
  cursor: pointer;
  font-weight: 800;
}

.app-zoom-controls button:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.app-zoom-controls span {
  min-width: 48px;
  text-align: center;
  color: var(--text-main);
  font-weight: 800;
  font-size: 13px;
}
</style>
