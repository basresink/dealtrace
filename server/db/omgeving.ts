// Omgevingsvariabelen voor scripts buiten Nuxt (migreer, seed, checks).
import { existsSync } from 'node:fs'

if (existsSync('.env')) process.loadEnvFile('.env')

export const BEHEER_URL = process.env.DATABASE_URL_BEHEER || 'postgresql://postgres:postgres@127.0.0.1:5432/dealtrace'
export const APP_URL = process.env.DATABASE_URL || 'postgresql://dealtrace_app:dealtrace_app@127.0.0.1:5432/dealtrace'
export const APP_WACHTWOORD = process.env.DATABASE_APP_WACHTWOORD || 'dealtrace_app'

export function isLokaal(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return host === '127.0.0.1' || host === 'localhost' || host === 'db'
  } catch {
    return false
  }
}
