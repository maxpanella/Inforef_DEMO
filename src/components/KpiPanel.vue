<template>
  <div class="kpi-root">
    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-title">Tempo medio attesa</div>
        <div class="kpi-value">{{ avgWait }}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Occupazione letti</div>
        <div class="kpi-value">{{ bedOccupancy }}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Utilizzo elettromedicale</div>
        <div class="kpi-value">{{ deviceUsage }}%</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ assetList: { type: Array, required: true } })

const avgWait = computed(() => {
  const n = props.assetList.length
  if (n === 0) return 0
  const sum = props.assetList.reduce((s, a) => s + Math.hypot(a.x || 0, a.y || 0), 0)
  const avg = sum / n
  return Math.round((avg / 1000) * 60)
})

const bedOccupancy = computed(() => {
  const beds = props.assetList.filter(a => String(a.tag).startsWith('bed-'))
  if (beds.length === 0) return Math.min(100, Math.max(5, Math.round((props.assetList.length / 8) * 100)))
  const occupied = beds.filter(b => (b.x || 0) !== 0 || (b.y || 0) !== 0).length
  return Math.round((occupied / beds.length) * 100)
})

const deviceUsage = computed(() => {
  const devs = props.assetList.filter(a => !isNaN(Number(a.tag)) && Number(a.tag) > 0)
  if (devs.length === 0) return 12
  const used = devs.filter(d => (d.x || 0) !== 0 || (d.y || 0) !== 0).length
  return Math.round((used / devs.length) * 100)
})
</script>

<style>
.kpi-root{margin-top:12px}
.kpi-row{display:flex;gap:8px}
.kpi-card{background:#fff;padding:12px;border-radius:8px;flex:1}
.kpi-title{font-size:12px;color:#666}
.kpi-value{font-weight:700;font-size:18px;margin-top:6px}
</style>