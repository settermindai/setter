export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function getAIResponse(
  systemPrompt: string,
  messages: Message[]
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: systemPrompt,
      messages: messages,
    })
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('Error API Anthropic:', data)
    throw new Error('Error llamando a la IA')
  }

  const raw = data.content[0].text

  try {
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (parsed.messages && Array.isArray(parsed.messages)) {
      return parsed.messages.join('|||')
    }
  } catch (e) {
    // Si no es JSON válido, devolver tal cual
  }

  return raw
}