<template>
  <div class="tabs">
    <button class="tab" :class="{ active: modelValue === 'overview' }" @click="$emit('update:modelValue', 'overview')">持仓概览</button>
    <button class="tab" :class="{ active: modelValue === 'allocate' }" @click="$emit('update:modelValue', 'allocate')">持仓比例</button>
    <button class="tab" :class="{ active: modelValue === 'advice' }" @click="$emit('update:modelValue', 'advice')">AI 顾问</button>
    <button class="tab" :class="{ active: modelValue === 'strategy' }" @click="$emit('update:modelValue', 'strategy')">策略管理</button>
  </div>
</template>

<script setup>
defineProps({ modelValue: String })
defineEmits(['update:modelValue'])
</script>
