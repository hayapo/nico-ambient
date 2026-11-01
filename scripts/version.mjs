import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('public/manifest.json', 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(pkg.version) || pkg.version !== manifest.version) {
  throw new Error('package.jsonとManifestのバージョンが一致していません');
}
const bump = process.argv[2];
if (bump) {
  if (!['major', 'minor', 'patch'].includes(bump))
    throw new Error('Invalid bump');
  const parts = pkg.version.split('.').map(Number);
  const index = ['major', 'minor', 'patch'].indexOf(bump);
  parts[index]++;
  parts.fill(0, index + 1);
  if (parts.some((n) => n > 65535))
    throw new Error('Manifest version limit exceeded');
  pkg.version = manifest.version = parts.join('.');
  for (const [path, value] of [
    ['package.json', pkg],
    ['public/manifest.json', manifest],
  ]) {
    fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  }
}
console.log(pkg.version);
