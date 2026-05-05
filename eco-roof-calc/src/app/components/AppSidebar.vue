<template>
  <aside class="app-sidebar">
    <div class="app-brand-block">
      <div class="app-brand">RoofCalc</div>
      <p class="app-brand-caption">
        Инженерный калькулятор плоской кровли с собственной расценкой работ.
      </p>
    </div>

    <section class="nav-section">
      <div class="nav-section-title">Основной сценарий</div>
      <nav class="app-sidebar-nav">
        <RouterLink
          v-for="item in primaryNavigation"
          :key="item.to"
          class="app-sidebar-link"
          :to="item.to"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </section>

    <section class="nav-section">
      <div class="nav-section-title">Сметная база</div>
      <nav class="app-sidebar-nav">
        <RouterLink
          v-for="item in adminNavigation"
          :key="item.to"
          class="app-sidebar-link app-sidebar-link-secondary"
          :to="item.to"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </section>

  </aside>
</template>

<script setup>
import { RouterLink } from 'vue-router'
import { adminNavigation, primaryNavigation } from '@/app/navigation'
</script>

<style scoped>
.app-brand-block {
  padding: 12px 14px 8px;
}

.app-brand {
  font-size: 28px;
  font-weight: 900;
  color: #f08d27;
  letter-spacing: 0.02em;
}

.app-brand-caption {
  margin: 10px 0 0;
  color: var(--text-soft);
  font-size: 13px;
  line-height: 1.5;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-section + .nav-section {
  padding-top: 10px;
  border-top: 1px solid var(--border-color);
}

.nav-section-title {
  padding: 0 14px;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-soft);
}

.app-sidebar-link-secondary.router-link-active {
  background: var(--bg-active);
  color: var(--text-main);
}
</style>
