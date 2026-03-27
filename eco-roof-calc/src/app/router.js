import { createRouter, createWebHistory } from 'vue-router'
import PresetsPage from '@/pages/PresetsPage.vue'
import CalculatorPage from '@/pages/CalculatorPage.vue'
import DirectoriesPage from '@/pages/DirectoriesPage.vue'
import FormulasPage from '@/pages/FormulasPage.vue'
import CoefficientsPage from '@/pages/CoefficientsPage.vue'
import TemplatesPage from '@/pages/TemplatesPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'presets', component: PresetsPage },
    { path: '/calculator', name: 'calculator', component: CalculatorPage },
    { path: '/directories', name: 'directories', component: DirectoriesPage },
    { path: '/formulas', name: 'formulas', component: FormulasPage },
    { path: '/coefficients', name: 'coefficients', component: CoefficientsPage },
    { path: '/templates', name: 'templates', component: TemplatesPage }
  ]
})

export default router
