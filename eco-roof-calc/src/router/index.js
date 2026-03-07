import { createRouter, createWebHistory } from 'vue-router'
import CalculatorView from '../views/CalculatorView.vue'
import DirectoriesView from '../views/DirectoriesView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
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