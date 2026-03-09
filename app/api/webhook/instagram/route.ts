import { NextResponse } from 'next/server'

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN

// Meta verifica el webhook con GET
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }

  return new Response('Forbidden', { status: 403 })
}

// Meta envía los mensajes con POST
export async function POST(request: Request) {
  const body = await request.json()
  console.log('Mensaje recibido:', JSON.stringify(body, null, 2))
  return NextResponse.json({ status: 'ok' })
}