import { createClient } from '@supabase/supabase-js'

const getSupabase = () => createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function getSession(phone: string) {
  const { data } = await getSupabase()
    .from('wa_sessions')
    .select('*')
    .eq('phone', phone)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  return data
}

export async function setSession(phone: string, updates: Record<string, any>) {
  const existing = await getSession(phone)
  if (existing) {
    await getSupabase().from('wa_sessions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('phone', phone)
  } else {
    await getSupabase().from('wa_sessions').insert({
      phone,
      ...updates,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
  }
}

export async function clearSession(phone: string) {
  await getSupabase().from('wa_sessions').delete().eq('phone', phone)
}

export async function getWallet(phone: string) {
  const { data } = await getSupabase()
    .from('wa_users')
    .select('wallet_balance')
    .eq('phone', phone)
    .maybeSingle()
  return data?.wallet_balance || 0
}

export async function deductWallet(phone: string, amount: number) {
  await getSupabase().rpc('deduct_wallet', {
    user_phone: phone,
    deduct_amount: amount
  })
}

export async function creditWallet(phone: string, amount: number) {
  await getSupabase().rpc('credit_wallet', {
    user_phone: phone,
    credit_amount: amount
  })
}