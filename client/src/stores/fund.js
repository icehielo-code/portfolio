import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fundsApi, strategiesApi, checkpointsApi, settingsApi, proxyApi } from '../api'

export const useFundStore = defineStore('fund', () => {
  const funds = ref([])
  const strategies = ref([])
  const checkpoints = ref([])
  const originMode = ref(false)
  const privacyMode = ref(false)
  const activeStrategyId = ref(null)
  const loading = ref(false)

  const totalValue = computed(() => funds.value.reduce((s, f) => s + f.nav * f.shares, 0))

  const latestCheckpoint = computed(() => {
    return checkpoints.value.length ? checkpoints.value[0] : null
  })

  function getCheckpointNav(code) {
    const cp = latestCheckpoint.value
    if (!cp) return null
    const snapshot = (cp.nav_snapshots || []).find(s => s.code === code)
    return snapshot ? snapshot.nav : null
  }

  const activeStrategy = computed(() => {
    return strategies.value.find(s => s.id === activeStrategyId.value) || strategies.value.find(s => s.is_active) || null
  })

  async function loadAll() {
    loading.value = true
    try {
      const [f, s, c, om] = await Promise.all([
        fundsApi.list(),
        strategiesApi.list(),
        checkpointsApi.list(),
        settingsApi.get('origin_mode'),
      ])
      funds.value = f
      strategies.value = s
      checkpoints.value = c
      originMode.value = om.value === 'true'
      const active = s.find(st => st.is_active)
      if (active) activeStrategyId.value = active.id
    } finally {
      loading.value = false
    }
  }

  async function addFund(data) {
    const fund = await fundsApi.create(data)
    funds.value.push(fund)
    return fund
  }

  async function updateFund(id, data) {
    const fund = await fundsApi.update(id, data)
    const idx = funds.value.findIndex(f => f.id === id)
    if (idx >= 0) funds.value[idx] = fund
    return fund
  }

  async function removeFund(id) {
    await fundsApi.remove(id)
    funds.value = funds.value.filter(f => f.id !== id)
  }

  async function refreshAllNAVs() {
    const codes = funds.value.map(f => f.code)
    if (!codes.length) return
    const results = await proxyApi.batchQuery(codes)
    const updates = []
    for (const [code, data] of Object.entries(results)) {
      if (data.nav && !data.error) {
        const navVal = data.gsz && parseFloat(data.gsz) > 0 ? data.gsz : (data.nav || data.dwjz)
        if (navVal) updates.push({ code, nav: parseFloat(navVal) })
      }
    }
    if (updates.length) {
      await fundsApi.batchNav(updates)
      updates.forEach(u => {
        const fund = funds.value.find(f => f.code === u.code)
        if (fund) fund.nav = u.nav
      })
    }
    return updates.length
  }

  async function addStrategy(data) {
    const strategy = await strategiesApi.create(data)
    strategies.value.push(strategy)
    return strategy
  }

  async function updateStrategy(id, data) {
    const strategy = await strategiesApi.update(id, data)
    const idx = strategies.value.findIndex(s => s.id === id)
    if (idx >= 0) strategies.value[idx] = strategy
    return strategy
  }

  async function removeStrategy(id) {
    await strategiesApi.remove(id)
    strategies.value = strategies.value.filter(s => s.id !== id)
  }

  async function activateStrategy(id) {
    await strategiesApi.activate(id)
    strategies.value.forEach(s => { s.is_active = s.id === id ? 1 : 0 })
    activeStrategyId.value = id
  }

  async function addCheckpoint(data) {
    const cp = await checkpointsApi.create(data)
    checkpoints.value.unshift(cp)
    return cp
  }

  async function removeCheckpoint(id) {
    await checkpointsApi.remove(id)
    checkpoints.value = checkpoints.value.filter(c => c.id !== id)
  }

  async function toggleOriginMode(val) {
    originMode.value = val
    await settingsApi.set('origin_mode', String(val))
  }

  function togglePrivacy() {
    privacyMode.value = !privacyMode.value
  }

  return {
    funds, strategies, checkpoints, originMode, privacyMode, activeStrategyId, loading,
    totalValue, latestCheckpoint, getCheckpointNav, togglePrivacy, activeStrategy,
    loadAll, addFund, updateFund, removeFund, refreshAllNAVs,
    addStrategy, updateStrategy, removeStrategy, activateStrategy,
    addCheckpoint, removeCheckpoint, toggleOriginMode,
  }
})
