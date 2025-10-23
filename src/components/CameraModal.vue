<template>
  <div class="camera-overlay" @click.self="close">
    <div class="camera-box">
      <div class="header"><button @click="close">Chiudi</button></div>
      <div class="camera-body">
        <iframe v-if="isIframe" :src="url" frameborder="0" style="width:100%;height:100%"></iframe>
        <div v-else class="open-link"><a :href="url" target="_blank" rel="noopener">Apri stream</a></div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({ url: { type: String, required: true } })
const emit = defineEmits(['close'])
const isIframe = props.url && props.url.startsWith('http')
function close(){ emit('close') }
</script>

<style>
.camera-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:2000}
.camera-box{width:80%;height:70%;background:#fff;border-radius:8px;overflow:hidden;display:flex;flex-direction:column}
.header{padding:8px;text-align:right}
.camera-body{flex:1;padding:8px}
.open-link{display:flex;align-items:center;justify-content:center;height:100%}
</style>