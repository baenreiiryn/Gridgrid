import fs from 'node:fs';

const htmlPath = new URL('../dist/index.html', import.meta.url);
const html = fs.readFileSync(htmlPath, 'utf8');

if (/\b(?:src|href)=["']\/assets\//.test(html)) {
  throw new Error('Production build contains absolute /assets paths and will fail under Electron file://.');
}

if (!html.includes('./assets/')) {
  throw new Error('Production build does not contain relative ./assets paths.');
}

console.log('Packaged renderer asset paths are relative and file:// compatible.');
