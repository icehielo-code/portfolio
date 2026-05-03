<template>
  <div>
    <div class="mode-banner" :class="store.originMode ? 'mode-origin' : 'mode-stage'">
      <span class="mode-dot"></span>
      {{ store.originMode ? '成本基准模式 — 收益按成本净值计算' : '阶段基准模式 — 收益按检查点净值计算' }}
      <label class="toggle" style="margin-left:auto;">
        <input type="checkbox" :checked="store.originMode" @change="store.toggleOriginMode($event.target.checked)" />
        <span class="toggle-track"></span>
      </label>
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
        <div class="metric-label">持有收益</div>
        <div class="metric-value" :class="totalPL >= 0 ? 'up' : 'down'">{{ totalPL >= 0 ? '+' : '' }}¥{{ formatNum(Math.abs(totalPL)) }}</div>
        <div class="metric-sub">{{ totalPLRate >= 0 ? '+' : '' }}{{ totalPLRate.toFixed(2) }}%</div>
      </div>
      <div class="metric">
        <div class="metric-label">最大回撤</div>
        <div class="metric-value down">-{{ maxDrawdown.toFixed(2) }}%</div>
      </div>
    </div>

    <div class="card">
      <div class="section-title">持仓基金</div>
      <table class="fund-table" v-if="store.funds.length">
        <thead>
          <tr>
            <th>基金</th>
            <th>净值</th>
            <th>市值</th>
            <th>收益</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in store.funds" :key="f.id">
            <td>
              <div class="fund-name">{{ f.name }}</div>
              <div class="fund-code">{{ f.code }}</div>
            </td>
            <td>{{ f.nav?.toFixed(4) }}</td>
            <td>¥{{ formatNum(f.nav * f.shares) }}</td>
            <td>
              <span :class="fundPL(f) >= 0 ? 'up' : 'down'">
                {{ fundPL(f) >= 0 ? '+' : '' }}¥{{ formatNum(Math.abs(fundPL(f))) }}
              </span>
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

    <div class="two-col">
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

      <div class="card">
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
          <button class="btn btn-primary" @click="addCheckpoint" style="align-self:flex-end;">添加</button>
        </div>
        <div class="cp-list">
          <div v-for="cp in store.checkpoints" :key="cp.id" class="cp-item">
            <span class="cp-dot"></span>
            <span class="cp-name">{{ cp.label }}</span>
            <span class="cp-meta">{{ cp.checkpoint_date }}</span>
            <button class="cp-del" @click="store.removeCheckpoint(cp.id)">删除</button>
          </div>
        </div>
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

const cpLabel = ref('')
const cpDate = ref(new Date().toISOString().slice(0, 10))

const totalValue = computed(() => store.totalValue)

const totalCost = computed(() => store.funds.reduce((s, f) => s + f.origin_nav * f.shares, 0))

const totalPL = computed(() => totalValue.value - totalCost.value)

const totalPLRate = computed(() => totalCost.value > 0 ? (totalPL.value / totalCost.value) * 100 : 0)

const todayPL = computed(() => {
  return store.funds.reduce((s, f) => {
    const baseNav = store.originMode ? f.origin_nav : f.nav
    return s + (f.nav - baseNav) * f.shares * 0.002
  }, 0)
})

const maxDrawdown = computed(() => {
  if (!store.funds.length) return 0
  const maxPL = Math.max(...store.funds.map(f => fundPLRate(f)))
  return Math.max(0, maxPL < 0 ? Math.abs(maxPL) : 0)
})

function fundPL(f) { return (f.nav - f.origin_nav) * f.shares }
function fundPLRate(f) { return f.origin_nav > 0 ? ((f.nav - f.origin_nav) / f.origin_nav) * 100 : 0 }

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

function formatNum(n) {
  if (n >= 10000) return (n / 10000).toFixed(2) + '万'
  return n.toFixed(2)
}

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
  const snapshots = store.funds.map(f => ({ code: f.code, name: f.name, nav: f.nav }))
  await store.addCheckpoint({ label: cpLabel.value, checkpoint_date: cpDate.value, nav_snapshots: snapshots })
  cpLabel.value = ''
  toast('检查点已添加')
}
</script>
