/**
 * Canonical site URL for absolute OG / Twitter URLs.
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://tabwrapped.com).
 * Falls back so link previews still get valid og:image when env is missing.
 */
export function getSiteOrigin(): URL {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site) {
    try {
      const normalized = site.endsWith('/') ? site.slice(0, -1) : site;
      return new URL(normalized);
    } catch {
      /* fall through */
    }
  }
  const vercel = process.env.VERCEL_URL;
  if (vercel) {
    return new URL(`https://${vercel.replace(/^https?:\/\//, '')}`);
  }
  if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
    return new URL('https://tabwrapped.com');
  }
  return new URL('http://localhost:3000');
}
