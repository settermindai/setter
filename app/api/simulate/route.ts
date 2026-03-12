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

export async function POST(request: Request) {
  try {
    const { message, reset } = await request.json()
    const supabase = getSupabase()

    // Si reset, borrar lead simulador
    if (reset) {
      const { data: simLead } = await supabase.from('leads').select('id').eq('ig_user_id', 'simulator').single()
      if (simLead) {
        await supabase.from('messages').delete().eq('lead_id', simLead.id)
        await supabase.from('leads').delete().eq('id', simLead.id)
      }
      return NextResponse.json({ ok: true })
    }

    // Obtener o crear lead simulador
    let { data: lead } = await supabase.from('leads').select('*').eq('ig_user_id', 'simulator').single()
    if (!lead) {
      const { data: newLead } = await supabase.from('leads').insert({
        ig_user_id: 'simulator', username: 'simulator', status: 'new'
      }).select().single()
      lead = newLead
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

    // Cargar bloques, recursos y reglas — igual que el cron
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