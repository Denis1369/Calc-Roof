<template>
  <div class="app-shell">
    <aside class="app-sidebar">
      <div class="app-brand">Eco-Roof</div>

      <nav class="app-sidebar-nav">
        <RouterLink class="app-sidebar-link" to="/">Выбор системы</RouterLink>
        <RouterLink class="app-sidebar-link" to="/calculator">Калькулятор</RouterLink>
        <RouterLink class="app-sidebar-link" to="/directories">Справочники</RouterLink>
        <RouterLink class="app-sidebar-link" to="/formulas">formulas</RouterLink>
        <RouterLink class="app-sidebar-link" to="/coefficients">coefficients</RouterLink>
        <RouterLink class="app-sidebar-link" to="/templates">templates</RouterLink>
      </nav>

      <div class="app-sidebar-footer">
        <button class="theme-toggle" @click="toggleTheme">
          {{ theme === 'dark' ? 'Светлая тема' : 'Тёмная тема' }}
        </button>
      </div>
    </aside>

    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { RouterLink, RouterView } from 'vue-router'
import { useTheme } from './composables/useTheme'

const { theme, toggleTheme } = useTheme()
</script>