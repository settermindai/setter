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

async function getOrCreateSimLead(supabase: any) {
  const { data: existing } = await supabase.from('leads').select('*').eq('ig_user_id', 'simulator').single()
  if (existing) return existing
  const { data: newLead } = await supabase.from('leads').insert({
    ig_user_id: 'simulator', username: 'simulator', status: 'new'
  }).select().single()
  return newLead
}

export async function POST(request: Request) {
  try {
    const { message, reset } = await request.json()
    const supabase = getSupabase()

    const lead = await getOrCreateSimLead(supabase)
    if (!lead) return NextResponse.json({ reply: 'error creando lead simulador' }, { status: 500 })

    // Reset: solo borra mensajes, mantiene el lead
    if (reset) {
      await supabase.from('messages').delete().eq('lead_id', lead.id)
      return NextResponse.json({ ok: true })
    }

    // Guardar mensaje del usuario
    await supabase.from('messages').insert({
      lead_id: lead.id, role: 'user', content: message
    })

    // Cargar historial completo desde Supabase
    const { data: history } = await supabase.from('messages').select('*').eq('lead_id', lead.id).order('created_at', { ascending: true })
    const conversationHistory = (history || []).map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    // Cargar bloques, recursos y reglas
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

    const { data: settingsData } = await supabase.from('settings').select('rules').limit(1).single()
    const rules = settingsData?.rules || null

    const systemPrompt = buildSystemPrompt(blocks, resources, rules)
    const aiResponse = await getAIResponse(systemPrompt, conversationHistory)

    // Guardar respuesta del bot
    await supabase.from('messages').insert({
      lead_id: lead.id, role: 'assistant', content: aiResponse
    })

    return NextResponse.json({ reply: aiResponse })
  } catch (error) {
    console.error('Simulate error:', error)
    return NextResponse.json({ reply: 'error al procesar' }, { status: 500 })
  }
}