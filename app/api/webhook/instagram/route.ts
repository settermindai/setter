import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN
const BOT_ID = '17841442428617540'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
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

async function getIGUserInfo(igUserId: string) {
  try {
    const res = await fetch(`https://graph.instagram.com/v21.0/${igUserId}?fields=name,username&access_token=${process.env.INSTAGRAM_ACCESS_TOKEN}`)
    const data = await res.json()
    return { full_name: data.name || null, username: data.username || null }
  } catch (e) {
    return { full_name: null, username: null }
  }
}

async function getOrCreateLead(supabase: any, igUserId: string) {
  const { data: existing } = await supabase.from('leads').select('*').eq('ig_user_id', igUserId).single()
  if (existing) {
    // Actualizar nombre si no lo tenía
    if (!existing.username || !existing.full_name) {
      const info = await getIGUserInfo(igUserId)
      if (info.username || info.full_name) {
        await supabase.from('leads').update(info).eq('id', existing.id)
        return { ...existing, ...info }
      }
    }
    return existing
  }
  const info = await getIGUserInfo(igUserId)
  const { data: newLead } = await supabase.from('leads').insert({
    ig_user_id: igUserId, status: 'new', ...info
  }).select().single()
  return newLead
}

function isWithinActiveHours(start: string, end: string): boolean {
  const now = new Date()
  const spainTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const nowMinutes = spainTime.getHours() * 60 + spainTime.getMinutes()
  const startMinutes = sh * 60 + sm
  const endMinutes = eh * 60 + em
  return nowMinutes >= startMinutes && nowMinutes < endMinutes
}

function getNextActiveTime(start: string): Date {
  const now = new Date()
  const spainNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
  const [sh, sm] = start.split(':').map(Number)
  const next = new Date(spainNow)
  next.setHours(sh, sm, 0, 0)
  if (next <= spainNow) next.setDate(next.getDate() + 1)
  return next
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
    const settings = await getSettings()

    // Guardar lead y mensaje
    const lead = await getOrCreateLead(supabase, senderId)
    if (lead) {
      await supabase.from('messages').insert({
        lead_id: lead.id, role: 'user', content: messageText, ig_message_id: messageId || null,
      })
    }

    // Modo instantáneo — bypasea cola, cron y horario
    if (settings.response_delay_seconds === 0) {
      const { buildSystemPrompt } = await import('@/lib/prompt-builder')
      const { getAIResponse } = await import('@/lib/ai')

      const { data: blocksData } = await supabase.from('blocks').select('*').limit(1).single()
      const blocks = blocksData ? {
        identidad: blocksData.identidad?.content || '',
        negocio: blocksData.negocio?.content || '',
        calificacion: blocksData.calificacion?.content || '',
        ejemplos: blocksData.ejemplos?.content || '',
      } : { identidad: '', negocio: '', calificacion: '', ejemplos: '' }

      const { data: resourcesData } = await supabase.from('resources').select('*')
      const resources = resourcesData && resourcesData.length > 0
        ? resourcesData.map((r: any) => `- ${r.name}: ${r.url}\n  Cuándo enviarlo: ${r.guide_text}`).join('\n')
        : null

      const rules = settings.rules || null
      const systemPrompt = buildSystemPrompt(blocks, resources, rules)

      const { data: recentMessages } = await supabase.from('messages').select('*').eq('lead_id', lead?.id).order('created_at', { ascending: true }).limit(60)
      const rawHistory = (recentMessages || []).map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      // Unir mensajes consecutivos del mismo rol
      const history = rawHistory.reduce((acc: any[], msg) => {
        if (acc.length > 0 && acc[acc.length - 1].role === msg.role) {
          acc[acc.length - 1].content += '\n' + msg.content
        } else {
          acc.push({ role: msg.role, content: msg.content })
        }
        return acc
      }, [])

      // Asegurarse que el último mensaje es del usuario
      if (history.length === 0 || history[history.length - 1].role !== 'user') {
        history.push({ role: 'user', content: messageText })
      }
      const aiResponse = await getAIResponse(systemPrompt, history)

      if (lead) {
        await supabase.from('messages').insert({ lead_id: lead.id, role: 'assistant', content: aiResponse })
      }

      const parts = aiResponse.split('|||').map((p: string) => p.trim()).filter(Boolean)
      for (const part of parts) {
        await fetch(`https://graph.instagram.com/v21.0/me/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient: { id: senderId }, message: { text: part }, access_token: process.env.INSTAGRAM_ACCESS_TOKEN })
        })
      }

      return NextResponse.json({ status: 'instant' })
    }

    // Modo con delay — encolar
    let scheduledFor: Date
    if (settings.active_hours_enabled && !isWithinActiveHours(settings.active_hours_start, settings.active_hours_end)) {
      scheduledFor = getNextActiveTime(settings.active_hours_start)
      console.log(`⏳ Fuera de horario — encolado para ${scheduledFor.toISOString()}`)
    } else {
      scheduledFor = new Date(Date.now() + (settings.response_delay_seconds * 1000))
      console.log(`⏱ Encolado con delay ${settings.response_delay_seconds}s`)
    }

    await supabase.from('message_queue').insert({
      sender_id: senderId,
      message_text: messageText,
      message_id: messageId,
      scheduled_for: scheduledFor.toISOString(),
    })

    return NextResponse.json({ status: 'queued' })

  } catch (error) {
    console.error('Error en webhook:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}