// Stub adapter: NON usa LOCALSENSE. Serve solo per compatibilità import.
// Restituisce start/stop/simulate vuoti che la UI può chiamare.
export default function createLocalsenseAdapter(opts = {}) {
  let started = false
  function start(assetListRef) {
    started = true
    console.info('[LS-Stub] start called (no LOCALSENSE)');
    return Promise.resolve(true)
  }
  function stop() {
    started = false
    console.info('[LS-Stub] stop called');
  }
  function simulate(pos) {
    // UI può sovrascrivere; by default logga
    console.info('[LS-Stub] simulate', pos)
  }
  return { start, stop, simulate, _debug: {} }
}