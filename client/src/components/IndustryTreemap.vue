<template>
  <div class="chart-container">
    <div v-if="privacyMode" class="privacy-overlay">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
      <span>隐私模式下无法显示</span>
    </div>
    <div v-else-if="!industryData.length" class="privacy-overlay">
      <span>暂无行业数据</span>
    </div>
    <VChart v-else :option="chartOption" :theme="echartsTheme" autoresize style="height:340px;" ref="chartRef" />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  industryData: { type: Array, required: true },
  industryFundMap: { type: Object, required: true },
  privacyMode: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
})

const chartRef = ref(null)

const echartsTheme = computed(() => {
  if (typeof window === 'undefined') return undefined
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : undefined
})

const isDark = computed(() => echartsTheme.value === 'dark')

watch(() => props.active, (val) => {
  if (val && chartRef.value) {
    nextTick(() => chartRef.value.resize())
  }
})

const chartOption = computed(() => {
  const data = props.industryData
  if (!data.length) return {}

  const chartData = data.map(d => ({
    name: d.name,
    value: d.pct,
    itemStyle: { color: d.color },
    change: d.change,
  }))

  const fundMap = props.industryFundMap
  const primaryColor = isDark.value ? '#f0efe8' : '#1a1a18'

  return {
    tooltip: {
      backgroundColor: isDark.value ? '#2e2e2b' : '#ffffff',
      borderColor: isDark.value ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)',
      textStyle: { color: primaryColor, fontSize: 12 },
      formatter: (params) => {
        const d = params.data
        const sign = d.change >= 0 ? '+' : ''
        let html = `<b>${d.name}</b><br/>`
        html += `占比: ${d.value.toFixed(1)}%<br/>`
        html += `加权涨跌: <span style="color:${d.change >= 0 ? '#e24b4a' : '#1d9e75'}">${sign}${d.change.toFixed(2)}%</span>`
        const funds = fundMap[d.name]
        if (funds?.length) {
          html += '<br/><hr style="margin:4px 0;border-color:rgba(128,128,128,0.2)"/>'
          funds.forEach(f => {
            html += `<br/>${f.name}: ${f.pct.toFixed(1)}%`
          })
        }
        return html
      },
    },
    series: [{
      type: 'treemap',
      roam: false,
      width: '100%',
      height: '100%',
      breadcrumb: {
        show: true,
        bottom: 0,
        height: 22,
        itemStyle: {
          color: isDark.value ? '#2e2e2b' : '#efefea',
          borderColor: isDark.value ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)',
          textStyle: { color: primaryColor, fontSize: 11 },
        },
        emphasis: {
          itemStyle: { color: isDark.value ? '#3a3a36' : '#e0e0da' },
        },
      },
      label: {
        show: true,
        fontSize: 11,
        fontWeight: 500,
        color: 'rgba(255,255,255,0.95)',
        formatter: (p) => p.value > 4 ? `${p.name}\n${p.value.toFixed(1)}%` : (p.value > 1.5 ? `${p.value.toFixed(1)}%` : ''),
      },
      data: chartData,
      levels: [{
        itemStyle: {
          borderColor: isDark.value ? '#1c1c1a' : '#ffffff',
          borderWidth: 2,
          gapWidth: 1,
        },
      }],
      top: 0,
      left: 0,
      bottom: 30,
    }],
    backgroundColor: 'transparent',
  }
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
