// Herbevestiging voor gevaarlijke acties (15.3): geeft de server 428, dan vraagt
// dit venster de code uit de authenticator en probeert de actie daarna opnieuw.
let oplossen: ((ok: boolean) => void) | null = null

export function useHerbevestig() {
  const open = useState<boolean>('herbevestig-open', () => false)

  async function metHerbevestiging<T>(actie: () => Promise<T>): Promise<T> {
    try {
      return await actie()
    } catch (e: any) {
      if ((e?.statusCode ?? e?.response?.status) !== 428) throw e
      const ok = await new Promise<boolean>((res) => { oplossen = res; open.value = true })
      if (!ok) throw Object.assign(new Error('Geannuleerd'), { geannuleerd: true })
      return await actie()
    }
  }

  function sluit(ok: boolean) {
    open.value = false
    oplossen?.(ok)
    oplossen = null
  }

  return { open, metHerbevestiging, sluit }
}

/** Foutmelding uit een $fetch-fout, voor de meldingsstrook. */
export function foutTekst(e: any, standaard = 'Er ging iets mis'): string {
  if (e?.geannuleerd) return ''
  return e?.data?.statusMessage ?? e?.statusMessage ?? e?.message ?? standaard
}
