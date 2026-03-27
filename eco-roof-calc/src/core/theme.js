import { ref } from 'vue'

const STORAGE_KEY = 'eco-roof-theme'
const theme = ref('dark')
let initialized = false

function applyTheme(value) {
  document.documentElement.setAttribute('data-theme', value)
  localStorage.setItem(STORAGE_KEY, value)
  theme.value = value
}

export function initTheme() {
  if (initialized) return

  const savedTheme = localStorage.getItem(STORAGE_KEY)
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light')

  applyTheme(initialTheme)
  initialized = true
}

export function useTheme() {
  function toggleTheme() {
    applyTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  function setTheme(value) {
    applyTheme(value)
  }

  return {
    theme,
    toggleTheme,
    setTheme
  }
}