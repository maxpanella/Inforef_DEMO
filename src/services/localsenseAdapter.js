// Simple localsense adapter (stub) used by the demo.
// Exports a factory: createLocalsenseAdapter()
// The adapter emits "sample" events with objects { id, x, y, ts } (mm coordinates)
// Provides: start(), stop(), simulate(sample), on(event, cb), off(event, cb)

export default function createLocalsenseAdapter() {
  const listeners = {
    sample: new Set()
  }

  let running = false
  let interval = null

  function emitSample(s) {
    for (const cb of listeners.sample) {
      try { cb(s) } catch (e) { console.error('localsenseAdapter listener error', e) }
    }
  }

  function start(options = {}) {
    if (running) return
    running = true
    // simple simulator: emits two moving tags if no external source connected
    let angle = 0
    interval = setInterval(() => {
      angle += 0.2
      const cx = 2000, cy = 1500, r = 5000
      const s1 = { id: '3001', x: Math.round(cx + Math.cos(angle) * r), y: Math.round(cy + Math.sin(angle) * r), ts: Date.now() }
      const s2 = { id: '3002', x: Math.round(cx + Math.cos(angle + 1.7) * r), y: Math.round(cy + Math.sin(angle + 1.7) * r), ts: Date.now() }
      emitSample(s1)
      emitSample(s2)
    }, options.interval || 400)
  }

  function stop() {
    if (!running) return
    running = false
    if (interval) {
      clearInterval(interval)
      interval = null
    }
  }

  // manually push a sample (useful for UI "simulate once")
  function simulate(sample) {
    if (!sample) return
    const s = Object.assign({ ts: Date.now() }, sample)
    emitSample(s)
  }

  function on(event, cb) {
    if (!listeners[event]) listeners[event] = new Set()
    listeners[event].add(cb)
  }

  function off(event, cb) {
    if (!listeners[event]) return
    listeners[event].delete(cb)
  }

  // useful helper to map external id -> local tag (not required, but handy)
  function mapTag(tag, assetId) {
    // no-op in stub, could store mapping if needed
    // left as placeholder
    return true
  }

  return {
    start,
    stop,
    simulate,
    on,
    off,
    mapTag,
    _isRunning: () => running // helper for debugging
  }
}