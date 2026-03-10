const BASE_URL = '/api'
const TIMEOUT_MS = 120_000

async function request(method, path, { params, json, responseType } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const url = new URL(BASE_URL + path, window.location.origin)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v != null && v !== '') url.searchParams.set(k, String(v))
      }
    }

    const res = await fetch(url, {
      method,
      headers: json != null ? { 'Content-Type': 'application/json' } : {},
      body: json != null ? JSON.stringify(json) : undefined,
      signal: controller.signal,
    })

    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}: ${res.statusText}`)
      err.status = res.status
      throw err
    }

    if (responseType === 'blob') return res.blob()
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

const get  = (path, opts) => request('GET',  path, opts)
const post = (path, opts) => request('POST', path, opts)

export const getStartups      = (filters = {}) => get('/startups', { params: filters })
export const startupFromUrl   = (url) => post('/startups/from-url', { json: { url } })
export const getStartup   = (id) => get(`/startups/${id}`)
export const scoreStartup = (id) => post(`/startups/${id}/score`)
export const generateMemo = (id) => post(`/startups/${id}/memo`)
export const refreshFeed  = ()  => post('/refresh')
export const scoreAll     = ()  => post('/score-all')
export const clearAll     = ()  => post('/reset')
export const getStats     = ()  => get('/stats')

export const exportPdf = async () => {
  const blob = await get('/export/pdf', { responseType: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `elaia-dealflow-${new Date().toISOString().slice(0, 10)}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
