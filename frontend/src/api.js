import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 120_000, // 2 min for scoring operations
})

export const getStartups = (filters = {}) =>
  api.get('/startups', { params: filters }).then(r => r.data)

export const getStartup = (id) =>
  api.get(`/startups/${id}`).then(r => r.data)

export const scoreStartup = (id) =>
  api.post(`/startups/${id}/score`).then(r => r.data)

export const generateMemo = (id) =>
  api.post(`/startups/${id}/memo`).then(r => r.data)

export const refreshFeed = () =>
  api.post('/refresh').then(r => r.data)

export const scoreAll = () =>
  api.post('/score-all').then(r => r.data)

export const clearAll = () =>
  api.post('/reset').then(r => r.data)

export const getStats = () =>
  api.get('/stats').then(r => r.data)

export const exportPdf = () =>
  api.get('/export/pdf', { responseType: 'blob' }).then(r => {
    const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `elaia-dealflow-${new Date().toISOString().slice(0, 10)}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  })
