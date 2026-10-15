import { controleerCredits } from './credits'

const fouten = controleerCredits(process.cwd())
if (fouten.length) {
  console.error(fouten.join('\n'))
  process.exit(1)
}
console.log('check:credits: elke AI-aanroep loopt via reserveer of metCredits; de prijs staat alleen in shared/credits.ts.')
