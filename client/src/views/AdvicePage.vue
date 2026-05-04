<template>
  <div>
    <div class="card">
      <div class="advice-header">
        <div>
          <div class="advice-title">AI 投资顾问</div>
          <div class="advice-date">当前策略：{{ store.activeStrategy?.name || '未选择' }}</div>
        </div>
        <span class="strategy-tag">{{ store.activeStrategy?.name || '无策略' }}</span>
      </div>

      <div class="ai-chat" ref="chatBox">
        <div v-for="msg in messages" :key="msg.id" class="ai-msg" :class="msg.role">
          {{ msg.content }}
        </div>
        <div v-if="loading" class="ai-msg assistant">思考中…</div>
      </div>

      <div class="ai-input-row">
        <input v-model="inputMsg" placeholder="输入问题或指令…" @keyup.enter="sendMsg" />
        <button class="btn btn-primary" @click="sendMsg" :disabled="loading">发送</button>
      </div>

      <div class="btn-row">
        <button class="btn" @click="askAI('default')">操作建议</button>
        <button class="btn" @click="askAI('rebalance')">再平衡</button>
        <button class="btn" @click="askAI('deep')">深度分析</button>
        <button class="btn" @click="askAI('market')">市场分析</button>
        <button class="btn" @click="askAI('risk')">风险评估</button>
        <button class="btn" @click="clearHistory" style="color:var(--color-text-danger);">清空对话</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue'
import { useFundStore } from '../stores/fund'
import { aiApi } from '../api'

const store = useFundStore()
const messages = ref([])
const inputMsg = ref('')
const loading = ref(false)
const chatBox = ref(null)

onMounted(async () => {
  try {
    const history = await aiApi.history(20)
    messages.value = history.map(m => ({ id: m.id, role: m.role, content: m.content }))
    scrollBottom()
  } catch {}
})

function scrollBottom() {
  nextTick(() => { if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight })
}

async function sendMsg() {
  const msg = inputMsg.value.trim()
  if (!msg || loading.value) return
  inputMsg.value = ''
  messages.value.push({ id: Date.now(), role: 'user', content: msg })
  loading.value = true
  scrollBottom()
  try {
    const data = await aiApi.chat(msg)
    messages.value.push({ id: Date.now() + 1, role: 'assistant', content: data.reply })
  } catch (e) {
    messages.value.push({ id: Date.now() + 1, role: 'assistant', content: '请求失败: ' + e.message })
  } finally {
    loading.value = false
    scrollBottom()
  }
}

async function askAI(type) {
  loading.value = true
  messages.value.push({ id: Date.now(), role: 'user', content: `[${type}] 请求AI分析` })
  scrollBottom()
  try {
    const data = await aiApi.chat(null, type)
    messages.value.push({ id: Date.now() + 1, role: 'assistant', content: data.reply })
  } catch (e) {
    messages.value.push({ id: Date.now() + 1, role: 'assistant', content: '请求失败: ' + e.message })
  } finally {
    loading.value = false
    scrollBottom()
  }
}

async function clearHistory() {
  await aiApi.clearHistory()
  messages.value = []
}

defineExpose({ askAI })
</script>
