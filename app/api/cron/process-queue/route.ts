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
          .order('created_at', { ascending: false })
          .limit(60)

        const history = (recentMessages || []).reverse().map((m: any) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))

        history.push({ role: 'user', content: item.message_text })

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

        // Analizar conversación y actualizar perfil del lead
        if (lead && history.length >= 2) {
          try {
            const analysisPrompt = `Analiza esta conversación de ventas por Instagram y extrae en JSON:
{
  "summary": "resumen breve del lead en 1-2 frases",
  "pain_points": "dolores principales separados por coma",
  "desires": "deseos principales separados por coma", 
  "objections": "objeciones o contras separados por coma"
}
Solo responde con el JSON, sin nada más.`

            const analysisHistory = [
              ...history,
              { role: 'assistant' as const, content: aiResponse }
            ]

            const analysisResponse = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': process.env.ANTHROPIC_API_KEY!,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 300,
                system: analysisPrompt,
                messages: analysisHistory,
              })
            })
            const analysisData = await analysisResponse.json()
            const raw = analysisData.content[0].text.replace(/```json|```/g, '').trim()
            const analysis = JSON.parse(raw)

            await supabase.from('leads').update({
              summary: analysis.summary || '',
              pain_points: analysis.pain_points || '',
              desires: analysis.desires || '',
              objections: analysis.objections || '',
              updated_at: new Date().toISOString(),
            }).eq('id', lead.id)
          } catch (e) {
            console.error('Error analizando conversación:', e)
          }
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
