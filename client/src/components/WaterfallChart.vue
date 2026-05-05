<template>
  <div class="chart-container">
    <div v-if="privacyMode" class="privacy-overlay">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
      <span>隐私模式下无法显示</span>
    </div>
    <div v-else-if="!funds.length" class="privacy-overlay">
      <span>暂无持仓数据</span>
    </div>
    <VChart v-else :option="currentOption" :theme="echartsTheme" :key="mode" autoresize style="height:380px;" />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  funds: { type: Array, required: true },
  baseNavForFund: { type: Function, required: true },
  totalValue: { type: Number, required: true },
  privacyMode: { type: Boolean, default: false },
  mode: { type: String, default: 'waterfall' },
})

const UP_COLOR = '#e24b4a'
const DOWN_COLOR = '#1d9e75'
const START_COLOR = '#9a9992'
const END_COLOR = '#378add'

const echartsTheme = computed(() => {
  if (typeof window === 'undefined') return undefined
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : undefined
})

const isDark = computed(() => echartsTheme.value === 'dark')

const waterfallData = computed(() => {
  const funds = props.funds
  if (!funds.length) return []

  const totalCost = funds.reduce((s, f) => s + props.baseNavForFund(f) * f.shares, 0)

  const items = funds
    .map(f => ({
      name: f.name,
      pl: (f.nav - props.baseNavForFund(f)) * f.shares,
    }))
    .sort((a, b) => b.pl - a.pl)

  return { totalCost, items }
})

const bubbleData = computed(() => {
  const funds = props.funds
  if (!funds.length) return []

  return funds.map(f => {
    const base = props.baseNavForFund(f)
    const mv = f.nav * f.shares
    const posRatio = props.totalValue > 0 ? (mv / props.totalValue) * 100 : 0
    const retRate = base > 0 ? ((f.nav - base) / base) * 100 : 0
    return {
      name: f.name,
      code: f.code,
      mv,
      posRatio,
      retRate,
    }
  })
})

const stageLabel = computed(() => {
  // Determine if we're in cumulative or phase mode by checking the first fund
  if (!props.funds.length) return ''
  const f = props.funds[0]
  return props.baseNavForFund(f) === f.origin_nav ? '累计' : '阶段'
})

const waterfallOption = computed(() => {
  const data = waterfallData.value
  if (!data) return {}

  const categories = ['总成本', ...data.items.map(d => d.name), '总市值']

  let running = 0
  const baseData = []
  const valueData = []

  baseData.push(0)
  valueData.push({ value: data.totalCost, itemStyle: { color: START_COLOR } })
  running = data.totalCost

  for (const item of data.items) {
    baseData.push(running)
    valueData.push({
      value: item.pl,
      itemStyle: { color: item.pl >= 0 ? UP_COLOR : DOWN_COLOR },
    })
    running += item.pl
  }

  baseData.push(0)
  valueData.push({ value: props.totalValue, itemStyle: { color: END_COLOR } })

  const textColor = isDark.value ? '#9a9992' : '#6b6b66'
  const primaryColor = isDark.value ? '#f0efe8' : '#1a1a18'

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: isDark.value ? '#2e2e2b' : '#ffffff',
      borderColor: isDark.value ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)',
      textStyle: { color: primaryColor, fontSize: 12 },
      formatter: (params) => {
        const cat = params[0].axisValue
        const base = params[0].value
        const change = params[1].value
        const total = base + change
        let sign = ''
        if (change > 0) sign = '+'
        const changeStr = `${sign}¥${Math.round(change).toLocaleString()}`
        const totalStr = `¥${Math.round(Math.abs(total)).toLocaleString()}`
        if (cat === '总成本') return `<b>总成本</b><br/>¥${Math.round(data.totalCost).toLocaleString()}`
        if (cat === '总市值') return `<b>总市值</b><br/>¥${Math.round(props.totalValue).toLocaleString()}`
        return `<b>${cat}</b><br/>贡献: ${changeStr}<br/>累计: ${totalStr}`
      },
    },
    grid: { left: 60, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        color: textColor,
        fontSize: 11,
        rotate: categories.length > 8 ? 45 : 0,
        interval: 0,
      },
      axisLine: { lineStyle: { color: isDark.value ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: textColor,
        fontSize: 11,
        formatter: (v) => {
          if (Math.abs(v) >= 1e4) return '¥' + (v / 1e4).toFixed(1) + '万'
          return '¥' + Math.round(v).toLocaleString()
        },
      },
      splitLine: { lineStyle: { color: isDark.value ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' } },
    },
    series: [
      {
        name: 'base',
        type: 'bar',
        stack: 'waterfall',
        itemStyle: { color: 'transparent', borderColor: 'transparent' },
        emphasis: { itemStyle: { color: 'transparent', borderColor: 'transparent' } },
        data: baseData,
        barWidth: '50%',
      },
      {
        name: '盈亏',
        type: 'bar',
        stack: 'waterfall',
        data: valueData,
        barWidth: '50%',
        label: {
          show: true,
          position: 'top',
          fontSize: 10,
          color: textColor,
          formatter: (p) => {
            const v = p.value
            if (Math.abs(v) >= 1e4) return (v >= 0 ? '+' : '') + (v / 1e4).toFixed(1) + '万'
            return (v >= 0 ? '+' : '') + Math.round(v).toLocaleString()
          },
        },
        itemStyle: { borderRadius: [3, 3, 0, 0] },
      },
    ],
    backgroundColor: 'transparent',
  }
})

const bubbleOption = computed(() => {
  const items = bubbleData.value
  if (!items.length) return {}

  const textColor = isDark.value ? '#9a9992' : '#6b6b66'
  const primaryColor = isDark.value ? '#f0efe8' : '#1a1a18'
  const splitColor = isDark.value ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const borderColor = isDark.value ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)'

  const maxMV = Math.max(...items.map(d => d.mv), 1)
  const avgPos = items.reduce((s, d) => s + d.posRatio, 0) / items.length

  const label = stageLabel.value

  // Build data: [x, y, size, name, code]
  const scatterData = items.map(d => {
    const size = 10 + (d.mv / maxMV) * 50
    return [d.posRatio.toFixed(2), d.retRate.toFixed(2), size, d.name, d.code]
  })

  return {
    tooltip: {
      backgroundColor: isDark.value ? '#2e2e2b' : '#ffffff',
      borderColor,
      textStyle: { color: primaryColor, fontSize: 12 },
      formatter: (params) => {
        const d = params.data
        const sign = d[1] >= 0 ? '+' : ''
        return `<b>${d[3]}</b> (${d[4]})<br/>
          仓位: ${d[0]}%<br/>
          ${label}收益率: <span style="color:${d[1] >= 0 ? UP_COLOR : DOWN_COLOR}">${sign}${d[1]}%</span><br/>
          市值: ¥${Math.round(items[params.dataIndex].mv).toLocaleString()}`
      },
    },
    grid: { left: 55, right: 30, top: 30, bottom: 45 },
    xAxis: {
      name: '仓位比例 (%)',
      nameLocation: 'center',
      nameGap: 28,
      nameTextStyle: { color: textColor, fontSize: 12 },
      type: 'value',
      axisLabel: { color: textColor, fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: splitColor } },
      axisLine: { lineStyle: { color: borderColor } },
      min: 0,
    },
    yAxis: {
      name: `${label}收益率 (%)`,
      nameLocation: 'center',
      nameGap: 40,
      nameTextStyle: { color: textColor, fontSize: 12 },
      type: 'value',
      axisLabel: { color: textColor, fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: splitColor } },
      axisLine: { lineStyle: { color: borderColor } },
    },
    series: [{
      type: 'scatter',
      data: scatterData,
      symbolSize: (val) => val[2],
      itemStyle: {
        color: (params) => params.data[1] >= 0 ? UP_COLOR : DOWN_COLOR,
        opacity: 0.75,
      },
      emphasis: {
        itemStyle: { opacity: 1 },
        scale: 1.3,
        label: {
          show: true,
          formatter: (params) => params.data[3],
          position: 'right',
          fontSize: 12,
          color: primaryColor,
        },
      },
      label: {
        show: true,
        formatter: (params) => params.data[3],
        position: 'top',
        fontSize: 10,
        color: textColor,
        distance: 5,
      },
      markLine: {
        silent: true,
        symbol: 'none',
        label: { show: false },
        data: [
          { yAxis: 0, lineStyle: { color: textColor, type: 'dashed', opacity: 0.25 } },
          { xAxis: avgPos, lineStyle: { color: textColor, type: 'dashed', opacity: 0.25 } },
        ],
      },
      markArea: {
        silent: true,
        itemStyle: { opacity: 0.03 },
        data: [
          // Q1: Low position, High return (左上) — 低仓高收
          [{ xAxis: 'min', yAxis: 0 }, { xAxis: avgPos, yAxis: 'max' }],
          // Q2: High position, High return (右上) — 主力盈利
          [{ xAxis: avgPos, yAxis: 0 }, { xAxis: 'max', yAxis: 'max' }],
          // Q3: Low position, Low return (左下) — 观察区
          [{ xAxis: 'min', yAxis: 'min' }, { xAxis: avgPos, yAxis: 0 }],
          // Q4: High position, Low return (右下) — 高仓低收
          [{ xAxis: avgPos, yAxis: 'min' }, { xAxis: 'max', yAxis: 0 }],
        ],
      },
    }],
    backgroundColor: 'transparent',
  }
})

const currentOption = computed(() => {
  return props.mode === 'bubble' ? bubbleOption.value : waterfallOption.value
})
</script>

<style scoped>
.chart-container {
  width: 100%;
  min-height: 300px;
}

.privacy-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 200px;
  color: var(--color-text-secondary);
  font-size: 13px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
}
</style>
