import { controleerPlatform } from './platform'

const fouten = controleerPlatform(process.cwd())
if (fouten.length) {
  console.error(fouten.join('\n'))
  process.exit(1)
}
console.log('check:platform: platformendpoints controleren de founder, gewone schermen roepen geen platformroute aan.')
