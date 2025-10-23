// vite.config.js (CommonJS) - carica @vitejs/plugin-vue in modo dinamico per evitare errori ESM/require
module.exports = async () => {
  const { defineConfig } = require('vite')
  // import dinamico: @vitejs/plugin-vue è ESM-only, quindi lo importiamo con import()
  const { default: vue } = await import('@vitejs/plugin-vue')

  return defineConfig({
    plugins: [ vue() ],
    server: {
      host: true
    }
  })
}