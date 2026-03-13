import { createRouter, createWebHistory } from 'vue-router'
import CalculatorView from '../views/CalculatorView.vue'
import DirectoriesView from '../views/DirectoriesView.vue'
import PresetsView from '../views/PresetsView.vue'
import FormulasView from '../views/FormulasView.vue'
import CoefficientsView from '../views/CoefficientsView.vue'
import TriggersView from '../views/TriggersView.vue'
import TemplatesView from '../views/TemplatesView.vue'


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
    },
    {
      path: '/formulas',
      name: 'Formulas',
      component: FormulasView
    },
    {
      path: '/coefficients',
      name: 'coefficients',
      component: CoefficientsView
    },
    {
      path: '/triggers',
      name: 'triggers',
      component: TriggersView
    },
    {
      path: '/templates',
      name: 'templates',
      component: TemplatesView
    }
  ]
})

export default router