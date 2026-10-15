// De Planner op de server (11.3, mandaat A). Het plannen zelf (landing, capaciteit en de
// toets van de Bewaker per contacttaak) zit in de databasevrije motorRun; draai() legt
// vast wat de Planner deed en wat de Bewaker tegenhield.
import type { MotorUitvoer } from '../../../shared/motor'
import { logAgentRun, logTegengehouden } from './bewaker'

type Tx = Parameters<Parameters<ReturnType<typeof import('../db').gebruikDb>['transaction']>[0]>[0]

export async function draai(tx: Tx, org: string, uit: Pick<MotorUitvoer, 'taken' | 'geschoven' | 'tegengehouden'>, nu = new Date()) {
  const tegengehouden = await logTegengehouden(tx, org, uit.tegengehouden, nu)
  const geschoven = uit.geschoven.reduce((s, g) => s + g.aantal, 0)
  if (uit.taken.length || geschoven) {
    await logAgentRun(tx, org, {
      agent: 'planner', handeling: 'taken.landen', mandaat: 'A', uitkomst: 'uitgevoerd',
      bronnen: [{ taken: uit.taken.length, geschoven, perGebruiker: uit.geschoven }],
    }, nu)
  }
  return { tegengehouden, geschoven }
}
