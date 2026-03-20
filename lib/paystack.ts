export async function createPaymentLink({
  amount,
  ref,
  phone,
  meta,
}: {
  amount: number
  ref: string
  phone: string
  meta: Record<string, any>
}) {
  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amount * 100,
      reference: ref,
      channels: ['card', 'bank', 'bank_transfer', 'ussd'],
      metadata: meta,
    }),
  })
  const data = await res.json()
  return data.data.authorization_url
}

export async function createDedicatedAccount(phone: string) {
  // Create Paystack customer first
  const customerRes = await fetch('https://api.paystack.co/customer', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: `${phone}@airtimebot.com`,
      phone: phone,
      first_name: 'AirtimeBot',
      last_name: 'User',
    }),
  })
  const customer = await customerRes.json()

  // Create dedicated virtual account
  const accountRes = await fetch('https://api.paystack.co/dedicated_account', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customer: customer.data.customer_code,
      preferred_bank: 'wema-bank',
    }),
  })
  const account = await accountRes.json()
  return {
    bank: account.data?.bank?.name,
    accountNumber: account.data?.account_number,
    accountName: account.data?.account_name,
  }
}
