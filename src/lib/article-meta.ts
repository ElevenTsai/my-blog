/** Shared build-time metadata for HTML documents and Markdown articles. */
export function estimateReadingMinutes(content: string, format: 'html' | 'markdown' = 'html'): number {
  let text = content;
  if (format === 'markdown') {
    text = text
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/https?:\/\/[^\s<)]+/g, ' ');
  }
  text = text
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:#\d+|#x[\da-f]+|\w+);/gi, ' ');
  const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
  const characters = text.match(cjk)?.length ?? 0;
  const words = text.replace(cjk, ' ').match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
  return Math.max(1, Math.ceil(characters / 450 + words / 200));
}

export function formatReadingTime(minutes: number): string {
  return `约 ${Math.max(1, Math.ceil(minutes))} 分钟阅读`;
}

export function formatArticleDate(value: string, withTime = false): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } as const : {}),
  }).format(new Date(value)).replaceAll('/', '.');
}
