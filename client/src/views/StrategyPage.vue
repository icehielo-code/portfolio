<template>
  <div>
    <div class="section-title" style="margin-bottom:12px;">策略列表</div>

    <div v-for="s in store.strategies" :key="s.id" class="strategy-card" :class="{ active: s.is_active }" @click="store.activateStrategy(s.id)">
      <div class="strategy-top">
        <span class="strategy-name">{{ s.name }}</span>
        <span v-if="s.is_active" class="in-use-badge">使用中</span>
      </div>
      <div class="strategy-desc">{{ s.description }}</div>
      <div class="rules">
        <span v-for="r in s.rules" :key="r" class="rule-chip">{{ r }}</span>
      </div>
    </div>

    <div class="card" style="margin-top:1rem;">
      <div class="section-title">{{ editing ? '编辑策略' : '新建策略' }}</div>
      <div class="form-grid">
        <div class="form-item">
          <label>策略名称</label>
          <input v-model="form.name" placeholder="如：均衡策略" />
        </div>
        <div class="form-item">
          <label>描述</label>
          <input v-model="form.description" placeholder="策略描述" />
        </div>
      </div>
      <div class="form-item" style="margin-bottom:10px;">
        <label>规则（每行一条）</label>
        <textarea v-model="rulesText" rows="4" style="width:100%;padding:8px 10px;font-size:13px;border:0.5px solid var(--color-border-md);border-radius:var(--radius-md);background:var(--color-bg-primary);color:var(--color-text-primary);font-family:var(--font);outline:none;resize:vertical;" placeholder="止盈15%&#10;止损8%&#10;季度再平衡"></textarea>
      </div>
      <div class="btn-row" style="justify-content:flex-end;">
        <button v-if="editing" class="btn" @click="cancelEdit">取消</button>
        <button class="btn btn-primary" @click="saveStrategy">{{ editing ? '更新' : '创建' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useFundStore } from '../stores/fund'

const store = useFundStore()
const editing = ref(null)
const form = reactive({ name: '', description: '' })
const rulesText = ref('')

function cancelEdit() {
  editing.value = null
  form.name = ''
  form.description = ''
  rulesText.value = ''
}

function editStrategy(s) {
  editing.value = s.id
  form.name = s.name
  form.description = s.description
  rulesText.value = (s.rules || []).join('\n')
}

async function saveStrategy() {
  if (!form.name) { alert('请输入策略名称'); return }
  const rules = rulesText.value.split('\n').map(r => r.trim()).filter(Boolean)
  if (editing.value) {
    await store.updateStrategy(editing.value, { name: form.name, description: form.description, rules })
  } else {
    await store.addStrategy({ name: form.name, description: form.description, rules })
  }
  cancelEdit()
}
</script>
