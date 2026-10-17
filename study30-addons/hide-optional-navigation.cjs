/* v2.5.4 isolated acceptance preview: hide optional module navigation only.
 * The targets remain deployed at their original URLs; records are not touched.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const folder = process.argv[2];
if (!folder) throw Error('Usage: node hide-optional-navigation.cjs <deploy-directory>');
const indexPath = path.join(folder, 'index.html');
const original = fs.readFileSync(indexPath, 'utf8');
const anchorPattern = /<a\b[^>]*\bhref\s*=\s*(["'])([^"']+)\1[^>]*>[\s\S]*?<\/a>/gi;
const optionalModule = href => {
  try {
    const url = new URL(href, 'https://study.local/');
    return url.pathname.split('/').some(segment => segment === 'active-recall' || segment === 'dongdong-time');
  } catch {
    return false;
  }
};
let removed = 0;
const updated = original.replace(anchorPattern, (tag, quote, href) => {
  if (!optionalModule(href)) return tag;
  removed++;
  return '';
});
const remaining = [...updated.matchAll(anchorPattern)].filter(match => optionalModule(match[2]));
if (remaining.length) throw Error('Optional navigation still visible in deployed index.html');
if (updated !== original) fs.writeFileSync(indexPath, updated);
console.log('Optional recall/342 navigation hidden (' + removed + ' link(s)); modules and records unchanged.');
