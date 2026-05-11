<template>
  <div class="modal-overlay">
    <div class="modal" style="max-width:440px;">
      <h3>欢迎使用！配置 API Key</h3>
      <p style="font-size:12px;color:var(--color-text-secondary);margin-bottom:14px;line-height:1.5;">
        AI 投资顾问和 OCR 截图导入需要 API Key 才能使用。可随时在 AI 对话页面修改。
      </p>

      <div class="form-item" style="margin-bottom:10px;">
        <label>DeepSeek API Key</label>
        <input v-model="form.deepseekKey" type="password" placeholder="sk-..." />
      </div>
      <div class="form-item" style="margin-bottom:10px;">
        <label>SiliconFlow API Key（OCR 用）</label>
        <input v-model="form.siliconflowKey" type="password" placeholder="sk-..." />
      </div>

      <div class="form-grid" style="margin-bottom:14px;">
        <div class="form-item">
          <label>AI 对话模型</label>
          <input v-model="form.aiModel" placeholder="deepseek-chat" />
        </div>
        <div class="form-item">
          <label>OCR 模型</label>
          <input v-model="form.ocrModel" placeholder="deepseek-ai/DeepSeek-OCR" />
        </div>
      </div>

      <div class="btn-row" style="margin-top:0;">
        <button class="btn" @click="$emit('skip')">稍后配置</button>
        <button class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? '保存中...' : '保存并开始使用' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { paramsApi } from '../api'

const emit = defineEmits(['saved', 'skip'])

const saving = ref(false)

const form = reactive({
  deepseekKey: '',
  siliconflowKey: '',
  aiModel: 'deepseek-chat',
  ocrModel: 'deepseek-ai/DeepSeek-OCR',
})

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    const entries = [
      ['DEEPSEEK_API_KEY', form.deepseekKey.trim()],
      ['SILICONFLOW_API_KEY', form.siliconflowKey.trim()],
      ['AI_MODEL', form.aiModel.trim() || 'deepseek-chat'],
      ['OCR_MODEL', form.ocrModel.trim() || 'deepseek-ai/DeepSeek-OCR'],
    ]
    await Promise.all(entries.map(([k, v]) => paramsApi.set(k, v)))
    emit('saved')
  } catch {
    emit('saved')
  } finally {
    saving.value = false
  }
}
</script>
