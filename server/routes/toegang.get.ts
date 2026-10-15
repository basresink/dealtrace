import { ontbrekendeInstellingen, toegangsPagina } from '../utils/toegang'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
  const naar = String(getQuery(event).naar ?? '/')
  return toegangsPagina({ naar: naar.startsWith('/') && !naar.startsWith('//') ? naar : '/', mist: ontbrekendeInstellingen(useRuntimeConfig(event) as any) })
})
