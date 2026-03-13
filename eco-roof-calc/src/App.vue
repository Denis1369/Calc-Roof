<template>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="logo">Eco-Roof</div>
      <nav>
        <router-link class="nav-link" to="/">Выбор системы</router-link>
        <router-link class="nav-link" to="/calculator">Калькулятор</router-link>
        <router-link class="nav-link" to="/directories">Справочники</router-link>
        <router-link class="nav-link" to="/formulas">formulas</router-link>
        <router-link class="nav-link" to="/coefficients">coefficients</router-link>
        <router-link class="nav-link" to="/templates">templates</router-link>
      </nav>
    </aside>

    <main class="main-content">
      <router-view></router-view>
    </main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { initDatabase } from './database.js';
import { seedDatabase } from './seed.js'; 

onMounted(async () => {
  try {
    await initDatabase();
    await seedDatabase(); 
  } catch (error) {
    console.error('Ошибка инициализации БД:', error);
  }
});
</script>

<style>

body { margin: 0; font-family: 'Inter', sans-serif; background-color: #f8fbf9; }
.app-layout { display: flex; height: 100vh; }
.sidebar { width: 250px; background: #2e7d32; color: white; padding: 2rem 1rem; }
.logo { font-size: 1.5rem; font-weight: bold; margin-bottom: 2rem; text-align: center; }
.nav-link { display: block; color: white; text-decoration: none; padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 0.5rem; transition: background 0.2s; }
.nav-link:hover, .router-link-active { background: #1b5e20; }
.main-content { flex: 1; padding: 2rem; overflow-y: auto; }
</style>