'use client'

import { useEffect, useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Lead = {
  id: string
  ig_user_id: string
  username: string | null
  full_name: string | null
  status: string | null
  score: string | null
  created_at: string
}

type Message = {
  id: string
  lead_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

type Blocks = {
  id?: string
  identidad: string
  negocio: string
  calificacion: string
  ejemplos: string
}

const DEFAULT_BLOCKS: Blocks = {
  identidad: `## IDENTIDAD Y VOZ
Soy Alex, coach de transformación física especializado en personas con poco tiempo.

## TONO
* Tono base: cercano, profesional y directo
* Tuteo siempre
* NUNCA uses mayúsculas en la conversación
* Nunca termines con punto "."
* Nunca pongas "¿" al inicio de pregunta`,
  negocio: `## PRODUCTO
Programa de transformación física 12 semanas online 1:1.

## DIFERENCIAL
Sin dietas restrictivas. Adaptado a personas con poco tiempo.

## CTA
Llamada de valoración gratuita de 20 minutos.

## PRECIO (no mencionar hasta calificar)
997€`,
  calificacion: `## CLIENTE IDEAL
Mujer +30 años con responsabilidades laborales/familiares.
Ha probado dietas antes sin éxito. Tiene frustración acumulada.

## LEAD HIGH
Urgencia alta + fracasos previos + impacto emocional + puede invertir

## DESCALIFICADORES
Solo quiere info gratis. Sin urgencia. No puede invertir.`,
  ejemplos: `## GUION SEGUIDOR
Lead: "vi tu post y me interesa"
Tú: "me alegra que te haya llegado 🙌 qué fue lo que más resonó contigo"

## GUION PRECIO DIRECTO
Lead: "cuánto cuesta"
Tú: "antes de hablar de inversión quiero asegurarme de que es para ti — cuál es tu objetivo ahora mismo"

## GUION LEAD FRÍO
Lead: "lo pienso y te digo"
Tú: "perfecto sin presión — solo dime una cosa: qué tendría que tener la solución perfecta para que dijeras que sí"`,
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: 'Nuevo', color: '#3B82F6' },
  hot: { label: '🔥 Hot', color: '#EF4444' },
  warm: { label: 'Tibio', color: '#F59E0B' },
  cold: { label: 'Frío', color: '#6B7280' },
  booked: { label: '✅ Reservado', color: '#10B981' },
  disqualified: { label: 'Descartado', color: '#374151' },
}

const BLOCK_LABELS = [
  { key: 'identidad', label: 'Identidad y Voz', icon: '🎭' },
  { key: 'negocio', label: 'Negocio', icon: '💼' },
  { key: 'calificacion', label: 'Calificación', icon: '🎯' },
  { key: 'ejemplos', label: 'Guiones', icon: '💬' },
]

export default function Dashboard() {
  const [view, setView] = useState<'leads' | 'bloques'>('leads')
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [blocks, setBlocks] = useState<Blocks>(DEFAULT_BLOCKS)
  const [activeBlock, setActiveBlock] = useState('identidad')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadLeads()
    loadBlocks()
  }, [])

  useEffect(() => {
    if (selectedLead) loadMessages(selectedLead.id)
  }, [selectedLead])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime mensajes
  useEffect(() => {
    if (!selectedLead) return
    const channel = supabase
      .channel('messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `lead_id=eq.${selectedLead.id}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedLead])

  // Realtime leads
  useEffect(() => {
    const channel = supabase
      .channel('leads')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leads'
      }, () => { loadLeads() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadLeads() {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setLeads(data)
    setLoading(false)
  }

  async function loadMessages(leadId: string) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  async function loadBlocks() {
    const { data } = await supabase
      .from('blocks')
      .select('*')
      .limit(1)
      .single()
    if (data) {
      setBlocks({
        id: data.id,
        identidad: data.identidad?.content || DEFAULT_BLOCKS.identidad,
        negocio: data.negocio?.content || DEFAULT_BLOCKS.negocio,
        calificacion: data.calificacion?.content || DEFAULT_BLOCKS.calificacion,
        ejemplos: data.ejemplos?.content || DEFAULT_BLOCKS.ejemplos,
      })
    }
  }

  async function saveBlocks() {
    setSaving(true)
    const payload = {
      identidad: { content: blocks.identidad },
      negocio: { content: blocks.negocio },
      calificacion: { content: blocks.calificacion },
      ejemplos: { content: blocks.ejemplos },
      updated_at: new Date().toISOString(),
    }
    if (blocks.id) {
      await supabase.from('blocks').update(payload).eq('id', blocks.id)
    } else {
      const { data } = await supabase.from('blocks').insert(payload).select().single()
      if (data) setBlocks(prev => ({ ...prev, id: data.id }))
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function updateLeadStatus(leadId: string, status: string) {
    await supabase.from('leads').update({ status }).eq('id', leadId)
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l))
    if (selectedLead?.id === leadId) setSelectedLead(prev => prev ? { ...prev, status } : prev)
  }

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (ts: string) => {
    const d = new Date(ts)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const hours = diff / 1000 / 60 / 60
    if (hours < 1) return 'Hace unos minutos'
    if (hours < 24) return `Hace ${Math.floor(hours)}h`
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#0A0A0F',
      color: '#E8E8F0',
      fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      overflow: 'hidden',
    }}>

      {/* SIDEBAR */}
      <div style={{
        width: 64,
        background: '#0D0D14',
        borderRight: '1px solid #1A1A2E',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 0',
        gap: 8,
        flexShrink: 0,
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          marginBottom: 16,
        }}>⚡</div>

        {[
          { id: 'leads', icon: '👥', label: 'Leads' },
          { id: 'bloques', icon: '🧠', label: 'IA' },
        ].map(item => (
          <button key={item.id} onClick={() => setView(item.id as any)} style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            border: 'none',
            background: view === item.id ? '#1E1E35' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            transition: 'background 0.2s',
            outline: view === item.id ? '1px solid #6366F1' : 'none',
          }} title={item.label}>
            {item.icon}
          </button>
        ))}

        <div style={{ flex: 1 }} />
        <button onClick={async () => {
          await supabase.auth.signOut()
          window.location.href = '/'
        }} style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 18,
          color: '#4B4B6B',
        }} title="Cerrar sesión">↩</button>
      </div>

      {/* VISTA LEADS */}
      {view === 'leads' && (
        <>
          {/* LISTA DE LEADS */}
          <div style={{
            width: 300,
            background: '#0D0D14',
            borderRight: '1px solid #1A1A2E',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}>
            <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #1A1A2E' }}>
              <div style={{ fontSize: 11, color: '#4B4B6B', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
                Setter Mind
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>Leads</div>
              <div style={{ fontSize: 12, color: '#4B4B6B', marginTop: 2 }}>
                {leads.length} conversaciones
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading && (
                <div style={{ padding: 24, color: '#4B4B6B', fontSize: 13, textAlign: 'center' }}>
                  Cargando...
                </div>
              )}
              {!loading && leads.length === 0 && (
                <div style={{ padding: 24, color: '#4B4B6B', fontSize: 13, textAlign: 'center' }}>
                  Aún no hay leads.<br />Cuando alguien te escriba,<br />aparecerá aquí.
                </div>
              )}
              {leads.map(lead => {
                const status = STATUS_LABELS[lead.status || 'new'] || STATUS_LABELS.new
                const isSelected = selectedLead?.id === lead.id
                return (
                  <div key={lead.id} onClick={() => setSelectedLead(lead)} style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    background: isSelected ? '#1A1A2E' : 'transparent',
                    borderBottom: '1px solid #13131F',
                    transition: 'background 0.15s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        flexShrink: 0,
                      }}>
                        {(lead.username || lead.ig_user_id)?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {lead.username || lead.ig_user_id}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: status.color,
                            background: `${status.color}18`,
                            padding: '2px 6px',
                            borderRadius: 4,
                          }}>
                            {status.label}
                          </div>
                          <div style={{ fontSize: 10, color: '#4B4B6B' }}>
                            {formatDate(lead.created_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* CHAT */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {!selectedLead ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2A2A45', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 48 }}>💬</div>
                <div style={{ fontSize: 14 }}>Selecciona un lead para ver la conversación</div>
              </div>
            ) : (
              <>
                {/* Header chat */}
                <div style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid #1A1A2E',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#0D0D14',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                    }}>
                      {(selectedLead.username || selectedLead.ig_user_id)?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {selectedLead.username || selectedLead.ig_user_id}
                      </div>
                      <div style={{ fontSize: 11, color: '#4B4B6B' }}>
                        ID: {selectedLead.ig_user_id}
                      </div>
                    </div>
                  </div>

                  {/* Selector de estado */}
                  <select
                    value={selectedLead.status || 'new'}
                    onChange={e => updateLeadStatus(selectedLead.id, e.target.value)}
                    style={{
                      background: '#1A1A2E',
                      border: '1px solid #2A2A45',
                      color: '#E8E8F0',
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: 12,
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    {Object.entries(STATUS_LABELS).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>

                {/* Mensajes */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {messages.length === 0 && (
                    <div style={{ color: '#2A2A45', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
                      Sin mensajes aún
                    </div>
                  )}
                  {messages.map(msg => (
                    <div key={msg.id} style={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end',
                    }}>
                      <div style={{
                        maxWidth: '70%',
                        padding: '10px 14px',
                        borderRadius: msg.role === 'user' ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                        background: msg.role === 'user' ? '#1A1A2E' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: '#E8E8F0',
                      }}>
                        <div>{msg.content}</div>
                        <div style={{ fontSize: 10, color: msg.role === 'user' ? '#4B4B6B' : 'rgba(255,255,255,0.5)', marginTop: 4, textAlign: 'right' }}>
                          {formatTime(msg.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* VISTA BLOQUES DE IA */}
      {view === 'bloques' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid #1A1A2E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#0D0D14',
          }}>
            <div>
              <div style={{ fontSize: 11, color: '#4B4B6B', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>
                Motor de IA
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>Bloques de Instrucciones</div>
            </div>
            <button onClick={saveBlocks} disabled={saving} style={{
              background: saved ? '#10B981' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              border: 'none',
              color: 'white',
              padding: '10px 24px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}>
              {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}
            </button>
          </div>

          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            {/* Tabs bloques */}
            <div style={{
              width: 200,
              borderRight: '1px solid #1A1A2E',
              padding: '12px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              background: '#0D0D14',
            }}>
              {BLOCK_LABELS.map(block => (
                <button key={block.key} onClick={() => setActiveBlock(block.key)} style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: activeBlock === block.key ? '#1A1A2E' : 'transparent',
                  color: activeBlock === block.key ? '#E8E8F0' : '#4B4B6B',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 13,
                  fontWeight: activeBlock === block.key ? 600 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  outline: activeBlock === block.key ? '1px solid #2A2A45' : 'none',
                  transition: 'all 0.15s',
                }}>
                  <span>{block.icon}</span>
                  <span>{block.label}</span>
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <div style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: '#13131F',
                fontSize: 11,
                color: '#4B4B6B',
                lineHeight: 1.6,
              }}>
                💡 Los cambios se aplican en el siguiente mensaje que recibas
              </div>
            </div>

            {/* Editor */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 24, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: '#4B4B6B', fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>
                {BLOCK_LABELS.find(b => b.key === activeBlock)?.icon} {BLOCK_LABELS.find(b => b.key === activeBlock)?.label}
              </div>
              <textarea
                value={blocks[activeBlock as keyof Blocks] as string}
                onChange={e => setBlocks(prev => ({ ...prev, [activeBlock]: e.target.value }))}
                style={{
                  flex: 1,
                  background: '#0D0D14',
                  border: '1px solid #1A1A2E',
                  borderRadius: 12,
                  color: '#E8E8F0',
                  fontSize: 13,
                  lineHeight: 1.8,
                  padding: 20,
                  resize: 'none',
                  outline: 'none',
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#6366F1'}
                onBlur={e => e.target.style.borderColor = '#1A1A2E'}
                placeholder="Escribe las instrucciones para este bloque..."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}