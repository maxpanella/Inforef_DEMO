<template>
  <div class="demo-root">
    <aside class="sidebar">
      <div class="brand">Inforef RTLS Demo</div>

      <div class="controls">
        <label>Struttura</label>
        <select v-model="selectedSiteId">
          <option v-for="s in sites" :key="s.id" :value="s.id">{{ s.ragioneSociale }}</option>
        </select>

        <div class="btn-row">
          <button @click="showOverview" :disabled="overviewMode">Vista generale</button>
          <button @click="showSiteView" :disabled="!overviewMode">Vista sito</button>
        </div>
        <div class="btn-row">
          <button v-if="overviewMode" @click="fitAllSites">Inquadra tutte</button>
          <button v-else @click="fitAll">Centra mappa</button>
        </div>

        <div class="btn-row">
          <button @click="startDemo" :disabled="demoRunning || overviewMode">Start demo</button>
          <button @click="stopDemo" :disabled="!demoRunning">Stop</button>
        </div>
        <div class="btn-row">
          <button @click="simulateOnce" :disabled="overviewMode">Simula sample</button>
        </div>
      </div>

      <maintenance-list />

      <div class="events">
        <h4>Eventi</h4>
        <ul>
          <li v-for="(e,i) in events" :key="i"><small>{{ e.t }}</small> — {{ e.msg }}</li>
        </ul>
      </div>
    </aside>

    <main class="main">
      <div class="map-wrapper" ref="mapWrapEl">
        <div id="map"></div>
      </div>

      <!-- Overview: solo mappa (nessuna lista asset) -->
      <div v-if="overviewMode" class="overview-hint">
        Seleziona una struttura dalla mappa o dal menu in alto
      </div>

      <!-- Vista sito: reparti con lista asset -->
      <div v-else class="dept-panel">
        <div class="dept-header">
          <h3>Reparti — {{ selectedSiteLabel }}</h3>
          <div class="spacer"></div>
          <button class="link" @click="expandAll">Espandi tutto</button>
          <button class="link" @click="collapseAll">Comprimi tutto</button>
        </div>

        <div class="accordion">
          <div class="section" v-for="sec in groupedByDept" :key="sec.key">
            <div class="section-head" @click="toggleSection(sec.key)">
              <div class="title">
                <span class="chev" :class="{open: isOpen(sec.key)}">▸</span>
                <strong>{{ sec.key }}</strong>
              </div>
              <div class="badge">{{ sec.items.length }}</div>
            </div>
            <div class="section-body" v-show="isOpen(sec.key)">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Categoria</th>
                    <th>Stanza</th>
                    <th>Stato</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="a in sec.items" :key="a.id">
                    <td>{{ a.nome }}</td>
                    <td>{{ a.categoria || a.tipo }}</td>
                    <td>{{ a.stanza || '-' }}</td>
                    <td>{{ a.stato || '-' }}</td>
                    <td>
                      <button @click="openCamera(a.cameraUrl)" :disabled="!a.cameraUrl">Camera</button>
                      <button @click="runQualify(a)">Qualifica</button>
                      <button @click="openMaintenanceFor(a)">Manutenzione</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div v-if="groupedByDept.length===0" class="empty">Nessun asset per questa struttura</div>
        </div>
      </div>

      <camera-modal v-if="cameraModal.show" :url="cameraModal.url" @close="cameraModal.show=false" />
      <qualification-test v-if="qualModal.show" :asset="qualModal.asset" @close="qualModal.show=false" />
    </main>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import OlMap from 'ol/Map'                   // ALIAS: evita conflitto con Map nativo
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

import CameraModal from './CameraModal.vue'
import MaintenanceList from './MaintenanceList.vue'
import QualificationTest from './QualificationTest.vue'
import createLocalsenseAdapter from '../services/localsenseAdapter.js'
import { sites } from '../data/sites.js'
import { assetList } from '../data/assets.js'

const demoRunning = ref(false)
const events = ref([])

// Mappa e layer
let map = null
let assetSrc = null, assetLayer = null
let siteSrc = null, siteLayer = null

// Map nativa per le feature degli asset (esplicita)
const featureMap = new globalThis.Map()

const mapWrapEl = ref(null)
let ro = null

// Stato vista
const overviewMode = ref(false)
const selectedSiteId = ref(sites[0]?.id || null)

// Centro/rotazione iniziali
let defaultCenter = sites[0]?.lon && sites[0]?.lat ? fromLonLat([Number(sites[0].lon), Number(sites[0].lat)]) : fromLonLat([14.8484, 40.6369])
let rotationDeg = Number(sites[0]?.rotationDeg || 0)

// Coercizione lat/lon a numeri
const sitesWithCoords = computed(() =>
  sites
    .map(s => ({ ...s, lon: Number(s.lon), lat: Number(s.lat) }))
    .filter(s => Number.isFinite(s.lon) && Number.isFinite(s.lat))
)

const selectedSite = computed(() => sites.find(s => s.id === selectedSiteId.value) || null)
const selectedSiteLabel = computed(() => selectedSite.value ? selectedSite.value.ragioneSociale : '—')

// Filtri asset
const filteredAssets = computed(() =>
  assetList.value.filter(a => !selectedSiteId.value || a.siteId === selectedSiteId.value)
)

// Deduzione reparto per RSA se manca
function getDeptKey(a){
  if (a.reparto) return a.reparto
  const tipo = (a.tipo||'').toLowerCase()
  const cat  = (a.categoria||'').toLowerCase()
  const stanza = (a.stanza||'').toLowerCase()

  if (cat === 'personale') {
    if (stanza.includes('reception')) return 'Reception'
    return 'Infermeria'
  }
  if (cat === 'dispositivo-medico') {
    if (stanza.includes('ambulatorio') || tipo.includes('ecg')) return 'Infermeria'
    if (stanza.includes('osservazione') || stanza.includes('camera') || tipo.includes('monitor')) return 'Degenza'
    return 'Infermeria'
  }
  if (cat === 'sensor' || tipo.includes('sensore')) {
    if (tipo.includes('letto') || stanza.includes('camera')) return 'Degenza'
    if (tipo.includes('porta') || stanza.includes('uscita')) return 'Esterni'
    if (tipo.includes('caduta') || stanza.includes('corridoio')) return 'Corridoi'
    if (stanza.includes('bagno')) return 'Bagni assistiti'
    return 'Sicurezza'
  }
  if (cat === 'ausilio' || tipo.includes('carrello') || tipo.includes('wheelchair')) {
    if (stanza.includes('magazzino')) return 'Magazzino ausili'
    if (stanza.includes('infermeria')) return 'Infermeria'
    return 'Magazzino ausili'
  }
  if (cat === 'sicurezza' || tipo.includes('estintore') || tipo.includes('allarme') || tipo.includes('camera')) {
    if (tipo.includes('camera')) return 'Corridoi'
    return 'Sicurezza'
  }
  if (cat === 'infrastruttura' || tipo.includes('porta') || tipo.includes('ascensore') || tipo.includes('generatore') || tipo.includes('ups')) {
    if (tipo.includes('generatore') || tipo.includes('ups') || stanza.includes('tecnico')) return 'Locale tecnico'
    if (tipo.includes('porta') || tipo.includes('ascensore') || stanza.includes('corridoio')) return 'Corridoi'
    return 'Infrastruttura'
  }
  if (cat === 'consumabili' || tipo.includes('kit')) {
    if (stanza.includes('reception')) return 'Reception'
    return 'Infermeria'
  }
  if (stanza.includes('fisioterapia') || stanza.includes('riabilitazione')) return 'Riabilitazione'
  if (a.piano != null) return `Piano ${a.piano}`
  return 'Altro'
}

const deptPriority = [
  'Infermeria','Degenza','Riabilitazione','Fisioterapia','Corridoi','Bagni assistiti',
  'Magazzino ausili','Reception','Locale tecnico','Esterni','Sicurezza','Infrastruttura'
]

// Raggruppamento robusto (senza usare Map nativa per evitare collisioni)
const groupedByDept = computed(() => {
  const buckets = Object.create(null)
  for (const a of filteredAssets.value) {
    const key = getDeptKey(a)
    ;(buckets[key] ||= []).push(a)
  }
  const arr = Object.keys(buckets).map(k => ({ key: k, items: buckets[k] }))
  arr.sort((x, y) => {
    const ix = deptPriority.indexOf(x.key); const iy = deptPriority.indexOf(y.key)
    if (ix !== -1 && iy !== -1) return ix - iy
    if (ix !== -1) return -1
    if (iy !== -1) return 1
    if (x.key === 'Altro') return 1
    if (y.key === 'Altro') return -1
    return x.key.localeCompare(y.key, 'it')
  })
  return arr
})

// Stato apertura sezioni reparti
const openSections = ref(new Set())
function isOpen(key){ return openSections.value.has(key) }
function toggleSection(key){
  const s = new Set(openSections.value)
  if (s.has(key)) s.delete(key); else s.add(key)
  openSections.value = s
}
function expandAll(){ openSections.value = new Set(groupedByDept.value.map(s => s.key)) }
function collapseAll(){ openSections.value = new Set() }

function transformDxf(x, y) {
  const x_m = (Number(x) || 0) / 1000, y_m = (Number(y) || 0) / 1000
  const theta = rotationDeg * Math.PI / 180
  const x_rot = x_m * Math.cos(theta) - y_m * Math.sin(theta)
  const y_rot = x_m * Math.sin(theta) + y_m * Math.cos(theta)
  return [ defaultCenter[0] + x_rot, defaultCenter[1] - y_rot ]
}

function addEvent(msg) {
  events.value.unshift({ t: new Date().toLocaleTimeString(), msg })
  if (events.value.length > 300) events.value.pop()
}

function makeStyle(a) {
  const color =
    a.categoria === 'personale' ? '#2563eb' :
    a.categoria === 'dispositivo-medico' ? '#16a34a' :
    a.categoria === 'sensor' ? '#f59e0b' :
    a.categoria === 'infrastruttura' ? '#6b7280' :
    a.categoria === 'sicurezza' ? '#dc2626' :
    '#334155'
  return new Style({
    image: new CircleStyle({ radius: 8, fill: new Fill({ color }), stroke: new Stroke({ color:'#fff', width:2 }) }),
    text: new Text({ text: a.nome, offsetY: -18, fill: new Fill({ color:'#0f274f' }), font:'600 12px Inter, Arial' })
  })
}

// Marker siti evidenti in overview: SOLO nome struttura
function makeSiteStyle(s) {
  const halo = new Style({
    image: new CircleStyle({
      radius: 16,
      fill: new Fill({ color: 'rgba(14,165,233,0.18)' }),
      stroke: new Stroke({ color: '#06b6d4', width: 3 })
    })
  })
  halo.setZIndex(20)

  const core = new Style({
    image: new CircleStyle({
      radius: 9,
      fill: new Fill({ color: '#0284c7' }),
      stroke: new Stroke({ color: '#ffffff', width: 2 })
    }),
    text: new Text({
      text: s.ragioneSociale,
      offsetY: -22,
      fill: new Fill({ color: '#0c4a6e' }),
      font: '700 13px Inter, Arial'
    })
  })
  core.setZIndex(21)
  return [halo, core]
}

function clearAssetsLayer() {
  featureMap.forEach((f) => assetSrc.removeFeature(f))
  featureMap.clear()
}

function refreshAssets() {
  if (!assetSrc || overviewMode.value) return
  const visibleIds = new Set()
  for (const a of filteredAssets.value) {
    const id = a.id
    const coords = transformDxf(a.x || 0, a.y || 0)
    let f = featureMap.get(id)
    if (!f) {
      f = new Feature({ geometry: new Point(coords) })
      f.setId(id)
      f.setStyle(makeStyle(a))
      assetSrc.addFeature(f)
      featureMap.set(id, f)
    } else {
      animateFeatureTo(f, coords, 350)
      f.setStyle(makeStyle(a))
    }
    visibleIds.add(id)
  }
  featureMap.forEach((f, id) => {
    if (!visibleIds.has(id)) {
      assetSrc.removeFeature(f)
      featureMap.delete(id)
    }
  })
}

function refreshSites() {
  if (!siteSrc) return
  siteSrc.clear()
  for (const s of sitesWithCoords.value) {
    const coord = fromLonLat([s.lon, s.lat])
    const f = new Feature({ geometry: new Point(coord) })
    f.setId(`site-${s.id}`)
    f.setStyle(makeSiteStyle(s))
    siteSrc.addFeature(f)
  }
}

function animateFeatureTo(feat, target, duration = 300) {
  if (!feat) return
  const geom = feat.getGeometry()
  const [sx, sy] = geom.getCoordinates()
  const [tx, ty] = target
  const dx = tx - sx, dy = ty - sy
  const t0 = performance.now()
  function step(now) {
    const p = Math.min(1, (now - t0) / duration)
    geom.setCoordinates([ sx + dx * p, sy + dy * p ])
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

function initMap() {
  map = new OlMap({
    target: 'map',
    layers: [ new TileLayer({ source: new OSM() }) ],
    view: new View({ center: defaultCenter, zoom: 16 })
  })

  siteSrc = new VectorSource({ features: [] })
  siteLayer = new VectorLayer({ source: siteSrc })
  map.addLayer(siteLayer)

  assetSrc = new VectorSource({ features: [] })
  assetLayer = new VectorLayer({ source: assetSrc })
  map.addLayer(assetLayer)

  // Click su marker delle strutture per inquadrare il sito
  map.on('singleclick', (evt) => {
    if (!overviewMode.value) return
    map.forEachFeatureAtPixel(evt.pixel, (feature) => {
      const fid = feature?.getId?.()
      if (fid && String(fid).startsWith('site-')) {
        const siteId = String(fid).slice(5)
        selectSite(siteId)
        return true
      }
    })
  })

  ro = new ResizeObserver(() => { if (map) map.updateSize() })
  if (mapWrapEl.value) ro.observe(mapWrapEl.value)

  refreshSites()
  refreshAssets()
}

function applySite(siteId) {
  const s = sites.find(x => x.id === siteId)
  if (!s) return
  rotationDeg = Number(s.rotationDeg || 0)
  const lon = Number(s.lon), lat = Number(s.lat)
  if (Number.isFinite(lon) && Number.isFinite(lat)) {
    defaultCenter = fromLonLat([lon, lat])
    if (map) map.getView().animate({ center: defaultCenter, duration: 350, zoom: 18 })
  }
}

function showOverview() {
  overviewMode.value = true
  rotationDeg = 0
  clearAssetsLayer()
  refreshSites()
  nextTick(() => fitAllSites())
}

function showSiteView() {
  overviewMode.value = false
  if (!selectedSiteId.value && sites[0]) selectedSiteId.value = sites[0].id
  applySite(selectedSiteId.value)
  refreshAssets()
  nextTick(() => fitAll())
}

function fitAll() {
  if (!map || !assetSrc || overviewMode.value) return
  try {
    const extent = assetSrc.getExtent()
    if (extent && extent.every(Number.isFinite)) {
      map.getView().fit(extent, { padding: [40,40,40,40], duration: 300, maxZoom: 20 })
    }
  } catch {}
}

function fitAllSites() {
  if (!map || !siteSrc) return
  try {
    const extent = siteSrc.getExtent()
    if (extent && extent.every(Number.isFinite)) {
      map.getView().fit(extent, { padding: [60,60,60,60], duration: 350, maxZoom: 10 })
    }
  } catch {}
}

// Adapter demo
const adapter = createLocalsenseAdapter()

function startDemo() {
  if (demoRunning.value || overviewMode.value) return
  demoRunning.value = true
  adapter.on?.('sample', applySample)
  adapter.start?.({ interval: 400 })
  addEvent('Demo started')
}

function stopDemo() {
  if (!demoRunning.value) return
  adapter.off?.('sample', applySample)
  adapter.stop?.()
  demoRunning.value = false
  addEvent('Demo stopped')
}

function simulateOnce() {
  if (overviewMode.value) return
  const a = filteredAssets.value[0] || assetList.value[0]
  if (!a) return
  const sample = { id: a.tag, x: (a.x || 0) + 400, y: (a.y || 0) + 200, ts: Date.now() }
  applySample(sample)
}

function applySample(sample) {
  if (overviewMode.value) return
  const tagId = String(sample.id)
  const a = assetList.value.find(x => String(x.tag) === tagId) || assetList.value.find(x => String(x.id) === tagId)
  if (a) {
    a.x = sample.x; a.y = sample.y; a._ts = sample.ts
    addEvent(`Sample ${tagId} -> ${a.nome}`)
    refreshAssets()
  } else {
    addEvent(`Unmapped tag ${tagId}`)
  }
}

// Selezione sito (anche dal click mappa)
function selectSite(siteId) {
  selectedSiteId.value = siteId
  showSiteView()
}

// Auto-centering quando cambi struttura dal select
watch(selectedSiteId, async (newId) => {
  if (!newId) return
  if (overviewMode.value) {
    showSiteView()
  } else {
    applySite(newId)
    await nextTick()
    fitAll()
  }
})

const cameraModal = ref({ show: false, url: '' })
const qualModal = ref({ show: false, asset: null })

onMounted(() => {
  initMap()
  showOverview() // avvio in vista generale
})
onUnmounted(() => {
  if (ro) ro.disconnect()
  stopDemo()
})

// Debug helpers
if (typeof window !== 'undefined') {
  window.__sitesCount = () => console.log('sitesWithCoords:', sitesWithCoords.value.length, sitesWithCoords.value.map(s => s.id))
  window.__featureMapDump = () => {
    console.log('featureMap instanceof Map?', featureMap instanceof Map, 'size:', featureMap.size)
    featureMap.forEach((v,k)=>console.log('key',k,'value',v))
  }
}
</script>

<style>
.demo-root{display:flex;height:100vh;font-family:Inter, "Helvetica Neue", Arial, sans-serif;background:#f5f7fa}
.sidebar{width:340px;background:linear-gradient(180deg,#1f2b38,#283644);color:#fff;padding:16px;box-sizing:border-box;display:flex;flex-direction:column}
.brand{font-weight:700;font-size:18px;margin-bottom:12px}
.controls label{font-size:12px;color:#cbd5e1;margin-top:8px;display:block}
.controls select{width:100%;padding:8px;border-radius:6px;border:none;margin-top:4px}
.btn-row{display:flex;gap:8px;margin-top:10px}
.btn-row button{flex:1;padding:8px;border-radius:6px;border:none;cursor:pointer;background:#2b90ff;color:white}
.btn-row button:disabled{opacity:0.6;cursor:not-allowed}
.events{margin-top:16px;background:rgba(255,255,255,0.06);padding:8px;border-radius:6px;flex:1;overflow:auto}
.events h4{margin:0 0 8px 0;font-size:13px}
.events ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px}
.events li{font-size:12px;color:#e5e7eb}

.main{flex:1 1 auto;min-width:0;padding:16px;display:flex;flex-direction:column;gap:16px}
.map-wrapper{height:420px;max-height:420px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#fff}
#map{width:100%;height:100%;min-height:0}

.overview-hint{padding:10px 12px;background:#eef6ff;border:1px solid #cfe1ff;color:#0b3b7a;border-radius:6px}

.dept-panel{background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
.dept-header{display:flex;align-items:center;padding:12px;border-bottom:1px solid #eef2f7}
.dept-header h3{margin:0}
.dept-header .spacer{flex:1}
.dept-header .link{background:none;border:none;color:#2563eb;cursor:pointer;padding:6px 10px}

.accordion{display:flex;flex-direction:column}
.section{border-top:1px solid #f1f5f9}
.section-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;cursor:pointer;background:#fafafa}
.section-head .title{display:flex;align-items:center;gap:6px}
.section-head .chev{transition:transform .2s}
.section-head .chev.open{transform:rotate(90deg)}
.section-head .badge{background:#eef2ff;color:#3730a3;border:1px solid #c7d2fe;border-radius:10px;padding:2px 8px;font-size:12px}
.section-body{padding:10px 12px}
.section-body table{width:100%;border-collapse:collapse}
.section-body thead th{background:#f9fafb;text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#374151}
.section-body tbody td{padding:8px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827}
.section-body tbody tr:hover{background:#f9fafb}

button{padding:6px 8px;border-radius:6px;border:1px solid #d1d5db;background:#fff;cursor:pointer}
button:disabled{opacity:0.5;cursor:not-allowed}
</style>