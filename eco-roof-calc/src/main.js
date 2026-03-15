import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/theme.css'
import { initTheme } from './composables/useTheme'
import { initDatabase, getDb } from './database'
import { seedExtendedRealData } from './seed_extended_real_systems'
import { seedNormalizedUploadedEstimatesData } from './seed_uploaded_estimates_normalized_standalone_fixed'

async function bootstrap() {
  initTheme()

  await initDatabase()

  const db = await getDb()
  await seedExtendedRealData(db)
  await seedNormalizedUploadedEstimatesData(db)

  createApp(App).use(router).mount('#app')
}

bootstrap()