<template>
  <div id="app">
    <!-- Wrapping App: importa il componente demo e lo mostra -->
    <InforefClientDemo />
  </div>
</template>

<script setup>
import InforefClientDemo from './components/InforefClientDemo.vue'
</script>

<style>
/* Stili globali minimi per evitare layout sfalsati */
#app { height: 100vh; margin: 0; font-family: Inter, "Helvetica Neue", Arial, sans-serif; background: #f5f7fa; }
</style>