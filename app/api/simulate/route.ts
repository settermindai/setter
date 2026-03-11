import { NextResponse } from 'next/server'
import { buildSystemPrompt } from '@/lib/prompt-builder'
import { getAIResponse } from '@/lib/ai'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { message, history } = await request.json()

    // Cargar bloques desde Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    let blocks = {
      identidad: '', negocio: '', calificacion: '', ejemplos: ''
    }

    const { data } = await supabase.from('blocks').select('*').limit(1).single()
    if (data) {
      blocks = {
        identidad: data.identidad?.content || '',
        negocio: data.negocio?.content || '',
        calificacion: data.calificacion?.content || '',
        ejemplos: data.ejemplos?.content || '',
      }
    }

    const conversationHistory = [
      ...(history || []),
      { role: 'user' as const, content: message }
    ]

    const systemPrompt = buildSystemPrompt(blocks)
    const reply = await getAIResponse(systemPrompt, conversationHistory)

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Simulate error:', error)
    return NextResponse.json({ reply: 'error al procesar' }, { status: 500 })
  }
}