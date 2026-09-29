// Customer-facing links and LINE sharing.
// LINE's share URL opens the LINE app (or line.me on desktop) with the text ready to send to any chat,
// so it works without a LINE Official Account.

export function publicBase(settings) {
  const u = String((settings && settings.publicUrl) || '').trim().replace(/\/+$/, '');
  return u || window.location.origin;
}

export function shareToLine(text) {
  const url = 'https://line.me/R/share?text=' + encodeURIComponent(text);
  // No 'noopener' feature: with it window.open always returns null and a blocked popup can't be detected.
  const w = window.open(url, '_blank');
  if (w) w.opener = null;
  return !!w;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  }
}
