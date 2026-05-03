<template>
  <div class="app">
    <HeaderBar @export="handleExport" @import="handleImport" @ai-advice="openAI('default')" />
    <TabNav v-model="activeTab" />
    <OverviewPage v-if="activeTab === 'overview'" />
    <AllocatePage v-if="activeTab === 'allocate'" />
    <AdvicePage v-if="activeTab === 'advice'" ref="advicePage" />
    <StrategyPage v-if="activeTab === 'strategy'" />
    <EditModal v-if="editFund" :fund="editFund" @save="onSaveFund" @close="editFund = null" />
    <Toast :message="toastMsg" v-if="toastMsg" />
  </div>
</template>

<script setup>
import { ref, provide, onMounted } from 'vue'
import { useFundStore } from './stores/fund'
import { dataApi } from './api'
import HeaderBar from './components/HeaderBar.vue'
import TabNav from './components/TabNav.vue'
import OverviewPage from './views/OverviewPage.vue'
import AllocatePage from './views/AllocatePage.vue'
import AdvicePage from './views/AdvicePage.vue'
import StrategyPage from './views/StrategyPage.vue'
import EditModal from './components/EditModal.vue'
import Toast from './components/Toast.vue'

const store = useFundStore()
const activeTab = ref('overview')
const editFund = ref(null)
const toastMsg = ref('')
const advicePage = ref(null)

provide('openEdit', (fund) => { editFund.value = { ...fund } })
provide('toast', (msg) => { toastMsg.value = msg; setTimeout(() => { toastMsg.value = '' }, 2500) })
provide('openAI', (type) => { activeTab.value = 'advice'; setTimeout(() => advicePage.value?.askAI(type), 100) })

onMounted(() => store.loadAll())

async function onSaveFund(data) {
  await store.updateFund(data.id, data)
  editFund.value = null
}

async function handleExport() {
  const data = await dataApi.exportData()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `funds_backup_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function handleImport(file) {
  const text = await file.text()
  const data = JSON.parse(text)
  await dataApi.importData(data)
  await store.loadAll()
  toastMsg.value = '数据导入成功'
  setTimeout(() => { toastMsg.value = '' }, 2500)
}
</script>

<style>
@import './styles.css';
</style>
