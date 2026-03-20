import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { sendWA } from '@/lib/whatsapp'
import { purchaseAirtime } from '@/lib/airtime'
import { creditWallet } from '@/lib/session'

const getSupabase = () => createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(req: NextRequest) {
  const supabase = getSupabase()

  const body = await req.text()
  const sig = req.headers.get('x-paystack-signature')
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(body)
    .digest('hex')

  if (hash !== sig) {
    return new NextResponse('Invalid signature', { status: 401 })
  }

  const event = JSON.parse(body)

  if (event.event === 'dedicatedaccount.assign.success' ||
      event.event === 'charge.success') {

    const phone = event.data?.customer?.phone
    const amount = Math.floor(event.data?.amount / 100)
    const ref = event.data?.reference
    const meta = event.data?.metadata

    if (event.event === 'charge.success' && !meta?.airtime_amount) {
      if (phone && amount) {
        await creditWallet(phone, amount)
        await sendWA(phone,
          `✅ *Wallet Funded!*\n\n` +
          `💰 ₦${amount.toLocaleString()} added to your wallet\n\n` +
          `Send *balance* to check your wallet\n` +
          `Send *airtime* to buy airtime now`
        )
      }
      return NextResponse.json({ ok: true })
    }

    if (meta?.airtime_amount) {
      const { data: txn } = await supabase
        .from('transactions')
        .select('*')
        .eq('paystack_ref', ref)
        .eq('status', 'pending')
        .maybeSingle()

      if (!txn) return NextResponse.json({ ok: true })

      await supabase.from('transactions')
        .update({ status: 'paid' })
        .eq('id', txn.id)

      await sendWA(txn.phone, "✅ Payment confirmed! Sending your airtime...")

      const result = await purchaseAirtime({
        phone: txn.beneficiary,
        network: txn.network,
        amount: txn.amount,
        requestId: ref,
      })

      await supabase.from('transactions')
        .update({
          status: result.success ? 'delivered' : 'failed',
          airtime_response: result,
        })
        .eq('id', txn.id)

      if (result.success) {
        await sendWA(txn.phone,
          `✅ *Airtime Delivered!*\n\n` +
          `📱 ${txn.beneficiary} (${txn.network})\n` +
          `💰 ₦${txn.amount.toLocaleString()} airtime sent\n` +
          `🔖 Ref: ${result.transactionId}\n\n` +
          `Send *airtime* to buy again`
        )
      } else {
        await sendWA(txn.phone,
          `❌ Airtime delivery failed.\n\n` +
          `You will be refunded ₦${(txn.amount + txn.fee).toLocaleString()} within 24 hours.\n` +
          `Ref: ${ref}`
        )
      }
    }
  }

  return NextResponse.json({ ok: true })
}