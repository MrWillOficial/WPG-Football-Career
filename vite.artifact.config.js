// Build alternativo, só pra gerar um único index.html autocontido (JS+CSS
// inline) que dá pra publicar como link de teste (Claude Artifact) e abrir
// direto no celular — sem precisar de servidor nem de achar o preview.
// Não é usado pelo deploy real (GitHub Pages, que continua em vite.config.js).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist-artifact',
    emptyOutDir: true,
  },
});
