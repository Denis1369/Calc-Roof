import { initApp } from './app/bootstrap/initApp'

initApp().catch((error) => {
  console.error('Application bootstrap failed:', error)
})