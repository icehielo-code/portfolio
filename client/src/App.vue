<template>
  <div class="app">
    <!-- Login screen -->
    <div v-if="!currentUser" class="login-page">
      <div class="login-card">
        <h1>CHONG的私人基金管理工具</h1>
        <p style="color:var(--color-text-secondary);margin-bottom:1.5rem;">输入用户名进入系统</p>
        <div class="login-row">
          <input v-model="loginName" placeholder="用户名" @keyup.enter="doLogin" autofocus />
          <button class="btn btn-primary" @click="doLogin" :disabled="!loginName.trim()">进入</button>
        </div>
        <div v-if="users.length" class="login-users">
          <div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:8px;">已有用户</div>
          <button v-for="u in users" :key="u.id" class="btn" @click="selectUser(u)" style="margin:2px 4px;font-size:12px;">{{ u.username }}</button>
        </div>
      </div>
    </div>

    <!-- Main app -->
    <template v-else>
      <HeaderBar @export="handleExport" @import="handleImport" @ai-advice="openAI('default')" @switch-user="currentUser = null" :currentUser="currentUser" />
      <TabNav v-model="activeTab" />
      <OverviewPage v-if="activeTab === 'overview'" />
      <AllocatePage v-if="activeTab === 'allocate'" />
      <AdvicePage v-if="activeTab === 'advice'" ref="advicePage" />
      <StrategyPage v-if="activeTab === 'strategy'" />
      <EditModal v-if="editFund" :fund="editFund" @save="onSaveFund" @close="editFund = null" />
      <ApiKeySetupModal v-if="showApiSetup" @saved="onApiSaved" @skip="showApiSetup = false" />
      <Toast :message="toastMsg" v-if="toastMsg" />
    </template>
  </div>
</template>

<script setup>
import { ref, provide, onMounted } from 'vue'
import { useFundStore } from './stores/fund'
import { dataApi, usersApi } from './api'
import HeaderBar from './components/HeaderBar.vue'
import TabNav from './components/TabNav.vue'
import OverviewPage from './views/OverviewPage.vue'
import AllocatePage from './views/AllocatePage.vue'
import AdvicePage from './views/AdvicePage.vue'
import StrategyPage from './views/StrategyPage.vue'
import EditModal from './components/EditModal.vue'
import ApiKeySetupModal from './components/ApiKeySetupModal.vue'
import Toast from './components/Toast.vue'

const store = useFundStore()
const activeTab = ref('overview')
const editFund = ref(null)
const toastMsg = ref('')
const advicePage = ref(null)
const currentUser = ref(null)
const loginName = ref('')
const users = ref([])
const showApiSetup = ref(false)

provide('openEdit', (fund) => { editFund.value = { ...fund } })
provide('toast', (msg) => { toastMsg.value = msg; setTimeout(() => { toastMsg.value = '' }, 2500) })
provide('openAI', (type) => { activeTab.value = 'advice'; setTimeout(() => advicePage.value?.askAI(type), 100) })

onMounted(async () => {
  // Check for saved user
  const saved = localStorage.getItem('currentUser')
  if (saved) {
    try {
      currentUser.value = JSON.parse(saved)
      await store.loadAll()
      await store.loadDailyData()
      await store.fetchGsz()
      store.startPolling()
    } catch {
      localStorage.removeItem('currentUser')
    }
  }
  // Load user list for login screen
  try {
    users.value = await usersApi.list()
  } catch {}
})

async function doLogin() {
  const name = loginName.value.trim()
  if (!name) return
  try {
    const user = await usersApi.login(name)
    selectUser(user)
  } catch (e) {
    toastMsg.value = '登录失败: ' + e.message
    setTimeout(() => { toastMsg.value = '' }, 2500)
  }
}

async function selectUser(user) {
  currentUser.value = user
  localStorage.setItem('currentUser', JSON.stringify({ id: user.id, username: user.username }))
  loginName.value = ''
  await store.loadAll()
  await store.loadDailyData()
  await store.fetchGsz()
  store.startPolling()
  if (user.isNew) {
    showApiSetup.value = true
  }
}

function onApiSaved() {
  showApiSetup.value = false
  toastMsg.value = 'API Key 已配置，AI 功能已就绪'
  setTimeout(() => { toastMsg.value = '' }, 2500)
}

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
