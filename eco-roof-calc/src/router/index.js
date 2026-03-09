import { createRouter, createWebHistory } from 'vue-router'
import CalculatorView from '../views/CalculatorView.vue'
import DirectoriesView from '../views/DirectoriesView.vue'
import PresetsView from '../views/PresetsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'presets',
      component: PresetsView
    },
    {
      path: '/calculator',
      name: 'calculator',
      component: CalculatorView
    },
    {
      path: '/directories',
      name: 'directories',
      component: DirectoriesView
    }
  ]
})

export default router