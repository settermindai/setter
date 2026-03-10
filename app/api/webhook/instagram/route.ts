import { NextResponse } from 'next/server'
import { buildSystemPrompt } from '@/lib/prompt-builder'
import { getAIResponse } from '@/lib/ai'
import { createClient } from '@supabase/supabase-js'

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Bloques por defecto (fallback si no hay en Supabase)
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

// Historial en memoria (para contexto de conversación)
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

async function getBlocks() {
  try {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('blocks')
      .select('*')
      .limit(1)
      .single()

    if (data) {
      return {
        identidad: data.identidad?.content || DEFAULT_BLOCKS.identidad,
        negocio: data.negocio?.content || DEFAULT_BLOCKS.negocio,
        calificacion: data.calificacion?.content || DEFAULT_BLOCKS.calificacion,
        ejemplos: data.ejemplos?.content || DEFAULT_BLOCKS.ejemplos,
      }
    }
  } catch (e) {
    console.log('Usando bloques por defecto')
  }
  return DEFAULT_BLOCKS
}

async function getOrCreateLead(supabase: any, igUserId: string) {
  // Buscar lead existente
  const { data: existing } = await supabase
    .from('leads')
    .select('*')
    .eq('ig_user_id', igUserId)
    .single()

  if (existing) return existing

  // Crear nuevo lead
  const { data: newLead } = await supabase
    .from('leads')
    .insert({
      ig_user_id: igUserId,
      status: 'new',
    })
    .select()
    .single()

  return newLead
}

async function saveMessage(supabase: any, leadId: string, role: 'user' | 'assistant', content: string, igMessageId?: string) {
  await supabase.from('messages').insert({
    lead_id: leadId,
    role,
    content,
    ig_message_id: igMessageId || null,
  })
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

    // Ignorar echos
    if (messaging.message?.is_echo) {
      return NextResponse.json({ status: 'echo ignored' })
    }

    // Ignorar reads y deliveries (sin mensaje)
    if (!messaging.message) {
      return NextResponse.json({ status: 'no message ignored' })
    }

    const senderId = messaging.sender?.id

    // Ignorar mensajes propios
    if (senderId === '17841442428617540') {
      return NextResponse.json({ status: 'own message ignored' })
    }

    const messageText = messaging.message?.text
    const messageId = messaging.message?.mid

    // Ignorar mensajes sin texto (fotos, audios, etc.)
    if (!messageText) {
      return NextResponse.json({ status: 'no text ignored' })
    }

    // Guardar en Supabase
    const supabase = getSupabase()
    const lead = await getOrCreateLead(supabase, senderId)

    if (lead) {
      await saveMessage(supabase, lead.id, 'user', messageText, messageId)
    }

    // Cargar historial de conversación
    if (!conversationHistory[senderId]) {
      conversationHistory[senderId] = []
    }

    conversationHistory[senderId].push({
      role: 'user',
      content: messageText
    })

    // Obtener bloques desde Supabase (o defecto)
    const blocks = await getBlocks()
    const systemPrompt = buildSystemPrompt(blocks)
    const aiResponse = await getAIResponse(systemPrompt, conversationHistory[senderId])

    conversationHistory[senderId].push({
      role: 'assistant',
      content: aiResponse
    })

    // Guardar respuesta en Supabase
    if (lead) {
      await saveMessage(supabase, lead.id, 'assistant', aiResponse)
    }

    await sendInstagramMessage(senderId, aiResponse)
    console.log(`✅ Respondido a ${senderId}: ${aiResponse}`)

    return NextResponse.json({ status: 'ok' })

  } catch (error) {
    console.error('Error en webhook:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}