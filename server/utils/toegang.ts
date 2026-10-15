// Toegangswachtwoord voor de online testomgeving (Netlify). Eén wachtwoord voor
// de hele site; het cookie bevat een HMAC, nooit het wachtwoord zelf.
import { createHmac, timingSafeEqual } from 'node:crypto'

export const TOEGANG_COOKIE = 'dt_toegang'
export const STANDAARD_GEHEIM = 'lokaal-ontwikkelgeheim-niet-voor-productie-gebruiken'

export function toegangsbewijs(wachtwoord: string, geheim: string): string {
  return createHmac('sha256', geheim).update(`toegang:${wachtwoord}`).digest('hex')
}

export function gelijk(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Wat ontbreekt er online nog aan de instellingen? Leeg is in orde. */
export function ontbrekendeInstellingen(config: { online?: boolean; toegangswachtwoord?: string; sessieGeheim?: string }): string[] {
  if (!config.online) return []
  const mist: string[] = []
  if (!config.toegangswachtwoord) mist.push('TOEGANGSWACHTWOORD')
  if (!config.sessieGeheim || config.sessieGeheim === STANDAARD_GEHEIM) mist.push('SESSIE_GEHEIM')
  return mist
}

export function toegangsPagina(opties: { fout?: string; naar?: string; mist?: string[] }): string {
  const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
  const inhoud = opties.mist?.length
    ? `<h1>Nog niet ingesteld</h1><p>Zet bij Netlify onder Environment variables: <strong>${opties.mist.map(esc).join(', ')}</strong>. Start daarna een nieuwe deploy.</p>`
    : `<h1>Dealtrace testomgeving</h1>
       <p>Vul het toegangswachtwoord in. Alle data hier is fictief.</p>
       <form method="post" action="/toegang">
         <input type="hidden" name="naar" value="${esc(opties.naar ?? '/')}">
         <label for="w">Toegangswachtwoord</label>
         <input id="w" name="wachtwoord" type="password" autocomplete="current-password" autofocus required>
         ${opties.fout ? `<p class="fout" role="alert">${esc(opties.fout)}</p>` : ''}
         <button type="submit">Naar binnen</button>
       </form>`
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Toegang · Dealtrace</title><meta name="robots" content="noindex">
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f6f2;color:#0a0a0a;font:16px/1.5 system-ui,sans-serif;padding:16px;box-sizing:border-box}
main{width:100%;max-width:400px;background:#fff;border:1px solid #e5e3dc;border-radius:4px;padding:32px;box-sizing:border-box}
h1{font-size:24px;margin:0 0 8px}p{color:#555;margin:0 0 16px}label{display:block;font-weight:600;font-size:13px;margin-bottom:6px}
input[type=password]{width:100%;min-height:44px;box-sizing:border-box;border:1px solid #ccc;border-radius:4px;padding:8px 12px;font:inherit}
button{margin-top:16px;width:100%;min-height:44px;border:0;border-radius:4px;background:#0a0a0a;color:#ffd400;font:600 15px system-ui,sans-serif;cursor:pointer}
.fout{color:#c62828;margin:8px 0 0}
</style></head><body><main>${inhoud}</main></body></html>`
}
