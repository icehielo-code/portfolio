<template>
  <div>
    <div class="card">
      <div class="alloc-tabs">
        <button class="alloc-tab" :class="{ active: allocTab === 'overview' }" @click="allocTab = 'overview'">持仓概览</button>
        <button class="alloc-tab" :class="{ active: allocTab === 'category' }" @click="allocTab = 'category'">基金大类</button>
        <button class="alloc-tab" :class="{ active: allocTab === 'style' }" @click="allocTab = 'style'">基金风格</button>
        <button class="alloc-tab" :class="{ active: allocTab === 'manager' }" @click="allocTab = 'manager'">基金经理</button>
        <button class="alloc-tab" :class="{ active: allocTab === 'holdings' }" @click="allocTab = 'holdings'">底层资产集中度</button>
      </div>

      <div class="alloc-panel" :class="{ active: allocTab === 'overview' }">
        <div v-for="(f, i) in store.funds" :key="f.id" class="alloc-row">
          <span class="alloc-name">{{ f.name }}</span>
          <div class="alloc-flex">
            <div class="alloc-bar-wrap">
              <div class="alloc-bar" :style="{ width: getPct(f) + '%', background: COLORS[i % COLORS.length] }"></div>
            </div>
          </div>
          <span class="alloc-pct">{{ getPct(f).toFixed(1) }}%</span>
        </div>
      </div>

      <div class="alloc-panel" :class="{ active: allocTab === 'category' }">
        <div v-for="cat in categoryData" :key="cat.name" class="alloc-cat-row">
          <span class="alloc-cat-name">{{ cat.name }}</span>
          <div class="alloc-cat-flex">
            <div class="alloc-cat-bar-wrap">
              <div class="alloc-cat-bar" :style="{ width: cat.pct + '%', background: cat.color }"></div>
            </div>
          </div>
          <span class="alloc-cat-pct">{{ cat.pct.toFixed(1) }}%</span>
          <span class="alloc-cat-amount">¥{{ formatAmt(cat.value) }}</span>
        </div>
      </div>

      <div class="alloc-panel" :class="{ active: allocTab === 'style' }">
        <div v-for="s in styleData" :key="s.name" class="alloc-cat-row">
          <span class="alloc-cat-name">{{ s.name }}</span>
          <div class="alloc-cat-flex">
            <div class="alloc-cat-bar-wrap">
              <div class="alloc-cat-bar" :style="{ width: s.pct + '%', background: s.color }"></div>
            </div>
          </div>
          <span class="alloc-cat-pct">{{ s.pct.toFixed(1) }}%</span>
          <span class="alloc-cat-amount">¥{{ formatAmt(s.value) }}</span>
        </div>
      </div>

      <div class="alloc-panel" :class="{ active: allocTab === 'manager' }">
        <table class="fund-table">
          <thead><tr><th>基金经理</th><th>管理基金</th><th>总市值</th><th>占比</th></tr></thead>
          <tbody>
            <tr v-for="m in managerData" :key="m.name">
              <td style="font-weight:500;">{{ m.name }}</td>
              <td>{{ m.funds.map(f => f.name).join('、') }}</td>
              <td>¥{{ formatAmt(m.value) }}</td>
              <td>{{ m.pct.toFixed(1) }}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="alloc-panel" :class="{ active: allocTab === 'holdings' }">
        <div v-for="f in store.funds.filter(f => f.top_holdings && f.top_holdings.length)" :key="f.id" style="margin-bottom:16px;">
          <div style="font-size:13px;font-weight:500;margin-bottom:6px;">{{ f.name }}</div>
          <table class="holdings-table">
            <thead><tr><th>持仓</th><th>占比</th></tr></thead>
            <tbody>
              <tr v-for="h in f.top_holdings" :key="h.name">
                <td>{{ h.name }}</td>
                <td>{{ h.pct }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="!store.funds.some(f => f.top_holdings && f.top_holdings.length)" class="empty-state">
          <p>暂无底层资产数据，请在编辑基金时添加前十大持仓</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useFundStore } from '../stores/fund'

const store = useFundStore()
const allocTab = ref('overview')

const COLORS = ['#378ADD','#1D9E75','#E24B4A','#BA7517','#7F77DD','#D4537E','#0F6E56']

const tv = computed(() => store.totalValue)

function getPct(f) { return tv.value > 0 ? (f.nav * f.shares / tv.value) * 100 : 0 }

const categoryData = computed(() => {
  const map = {}
  const catColors = { '权益类': '#378ADD', '境内固收': '#1D9E75', '海外市场': '#E24B4A', '商品及其它': '#BA7517' }
  store.funds.forEach(f => {
    const cat = f.category || '权益类'
    if (!map[cat]) map[cat] = { name: cat, value: 0, color: catColors[cat] || '#7F77DD' }
    map[cat].value += f.nav * f.shares
  })
  return Object.values(map).map(c => ({ ...c, pct: tv.value > 0 ? (c.value / tv.value) * 100 : 0 }))
})

const styleData = computed(() => {
  const map = {}
  const styleColors = { '价值型': '#378ADD', '均衡型': '#1D9E75', '成长型': '#E24B4A' }
  store.funds.filter(f => f.category === '权益类').forEach(f => {
    const s = f.style || '均衡型'
    if (!map[s]) map[s] = { name: s, value: 0, color: styleColors[s] || '#7F77DD' }
    map[s].value += f.nav * f.shares
  })
  const total = Object.values(map).reduce((s, c) => s + c.value, 0)
  return Object.values(map).map(c => ({ ...c, pct: total > 0 ? (c.value / total) * 100 : 0 }))
})

const managerData = computed(() => {
  const map = {}
  store.funds.forEach(f => {
    const m = f.manager || '未知'
    if (!map[m]) map[m] = { name: m, funds: [], value: 0 }
    map[m].funds.push(f)
    map[m].value += f.nav * f.shares
  })
  return Object.values(map).map(m => ({ ...m, pct: tv.value > 0 ? (m.value / tv.value) * 100 : 0 }))
})

function formatAmt(n) {
  if (n >= 10000) return (n / 10000).toFixed(2) + '万'
  return n.toFixed(0)
}
</script>
