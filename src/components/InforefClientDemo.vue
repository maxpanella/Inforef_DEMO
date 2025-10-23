<template>
  <div class="demo-root">
    <aside class="sidebar">
      <div class="brand">RTLS Demo — InforefClient (clean)</div>

      <div class="controls">
        <label>Demo Controls</label>
        <div class="btn-row">
          <button @click="startDemo" :disabled="demoRunning">Start Demo</button>
          <button @click="stopDemo" :disabled="!demoRunning">Stop Demo</button>
          <button @click="simulateOnce">Simula singolo</button>
        </div>
        <div class="status">Demo: <strong>{{ demoRunning ? 'running' : 'stopped' }}</strong></div>
      </div>

      <kpi-panel :asset-list="assetList" class="kpi" />

      <div class="events">
        <h4>Event Log</h4>
        <ul>
          <li v-for="(e,i) in events" :key="i">{{ e.t }} — {{ e.msg }}</li>
        </ul>
      </div>

      <maintenance-list />
    </aside>

    <main class="main-area">
      <div class="map-toolbar">
        <div>Assets: {{ assetList.length }}</div>
        <div class="controls-small">
          <button @click="fitAll">Fit View</button>
        </div>
      </div>

      <div id="map" class="map-area"></div>

      <div class="asset-panel">
        <h4>Assets</h4>
        <table>
          <thead><tr><th>Nome</th><th>Tag</th><th>Pos (mm)</th><th>Camera</th><th>Azioni</th></tr></thead>
          <tbody>
            <tr v-for="a in assetList" :key="a.id">
              <td>{{ a.nome }}</td>
              <td>{{ a.tag }}</td>
              <td>{{ Math.round(a.x||0) }}, {{ Math.round(a.y||0) }}</td>
              <td><button v-if="a.cameraUrl" @click="openCamera(a.cameraUrl)">Apri Camera</button><span v-else class="muted">-</span></td>
              <td><button @click="runQualify(a)">Test Qualifica</button><button @click="openMaintenanceFor(a)">Manutenzione</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>

    <camera-modal v-if="cameraModal.show" :url="cameraModal.url" @close="cameraModal.show=false" />
    <qualification-test v-if="qualModal.show" :asset="qualModal.asset" @close="qualModal.show=false" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import { Point } from 'ol/geom'
import Style from 'ol/style/Style'
import CircleStyle from 'ol/style/Circle'
import Stroke from 'ol/style/Stroke'
import Fill from 'ol/style/Fill'
import Text from 'ol/style/Text'
import { fromLonLat } from 'ol/proj'

import KpiPanel from './KpiPanel.vue'
import CameraModal from './CameraModal.vue'
import MaintenanceList from './MaintenanceList.vue'
import QualificationTest from './QualificationTest.vue'
import createLocalsenseAdapter from '../services/localsenseAdapter.js' // stub, safe

const demoRunning = ref(false)
const events = ref([])

const assetList = ref([
  { id:'med-01', nome:'Medico Rossi', tag:'3001', x:0, y:0, cameraUrl: '' },
  { id:'ass-01', nome:'Assistente', tag:'3002', x:0, y:0, cameraUrl: '' },
  { id:'est-01', nome:'Estintore', tag:'1001', x:0, y:0, cameraUrl: '' },
  { id:'def-01', nome:'Defibrillatore', tag:'2001', x:0, y:0, cameraUrl: '' }
])

let map = null, assetSrc = null, adapter = null, assetLayer = null, featureMap = {}

const defaultCenter = fromLonLat([14.8484009,40.6368532])
const rotationDeg = 44

function transformDxf(x,y){
  const x_m = x/1000, y_m = y/1000
  const theta = rotationDeg * Math.PI / 180
  const x_rot = x_m*Math.cos(theta) - y_m*Math.sin(theta)
  const y_rot = x_m*Math.sin(theta) + y_m*Math.cos(theta)
  return [ defaultCenter[0] + x_rot, defaultCenter[1] - y_rot ]
}

function addEvent(msg){ events.value.unshift({ t: new Date().toLocaleTimeString(), msg }); if(events.value.length>300) events.value.pop() }

function initMap(){
  map = new Map({ target: 'map', layers: [ new TileLayer({ source: new OSM() }) ], view: new View({ center: defaultCenter, zoom: 20 }) })
  assetSrc = new VectorSource({ features: [] })
  assetLayer = new VectorLayer({ source: assetSrc })
  map.addLayer(assetLayer)
  refreshAssets()
}

function animateFeatureTo(feat, target, duration = 400){
  if(!feat) return
  const geom = feat.getGeometry()
  const start = geom.getCoordinates()
  const sx = start[0], sy = start[1]
  const tx = target[0], ty = target[1]
  const dx = tx - sx, dy = ty - sy
  const t0 = performance.now()
  function step(now){
    const elapsed = now - t0
    const p = Math.min(1, elapsed / duration)
    geom.setCoordinates([ sx + dx * p, sy + dy * p ])
    if(p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

function refreshAssets(){
  if(!assetSrc) return
  for(const a of assetList.value){
    const id = a.id
    const coords = transformDxf(a.x||0, a.y||0)
    if(!featureMap[id]){
      const f = new Feature({ geometry: new Point(coords) })
      f.setStyle(new Style({
        image: new CircleStyle({ radius: 10, fill: new Fill({ color: '#2c5aa0' }), stroke: new Stroke({ color:'#fff', width:2 }) }),
        text: new Text({ text: a.nome, offsetY:-18, fill: new Fill({ color:'#0f274f' }), font:'600 12px' })
      }))
      f.setId(id)
      assetSrc.addFeature(f)
      featureMap[id] = f
    } else {
      animateFeatureTo(featureMap[id], coords, 450)
    }
  }
}

function startDemo(){
  if(demoRunning.value) return
  demoRunning.value = true
  let angle = 0
  window.__demoTimer = setInterval(()=> {
    angle += 0.25
    const r = 5000, cx = 2000, cy = 1500
    const s1 = { id:'3001', x: cx + Math.cos(angle)*r, y: cy + Math.sin(angle)*r, ts: Date.now() }
    const s2 = { id:'3002', x: cx + Math.cos(angle+1.7)*r, y: cy + Math.sin(angle+1.7)*r, ts: Date.now() }
    applySample(s1); applySample(s2)
  }, 400)
  addEvent('Demo started')
}

function stopDemo(){
  if(window.__demoTimer){ clearInterval(window.__demoTimer); window.__demoTimer = null }
  demoRunning.value = false
  addEvent('Demo stopped')
}

function simulateOnce(){
  const a = assetList.value[0]
  const sample = { id: a.tag, x: 5000, y: 2000, ts: Date.now() }
  applySample(sample)
}

function applySample(sample){
  // sample in mm => update matching asset if found
  const tagId = String(sample.id)
  const a = assetList.value.find(x => String(x.tag) === tagId) || assetList.value.find(x => String(x.id) === tagId)
  if(a){
    a.x = sample.x; a.y = sample.y; a._ts = sample.ts
    addEvent(`Simulated ${tagId} -> ${a.nome}`)
    refreshAssets()
  } else {
    addEvent(`Unmapped simulated tag ${tagId}`)
  }
}

function openCamera(url){ cameraModal.value = { show:true, url } }
function runQualify(asset){ qualModal.value = { show:true, asset } }
function openMaintenanceFor(asset){
  const ev = new CustomEvent('maintenance-open-for', { detail: { assetId: asset.id } })
  window.dispatchEvent(ev)
}

function fitAll(){ if(map) map.getView().animate({ center: defaultCenter, duration: 400 }) }

const cameraModal = ref({ show:false, url:'' })
const qualModal = ref({ show:false, asset:null })

onMounted(()=> { initMap() })
onUnmounted(()=> { stopDemo() })

// expose console helpers
if(typeof window !== 'undefined'){
  window.__startDemo = startDemo
  window.__stopDemo = stopDemo
  window.__simulateSample = simulateOnce
  window.__assetList = assetList
}
</script>

<style>
.demo-root{display:flex;height:100vh;font-family:Inter, "Helvetica Neue", Arial, sans-serif}
.sidebar{width:320px;background:linear-gradient(180deg,#1f2b38,#283644);color:#fff;padding:16px;box-sizing:border-box;display:flex;flex-direction:column}
.brand{font-weight:700;font-size:18px;margin-bottom:12px}
.controls label{font-size:12px;color:#cbd5e1;margin-top:8px;display:block}
.btn-row{display:flex;gap:8px;margin-top:10px}
.btn-row button{flex:1;padding:8px;border-radius:6px;border:none;cursor:pointer;background:#2b90ff;color:white}
.kpi{margin-top:12px}
.events{margin-top:14px;flex:1;overflow:auto}
.events ul{list-style:none;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px}
.events li{font-size:12px;padding:6px 4px;border-bottom:1px dashed rgba(255,255,255,0.02)}
.main-area{flex:1;display:flex;flex-direction:column;padding:12px}
.map-area{flex:1;border-radius:8px;overflow:hidden;box-shadow:0 6px 18px rgba(16,24,40,0.08)}
.asset-panel{margin-top:12px;background:#fff;padding:12px;border-radius:8px}
.asset-panel table{width:100%;border-collapse:collapse}
.asset-panel th, .asset-panel td{padding:6px;text-align:left;border-bottom:1px solid #eee;font-size:13px}
.muted{color:#999;font-size:12px}
</style>