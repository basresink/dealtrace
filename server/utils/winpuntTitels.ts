// De titels van de winpunten uit het verkoopverhaal (ook de niet-actieve), op id. Voor plekken die een
// winpunt-id bewaren (inzichten van de Waarnemer en de motor) en een leesbare tekst moeten tonen.
// Draait binnen metOrganisatie, dus alleen de winpunten van de eigen organisatie.
import { sql } from 'drizzle-orm'

export async function winpuntTitels(tx: { execute: (q: any) => Promise<{ rows: unknown[] }> }): Promise<Map<string, string>> {
  const rows = (await tx.execute(sql`select extern_id, titel from vv_winpunten`)).rows as { extern_id: string; titel: string }[]
  return new Map(rows.filter((r) => r.extern_id && r.titel).map((r) => [r.extern_id, r.titel]))
}
