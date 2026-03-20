const PREFIXES: Record<string, string> = {
  '0703': 'MTN', '0706': 'MTN', '0803': 'MTN', '0806': 'MTN',
  '0810': 'MTN', '0813': 'MTN', '0814': 'MTN', '0816': 'MTN',
  '0903': 'MTN', '0906': 'MTN',
  '0705': 'Glo', '0805': 'Glo', '0807': 'Glo', '0811': 'Glo',
  '0815': 'Glo', '0905': 'Glo',
  '0701': 'Airtel', '0708': 'Airtel', '0802': 'Airtel', '0808': 'Airtel',
  '0812': 'Airtel', '0901': 'Airtel', '0902': 'Airtel',
  '0809': '9mobile', '0817': '9mobile', '0818': '9mobile', '0909': '9mobile',
}

export function detectNetwork(phone: string): string | null {
  const p = phone.replace(/[\s\-\+]/g, '')
  const norm = p.startsWith('234') ? '0' + p.slice(3) : p
  return PREFIXES[norm.substring(0, 4)] || null
}

export function normalizePhone(phone: string): string {
  const p = phone.replace(/[\s\-\+]/g, '')
  return p.startsWith('234') ? '0' + p.slice(3) : p
}

export function isValidNigerianNumber(phone: string): boolean {
  return /^0[7-9][01]\d{8}$/.test(phone)
}
