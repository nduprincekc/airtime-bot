import { NextRequest, NextResponse } from 'next/server'
import { handleMessage } from '@/lib/bot'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    const entry = body.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value
    const message = value?.messages?.[0]

    console.log('Incoming body:', JSON.stringify(body, null, 2))

    if (!message) {
      console.log('No message found - likely a status update')
      return NextResponse.json({ status: 'no message' })
    }

    if (message.type !== 'text') {
      console.log('Non-text message:', message.type)
      return NextResponse.json({ status: 'ignored' })
    }

    const phone = message.from
    const text = message.text.body

    console.log(`Message from ${phone}: ${text}`)

    handleMessage(phone, text).catch(console.error)

    return NextResponse.json({ status: 'ok' })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}