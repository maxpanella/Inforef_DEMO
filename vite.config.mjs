import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/Inforef_DEMO/', // IMPORTANT: change to your repo name for GitHub Pages project site
  plugins: [vue()],
})