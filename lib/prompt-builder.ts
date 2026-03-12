export interface Blocks {
  identidad: string
  negocio: string
  calificacion: string
  ejemplos: string
}

export function buildSystemPrompt(blocks: Blocks, resources?: string | null, rules?: string | null): string {
  return `
Lee y sigue TODAS las instrucciones siguientes al pie de la letra.

Así el comportamiento queda 100% controlado desde el dashboard — el bloque **Identidad y Voz** define quién es, y las **Reglas** definen cómo actuar.

═══════════════════════════════
IDENTIDAD Y VOZ
═══════════════════════════════
${blocks.identidad}

═══════════════════════════════
NEGOCIO
═══════════════════════════════
${blocks.negocio}

═══════════════════════════════
CALIFICACIÓN
═══════════════════════════════
${blocks.calificacion}

═══════════════════════════════
EJEMPLOS Y GUIONES
═══════════════════════════════
${blocks.ejemplos}

${resources ? `═══════════════════════════════
RECURSOS DISPONIBLES
═══════════════════════════════
Tienes acceso a estos recursos. Envía el link completo cuando la situación lo requiera según las instrucciones de cada uno:
${resources}
` : ''}

═══════════════════════════════
REGLAS FINALES IRROMPIBLES
═══════════════════════════════
${rules || ''}

═══════════════════════════════
FORMATO DE RESPUESTA — OBLIGATORIO
═══════════════════════════════
Responde SIEMPRE en este formato JSON exacto, sin nada más:
{"messages": ["primer mensaje", "segundo mensaje"]}
* Cada mensaje máximo 1 frase corta
* Sin saltos de línea dentro de cada mensaje
`
}