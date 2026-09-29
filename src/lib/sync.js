// Keeps this browser in step with the server: sends queued changes, listens for changes from the other
// device over Server-Sent Events, and caches everything locally so the app still opens offline.
import { api, withPin } from './api.js';

const CACHE = 'kt-cache-v3';
const QUEUE = 'kt-queue-v3';

const load = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

export class Sync {
  constructor({ onRemote, onStatus }) {
    this.onRemote = onRemote;
    this.onStatus = onStatus;
    this.queue = load(QUEUE) || [];
    const c = load(CACHE);
    this.cache = c && c.data ? c.data : null;
    this.rev = c && c.data ? c.rev || 0 : 0;
    this.online = false;
    this.needPin = false;
    this.lastSync = null;
    this.busy = false;
    this.needFetch = true;
  }

  start() {
    this.connect();
    this.kick();
    this.timer = setInterval(() => { if (!this.online || this.queue.length) this.kick(); }, 5000);
  }

  stop() {
    clearInterval(this.timer);
    if (this.es) this.es.close();
    this.es = null;
  }

  connect() {
    if (this.es) this.es.close();
    this.es = new EventSource(withPin('/api/events'));
    this.es.addEventListener('rev', e => {
      const { rev } = JSON.parse(e.data);
      if (rev !== this.rev) { this.needFetch = true; this.kick(); }
    });
    this.es.onerror = () => { if (this.online) { this.online = false; this.emit(); } };
  }

  saveCache(data) { save(CACHE, { rev: this.rev, data }); }

  push(ops) {
    if (!ops.length) return;
    this.queue.push(...ops);
    save(QUEUE, this.queue);
    this.emit();
    this.kick();
  }

  // Forget unsent changes (used after a full reset on the server).
  clearQueue() {
    this.queue = [];
    save(QUEUE, this.queue);
    this.needFetch = true;
  }

  async kick() {
    if (this.busy) return;
    this.busy = true;
    try {
      while (this.queue.length) {
        const batch = this.queue.slice(0, 200);
        const r = await api('/api/ops', { method: 'POST', body: { ops: batch } });
        this.queue.splice(0, batch.length);
        save(QUEUE, this.queue);
        if (r.prevRev !== this.rev || (r.fixed && r.fixed.length)) this.needFetch = true;
        this.rev = r.rev;
      }
      if (this.needFetch) {
        this.needFetch = false;
        const d = await api('/api/state');
        this.rev = d.rev;
        this.onRemote(d);
      }
      this.online = true;
      this.needPin = false;
      this.lastSync = new Date();
    } catch (e) {
      this.online = false;
      this.needFetch = true;
      if (e.status === 401) this.needPin = true;
    } finally {
      this.busy = false;
      this.emit();
      if (this.online && (this.queue.length || this.needFetch)) setTimeout(() => this.kick(), 0);
    }
  }

  retryWithPin() {
    this.needPin = false;
    this.connect();
    this.kick();
  }

  emit() {
    this.onStatus({ online: this.online, pending: this.queue.length, lastSync: this.lastSync, needPin: this.needPin });
  }
}
