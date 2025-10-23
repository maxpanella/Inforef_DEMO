<template>
  <div class="maintenance-root">
    <h4>Lista Manutenzioni</h4>
    <div class="new-row">
      <input v-model="newTitle" placeholder="Titolo manutenzione" />
      <button @click="add()">Aggiungi</button>
    </div>
    <ul>
      <li v-for="(m,i) in items" :key="m.id">
        <div class="left">
          <input type="checkbox" v-model="m.done" @change="save()" />
          <span :class="{done: m.done}">{{ m.title }}</span>
          <small class="muted">({{ m.assetId || 'N/A' }})</small>
        </div>
        <div class="right">
          <button @click="remove(i)">Elimina</button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
const STORAGE_KEY = 'demo_maintenance_list'
const newTitle = ref('')
const items = ref([])

function load(){
  try { items.value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch(e){ items.value = [] }
}
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value)) }
function add(){
  if(!newTitle.value) return
  items.value.unshift({ id: Date.now().toString(), title: newTitle.value, done: false, assetId: null })
  newTitle.value = ''
  save()
}
function remove(i){ items.value.splice(i,1); save() }

onMounted(()=> {
  load()
  window.addEventListener('maintenance-open-for', (ev)=> {
    const assetId = ev.detail && ev.detail.assetId
    if(assetId) newTitle.value = `Manutenzione su ${assetId}`
  })
})
</script>

<style>
.maintenance-root{margin-top:12px;background:rgba(255,255,255,0.03);padding:8px;border-radius:6px}
.new-row{display:flex;gap:8px;margin-bottom:8px}
.new-row input{flex:1;padding:6px}
ul{list-style:none;padding:0;margin:0}
li{display:flex;justify-content:space-between;padding:6px 4px;border-bottom:1px dashed rgba(255,255,255,0.02)}
.done{opacity:0.6;text-decoration:line-through}
.muted{color:#aaa;margin-left:6px}
</style>