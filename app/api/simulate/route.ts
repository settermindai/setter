import { NextResponse } from 'next/server'
import { buildSystemPrompt } from '@/lib/prompt-builder'
import { getAIResponse } from '@/lib/ai'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { message, history } = await request.json()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Bloques
    const { data: blocksData } = await supabase.from('blocks').select('*').limit(1).single()
    const blocks = blocksData ? {
      identidad: blocksData.identidad?.content || '',
      negocio: blocksData.negocio?.content || '',
      calificacion: blocksData.calificacion?.content || '',
      ejemplos: blocksData.ejemplos?.content || '',
    } : { identidad: '', negocio: '', calificacion: '', ejemplos: '' }

    // Recursos
    const { data: resourcesData } = await supabase.from('resources').select('*')
    const resources = resourcesData && resourcesData.length > 0
      ? resourcesData.map((r: any) => `- ${r.name}: ${r.url}\n  Cuándo enviarlo: ${r.guide_text}`).join('\n')
      : null

    // Reglas
    const { data: settingsData } = await supabase.from('settings').select('rules').limit(1).single()
    const rules = settingsData?.rules || null
    
    console.log('BLOCKS:', JSON.stringify(blocks))
    console.log('RULES:', rules)
    const systemPrompt = buildSystemPrompt(blocks, resources, rules)

    const conversationHistory = [
      ...(history || []),
      { role: 'user' as const, content: message }
    ]

    const reply = await getAIResponse(systemPrompt, conversationHistory)

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Simulate error:', error)
    return NextResponse.json({ reply: 'error al procesar' }, { status: 500 })
  }
}