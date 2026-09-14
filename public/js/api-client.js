export class ApiClient {
  constructor(base = '') { this.base = base; }
  get headers() {
    return { 'Content-Type': 'application/json' };
  }
  async request(path, opts = {}) {
    const res = await fetch(this.base + path, { ...opts, headers: { ...this.headers, ...(opts.headers||{}) }, credentials: 'include' });
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
