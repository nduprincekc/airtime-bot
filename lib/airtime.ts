export async function purchaseAirtime({
  phone, network, amount, requestId
}: {
  phone: string
  network: string
  amount: number
  requestId: string
}) {
  const operatorIds: Record<string, number> = {
    'MTN': 341,
    'Glo': 340,
    'Airtel': 338,
    '9mobile': 339
  }

  // Get token
  const tokenRes = await fetch('https://auth.reloadly.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.RELOADLY_CLIENT_ID,
      client_secret: process.env.RELOADLY_CLIENT_SECRET,
      grant_type: 'client_credentials',
      audience: 'https://topups-sandbox.reloadly.com'
    })
  })
  const { access_token } = await tokenRes.json()

  // Send airtime
  const res = await fetch('https://topups-sandbox.reloadly.com/topups', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/com.reloadly.topups-v1+json'
    },
    body: JSON.stringify({
      recipientPhone: {
        countryCode: 'NG',
        number: phone
      },
      operatorId: operatorIds[network],
      amount,
      useLocalAmount: true
    })
  })

  const data = await res.json()
  return {
    success: data.status === 'SUCCESSFUL',
    transactionId: data.transactionId?.toString()
  }
}
