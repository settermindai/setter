import { NextResponse } from 'next/server'
import { buildSystemPrompt } from '@/lib/prompt-builder'
import { getAIResponse } from '@/lib/ai'

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN

// Bloques por defecto — luego vendrán de Supabase
const DEFAULT_BLOCKS = {
  identidad: `## IDENTIDAD Y VOZ
Soy Alex, coach de transformación física especializado en personas con poco tiempo.

## TONO
* Tono base: cercano, profesional y directo
* Tuteo siempre
* NUNCA uses mayúsculas en la conversación
* Nunca termines con punto "."
* Nunca pongas "¿" al inicio de pregunta`,

  negocio: `## PRODUCTO
Programa de transformación física 12 semanas online 1:1.

## DIFERENCIAL
Sin dietas restrictivas. Adaptado a personas con poco tiempo.

## CTA
Llamada de valoración gratuita de 20 minutos.

## PRECIO (no mencionar hasta calificar)
997€`,

  calificacion: `## CLIENTE IDEAL
Mujer +30 años con responsabilidades laborales/familiares.
Ha probado dietas antes sin éxito. Tiene frustración acumulada.

## LEAD HIGH
Urgencia alta + fracasos previos + impacto emocional + puede invertir

## DESCALIFICADORES
Solo quiere info gratis. Sin urgencia. No puede invertir.`,

  ejemplos: `## GUION SEGUIDOR
Lead: "vi tu post y me interesa"
Tú: "me alegra que te haya llegado 🙌 qué fue lo que más resonó contigo"

## GUION PRECIO DIRECTO
Lead: "cuánto cuesta"
Tú: "antes de hablar de inversión quiero asegurarme de que es para ti — cuál es tu objetivo ahora mismo"

## GUION LEAD FRÍO
Lead: "lo pienso y te digo"
Tú: "perfecto sin presión — solo dime una cosa: qué tendría que tener la solución perfecta para que dijeras que sí"`,
}

// Historial en memoria (temporal, luego irá a Supabase)
const conversationHistory: Record<string, Array<{ role: 'user' | 'assistant', content: string }>> = {}

async function sendInstagramMessage(recipientId: string, message: string) {
  const response = await fetch(
    `https://graph.instagram.com/v21.0/me/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
        access_token: process.env.INSTAGRAM_ACCESS_TOKEN,
      })
    }
  )
  return response.json()
}

// GET — verificación del webhook
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

// POST — recibir y responder mensajes
export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('WEBHOOK BODY:', JSON.stringify(body, null, 2))
    
    const entry = body.entry?.[0]
    const messaging = entry?.messaging?.[0]

    if (!messaging) {
      return NextResponse.json({ status: 'no messaging' })
    }

    // Ignorar cualquier mensaje que no sea del lead
    if (messaging.message?.is_echo) {
      return NextResponse.json({ status: 'echo ignored' })
    }

    // Ignorar si el sender es la propia cuenta
    const senderId = messaging.sender?.id
    const recipientId = messaging.recipient?.id
    
    if (senderId === '17841442428617540') {
      return NextResponse.json({ status: 'own message ignored' })
    }

    const messageText = messaging.message?.text

    // Ignorar mensajes sin texto
    if (!messageText) {
      await sendInstagramMessage(senderId, "disculpa pero ahora no puedo ver eso, estoy en el coche — me lo cuentas por aquí")
      return NextResponse.json({ status: 'ok' })
    }

    if (!conversationHistory[senderId]) {
      conversationHistory[senderId] = []
    }

    conversationHistory[senderId].push({
      role: 'user',
      content: messageText
    })

    const systemPrompt = buildSystemPrompt(DEFAULT_BLOCKS)
    const aiResponse = await getAIResponse(systemPrompt, conversationHistory[senderId])

    conversationHistory[senderId].push({
      role: 'assistant',
      content: aiResponse
    })

    await sendInstagramMessage(senderId, aiResponse)

    console.log(`✅ Respondido a ${senderId}: ${aiResponse}`)

    return NextResponse.json({ status: 'ok' })

  } catch (error) {
    console.error('Error en webhook:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}