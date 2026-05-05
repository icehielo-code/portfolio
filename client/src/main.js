import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VChart from 'vue-echarts'
import 'echarts'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.component('VChart', VChart)
app.mount('#app')
