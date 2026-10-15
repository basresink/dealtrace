// De agenda-adapter (12, gat 37). De echte koppeling met Microsoft 365 en Google komt met
// P13; tot dan de mock: hij onthoudt wat er bezet gezet zou worden en meldt "niet gekoppeld".
export interface AgendaAdapter {
  gekoppeld(gebruikerId: string): Promise<boolean>
  /** Bezette momenten in de agenda van de gebruiker. */
  bezet(gebruikerId: string, van: Date, tot: Date): Promise<{ start: string; eind: string }[]>
  /** Zet een blok als bezet in de gekoppelde agenda. */
  zetBezet(gebruikerId: string, blok: { start: string; eind: string; titel: string }): Promise<{ ok: boolean; reden?: string }>
}

export const mockAgendaLog: { gebruikerId: string; start: string; eind: string; titel: string }[] = []

export const mockAgenda: AgendaAdapter = {
  async gekoppeld() { return false },
  async bezet() { return [] },
  async zetBezet(gebruikerId, blok) {
    mockAgendaLog.push({ gebruikerId, ...blok })
    return { ok: false, reden: 'Werkt zodra je agenda gekoppeld is' }
  },
}

export function agenda(): AgendaAdapter {
  return mockAgenda
}
