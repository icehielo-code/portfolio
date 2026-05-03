<template>
  <div class="header">
    <div class="header-left">
      <h1>CHONG的私人基金管理工具</h1>
      <p>{{ today }}</p>
    </div>
    <div class="header-right">
      <button class="btn btn-icon" :class="{ spinning: refreshing }" @click="refreshNav" title="刷新净值">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
      </button>
      <button class="btn" @click="$emit('export')" style="font-size:12px;padding:6px 12px;">导出数据</button>
      <label class="btn" style="font-size:12px;padding:6px 12px;cursor:pointer;">
        导入数据
        <input type="file" accept=".json" @change="onImport" style="display:none;" />
      </label>
      <button class="btn btn-primary" @click="$emit('ai-advice')" style="font-size:12px;padding:6px 12px;">AI 顾问</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useFundStore } from '../stores/fund'

const emit = defineEmits(['export', 'import', 'ai-advice'])
const store = useFundStore()
const refreshing = ref(false)

const today = computed(() => {
  const d = new Date()
  const week = ['日','一','二','三','四','五','六']
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 星期${week[d.getDay()]}`
})

async function refreshNav() {
  refreshing.value = true
  try {
    const count = await store.refreshAllNAVs()
    alert(`已刷新 ${count} 支基金净值`)
  } catch (e) {
    alert('刷新失败: ' + e.message)
  } finally {
    refreshing.value = false
  }
}

function onImport(e) {
  const file = e.target.files[0]
  if (file) emit('import', file)
  e.target.value = ''
}
</script>
