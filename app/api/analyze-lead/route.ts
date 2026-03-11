import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(request: Request) {
  try {
    const { leadId, history } = await request.json()
    if (!leadId || !history) return NextResponse.json({ ok: false })

    const supabase = getSupabase()

    const analysisResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: `Analiza esta conversación de ventas por Instagram y responde ÚNICAMENTE con este JSON válido, sin texto adicional, sin markdown:
{"summary":"resumen en 1 frase","pain_points":"dolores separados por coma","desires":"deseos separados por coma","objections":"objeciones separadas por coma"}`,
        messages: history,
      })
    })

    const analysisData = await analysisResponse.json()
    const raw = analysisData?.content?.[0]?.text?.replace(/```json|```/g, '').trim()
    if (!raw) return NextResponse.json({ ok: false })

    const analysis = JSON.parse(raw)
    await supabase.from('leads').update({
      summary: analysis.summary || '',
      pain_points: analysis.pain_points || '',
      desires: analysis.desires || '',
      objections: analysis.objections || '',
      updated_at: new Date().toISOString(),
    }).eq('id', leadId)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Error analyze-lead:', e)
    return NextResponse.json({ ok: false })
  }
}