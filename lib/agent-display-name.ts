/**
 * Display names for agents (may differ from raw `agents.name` in the database).
 */
export function formatAgentDisplayName(name: string | null | undefined): string {
  const raw = (name ?? '').trim()
  if (!raw) return ''

  const key = raw.toLowerCase().replace(/\s+/g, ' ')
  if (
    key === 'dr.mohamed amer' ||
    key === 'dr mohamed amer' ||
    key === 'dr. mohamed amer'
  ) {
    return 'Dr.Amer'
  }

  return raw
}
