import axios from 'axios'

const http = axios.create({ baseURL: '/api' })

http.interceptors.request.use(config => {
  const user = JSON.parse(localStorage.getItem('currentUser') || 'null')
  if (user?.id) config.headers['x-user-id'] = user.id
  return config
})

export const usersApi = {
  list: () => http.get('/users').then(r => r.data),
  login: (username) => http.post('/users/login', { username }).then(r => r.data),
}

export const fundsApi = {
  list: () => http.get('/funds').then(r => r.data),
  create: (data) => http.post('/funds', data).then(r => r.data),
  update: (id, data) => http.put(`/funds/${id}`, data).then(r => r.data),
  remove: (id) => http.delete(`/funds/${id}`).then(r => r.data),
  batchNav: (updates) => http.put('/funds/batch/nav', { updates }).then(r => r.data),
}

export const strategiesApi = {
  list: () => http.get('/strategies').then(r => r.data),
  create: (data) => http.post('/strategies', data).then(r => r.data),
  update: (id, data) => http.put(`/strategies/${id}`, data).then(r => r.data),
  remove: (id) => http.delete(`/strategies/${id}`).then(r => r.data),
  activate: (id) => http.put(`/strategies/activate/${id}`).then(r => r.data),
}

export const checkpointsApi = {
  list: () => http.get('/checkpoints').then(r => r.data),
  create: (data) => http.post('/checkpoints', data).then(r => r.data),
  remove: (id) => http.delete(`/checkpoints/${id}`).then(r => r.data),
}

export const settingsApi = {
  get: (key) => http.get(`/settings/${key}`).then(r => r.data),
  set: (key, value) => http.put(`/settings/${key}`, { value }).then(r => r.data),
}

export const paramsApi = {
  get: (key) => http.get(`/params/${key}`).then(r => r.data),
  set: (key, value) => http.put(`/params/${key}`, { value }).then(r => r.data),
}

export const proxyApi = {
  queryFund: (code) => http.get('/proxy', { params: { code } }).then(r => r.data),
  batchQuery: (codes) => http.post('/proxy/batch', { codes }).then(r => r.data),
  fundDetail: (code) => http.get('/proxy/fund-detail', { params: { code } }).then(r => r.data),
  batchFundDetail: (codes) => http.post('/proxy/batch-fund-detail', { codes }).then(r => r.data),
  stockQuotes: (secids) => http.get('/proxy/stock-quotes', { params: { secids } }).then(r => r.data),
  industries: (secids) => http.post('/proxy/industries', { secids }).then(r => r.data),
}

export const aiApi = {
  chat: (message, type) => http.post('/ai/chat', { message, type }).then(r => r.data),
  ocr: (formData) => http.post('/ai/ocr', formData).then(r => r.data),
  history: (limit) => http.get('/ai/history', { params: { limit } }).then(r => r.data),
  clearHistory: () => http.delete('/ai/history').then(r => r.data),
}

export const fundDailyApi = {
  latest: () => http.get('/fund-daily/latest').then(r => r.data),
}

export const dataApi = {
  exportData: () => http.get('/export').then(r => r.data),
  importData: (data) => http.post('/import', data).then(r => r.data),
}
