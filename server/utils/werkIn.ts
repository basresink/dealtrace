// Het werk-in-cookie van de founder (13.3 flow 4): ondertekend, httpOnly, met
// organisatie, modus, reden en vervaltijd (hooguit 8 uur). Eigen geheim
// (ORG_WISSEL_SECRET), los van de sessie.
import type { H3Event } from 'h3'
import { SignJWT, jwtVerify } from 'jose'
import { WERK_IN_MAX_MS, werkInGeldig, type WerkIn, type WerkInInhoud, type WerkModus } from '../../shared/werkIn'

export const WERK_IN_COOKIE = 'dt_werkin'

function sleutel(): Uint8Array {
  return new TextEncoder().encode(useRuntimeConfig().orgWisselGeheim as string)
}

export async function zetWerkIn(event: H3Event, inhoud: { founderId: string; organisatieId: string; modus: WerkModus; reden: string; start?: string }) {
  const start = inhoud.start ?? new Date().toISOString()
  const tot = new Date(Date.parse(start) + WERK_IN_MAX_MS).toISOString()
  const volledig: WerkInInhoud = { ...inhoud, start, tot }
  const token = await new SignJWT({ ...volledig }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime(new Date(tot)).sign(sleutel())
  setCookie(event, WERK_IN_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/',
    secure: !import.meta.dev && getRequestURL(event).protocol === 'https:',
    maxAge: Math.max(1, Math.floor((Date.parse(tot) - Date.now()) / 1000)),
  })
  return volledig
}

export async function leesWerkInInhoud(event: H3Event): Promise<WerkInInhoud | null> {
  const token = getCookie(event, WERK_IN_COOKIE)
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, sleutel())
    return payload as unknown as WerkInInhoud
  } catch {
    return null
  }
}

export async function leesWerkIn(event: H3Event, founderId: string): Promise<WerkIn | null> {
  return werkInGeldig(await leesWerkInInhoud(event), founderId, new Date())
}

export function wisWerkIn(event: H3Event) {
  deleteCookie(event, WERK_IN_COOKIE, { path: '/' })
}
