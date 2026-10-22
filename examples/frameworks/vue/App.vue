<script setup>
import {ref,watch} from "vue";
import {useWonderLayer} from "./main.js";
const {state}=useWonderLayer();
const note=ref("");
watch(()=>state.layer,async layer=>{
  if(!layer)return;
  const record=(await layer.store.listRecords()).find(row=>row.id==="vue-draft");
  note.value=record?.content??"";
},{immediate:true});
async function save(){
  if(state.layer)await state.layer.store.save("vue-draft",note.value);
}
</script>
<template>
  <section>
    <h1>Wonder Layer — Vue PWA integration</h1>
    <textarea v-model="note" />
    <button :disabled="state.status!=='ready'" @click="save">Save offline</button>
    <p role="status">{{state.error?.message ?? state.status}}</p>
  </section>
</template>

