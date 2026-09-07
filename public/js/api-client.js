export class ApiClient {
  constructor(base = '') { this.base = base; this.controller = null; }
  get headers() {
    const h = { 'Content-Type': 'application/json' };
    const t = localStorage.getItem('shiep_token');
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }
  async request(path, opts = {}) {
    if (this.controller) this.controller.abort();
    this.controller = new AbortController();
    const res = await fetch(this.base + path, { ...opts, headers: { ...this.headers, ...(opts.headers||{}) }, credentials: 'include', signal: this.controller.signal });
    if (!res.ok) {
      const txt = await res.text().catch(()=> '');
      let err;
      try { err = JSON.parse(txt); } catch { err = { error: txt || res.statusText }; }
      throw new Error(err.error || err.message || `HTTP ${res.status}`);
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  }
  get(p) { return this.request(p, { method: 'GET' }); }
  post(p, b) { return this.request(p, { method: 'POST', body: b ? JSON.stringify(b) : undefined }); }
  patch(p, b) { return this.request(p, { method: 'PATCH', body: b ? JSON.stringify(b) : undefined }); }
}
export const api = new ApiClient();
