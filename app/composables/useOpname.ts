// Opnemen (P30, P31): MediaRecorder op 24 kbit/s Opus; de opname gaat als bijlage in de
// uploadwachtrij. Met verbinding volgt de transcriptie op de server (EU); zonder verbinding wacht hij.
export function useOpname() {
  const bijlagen = useBijlagen()
  const neemtOp = ref(false)
  const seconden = ref(0)
  let rec: MediaRecorder | null = null
  let stukken: Blob[] = []
  let teller: any
  let stream: MediaStream | null = null
  const kan = computed(() => import.meta.client && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined')
  async function start() {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : ''
    rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 })
    stukken = []; seconden.value = 0
    rec.ondataavailable = (e) => stukken.push(e.data)
    rec.start(); neemtOp.value = true
    teller = setInterval(() => seconden.value++, 1000)
  }
  /** Stop en bewaar als bijlage bij het record; geeft het id van de bijlage. */
  async function stop(record: { soort: string; id: string }): Promise<string | null> {
    if (!rec) return null
    const klaar = new Promise<void>((ok) => { rec!.onstop = () => ok() })
    rec.stop(); await klaar
    clearInterval(teller); neemtOp.value = false
    stream?.getTracks().forEach((t) => t.stop())
    const blob = new Blob(stukken, { type: rec.mimeType || 'audio/webm' })
    rec = null
    if (blob.size < 500) return null
    return await bijlagen.voegToe(blob, 'opname', record)
  }
  /** Transcriberen met verbinding; null als het (nog) niet kan. */
  async function tekstVan(bijlageId: string): Promise<{ tekst: string | null; reden?: string }> {
    if (!navigator.onLine) return { tekst: null, reden: 'Opname bewaard op je telefoon. De tekst volgt zodra je verbinding hebt.' }
    try {
      await bijlagen.verstuur()
      const r: any = await $fetch('/api/spraak/transcribeer', { method: 'POST', body: { bijlageId } })
      return { tekst: r.tekst, reden: r.reden }
    } catch (e) { return { tekst: null, reden: foutTekst(e) } }
  }
  onBeforeUnmount(() => { clearInterval(teller); stream?.getTracks().forEach((t) => t.stop()) })
  return { kan, neemtOp, seconden, start, stop, tekstVan }
}
