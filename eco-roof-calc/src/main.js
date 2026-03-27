import { createApp } from 'vue'
import App from '@/app/App.vue'
import router from '@/app/router'
import '@/styles/theme.css'
import { initTheme } from '@/core/theme'
import { ensureAppData } from '@/core/bootstrap/ensureAppData'

async function bootstrap() {
  initTheme()
  await ensureAppData()

  createApp(App)
    .use(router)
    .mount('#app')
}

bootstrap().catch((error) => {
  console.error('Application bootstrap failed:', error)
})
