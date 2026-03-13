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
body { 
  margin: 0; 
  font-family: 'Inter', sans-serif; 
  background-color: #2A3439; 
  color: #FFFFFF; 
  -webkit-font-smoothing: antialiased; 
}
.app-layout { 
  display: flex; 
  height: 100vh; 
}
.sidebar { 
  width: 250px; 
  background: #21292E; 
  border-right: 1px solid #4A5A63; 
  color: #FFFFFF; 
  padding: 2rem 1rem; 
  box-sizing: border-box; 
}
.logo { 
  font-size: 1.5rem; 
  font-weight: 900; 
  margin-bottom: 2rem; 
  text-align: center; 
  color: #F29A2E; 
  letter-spacing: 0.05em; 
}
.nav-link { 
  display: block; 
  color: #A0B1BA; 
  text-decoration: none; 
  padding: 0.85rem 1.2rem; 
  border-radius: 8px; 
  margin-bottom: 0.5rem; 
  font-weight: 600; 
  transition: all 0.2s ease; 
}
.nav-link:hover { 
  background: rgba(242, 154, 46, 0.1); 
  color: #F29A2E; 
}
.router-link-active { 
  background: #F29A2E; 
  color: #FFFFFF; 
  box-shadow: 0 4px 12px rgba(242, 154, 46, 0.3); 
}
.main-content { 
  flex: 1; 
  padding: 2rem; 
  overflow-y: auto; 
  background-color: #2A3439; 
}

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: #21292E; }
::-webkit-scrollbar-thumb { background: #4A5A63; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #F29A2E; }
</style>