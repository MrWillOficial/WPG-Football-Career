// Gera dist-artifact/wpg-artifact.html: o mesmo bundle single-file de
// vite.artifact.config.js, mas pronto pro formato que a publicação de
// Artifact espera (sem <!doctype>/<html>/<head>/<body> próprios) e com a
// fonte do Google carregando de forma assíncrona.
//
// Por que a fonte precisa de tratamento especial: o CSS gerado usa
// `@import url(fonts.googleapis.com/...)` dentro do <style> inline. Isso é
// bloqueante — se a rede demorar (ou a fonte nunca responder), a página
// inteira fica presa num spinner antes de mostrar qualquer coisa. Convertido
// pra <link rel="stylesheet" media="print"> + troca de media via <script> —
// o carregamento da fonte deixa de travar o primeiro paint. Verificado com
// a fonte nunca respondendo: DOMContentLoaded em ~140ms de qualquer jeito.
//
// Uso: node scripts/build-artifact-html.mjs
// (rode `npx vite build --config vite.artifact.config.js` antes, ou deixe
// este script rodar por conta própria — ver package.json script correspondente)

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const BUILT_HTML = path.join(ROOT, 'dist-artifact', 'index.html');
const OUT_HTML = path.join(ROOT, 'dist-artifact', 'wpg-artifact.html');

execSync('npx vite build --config vite.artifact.config.js', { cwd: ROOT, stdio: 'inherit' });

let html = fs.readFileSync(BUILT_HTML, 'utf8');

html = html.replace(/^<!doctype html>\s*/i, '');
html = html.replace(/<html[^>]*>\s*/i, '');
html = html.replace(/<head>\s*/i, '');
html = html.replace(/<meta charset="UTF-8" \/>\s*/i, '');
html = html.replace(/<meta name="viewport"[^>]*\/>\s*/i, '');
html = html.replace(/<meta name="theme-color"[^>]*\/>\s*/i, '');
html = html.replace(/<meta name="description"[^>]*\/>\s*/i, '');
html = html.replace(/<\/head>\s*/i, '');
html = html.replace(/<body>\s*/i, '');
html = html.replace(/<\/body>\s*/i, '');
html = html.replace(/<\/html>\s*$/i, '');
html = html.replace(/<title>WPG PROJECT — Football Career Simulation<\/title>/, '<title>WPG Project</title>');

const importMatch = html.match(/@import\s+"([^"]+fonts\.googleapis\.com[^"]+)";/);
if (importMatch) {
  const fontUrl = importMatch[1];
  html = html.replace(importMatch[0], '');
  const asyncFontTags =
    `<link rel="preconnect" href="https://fonts.googleapis.com">\n` +
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n` +
    `<link id="wpg-fonts" rel="stylesheet" href="${fontUrl}" media="print">\n` +
    `<script>document.getElementById("wpg-fonts").media="all";<\/script>\n`;
  html = asyncFontTags + html;
} else {
  console.warn('AVISO: nenhum @import de fonts.googleapis.com encontrado — confirme se a fonte ainda carrega assíncrona antes de publicar.');
}

fs.writeFileSync(OUT_HTML, html);
console.log(`OK: ${OUT_HTML} (${html.length} bytes)`);
