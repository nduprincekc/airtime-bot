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
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]

    if (!message || message.type !== 'text') {
      return NextResponse.json({ status: 'ignored' })
    }

    const phone = message.from
    const text = message.text.body

    handleMessage(phone, text).catch(console.error)

    return NextResponse.json({ status: 'ok' })
  } catch (err) {
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
