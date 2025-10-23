<template>
  <div class="qual-overlay" @click.self="close">
    <div class="qual-box">
      <div class="header">
        <strong>Test Qualifica — {{ asset?.nome || asset?.id }}</strong>
        <button @click="close">Chiudi</button>
      </div>
      <div class="body">
        <div v-if="!running">
          <p>Avvia il test per misurare segnale, jitter e pacchetti.</p>
          <button @click="startTest">Avvia Test</button>
        </div>
        <div v-else>
          <p>Test in corso... {{ progress }}%</p>
          <div class="meter"><div class="meter-fill" :style="{width: progress + '%'}"></div></div>
        </div>

        <div v-if="result">
          <h4>Risultato</h4>
          <p>SNR: {{ result.snr }} dB</p>
          <p>Packet loss: {{ result.loss }}%</p>
          <p>Jitter: {{ result.jitter }} ms</p>
          <p>Esito: <strong :class="{pass: result.pass, fail: !result.pass}">{{ result.pass ? 'PASS' : 'FAIL' }}</strong></p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const props = defineProps({ asset: { type: Object, required: true } })
const emit = defineEmits(['close'])
const running = ref(false)
const progress = ref(0)
const result = ref(null)

function close(){ emit('close') }

function startTest(){
  running.value = true; progress.value = 0; result.value = null
  const timer = setInterval(()=> {
    progress.value += Math.floor(Math.random()*12) + 6
    if(progress.value >= 100){
      clearInterval(timer); running.value = false; progress.value = 100
      const snr = Math.round(10 + Math.random()*30)
      const loss = Math.round(Math.random()*8)
      const jitter = Math.round(1 + Math.random()*50)
      const pass = snr > 15 && loss < 5
      result.value = { snr, loss, jitter, pass, ts: Date.now() }
      // persist in localStorage history
      const key = 'qual_history'
      try {
        const arr = JSON.parse(localStorage.getItem(key) || '[]')
        arr.unshift({ assetId: props.asset.id, ...result.value })
        localStorage.setItem(key, JSON.stringify(arr.slice(0,50)))
      } catch(e){}
    }
  }, 300)
}
</script>

<style>
.qual-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:2000}
.qual-box{width:520px;background:#fff;border-radius:8px;overflow:hidden}
.header{display:flex;justify-content:space-between;padding:12px;border-bottom:1px solid #eee}
.body{padding:12px}
.meter{height:12px;background:#eee;border-radius:6px;overflow:hidden;margin:8px 0}
.meter-fill{height:100%;background:#2b90ff}
.pass{color:green}
.fail{color:red}
</style>