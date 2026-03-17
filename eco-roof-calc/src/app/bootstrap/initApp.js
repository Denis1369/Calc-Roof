import { createApp } from 'vue'
import App from '../../App.vue'
import router from '../../router'
import '../../styles/theme.css'

import { initTheme } from '../../composables/useTheme'
import { ensureAppData } from '../../application/bootstrap/ensureAppData'

export async function initApp() {
  initTheme()
  await ensureAppData()

  createApp(App)
    .use(router)
    .mount('#app')
}