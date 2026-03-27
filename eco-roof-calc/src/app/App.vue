<template>
  <div class="app-shell">
    <aside class="app-sidebar">
      <div class="app-brand">Eco-Roof</div>

      <nav class="app-sidebar-nav">
        <RouterLink class="app-sidebar-link" to="/">Выбор системы</RouterLink>
        <RouterLink class="app-sidebar-link" to="/calculator">Калькулятор</RouterLink>
        <RouterLink class="app-sidebar-link" to="/directories">Справочники</RouterLink>
        <RouterLink class="app-sidebar-link" to="/formulas">Формулы</RouterLink>
        <RouterLink class="app-sidebar-link" to="/coefficients">Коэффициенты</RouterLink>
        <RouterLink class="app-sidebar-link" to="/templates">Редактор систем</RouterLink>
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
import { useTheme } from '@/core/theme'

const { theme, toggleTheme } = useTheme()
</script>