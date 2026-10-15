export function useZoeken() {
  const open = useState<boolean>('zoekenOpen', () => false)
  return { open }
}
