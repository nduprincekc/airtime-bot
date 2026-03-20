import { createClient } from '@supabase/supabase-js'
import { sendWA } from './whatsapp'
import { getSession, setSession, clearSession, getWallet, deductWallet } from './session'
import { detectNetwork, normalizePhone, isValidNigerianNumber } from './network'
import { createPaymentLink, createDedicatedAccount } from './paystack'
import { purchaseAirtime } from './airtime'

const getSupabase = () => createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const FEE = 20

export async function handleMessage(phone: string, text: string) {
  const msg = text.trim().toLowerCase()
  const supabase = getSupabase()

  if (['cancel', 'stop', 'exit'].includes(msg)) {
    await clearSession(phone)
    await sendWA(phone, "Cancelled ✅\n\nSend *menu* to see what I can do.")
    return
  }

  if (msg === 'menu' || msg === 'hi' || msg === 'hello' || msg === 'start') {
    await clearSession(phone)
    const balance = await getWallet(phone)
    await sendWA(phone,
      `👋 Welcome to *AirtimeBot*!\n\n` +
      `💰 Wallet balance: *₦${balance.toLocaleString()}*\n\n` +
      `What would you like to do?\n\n` +
      `1️⃣ *airtime* — Buy airtime\n` +
      `2️⃣ *data* — Buy data bundle\n` +
      `3️⃣ *tv* — Pay DSTV/GOTV\n` +
      `4️⃣ *electricity* — Buy power token\n` +
      `5️⃣ *balance* — Check wallet\n` +
      `6️⃣ *fund* — Add money to wallet\n` +
      `7️⃣ *history* — Last 5 transactions\n` +
      `8️⃣ *save* — Save a number\n\n` +
      `Reply with any option above 👆`
    )
    return
  }

  if (msg === 'balance') {
    const balance = await getWallet(phone)
    await sendWA(phone,
      `💰 Your wallet balance is *₦${balance.toLocaleString()}*\n\n` +
      `Send *fund* to top up your wallet\n` +
      `Send *airtime* to buy airtime`
    )
    return
  }

  if (msg === 'fund') {
    const { data: user } = await supabase
      .from('wa_users')
      .select('account_number, account_bank')
      .eq('phone', phone)
      .maybeSingle()

    if (user?.account_number) {
      await sendWA(phone,
        `💳 *Your wallet funding account:*\n\n` +
        `🏦 Bank: *${user.account_bank}*\n` +
        `📱 Account: *${user.account_number}*\n` +
        `👤 Name: *AirtimeBot - User*\n\n` +
        `Transfer any amount from Opay, Kuda, or any bank.\n` +
        `Your wallet will be credited *instantly* ⚡`
      )
    } else {
      await sendWA(phone, "⏳ Setting up your personal wallet account...")
      const account = await createDedicatedAccount(phone)
      await supabase.from('wa_users')
        .upsert({
          phone,
          account_number: account.accountNumber,
          account_bank: account.bank,
        }, { onConflict: 'phone' })
      await sendWA(phone,
        `✅ *Your wallet account is ready!*\n\n` +
        `🏦 Bank: *${account.bank}*\n` +
        `📱 Account: *${account.accountNumber}*\n` +
        `👤 Name: *${account.accountName}*\n\n` +
        `Transfer any amount from Opay, Kuda, or any bank.\n` +
        `Your wallet will be credited *instantly* ⚡\n\n` +
        `_Save this account number — it's yours permanently_ 💾`
      )
    }
    return
  }

  if (msg === 'history') {
    const { data: txns } = await supabase
      .from('transactions')
      .select('*')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(5)

    if (!txns || txns.length === 0) {
      await sendWA(phone, "No transactions yet.\n\nSend *airtime* to make your first purchase!")
      return
    }

    const list = txns.map((t: any, i: number) =>
      `${i + 1}. ₦${t.amount} ${t.network} → ${t.beneficiary}\n   ${t.status === 'delivered' ? '✅' : '❌'} ${new Date(t.created_at).toLocaleDateString()}`
    ).join('\n\n')

    await sendWA(phone, `📋 *Your last ${txns.length} transactions:*\n\n${list}`)
    return
  }

  if (msg.startsWith('save ')) {
    const parts = text.trim().split(' ')
    if (parts.length < 3) {
      await sendWA(phone, "Format: *save [name] [number]*\n\nExample: save mum 08012345678")
      return
    }
    const name = parts[1]
    const number = normalizePhone(parts[2])
    if (!isValidNigerianNumber(number)) {
      await sendWA(phone, "Invalid number. Try again.\n\nExample: save mum 08012345678")
      return
    }
    const network = detectNetwork(number)
    await supabase.from('beneficiaries').insert({
      phone, name, beneficiary_phone: number, network
    })
    await sendWA(phone, `✅ *${name}* saved as ${number} (${network || 'unknown network'})\n\nSend *airtime* to top them up anytime.`)
    return
  }

  if (msg === 'last') {
    const { data: last } = await supabase
      .from('transactions')
      .select('*')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!last) {
      await sendWA(phone, "No previous transaction found.\n\nSend *airtime* to start.")
      return
    }

    await setSession(phone, {
      state: 'awaiting_confirm',
      pending_phone: last.beneficiary,
      pending_network: last.network,
      pending_amount: last.amount,
    })

    const balance = await getWallet(phone)
    const total = last.amount + FEE

    await sendWA(phone,
      `🔄 *Repeat last transaction?*\n\n` +
      `📱 Number: ${last.beneficiary}\n` +
      `📡 Network: ${last.network}\n` +
      `💰 Amount: ₦${last.amount.toLocaleString()}\n` +
      `💳 Fee: ₦${FEE}\n` +
      `💵 Total: *₦${total.toLocaleString()}*\n\n` +
      `Wallet balance: ₦${balance.toLocaleString()}\n\n` +
      `Reply *YES* to confirm or *cancel* to stop`
    )
    return
  }

  const session = await getSession(phone)
  const state = session?.state || 'idle'

  if (msg === 'airtime' || msg === '1') {
    await setSession(phone, { state: 'awaiting_number' })
    await sendWA(phone,
      `📱 *Buy Airtime*\n\n` +
      `Which number do you want to top up?\n\n` +
      `Send the phone number\n` +
      `Or send *self* to top up your own line\n\n` +
      `_Send cancel anytime to stop_`
    )
    return
  }

  if (state === 'awaiting_number') {
    let target = text.trim()
    if (msg === 'self') target = phone.startsWith('234') ? '0' + phone.slice(3) : phone

    const { data: saved } = await supabase
      .from('beneficiaries')
      .select('*')
      .eq('phone', phone)
      .ilike('name', target)
      .maybeSingle()

    if (saved) target = saved.beneficiary_phone

    const norm = normalizePhone(target)
    if (!isValidNigerianNumber(norm)) {
      await sendWA(phone, "❌ Invalid number.\n\nPlease send a valid Nigerian number like *08012345678*")
      return
    }

    const network = detectNetwork(norm)
    await setSession(phone, {
      state: network ? 'awaiting_amount' : 'awaiting_network',
      pending_phone: norm,
      pending_network: network,
    })

    if (network) {
      await sendWA(phone,
        `✅ Number: *${norm}*\n` +
        `📡 Network: *${network}* (auto-detected)\n\n` +
        `How much airtime?\n\n` +
        `• ₦100\n• ₦200\n• ₦500\n• ₦1,000\n• ₦2,000\n\n` +
        `Or type any amount`
      )
    } else {
      await sendWA(phone,
        `✅ Number: *${norm}*\n\n` +
        `Which network?\n\n` +
        `• MTN\n• Glo\n• Airtel\n• 9mobile`
      )
    }
    return
  }

  if (state === 'awaiting_network') {
    const nets: Record<string, string> = {
      mtn: 'MTN', glo: 'Glo', airtel: 'Airtel', '9mobile': '9mobile'
    }
    const net = Object.keys(nets).find(n => msg.includes(n))
    if (!net) {
      await sendWA(phone, "Please choose:\n\n• MTN\n• Glo\n• Airtel\n• 9mobile")
      return
    }
    await setSession(phone, { state: 'awaiting_amount', pending_network: nets[net] })
    await sendWA(phone,
      `📡 Network: *${nets[net]}*\n\n` +
      `How much airtime?\n\n` +
      `• ₦100\n• ₦200\n• ₦500\n• ₦1,000\n• ₦2,000\n\n` +
      `Or type any amount`
    )
    return
  }

  if (state === 'awaiting_amount') {
    const amount = parseInt(text.replace(/[₦,\s]/g, ''))
    if (isNaN(amount) || amount < 50) {
      await sendWA(phone, "❌ Minimum is ₦50. Please send a valid amount.")
      return
    }
    if (amount > 50000) {
      await sendWA(phone, "❌ Maximum per transaction is ₦50,000.")
      return
    }

    const total = amount + FEE
    const wallet = await getWallet(phone)

    await setSession(phone, { state: 'awaiting_confirm', pending_amount: amount })

    if (wallet >= total) {
      await sendWA(phone,
        `📋 *Confirm Purchase*\n\n` +
        `📱 Number: ${session!.pending_phone}\n` +
        `📡 Network: ${session!.pending_network}\n` +
        `💰 Airtime: ₦${amount.toLocaleString()}\n` +
        `💳 Fee: ₦${FEE}\n` +
        `💵 Total: *₦${total.toLocaleString()}*\n\n` +
        `💼 Wallet balance: ₦${wallet.toLocaleString()}\n\n` +
        `Reply *YES* to confirm`
      )
    } else {
      const ref = `AIR-${phone}-${Date.now()}`
      const link = await createPaymentLink({
        amount: total,
        ref,
        phone,
        meta: {
          beneficiary: session!.pending_phone,
          network: session!.pending_network,
          airtime_amount: amount,
        },
      })

      await setSession(phone, { paystack_ref: ref })

      await supabase.from('transactions').insert({
        phone,
        beneficiary: session!.pending_phone,
        network: session!.pending_network,
        amount,
        fee: FEE,
        paystack_ref: ref,
        status: 'pending',
      })

      await sendWA(phone,
        `📋 *Confirm Purchase*\n\n` +
        `📱 Number: ${session!.pending_phone}\n` +
        `📡 Network: ${session!.pending_network}\n` +
        `💰 Airtime: ₦${amount.toLocaleString()}\n` +
        `💳 Fee: ₦${FEE}\n` +
        `💵 Total: *₦${total.toLocaleString()}*\n\n` +
        `💼 Wallet balance: ₦${wallet.toLocaleString()} (insufficient)\n\n` +
        `Pay here 👇\n${link}\n\n` +
        `_Link expires in 30 mins_`
      )
    }
    return
  }

  if (state === 'awaiting_confirm') {
    if (msg !== 'yes') {
      await sendWA(phone, "Reply *YES* to confirm or *cancel* to stop.")
      return
    }

    const amount = session!.pending_amount
    const total = amount + FEE

    await deductWallet(phone, total)
    await clearSession(phone)

    await sendWA(phone, "⏳ Processing your airtime...")

    const result = await purchaseAirtime({
      phone: session!.pending_phone,
      network: session!.pending_network,
      amount,
      requestId: `AIR-${Date.now()}`,
    })

    await supabase.from('transactions').insert({
      phone,
      beneficiary: session!.pending_phone,
      network: session!.pending_network,
      amount,
      fee: FEE,
      status: result.success ? 'delivered' : 'failed',
      airtime_response: result,
    })

    if (result.success) {
      const newBalance = await getWallet(phone)
      await sendWA(phone,
        `✅ *Airtime Delivered!*\n\n` +
        `📱 ${session!.pending_phone} (${session!.pending_network})\n` +
        `💰 ₦${amount.toLocaleString()} airtime sent\n` +
        `🔖 Ref: ${result.transactionId}\n\n` +
        `💼 New balance: *₦${newBalance.toLocaleString()}*\n\n` +
        `Send *airtime* to buy again or *menu* for more options`
      )
    } else {
      await supabase.rpc('credit_wallet', {
        user_phone: phone,
        credit_amount: total
      })
      await sendWA(phone,
        `❌ Airtime delivery failed.\n\n` +
        `💰 ₦${total.toLocaleString()} has been refunded to your wallet.\n\n` +
        `Please try again or contact support.`
      )
    }
    return
  }

  await sendWA(phone, "Send *menu* to see all options or *airtime* to buy airtime.")
}