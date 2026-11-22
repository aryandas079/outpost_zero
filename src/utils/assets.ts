/**
 * Resolves static asset paths correctly in both web/browser (http://localhost:3000)
 * and Electron Windows desktop runtime (file:// protocol).
 */
export function toAssetUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const base = import.meta.env.BASE_URL || './';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  return `${cleanBase}${cleanPath}`;
}
