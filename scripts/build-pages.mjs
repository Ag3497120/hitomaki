import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
execFileSync(process.execPath, ['node_modules/vinext/dist/cli.js', 'build'], {
  cwd: root,
  env: { ...process.env, HITOMAKI_GITHUB_PAGES: '1' },
  stdio: 'inherit',
});
// Vinext includes basePath in its output tree; Pages adds /hitomaki itself.
const source = new URL('../dist/client/hitomaki/', import.meta.url);
const output = new URL('../out/', import.meta.url);
if (!existsSync(new URL('index.html', source))) {
  throw new Error('Static export did not produce /hitomaki/index.html');
}
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(source, output, { recursive: true });
cpSync(
  new URL('../dist/client/404.html', import.meta.url),
  new URL('404.html', output),
);
writeFileSync(new URL('.nojekyll', output), '');
const html = readFileSync(new URL('index.html', output), 'utf8');
for (const match of html.matchAll(/(?:src|href)="(\/hitomaki\/[^"?#]*)/g)) {
  const asset = match[1].slice('/hitomaki/'.length);
  if (asset && !existsSync(new URL(asset, output))) {
    throw new Error(`Missing exported asset: ${match[1]}`);
  }
}
console.log('GitHub Pages artifact ready in out/ (public files only).');
