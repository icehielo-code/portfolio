import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fundsApi, strategiesApi, checkpointsApi, settingsApi, proxyApi, fundDailyApi } from '../api'

export const useFundStore = defineStore('fund', () => {
  const funds = ref([])
  const strategies = ref([])
  const checkpoints = ref([])
  const originMode = ref(false)
  const privacyMode = ref(false)
  const navRefreshTime = ref('')
  const navDate = ref('')
  const dailyFunds = ref({})
  let pollingTimer = null
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
        const navVal = data.nav || data.dwjz  // official NAV from 东方财富 REST API
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
    // Store daily change % and estimated NAV in memory
    let latestJzrq = ''
    for (const [code, data] of Object.entries(results)) {
      const fund = funds.value.find(f => f.code === code)
      if (fund && data.gszzl != null) {
        fund._changePct = parseFloat(data.gszzl)
      }
      if (fund && data.gsz != null) {
        fund._gsz = parseFloat(data.gsz)
      }
      if (fund && data.jzrq) fund._navDate = data.jzrq
      if (data.jzrq && (!latestJzrq || data.jzrq > latestJzrq)) {
        latestJzrq = data.jzrq
      }
    }
    if (latestJzrq) navDate.value = latestJzrq.slice(5) // mm-dd
    const now = new Date()
    navRefreshTime.value = String(now.getFullYear()).slice(2) + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0')
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

  async function loadDailyData() {
    try {
      const { date, funds: dailyMap } = await fundDailyApi.latest()
      if (date) {
        navDate.value = date.slice(5) // mm-dd (global latest)
        dailyFunds.value = dailyMap
        for (const fund of funds.value) {
          const d = dailyMap[fund.code]
          if (d && d.nav) {
            fund.nav = d.nav
            fund._changePct = d.changePct || 0
            fund._navDate = d.date || ''  // per-fund individual date
          }
        }
      }
    } catch {}
  }

  async function fetchGsz() {
    // Lightweight: only fetch intraday estimates from 天天基金
    const codes = funds.value.map(f => f.code).filter(Boolean)
    if (!codes.length) return
    try {
      const results = await proxyApi.batchQuery(codes)
      for (const [code, data] of Object.entries(results)) {
        const fund = funds.value.find(f => f.code === code)
        if (!fund) continue
        if (data.gsz != null) fund._gsz = parseFloat(data.gsz)
        if (data.jzrq) fund._navDate = data.jzrq
      }
    } catch {}
  }

  function startPolling(intervalMs = 5 * 60 * 1000) {
    stopPolling()
    pollingTimer = setInterval(async () => {
      try {
        const { date } = await fundDailyApi.latest()
        if (date && date.slice(5) !== navDate.value) {
          await loadDailyData()
        }
        await fetchGsz()
      } catch {}
    }, intervalMs)
  }

  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }
  }

  return {
    funds, strategies, checkpoints, originMode, privacyMode, navRefreshTime, navDate, dailyFunds, activeStrategyId, loading,
    totalValue, latestCheckpoint, getCheckpointNav, togglePrivacy, activeStrategy,
    loadAll, addFund, updateFund, removeFund, refreshAllNAVs,
    addStrategy, updateStrategy, removeStrategy, activateStrategy,
    addCheckpoint, removeCheckpoint, toggleOriginMode,
    loadDailyData, fetchGsz, startPolling, stopPolling,
  }
})
