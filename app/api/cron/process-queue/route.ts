import { NextResponse } from 'next/server'
import { buildSystemPrompt } from '@/lib/prompt-builder'
import { getAIResponse } from '@/lib/ai'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

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

export async function GET(request: Request) {
  // Verificar que es llamada de cron autorizada
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const supabase = getSupabase()
    const now = new Date().toISOString()

    // Obtener mensajes pendientes cuyo scheduled_for ya pasó
    const { data: pending } = await supabase
      .from('message_queue')
      .select('*')
      .eq('processed', false)
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })

    if (!pending || pending.length === 0) {
      return NextResponse.json({ status: 'no pending messages' })
    }

    console.log(`📬 Procesando ${pending.length} mensajes en cola`)

    // Cargar bloques y recursos una sola vez
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

    const { data: settingsData } = await supabase.from('settings').select('*').limit(1).single()
    const rules = settingsData?.rules || null
    const systemPrompt = buildSystemPrompt(blocks, resources, rules)

    for (const item of pending) {
      try {
        // Marcar como procesado primero para evitar duplicados
        await supabase.from('message_queue').update({ processed: true }).eq('id', item.id)

        // Obtener historial del lead
        const { data: lead } = await supabase.from('leads').select('*').eq('ig_user_id', item.sender_id).single()
        const { data: recentMessages } = await supabase
          .from('messages')
          .select('*')
          .eq('lead_id', lead?.id)
          .order('created_at', { ascending: true })
          .limit(60)

        const rawHistory = (recentMessages || []).map((m: any) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))

        const history = rawHistory.reduce((acc: any[], msg) => {
          if (acc.length > 0 && acc[acc.length - 1].role === msg.role) {
            acc[acc.length - 1].content += '\n' + msg.content
          } else {
            acc.push({ role: msg.role, content: msg.content })
          }
          return acc
        }, [])

        if (history.length === 0 || history[history.length - 1].role !== 'user') {
          history.push({ role: 'user', content: item.message_text })
        }

        const aiResponse = await getAIResponse(systemPrompt, history)

        if (lead) {
          await supabase.from('messages').insert({
            lead_id: lead.id, role: 'assistant', content: aiResponse,
          })
        }
        console.log('AI RESPONSE RAW:', aiResponse)
        console.log('PARTS:', aiResponse.split('|||'))
        const parts = aiResponse.split('|||').map((p: string) => p.trim()).filter(Boolean)
        for (const part of parts) {
          await sendInstagramMessage(item.sender_id, part)
          await new Promise(resolve => setTimeout(resolve, 4000))
        }

        // Lanzar análisis en endpoint separado sin esperar
        if (lead && history.length >= 2) {
          const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : 'https://setter-six.vercel.app'
          fetch(`${baseUrl}/api/analyze-lead`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leadId: lead.id,
              history: [...history, { role: 'assistant', content: aiResponse }]
            })
          }).catch(() => {})
        }

        console.log(`✅ Cola procesada para ${item.sender_id}`)

      } catch (err) {
        console.error(`Error procesando mensaje ${item.id}:`, err)
        // Revertir processed para reintentar
        await supabase.from('message_queue').update({ processed: false }).eq('id', item.id)
      }
    }

    return NextResponse.json({ status: 'ok', processed: pending.length })

  } catch (error) {
    console.error('Error en cron:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}// Wed Mar 11 08:47:08 CET 2026
