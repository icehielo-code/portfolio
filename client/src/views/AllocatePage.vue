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

      <!-- 持仓概览 -->
      <div class="alloc-panel" :class="{ active: allocTab === 'overview' }">
        <div class="viz-rank-header">
          <span class="viz-rank-total-label">总市值</span>
          <span class="viz-rank-total-val">¥{{ formatAmt(store.totalValue) }}</span>
        </div>
        <div class="viz-rank-list">
          <div v-for="(f, i) in rankedFunds" :key="f.id" class="viz-rank-item">
            <span class="viz-rank-num">{{ i + 1 }}</span>
            <span class="viz-rank-dot" :style="{ background: COLORS[i % COLORS.length] }"></span>
            <div class="viz-rank-body">
              <div class="viz-rank-top">
                <span class="viz-rank-name">{{ f.name }}</span>
                <span class="viz-rank-amount">¥{{ formatAmt(f.nav * f.shares) }}</span>
              </div>
              <div class="viz-rank-bar-wrap">
                <div class="viz-rank-bar" :style="{ width: rankedPct[i] + '%', background: COLORS[i % COLORS.length] }"></div>
              </div>
              <span class="viz-rank-pct">{{ rankedPct[i].toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 基金大类 -->
      <div class="alloc-panel" :class="{ active: allocTab === 'category' }">
        <div class="viz-overview">
          <div class="viz-donut-col">
            <svg viewBox="0 0 200 200" class="viz-donut">
              <circle cx="100" cy="100" r="78" fill="none" stroke="var(--color-bg-tertiary)" stroke-width="24" />
              <circle
                v-for="(seg, si) in categoryDonut"
                :key="'cs'+si"
                cx="100" cy="100" r="78"
                fill="none"
                :stroke="seg.color"
                stroke-width="24"
                stroke-linecap="butt"
                :stroke-dasharray="seg.dashArray"
                :stroke-dashoffset="seg.dashOffset"
                transform="rotate(-90 100 100)"
                style="transition: stroke-dasharray .6s ease, stroke-dashoffset .6s ease;"
              />
              <text x="100" y="97" text-anchor="middle" class="viz-donut-center-val">{{ categoryData.length }}</text>
              <text x="100" y="116" text-anchor="middle" class="viz-donut-center-label">大类数量</text>
            </svg>
          </div>
          <div class="viz-overview-list">
            <div v-for="cat in categoryData" :key="cat.name" class="viz-ov-item">
              <div class="viz-ov-left">
                <span class="viz-ov-dot" :style="{ background: cat.color }"></span>
                <span class="viz-ov-name">{{ cat.name }}</span>
              </div>
              <div class="viz-ov-right">
                <span class="viz-ov-pct">{{ cat.pct.toFixed(1) }}%</span>
                <span class="viz-ov-amount">¥{{ formatAmt(cat.value) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 基金风格 -->
      <div class="alloc-panel" :class="{ active: allocTab === 'style' }">
        <div v-if="styleData.length" class="viz-overview">
          <div class="viz-donut-col">
            <svg viewBox="0 0 200 200" class="viz-donut">
              <circle cx="100" cy="100" r="78" fill="none" stroke="var(--color-bg-tertiary)" stroke-width="24" />
              <circle
                v-for="(seg, si) in styleDonut"
                :key="'ss'+si"
                cx="100" cy="100" r="78"
                fill="none"
                :stroke="seg.color"
                stroke-width="24"
                stroke-linecap="butt"
                :stroke-dasharray="seg.dashArray"
                :stroke-dashoffset="seg.dashOffset"
                transform="rotate(-90 100 100)"
                style="transition: stroke-dasharray .6s ease, stroke-dashoffset .6s ease;"
              />
              <text x="100" y="97" text-anchor="middle" class="viz-donut-center-val">权益类</text>
              <text x="100" y="116" text-anchor="middle" class="viz-donut-center-label">风格分布</text>
            </svg>
          </div>
          <div class="viz-overview-list">
            <div v-for="s in styleData" :key="s.name" class="viz-ov-item" :class="{ selected: selectedStyle === s.name }" @click="selectedStyle = selectedStyle === s.name ? null : s.name">
              <div class="viz-ov-left">
                <span class="viz-ov-dot" :style="{ background: s.color }"></span>
                <span class="viz-ov-name">{{ s.name }}</span>
                <span class="viz-ov-chevron">{{ selectedStyle === s.name ? '▾' : '▸' }}</span>
              </div>
              <div class="viz-ov-right">
                <span class="viz-ov-pct">{{ s.pct.toFixed(1) }}%</span>
                <span class="viz-ov-amount">¥{{ formatAmt(s.value) }}</span>
              </div>
            </div>
          </div>

          <div v-if="selectedStyle && styleFunds(selectedStyle).length" class="viz-style-funds">
            <div v-for="f in styleFunds(selectedStyle)" :key="f.id" class="viz-style-fund-item">
              <span class="viz-style-fund-name">{{ f.name }}</span>
              <span class="viz-style-fund-code">{{ f.code }}</span>
              <span class="viz-style-fund-val">¥{{ formatAmt(f.nav * f.shares) }}</span>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <p>暂无权益类基金，无法展示风格分布</p>
        </div>
      </div>

      <!-- 基金经理 -->
      <div class="alloc-panel" :class="{ active: allocTab === 'manager' }">
        <div v-if="detailLoading" class="viz-loading">
          <span class="viz-spinner"></span> 正在获取基金经理数据...
        </div>
        <div v-else-if="managerData.length" class="viz-manager-grid">
          <div v-for="m in managerData" :key="m.name" class="viz-mgr-card">
            <div class="viz-mgr-avatar">
              <img v-if="m.pic" :src="m.pic" :alt="m.name" class="viz-mgr-avatar-img" @error="showInitial($event, m.name)" />
              <span v-else>{{ m.name.charAt(0) }}</span>
            </div>
            <div class="viz-mgr-body">
              <div class="viz-mgr-name">{{ m.name }}</div>
              <div class="viz-mgr-meta">
                <span v-if="m.workTime">从业 {{ m.workTime }}</span>
                <span v-if="m.fundSize"> · 管理 {{ m.fundSize }}</span>
              </div>
              <div class="viz-mgr-fund-list">{{ m.funds.map(f => f.name).join('、') }}</div>
              <div class="viz-mgr-bar-wrap">
                <div class="viz-mgr-bar" :style="{ width: m.pct + '%' }"></div>
              </div>
              <div class="viz-mgr-stats">
                <span class="viz-mgr-pct">{{ m.pct.toFixed(1) }}%</span>
                <span class="viz-mgr-amount">¥{{ formatAmt(m.value) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <p>暂无基金经理数据</p>
        </div>
      </div>

      <!-- 底层资产集中度 -->
      <div class="alloc-panel" :class="{ active: allocTab === 'holdings' }">
        <div v-if="detailLoading" class="viz-loading">
          <span class="viz-spinner"></span> 正在获取持仓数据...
        </div>
        <div v-if="industryData.length" class="viz-industry-section">
          <div class="section-title">行业分布 · 面积=资金占比 · 颜色=当日涨跌</div>
          <div class="viz-treemap">
            <div v-for="ind in industryData" :key="ind.name" class="viz-tm-cell"
              :style="{ flexBasis: Math.max(ind.pct * 2.5, 8) + '%', background: ind.color }"
              @mouseenter="hoveredIndustry = ind.name"
              @mouseleave="hoveredIndustry = null"
            >
              <span class="viz-tm-name" v-if="ind.pct > 2">{{ ind.name }}</span>
              <span class="viz-tm-pct">{{ ind.pct.toFixed(1) }}%</span>
              <span class="viz-tm-change" :style="{ color: ind.change >= 0 ? '#ffcdd2' : '#c8e6c9' }">
                {{ ind.change >= 0 ? '+' : '' }}{{ ind.change.toFixed(2) }}%
              </span>
              <!-- Tooltip -->
              <div v-if="hoveredIndustry === ind.name && industryFundMap[ind.name]" class="viz-tm-tip">
                <div class="viz-tm-tip-title">{{ ind.name }}</div>
                <div v-for="f in industryFundMap[ind.name]" :key="f.code" class="viz-tm-tip-row">
                  <span class="viz-tm-tip-fund">{{ f.name }}</span>
                  <span class="viz-tm-tip-pct">{{ f.pct.toFixed(1) }}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="holdingsData.length" class="viz-holdings-grid">
          <div v-for="fh in holdingsData" :key="fh.code" class="viz-holding-card">
            <div class="viz-holding-header">
              <span class="viz-holding-fund-name">{{ fh.name }}</span>
              <span class="viz-holding-badge">前{{ fh.holdings.length }}大持仓</span>
              <span v-if="fh.reportDate" class="viz-holding-date">{{ fh.reportDate }}</span>
            </div>
            <div class="viz-holding-bars">
              <div v-for="h in fh.holdings" :key="h.name" class="viz-holding-row">
                <div class="viz-holding-item-name">{{ h.name }}</div>
                <div class="viz-holding-bar-track">
                  <div
                    class="viz-holding-bar-fill"
                    :style="{ width: holdingBarPct(h.pct, fh) + '%' }"
                  ></div>
                </div>
                <div class="viz-holding-item-pct">{{ h.pct }}%</div>
                <div
                  v-if="stockQuotes[h.secid]"
                  class="viz-holding-change"
                  :class="stockQuotes[h.secid].changePct >= 0 ? 'up' : 'down'"
                >
                  {{ stockQuotes[h.secid].changePct >= 0 ? '+' : '' }}{{ stockQuotes[h.secid].changePct.toFixed(2) }}%
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!detailLoading && !industryData.length && !holdingsData.length" class="empty-state">
          <p>暂无底层资产数据</p>
        </div>
        <div v-if="detailLoadTime" class="viz-load-time">
          数据加载时间：{{ detailLoadTime }}
          <span class="viz-info-tip">
            <svg viewBox="0 0 1024 1024" width="14" height="14" fill="currentColor"><path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"/><path d="M464 336a48 48 0 1 0 96 0 48 48 0 1 0-96 0zm72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8z"/></svg>
            <span class="viz-info-tip-content">
              基金持仓数据每季度更新一次，取决于基金公司披露节奏：<br>
              · 一季报（截止3/31）→ 4月中下旬披露<br>
              · 二季报（截止6/30）→ 7月中下旬披露<br>
              · 三季报（截止9/30）→ 10月中下旬披露<br>
              · 年报（截止12/31）→ 次年3月中下旬披露<br>
              页面加载时实时获取东方财富最新数据
            </span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useFundStore } from '../stores/fund'
import { proxyApi } from '../api'

const store = useFundStore()
const allocTab = ref('overview')
const selectedStyle = ref(null)
const hoveredIndustry = ref(null)

const COLORS = ['#378ADD','#1D9E75','#E24B4A','#BA7517','#7F77DD','#D4537E','#0F6E56','#3BA8D4','#E8A020','#C55DA0']

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

function styleFunds(style) {
  return store.funds.filter(f => (f.style || '均衡型') === style && f.category === '权益类')
}

const fundDetails = ref({})
const stockQuotes = ref({})
const stockIndustries = ref({})
const detailLoading = ref(false)
const detailLoaded = ref(false)
const detailLoadTime = ref('')

async function loadFundDetails() {
  if (detailLoaded.value || detailLoading.value) return
  const codes = store.funds.map(f => f.code).filter(Boolean)
  if (!codes.length) { detailLoaded.value = true; return }

  detailLoading.value = true
  try {
    const results = await proxyApi.batchFundDetail(codes)
    fundDetails.value = results

    const allSecids = []
    for (const d of Object.values(results)) {
      for (const h of (d.holdings || [])) {
        if (h.secid && !allSecids.includes(h.secid)) allSecids.push(h.secid)
      }
    }
    if (allSecids.length) {
      try {
        const [quotes, industries] = await Promise.all([
          proxyApi.stockQuotes(allSecids.join(',')),
          proxyApi.industries(allSecids),
        ])
        stockQuotes.value = quotes
        stockIndustries.value = industries
      } catch {}
    }
  } catch {} finally {
    detailLoading.value = false
    detailLoaded.value = true
    const now = new Date()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const mi = String(now.getMinutes()).padStart(2, '0')
    const ss = String(now.getSeconds()).padStart(2, '0')
    detailLoadTime.value = `${mm}月${dd}日 ${hh}:${mi}:${ss}`
  }
}

watch(() => store.funds, () => { detailLoaded.value = false }, { deep: true })

onMounted(() => {
  if (store.funds.length) loadFundDetails()
})

const managerData = computed(() => {
  const map = {}
  store.funds.forEach(f => {
    const detail = fundDetails.value[f.code]
    const managers = detail?.managers || []
    if (managers.length === 0) {
      const m = f.manager || '未知'
      if (!map[m]) map[m] = { name: m, funds: [], value: 0, pic: '', workTime: '', fundSize: '' }
      map[m].funds.push(f)
      map[m].value += f.nav * f.shares
    } else {
      managers.forEach(mgr => {
        if (!map[mgr.name]) map[mgr.name] = { name: mgr.name, funds: [], value: 0, pic: mgr.pic || '', workTime: mgr.workTime || '', fundSize: mgr.fundSize || '' }
        map[mgr.name].funds.push(f)
        map[mgr.name].value += f.nav * f.shares
      })
    }
  })
  return Object.values(map)
    .map(m => ({ ...m, pct: tv.value > 0 ? (m.value / tv.value) * 100 : 0 }))
    .sort((a, b) => b.value - a.value)
})

const holdingsData = computed(() => {
  return store.funds.map(f => {
    const detail = fundDetails.value[f.code]
    const holdings = detail?.holdings || []
    return {
      code: f.code,
      name: f.name,
      amount: f.nav * f.shares,
      reportDate: detail?.reportDate || '',
      holdings,
    }
  }).filter(fh => fh.holdings.length > 0)
})

const IND_COLORS = ['#378ADD','#E24B4A','#1D9E75','#BA7517','#7F77DD','#D4537E','#0F6E56','#3BA8D4','#E8A020','#C55DA0','#5B8FF9','#F6BD16','#FF6B6B','#34A853','#9C27B0','#673AB7','#FF9800','#00BCD4','#8BC34A','#E91E63']

function heatColor(pct) {
  if (pct > 3) return '#d32f2f'
  if (pct > 1.5) return '#e57373'
  if (pct > 0.3) return '#ef9a9a'
  if (pct > -0.3) return '#bdbdbd'
  if (pct > -1.5) return '#a5d6a7'
  if (pct > -3) return '#66bb6a'
  return '#388e3c'
}

const industryData = computed(() => {
  const map = {}
  const allHoldings = holdingsData.value
  if (!allHoldings.length) return []

  allHoldings.forEach(fh => {
    const fundWeight = tv.value > 0 ? (fh.amount || 0) / tv.value : 0
    fh.holdings.forEach(h => {
      const indInfo = stockIndustries.value[h.secid]
      const quote = stockQuotes.value[h.secid]
      const level1 = indInfo?.level1 || '其他'
      if (!map[level1]) map[level1] = { name: level1, weight: 0, changeSum: 0, changeCount: 0, stocks: [] }
      map[level1].weight += (h.pct || 0) * fundWeight
      map[level1].changeSum += (quote?.changePct || 0) * (h.pct || 0)
      map[level1].changeCount += (h.pct || 0)
      if (!map[level1].stocks.find(s => s.name === h.name)) {
        map[level1].stocks.push({ name: h.name, pct: h.pct, change: quote?.changePct || 0 })
      }
    })
  })

  const totalWeight = Object.values(map).reduce((s, v) => s + v.weight, 0)
  if (totalWeight > 0) {
    Object.values(map).forEach(v => {
      v.pct = (v.weight / totalWeight) * 100
      v.change = v.changeCount > 0 ? v.changeSum / v.changeCount : 0
    })
  }

  return Object.values(map)
    .sort((a, b) => b.pct - a.pct)
    .map(v => ({ ...v, color: heatColor(v.change || 0) }))
})

const industryFundMap = computed(() => {
  const map = {}
  const allHoldings = holdingsData.value
  if (!allHoldings.length) return map

  allHoldings.forEach(fh => {
    fh.holdings.forEach(h => {
      const indInfo = stockIndustries.value[h.secid]
      const level1 = indInfo?.level1 || '其他'
      if (!map[level1]) map[level1] = {}
      if (!map[level1][fh.code]) map[level1][fh.code] = { name: fh.name, code: fh.code, pct: 0 }
      map[level1][fh.code].pct += (h.pct || 0)
    })
  })

  // Sort funds within each industry by exposure descending
  for (const key of Object.keys(map)) {
    map[key] = Object.values(map[key]).sort((a, b) => b.pct - a.pct)
  }

  return map
})

const DONUT_R = 78
const DONUT_CIRCUM = 2 * Math.PI * DONUT_R

function buildDonut(items, totalVal) {
  let offset = 0
  return items.map((item, i) => {
    const pctVal = totalVal > 0 ? (item.value / totalVal) * 100 : 0
    const len = Math.max((pctVal / 100) * DONUT_CIRCUM, 0.5)
    const seg = {
      color: item.color || COLORS[i % COLORS.length],
      dashArray: `${len} ${DONUT_CIRCUM - len}`,
      dashOffset: -offset,
    }
    offset += len
    return seg
  })
}

const rankedFunds = computed(() => {
  return [...store.funds].sort((a, b) => (b.nav * b.shares) - (a.nav * a.shares))
})

const rankedPct = computed(() => {
  const total = tv.value
  return rankedFunds.value.map(f => total > 0 ? (f.nav * f.shares / total) * 100 : 0)
})

const categoryDonut = computed(() => {
  return buildDonut(
    categoryData.value.map(c => ({ value: c.value, color: c.color })),
    tv.value
  )
})

const styleDonut = computed(() => {
  const total = styleData.value.reduce((s, c) => s + c.value, 0)
  return buildDonut(
    styleData.value.map(c => ({ value: c.value, color: c.color })),
    total
  )
})

function holdingBarPct(pct, fund) {
  const maxPct = Math.max(...fund.holdings.map(h => h.pct || 0), 1)
  return (pct / maxPct) * 100
}

function showInitial(e, name) {
  e.target.style.display = 'none'
  e.target.parentElement.textContent = name.charAt(0)
}

function formatAmt(n) {
  if (store.privacyMode) return '***'
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
</script>

<style scoped>
.viz-overview {
  display: flex;
  gap: 28px;
  align-items: center;
  flex-wrap: wrap;
}

.viz-donut-col {
  flex-shrink: 0;
  width: 180px;
  height: 180px;
}

.viz-donut {
  width: 100%;
  height: 100%;
}

.viz-donut-center-val {
  font-size: 18px;
  font-weight: 600;
  fill: var(--color-text-primary);
  font-family: var(--font);
}

.viz-donut-center-label {
  font-size: 11px;
  fill: var(--color-text-secondary);
  font-family: var(--font);
}

.viz-overview-list {
  flex: 1;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.viz-ov-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  transition: background .15s;
}

.viz-ov-item:hover {
  background: var(--color-bg-secondary);
}

.viz-ov-item {
  cursor: pointer;
}

.viz-ov-item.selected {
  background: var(--color-bg-secondary);
}

.viz-ov-chevron {
  font-size: 10px;
  color: var(--color-text-secondary);
  margin-left: 6px;
}

.viz-style-funds {
  margin-top: 4px;
  padding: 8px 12px 8px 28px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.viz-style-fund-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 0;
  font-size: 13px;
}

.viz-style-fund-name {
  font-weight: 500;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.viz-style-fund-code {
  font-size: 11px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.viz-style-fund-val {
  font-size: 13px;
  font-weight: 500;
  flex-shrink: 0;
}

.viz-ov-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.viz-ov-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.viz-ov-name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.viz-ov-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.viz-ov-pct {
  font-size: 14px;
  font-weight: 600;
  min-width: 42px;
  text-align: right;
}

.viz-ov-amount {
  font-size: 12px;
  color: var(--color-text-secondary);
  min-width: 64px;
  text-align: right;
}

.viz-rank-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0 0 14px 0;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 12px;
}

.viz-rank-total-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.viz-rank-total-val {
  font-size: 22px;
  font-weight: 600;
}

.viz-rank-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.viz-rank-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}

.viz-rank-num {
  font-size: 12px;
  color: var(--color-text-secondary);
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

.viz-rank-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.viz-rank-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.viz-rank-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.viz-rank-name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.viz-rank-amount {
  font-size: 13px;
  font-weight: 500;
  flex-shrink: 0;
  margin-left: 12px;
}

.viz-rank-bar-wrap {
  height: 6px;
  background: var(--color-bg-tertiary);
  border-radius: 3px;
  overflow: hidden;
}

.viz-rank-bar {
  height: 100%;
  border-radius: 3px;
  transition: width .6s ease;
}

.viz-rank-pct {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.viz-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 0;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.viz-spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-bg-tertiary);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: viz-spin .6s linear infinite;
}

@keyframes viz-spin {
  to { transform: rotate(360deg); }
}

.viz-manager-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.viz-mgr-card {
  display: flex;
  gap: 14px;
  padding: 14px 16px;
  border-radius: var(--radius-lg);
  background: var(--color-bg-secondary);
  transition: background .15s;
}

.viz-mgr-card:hover {
  background: var(--color-bg-tertiary);
}

.viz-mgr-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--color-accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  flex-shrink: 0;
  overflow: hidden;
}

.viz-mgr-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.viz-mgr-body {
  flex: 1;
  min-width: 0;
}

.viz-mgr-name {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 2px;
}

.viz-mgr-meta {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.viz-mgr-fund-list {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.viz-mgr-bar-wrap {
  height: 6px;
  background: var(--color-bg-primary);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}

.viz-mgr-bar {
  height: 100%;
  border-radius: 3px;
  background: var(--color-accent);
  transition: width .6s ease;
}

.viz-mgr-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.viz-mgr-pct {
  font-size: 15px;
  font-weight: 600;
}

.viz-mgr-amount {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.viz-holdings-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.viz-industry-section {
  margin-bottom: 20px;
}

.viz-treemap {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  min-height: 120px;
}

.viz-tm-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  padding: 8px 4px;
  min-width: 40px;
  flex-grow: 1;
  transition: flex-basis .5s ease;
}

.viz-tm-name {
  font-size: 11px;
  font-weight: 500;
  color: rgba(255,255,255,0.95);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.viz-tm-pct {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255,255,255,0.85);
  margin-top: 2px;
}

.viz-tm-change {
  font-size: 10px;
  font-weight: 500;
  margin-top: 1px;
}

.viz-tm-cell {
  position: relative;
}

.viz-tm-tip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-md);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  min-width: 180px;
  max-width: 260px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  z-index: 20;
  pointer-events: none;
}

.viz-tm-tip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: var(--color-bg-primary);
}

.viz-tm-tip-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 0.5px solid var(--color-border);
}

.viz-tm-tip-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 0;
  gap: 12px;
}

.viz-tm-tip-fund {
  font-size: 12px;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.viz-tm-tip-pct {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.viz-holding-card {
  padding: 14px 16px;
  border-radius: var(--radius-lg);
  background: var(--color-bg-secondary);
}

.viz-holding-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;
}

.viz-holding-fund-name {
  font-size: 14px;
  font-weight: 600;
}

.viz-holding-badge {
  font-size: 11px;
  color: var(--color-text-secondary);
  background: var(--color-bg-primary);
  padding: 2px 10px;
  border-radius: 20px;
}

.viz-holding-date {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.viz-holding-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.viz-holding-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.viz-holding-item-name {
  font-size: 12px;
  width: 100px;
  flex-shrink: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--color-text-secondary);
}

.viz-holding-bar-track {
  flex: 1;
  height: 8px;
  background: var(--color-bg-primary);
  border-radius: 4px;
  overflow: hidden;
}

.viz-holding-bar-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--color-accent), #5bb8f5);
  transition: width .6s ease;
}

.viz-holding-item-pct {
  font-size: 12px;
  font-weight: 500;
  width: 36px;
  text-align: right;
  flex-shrink: 0;
}

.viz-holding-change {
  font-size: 11px;
  font-weight: 500;
  width: 52px;
  text-align: right;
  flex-shrink: 0;
}

.viz-holding-change.up {
  color: #e24b4a;
}

.viz-holding-change.down {
  color: #1d9e75;
}

.viz-load-time {
  text-align: center;
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--color-bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.viz-info-tip {
  position: relative;
  display: inline-flex;
  align-items: center;
  color: var(--color-text-secondary);
  cursor: help;
}

.viz-info-tip svg {
  opacity: 0.5;
  transition: opacity .2s;
}

.viz-info-tip:hover svg {
  opacity: 1;
}

.viz-info-tip-content {
  display: none;
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-bg-tertiary);
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--color-text-primary);
  white-space: nowrap;
  box-shadow: 0 4px 16px rgba(0,0,0,.12);
  z-index: 10;
}

.viz-info-tip-content::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--color-bg-primary);
}

.viz-info-tip:hover .viz-info-tip-content {
  display: block;
}

@media (max-width: 600px) {
  .viz-overview {
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .viz-donut-col {
    width: 150px;
    height: 150px;
  }

  .viz-overview-list {
    width: 100%;
  }

  .viz-manager-grid {
    grid-template-columns: 1fr;
  }

  .viz-holding-item-name {
    width: 64px;
  }
}
</style>
