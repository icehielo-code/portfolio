<template>
  <div>
    <div class="card" style="background:var(--color-bg-secondary);border-color:transparent;">
      <div class="section-title">检查点</div>
      <div class="cp-add-row">
        <div class="form-item">
          <label>名称</label>
          <input v-model="cpLabel" placeholder="如：季度检查" />
        </div>
        <div class="form-item">
          <label>日期</label>
          <input v-model="cpDate" type="date" />
        </div>
      </div>
      <div class="form-item" style="margin-bottom:8px;">
        <label>净值（逗号分隔，顺序对应下方基金，留空自动填充当前净值）</label>
        <input v-model="cpNavs" placeholder="1.2345, 2.3456, 3.4567" />
      </div>
      <div class="cp-fund-order" v-if="store.funds.length">
        <span class="cp-fund-ref" v-for="(f, i) in store.funds" :key="f.code">{{ i + 1 }}. {{ f.name }} ({{ f.code }})</span>
      </div>
      <button class="btn btn-primary" @click="addCheckpoint" style="margin-top:8px;">添加检查点</button>

      <div class="cp-list" v-if="store.checkpoints.length" style="margin-top:12px;">
        <div v-for="cp in store.checkpoints" :key="cp.id" class="cp-item" :class="{ 'active-cp': cp.id === store.latestCheckpoint?.id }">
          <span class="cp-dot"></span>
          <div class="cp-info">
            <span class="cp-name">{{ cp.label }}</span>
            <div>
              <span class="cp-meta">{{ cp.checkpoint_date }}</span>
              <span class="cp-snap-count"> · {{ cp.nav_snapshots?.length || 0 }} 条记录</span>
            </div>
          </div>
          <button class="cp-del" @click="store.removeCheckpoint(cp.id)">删除</button>
        </div>
      </div>
    </div>

    <div class="metrics">
      <div class="metric">
        <div class="metric-label">总市值</div>
        <div class="metric-value">¥{{ formatNum(totalValue) }}</div>
      </div>
      <div class="metric">
        <div class="metric-label">今日盈亏</div>
        <div class="metric-value" :class="todayPL >= 0 ? 'up' : 'down'">{{ todayPL >= 0 ? '+' : '' }}¥{{ formatNum(Math.abs(todayPL)) }}</div>
      </div>
      <div class="metric">
        <div class="metric-label">{{ phaseLabel }}</div>
        <div class="metric-value" :class="totalPL >= 0 ? 'up' : 'down'">{{ totalPL >= 0 ? '+' : '' }}¥{{ formatNum(Math.abs(totalPL)) }}</div>
        <div class="metric-sub">{{ mask((totalPLRate >= 0 ? '+' : '') + totalPLRate.toFixed(2) + '%') }}</div>
      </div>
      <div class="metric">
        <div class="metric-label">最大回撤</div>
        <div class="metric-value down">-{{ maxDrawdown.toFixed(2) }}%</div>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span class="section-title" style="margin-bottom:0;">持仓基金</span>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--color-text-secondary);cursor:pointer;">
          <span>{{ showCumulative ? '累计收益' : '阶段收益' }}</span>
          <div class="toggle" style="width:32px;height:18px;">
            <input type="checkbox" v-model="showCumulative" />
            <span class="toggle-track"></span>
          </div>
        </label>
      </div>
      <table class="fund-table" v-if="store.funds.length">
        <thead>
          <tr>
            <th>基金</th>
            <th>净值 <span v-if="store.navRefreshTime" style="font-weight:400;font-size:10px;">{{ store.navRefreshTime }}</span></th>
            <th>买入净值</th>
            <th>市值</th>
            <th>{{ phaseLabel }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in store.funds" :key="f.id">
            <td>
              <div class="fund-name">{{ f.name }}</div>
              <div class="fund-code">{{ f.code }}</div>
              <div v-if="phaseTagsMap.get(f.code)?.length" class="phase-tags">
                <span v-for="(tag, i) in phaseTagsMap.get(f.code)" :key="i" class="phase-tag" :class="tag.pct >= 0 ? 'up' : 'down'">
                  {{ tag.label }}:{{ tag.pct >= 0 ? '+' : '' }}{{ tag.pct.toFixed(2) }}%
                </span>
              </div>
            </td>
            <td>{{ mask(f.nav?.toFixed(4)) }}</td>
            <td>{{ mask(baseNavForFund(f).toFixed(4)) }}</td>
            <td>¥{{ formatNum(f.nav * f.shares) }}</td>
            <td>
              <div :class="fundPL(f) >= 0 ? 'up' : 'down'" style="font-weight:500;">
                {{ fundPL(f) >= 0 ? '+' : '' }}¥{{ formatNum(Math.abs(fundPL(f))) }}
              </div>
              <div class="metric-sub" :class="fundPLRate(f) >= 0 ? 'up' : 'down'">
                {{ mask((fundPLRate(f) >= 0 ? '+' : '') + fundPLRate(f).toFixed(2) + '%') }}
              </div>
            </td>
            <td>
              <button class="btn" style="font-size:11px;padding:3px 8px;" @click="openEdit(f)">编辑</button>
              <button class="btn" style="font-size:11px;padding:3px 8px;margin-left:4px;color:var(--color-text-danger);" @click="removeFund(f.id)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state">
        <p>暂无持仓基金</p>
        <button class="btn btn-primary" @click="addNewFund">+ 添加基金</button>
      </div>
      <button v-if="store.funds.length" class="btn btn-block" @click="addNewFund" style="margin-top:10px;">+ 添加基金</button>
    </div>

    <div class="card">
      <div class="section-title">再平衡建议</div>
      <div v-for="f in rebalanceData" :key="f.code" class="rebal-row">
        <span class="rebal-name">{{ f.name }}</span>
        <div class="rebal-flex">
          <div class="alloc-bar-wrap">
            <div class="alloc-bar" :style="{ width: f.currentPct + '%', background: f.diffColor }"></div>
          </div>
        </div>
        <span class="rebal-action" :class="f.actionClass">{{ f.action }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { useFundStore } from '../stores/fund'

const store = useFundStore()
const openEdit = inject('openEdit')
const toast = inject('toast')

const showCumulative = ref(false)
const cpLabel = ref('')
const cpDate = ref(new Date().toISOString().slice(0, 10))
const cpNavs = ref('')

const totalValue = computed(() => store.totalValue)

function baseNavForFund(f) {
  if (showCumulative.value) return f.origin_nav
  const cp = store.latestCheckpoint
  if (cp) {
    const snap = cp.nav_snapshots?.find(s => s.code === f.code)
    if (snap?.nav) return snap.nav
  }
  return f.origin_nav
}

const phaseLabel = computed(() => {
  if (showCumulative.value) return '持有收益'
  const cp = store.latestCheckpoint
  if (cp) return '收益 (' + cp.checkpoint_date.slice(5) + ')'
  return '持有收益'
})

const totalCost = computed(() => store.funds.reduce((s, f) => s + baseNavForFund(f) * f.shares, 0))

const totalPL = computed(() => totalValue.value - totalCost.value)

const totalPLRate = computed(() => totalCost.value > 0 ? (totalPL.value / totalCost.value) * 100 : 0)

const todayPL = computed(() => {
  return store.funds.reduce((s, f) => {
    const change = f._changePct || 0
    return s + f.nav * f.shares * (change / 100)
  }, 0)
})

const maxDrawdown = computed(() => {
  if (!store.funds.length) return 0
  const maxPL = Math.max(...store.funds.map(f => fundPLRate(f)))
  return Math.max(0, maxPL < 0 ? Math.abs(maxPL) : 0)
})

function fundPL(f) { return (f.nav - baseNavForFund(f)) * f.shares }
function fundPLRate(f) { const base = baseNavForFund(f); return base > 0 ? ((f.nav - base) / base) * 100 : 0 }

const rebalanceData = computed(() => {
  const tv = totalValue.value
  if (!tv) return []
  return store.funds.map(f => {
    const current = (f.nav * f.shares / tv) * 100
    const diff = current - f.target
    let action = '持有'
    let actionClass = 'neutral'
    if (diff > 3) { action = `减仓 ${diff.toFixed(1)}%`; actionClass = 'up' }
    else if (diff < -3) { action = `加仓 ${Math.abs(diff).toFixed(1)}%`; actionClass = 'down' }
    return {
      code: f.code, name: f.name, currentPct: current, targetPct: f.target,
      diff, action, actionClass, diffColor: diff > 0 ? '#e24b4a' : '#1d9e75'
    }
  })
})

const phaseTagsMap = computed(() => {
  const map = new Map()
  const cps = store.checkpoints
  if (!cps.length) return map

  const chrono = [...cps].reverse()
  for (const f of store.funds) {
    const tags = []

    if (f.origin_nav > 0 && chrono.length > 0) {
      const firstNav = chrono[0].nav_snapshots.find(s => s.code === f.code)?.nav
      if (firstNav && firstNav > 0) {
        tags.push({ label: '原始', pct: ((firstNav - f.origin_nav) / f.origin_nav) * 100 })
      }
    }

    for (let i = 0; i < chrono.length - 1; i++) {
      const fromNav = chrono[i].nav_snapshots.find(s => s.code === f.code)?.nav
      const toNav = chrono[i + 1].nav_snapshots.find(s => s.code === f.code)?.nav
      if (fromNav && toNav && fromNav > 0) {
        tags.push({ label: chrono[i + 1].label, pct: ((toNav - fromNav) / fromNav) * 100 })
      }
    }

    if (chrono.length > 0) {
      const lastNav = chrono[chrono.length - 1].nav_snapshots.find(s => s.code === f.code)?.nav
      if (lastNav && lastNav > 0) {
        tags.push({ label: '当前', pct: ((f.nav - lastNav) / lastNav) * 100 })
      }
    }

    map.set(f.code, tags)
  }
  return map
})

function formatNum(n) {
  if (store.privacyMode) return '***'
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function mask(val) { return store.privacyMode ? '***' : val }

function addNewFund() {
  openEdit({ id: null, code: '', name: '', type: 'A股公募', nav: 0, shares: 0, target: 0, origin_nav: 0, category: '权益类', style: '均衡型', manager: '', top_holdings: [] })
}

async function removeFund(id) {
  if (confirm('确认删除该基金？')) {
    await store.removeFund(id)
    toast('已删除')
  }
}

async function addCheckpoint() {
  if (!cpLabel.value || !cpDate.value) { toast('请填写名称和日期'); return }

  const navStrs = cpNavs.value.split(',').map(s => s.trim())
  const navValues = navStrs.map(s => (s ? parseFloat(s) : NaN))

  for (let i = 0; i < navValues.length; i++) {
    if (navStrs[i] && isNaN(navValues[i])) {
      toast(`第 ${i + 1} 个净值格式错误: "${navStrs[i]}"`)
      return
    }
  }

  const snapshots = store.funds.map((f, i) => ({
    code: f.code,
    name: f.name,
    nav: (i < navValues.length && !isNaN(navValues[i])) ? navValues[i] : f.nav,
  }))

  await store.addCheckpoint({
    label: cpLabel.value,
    checkpoint_date: cpDate.value,
    nav_snapshots: snapshots,
  })

  cpLabel.value = ''
  cpNavs.value = ''
  toast('检查点已添加')
}
</script>
