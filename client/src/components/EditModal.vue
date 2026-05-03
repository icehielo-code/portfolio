<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <h3>{{ fund.id ? '编辑基金' : '添加基金' }}</h3>

      <div class="form-grid">
        <div class="form-item">
          <label>基金代码</label>
          <div style="display:flex;gap:6px;">
            <input v-model="form.code" placeholder="6位代码" maxlength="6" @blur="lookupFund" />
            <button class="btn" @click="lookupFund" :disabled="looking" style="flex-shrink:0;">查询</button>
          </div>
          <span v-if="lookupStatus" :style="{ color: lookupOk ? 'var(--color-text-success)' : 'var(--color-text-danger)', fontSize: '11px', marginTop: '2px' }">{{ lookupStatus }}</span>
        </div>
        <div class="form-item">
          <label>基金名称</label>
          <input v-model="form.name" placeholder="基金名称" />
        </div>
      </div>

      <div class="form-grid">
        <div class="form-item">
          <label>类型</label>
          <select v-model="form.type">
            <option>A股公募</option><option>ETF指数</option><option>QDII</option><option>债券基金</option><option>货币基金</option>
          </select>
        </div>
        <div class="form-item">
          <label>最新净值</label>
          <input v-model.number="form.nav" type="number" step="0.0001" />
        </div>
      </div>

      <div class="form-grid">
        <div class="form-item">
          <label>持有份额</label>
          <input v-model.number="form.shares" type="number" step="1" />
        </div>
        <div class="form-item">
          <label>目标仓位(%)</label>
          <input v-model.number="form.target" type="number" step="0.1" min="0" max="100" />
        </div>
      </div>

      <div class="form-grid">
        <div class="form-item">
          <label>成本净值</label>
          <input v-model.number="form.origin_nav" type="number" step="0.0001" />
        </div>
        <div class="form-item">
          <label>大类</label>
          <select v-model="form.category">
            <option>权益类</option><option>境内固收</option><option>海外市场</option><option>商品及其它</option>
          </select>
        </div>
      </div>

      <div class="form-grid">
        <div class="form-item">
          <label>风格</label>
          <select v-model="form.style">
            <option>价值型</option><option>均衡型</option><option>成长型</option>
          </select>
        </div>
        <div class="form-item">
          <label>基金经理</label>
          <input v-model="form.manager" placeholder="基金经理" />
        </div>
      </div>

      <div class="form-section">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:12px;color:var(--color-text-secondary);">前十大持仓</span>
          <button class="btn" style="font-size:11px;padding:3px 10px;" @click="addHolding">+ 添加</button>
        </div>
        <div v-for="(h, i) in form.top_holdings" :key="i" style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
          <input v-model="h.name" placeholder="名称" style="flex:1;padding:6px 8px;font-size:12px;border:0.5px solid var(--color-border-md);border-radius:var(--radius-md);background:var(--color-bg-primary);color:var(--color-text-primary);font-family:var(--font);outline:none;" />
          <input v-model.number="h.pct" type="number" step="0.1" placeholder="%" style="width:60px;padding:6px 8px;font-size:12px;border:0.5px solid var(--color-border-md);border-radius:var(--radius-md);background:var(--color-bg-primary);color:var(--color-text-primary);font-family:var(--font);outline:none;" />
          <button class="btn" style="font-size:11px;padding:3px 8px;color:var(--color-text-danger);" @click="form.top_holdings.splice(i,1)">✕</button>
        </div>
      </div>

      <div class="btn-row" style="justify-content:flex-end;">
        <button class="btn" @click="$emit('close')">取消</button>
        <button class="btn btn-primary" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { proxyApi } from '../api'

const props = defineProps({ fund: Object })
const emit = defineEmits(['save', 'close'])

const form = reactive({
  id: null, code: '', name: '', type: 'A股公募', nav: 0, shares: 0,
  target: 0, origin_nav: 0, category: '权益类', style: '均衡型',
  manager: '', top_holdings: [],
})
const looking = ref(false)
const lookupStatus = ref('')
const lookupOk = ref(false)

onMounted(() => {
  if (props.fund) Object.assign(form, { ...props.fund, top_holdings: [...(props.fund.top_holdings || [])] })
})

function addHolding() {
  form.top_holdings.push({ name: '', pct: 0 })
}

async function lookupFund() {
  const code = (form.code || '').replace(/\D/g, '')
  if (code.length !== 6) { lookupStatus.value = '请输入6位基金代码'; lookupOk.value = false; return }
  looking.value = true
  lookupStatus.value = '查询中…'
  try {
    const data = await proxyApi.queryFund(code)
    if (data.error) { lookupStatus.value = data.error; lookupOk.value = false; return }
    form.name = data.name || form.name
    const navVal = data.gsz && parseFloat(data.gsz) > 0 ? data.gsz : (data.nav || data.dwjz)
    if (navVal) form.nav = parseFloat(navVal)
    lookupStatus.value = `${data.name} · 来自${data.source}`
    lookupOk.value = true
  } catch (e) {
    lookupStatus.value = '查询失败'
    lookupOk.value = false
  } finally {
    looking.value = false
  }
}

function save() {
  emit('save', { ...form, top_holdings: form.top_holdings.filter(h => h.name) })
}
</script>
