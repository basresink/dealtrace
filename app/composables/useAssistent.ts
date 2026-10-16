// De AI-assistent openen vanaf elk scherm (F26). De context volgt het scherm: op een accountkaart
// het account, anders het scherm zelf. De chip kan weg; dan gaat de vraag zonder accountgegevens.
export interface AssistentContextUi { route: string; accountId: string | null; label: string }
export function useAssistent() {
  const open = useState('assistentOpen', () => false)
  const context = useState<AssistentContextUi | null>('assistentContext', () => null)
  const voorvraag = useState<string>('assistentVoorvraag', () => '')
  function openen(c?: Partial<AssistentContextUi> & { vraag?: string }) {
    const route = useRoute()
    const accountId = c?.accountId ?? (/^\/accounts\/[^/]+$/.test(route.path) ? route.path.split('/')[2]! : null)
    context.value = { route: c?.route ?? route.path, accountId, label: c?.label ?? (accountId ? (useState<string | null>('accountNaam').value ?? 'dit account') : schermNaam(route.path)) }
    voorvraag.value = c?.vraag ?? ''
    open.value = true
  }
  return { open, context, voorvraag, openen }
}
function schermNaam(p: string) {
  const n: Record<string, string> = { '/': 'Vandaag', '/helpcenter': 'Helpcenter', '/notificaties': 'Notificaties', '/belblokken': 'Belblokken', '/bellen': 'Bellen', '/richting': 'Richting', '/planning': 'Prospectplanning', '/leadgenerator': 'Leadgenerator', '/taken': 'Taken', '/prospects': 'Prospects' }
  const k = Object.keys(n).filter((x) => x === '/' ? p === '/' : p.startsWith(x)).sort((a, b) => b.length - a.length)[0]
  return k ? n[k]! : 'dit scherm'
}
