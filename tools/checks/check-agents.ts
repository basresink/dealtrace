import { controleerAgents } from './agents'

const fouten = controleerAgents(process.cwd())
if (fouten.length) {
  console.error(fouten.join('\n'))
  process.exit(1)
}
console.log('check:agents: elke schrijfactie in server/utils/agents gaat eerst langs de Bewaker.')
