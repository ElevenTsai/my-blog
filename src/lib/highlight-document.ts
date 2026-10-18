import { codeToHtml, bundledLanguages } from 'shiki';

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };
const decode = (text: string) => text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (original, value) => {
  if (entities[value]) return entities[value];
  if (value.startsWith('#')) {
    const point = parseInt(value.slice(value[1].toLowerCase() === 'x' ? 2 : 1), value[1].toLowerCase() === 'x' ? 16 : 10);
    if (point >= 0 && point <= 0x10ffff) return String.fromCodePoint(point);
  }
  return original;
});

// Feishu code is already escaped by the sync pipeline; highlight during the build.
export async function highlightDocument(html: string) {
  const pattern = /<pre class="language-([\w-]+)"><code class="language-[\w-]+">([\s\S]*?)<\/code><\/pre>/g;
  let output = '', offset = 0;
  for (const match of html.matchAll(pattern)) {
    output += html.slice(offset, match.index);
    const lang = match[1] in bundledLanguages ? match[1] : 'text';
    output += await codeToHtml(decode(match[2]), { lang, themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false });
    offset = match.index! + match[0].length;
  }
  return output + html.slice(offset);
}
