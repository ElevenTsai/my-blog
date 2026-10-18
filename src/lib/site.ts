// Public is the safe default. Internal builds must opt in explicitly.
export const showWork = false;
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export function sitePath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return value;
  if (base && (value === base || value.startsWith(`${base}/`))) return value;
  return `${base}${value}`;
}

export function siteHtml(html: string): string {
  return html.replace(/\b(href|src)=(['"])(\/[^'"\s]*)(\2)/g,
    (_, attribute, quote, value) => `${attribute}=${quote}${sitePath(value)}${quote}`);
}

export function navigationPath(pathname: string): string {
  const relative = base && pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname;
  return sitePath(relative.startsWith('/work/') || relative === '/highlight.html'
    ? '/work/' : relative.startsWith('/posts/') ? '/posts/' : '/');
}
