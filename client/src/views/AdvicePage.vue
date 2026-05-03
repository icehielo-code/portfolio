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

    <div class="card" style="margin-top:1rem;">
      <div class="section-title">OCR 识别（截图导入持仓）</div>
      <div style="border:2px dashed var(--color-border-md);border-radius:var(--radius-md);padding:2rem;text-align:center;cursor:pointer;transition:all .2s;"
           @dragover.prevent="dzOver = true" @dragleave="dzOver = false" @drop.prevent="onDrop" @click="pickFile"
           :style="{ background: dzOver ? 'var(--color-bg-secondary)' : '', borderColor: dzOver ? '#378add' : '' }">
        <p style="font-size:13px;color:var(--color-text-secondary);">拖拽截图到此处，或点击选择文件</p>
        <input type="file" ref="fileInput" accept="image/*" @change="onFilePick" style="display:none;" />
      </div>

      <div v-if="ocrLoading" style="text-align:center;padding:1rem;font-size:13px;color:var(--color-text-secondary);">识别中…</div>

      <div v-if="ocrResults.length" style="margin-top:1rem;">
        <div class="section-title">识别结果</div>
        <div v-for="(f, i) in ocrResults" :key="i" class="ocr-card">
          <div class="ocr-card-header">
            <span class="ocr-card-name">{{ f.name || '未识别' }}</span>
            <span class="ocr-card-code">{{ f.code || '' }}</span>
          </div>
          <div class="ocr-fields">
            <div class="ocr-field">
              <label>基金代码</label>
              <input v-model="f.code" />
            </div>
            <div class="ocr-field">
              <label>类型</label>
              <select v-model="f.type">
                <option>A股公募</option><option>ETF指数</option><option>QDII</option><option>债券基金</option>
              </select>
            </div>
            <div class="ocr-field">
              <label>净值</label>
              <input v-model.number="f.nav" type="number" step="0.0001" />
            </div>
            <div class="ocr-field">
              <label>份额</label>
              <input v-model.number="f.shares" type="number" step="1" />
            </div>
          </div>
        </div>
        <button class="btn btn-primary btn-block" @click="importOCR">导入到持仓</button>
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
const dzOver = ref(false)
const fileInput = ref(null)
const ocrLoading = ref(false)
const ocrResults = ref([])

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

function pickFile() { fileInput.value?.click() }

function onFilePick(e) {
  const file = e.target.files[0]
  if (file) doOCR(file)
  e.target.value = ''
}

function onDrop(e) {
  dzOver.value = false
  const file = e.dataTransfer.files[0]
  if (file) doOCR(file)
}

async function doOCR(file) {
  ocrLoading.value = true
  ocrResults.value = []
  try {
    const fd = new FormData()
    fd.append('image', file)
    const data = await aiApi.ocr(fd)
    ocrResults.value = data.funds || []
  } catch (e) {
    alert('OCR识别失败: ' + e.message)
  } finally {
    ocrLoading.value = false
  }
}

async function importOCR() {
  for (const f of ocrResults.value) {
    if (!f.code || !f.name) continue
    try {
      await store.addFund({
        code: f.code, name: f.name, type: f.type || 'A股公募',
        nav: f.nav || 0, shares: f.shares || 0, target: 0,
        origin_nav: f.nav || 0, category: '权益类', style: '均衡型',
        manager: '', top_holdings: [],
      })
    } catch {}
  }
  ocrResults.value = []
  alert('导入完成')
}

defineExpose({ askAI })
</script>
