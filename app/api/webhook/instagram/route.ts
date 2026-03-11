import { NextResponse } from 'next/server'
import { buildSystemPrompt } from '@/lib/prompt-builder'
import { getAIResponse } from '@/lib/ai'
import { createClient } from '@supabase/supabase-js'

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN
const BOT_ID = '17841442428617540'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const conversationHistory: Record<string, Array<{ role: 'user' | 'assistant', content: string }>> = {}

async function sendInstagramMessage(recipientId: string, message: string) {
  const response = await fetch(`https://graph.instagram.com/v21.0/me/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: message },
      access_token: process.env.INSTAGRAM_ACCESS_TOKEN,
    })
  })
  return response.json()
}

async function getSettings() {
  try {
    const supabase = getSupabase()
    const { data } = await supabase.from('settings').select('*').limit(1).single()
    if (data) return data
  } catch (e) {}
  return {
    response_delay_seconds: 5,
    active_hours_enabled: false,
    active_hours_start: '09:00',
    active_hours_end: '21:00',
  }
}

async function getBlocks() {
  try {
    const supabase = getSupabase()
    const { data } = await supabase.from('blocks').select('*').limit(1).single()
    if (data) return {
      identidad: data.identidad?.content || '',
      negocio: data.negocio?.content || '',
      calificacion: data.calificacion?.content || '',
      ejemplos: data.ejemplos?.content || '',
    }
  } catch (e) {}
  return { identidad: '', negocio: '', calificacion: '', ejemplos: '' }
}

async function getResources() {
  try {
    const supabase = getSupabase()
    const { data } = await supabase.from('resources').select('*')
    if (data && data.length > 0) {
      return data.map((r: any) => `- ${r.name}: ${r.url}\n  Cuándo enviarlo: ${r.guide_text}`).join('\n')
    }
  } catch (e) {}
  return null
}

async function getOrCreateLead(supabase: any, igUserId: string) {
  const { data: existing } = await supabase.from('leads').select('*').eq('ig_user_id', igUserId).single()
  if (existing) return existing
  const { data: newLead } = await supabase.from('leads').insert({ ig_user_id: igUserId, status: 'new' }).select().single()
  return newLead
}

async function saveMessage(supabase: any, leadId: string, role: 'user' | 'assistant', content: string, igMessageId?: string) {
  await supabase.from('messages').insert({
    lead_id: leadId, role, content, ig_message_id: igMessageId || null,
  })
}

function isWithinActiveHours(start: string, end: string): boolean {
  const now = new Date()
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = sh * 60 + sm
  const endMinutes = eh * 60 + em
  return nowMinutes >= startMinutes && nowMinutes < endMinutes
}

function getNextActiveTime(start: string): Date {
  const now = new Date()
  const [sh, sm] = start.split(':').map(Number)
  const next = new Date(now)
  next.setHours(sh, sm, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  return next
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('WEBHOOK BODY:', JSON.stringify(body, null, 2))

    const entry = body.entry?.[0]
    const messaging = entry?.messaging?.[0]

    if (!messaging) return NextResponse.json({ status: 'no messaging' })
    if (messaging.message?.is_echo) return NextResponse.json({ status: 'echo ignored' })
    if (!messaging.message) return NextResponse.json({ status: 'no message ignored' })

    const senderId = messaging.sender?.id
    if (senderId === BOT_ID) return NextResponse.json({ status: 'own message ignored' })

    const messageText = messaging.message?.text
    const messageId = messaging.message?.mid
    if (!messageText) return NextResponse.json({ status: 'no text ignored' })

    const supabase = getSupabase()
    const lead = await getOrCreateLead(supabase, senderId)
    if (lead) await saveMessage(supabase, lead.id, 'user', messageText, messageId)

    // Cargar configuración
    const settings = await getSettings()

    // Comprobar horario activo
    if (settings.active_hours_enabled) {
      const withinHours = isWithinActiveHours(settings.active_hours_start, settings.active_hours_end)
      if (!withinHours) {
        // Encolar para cuando empiece el horario
        const scheduledFor = getNextActiveTime(settings.active_hours_start)
        await supabase.from('message_queue').insert({
          sender_id: senderId,
          message_text: messageText,
          message_id: messageId,
          scheduled_for: scheduledFor.toISOString(),
        })
        console.log(`⏳ Mensaje encolado para ${scheduledFor.toISOString()}`)
        return NextResponse.json({ status: 'queued' })
      }
    }

    // Aplicar delay
    if (settings.response_delay_seconds > 0) {
      await sleep(settings.response_delay_seconds * 1000)
    }

    // Generar respuesta IA
    if (!conversationHistory[senderId]) conversationHistory[senderId] = []
    conversationHistory[senderId].push({ role: 'user', content: messageText })

    const blocks = await getBlocks()
    const resources = await getResources()
    const systemPrompt = buildSystemPrompt(blocks, resources)
    const aiResponse = await getAIResponse(systemPrompt, conversationHistory[senderId])

    conversationHistory[senderId].push({ role: 'assistant', content: aiResponse })
    if (lead) await saveMessage(supabase, lead.id, 'assistant', aiResponse)

    await sendInstagramMessage(senderId, aiResponse)
    console.log(`✅ Respondido a ${senderId}: ${aiResponse}`)

    return NextResponse.json({ status: 'ok' })

  } catch (error) {
    console.error('Error en webhook:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}