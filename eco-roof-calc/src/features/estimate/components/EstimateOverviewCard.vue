<template>
  <section class="document-header-text page-card">
    <strong>Общие суммарные данные по всем участкам:</strong><br />
    Суммарная площадь кровель =
    <span class="bold accent-text">{{ roofParams.area.toFixed(2) }}</span> м2,<br />
    Примыкания к парапету и верт. конструкциям =
    <span class="bold accent-text">{{ roofParams.perimeter.toFixed(2) }}</span> пог.м.,<br />
    Водоотведение парапетное = {{ roofParams.parapetDrains }} шт.,<br />
    Водоотведение внутреннее = {{ roofParams.innerDrains }} шт.,<br />
    Аэраторы = {{ roofParams.aerators }} шт.
  </section>
</template>

<script setup>
defineProps({
  roofParams: {
    type: Object,
    required: true
  }
})
</script>

<style scoped>
.document-header-text {
  padding: 20px;
  border-left: 5px solid var(--accent);
  font-size: 1.05rem;
  line-height: 1.7;
  border-radius: 0 12px 12px 0;
}

.accent-text {
  color: var(--accent);
  font-family: monospace;
  font-weight: 800;
}

.bold {
  font-weight: 700;
}
</style>
