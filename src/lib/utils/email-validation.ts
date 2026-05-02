import { promises as dns } from 'dns'

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Returns false only when DNS definitively says the domain has no mail
// exchangers (ENODATA) or does not exist (ENOTFOUND). All other errors
// (timeout, server failure, network unreachable) fail open so a DNS hiccup
// never blocks a legitimate signup.
export async function hasMxRecords(domain: string): Promise<boolean> {
  try {
    const records = await dns.resolveMx(domain)
    return records.length > 0
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENODATA' || code === 'ENOTFOUND') return false
    return true
  }
}
