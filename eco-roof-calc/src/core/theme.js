import { ref } from 'vue'

const STORAGE_KEY = 'eco-roof-theme'
const LIGHT_THEME = 'light'
const theme = ref(LIGHT_THEME)
let initialized = false

function applyLightTheme() {
  document.documentElement.setAttribute('data-theme', LIGHT_THEME)
  localStorage.setItem(STORAGE_KEY, LIGHT_THEME)
  theme.value = LIGHT_THEME
}

export function initTheme() {
  if (initialized) return

  applyLightTheme()
  initialized = true
}

export function useTheme() {
  function toggleTheme() {
    applyLightTheme()
  }

  function setTheme() {
    applyLightTheme()
  }

  return {
    theme,
    toggleTheme,
    setTheme
  }
}
