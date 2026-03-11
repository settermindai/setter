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
  updated_at: string
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

const SCORE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  high:   { label: 'HIGH', color: '#10B981', bg: '#10B98115' },
  medium: { label: 'MED',  color: '#F59E0B', bg: '#F59E0B15' },
  low:    { label: 'LOW',  color: '#6B7280', bg: '#6B728015' },
}

const NAV_ITEMS = [
  { id: 'home',     icon: '⌂',  label: 'Home' },
  { id: 'agente',   icon: '⚡', label: 'Agente' },
  { id: 'leads',    icon: '👥', label: 'Leads' },
  { id: 'links',    icon: '🔗', label: 'Links' },
  { id: 'settings', icon: '⚙', label: 'Settings' },
]

const AVATAR_BLOCKS = [
  { key: 'identidad',    label: 'Identidad y Voz', icon: '🎭', desc: 'Tono, personalidad, reglas de comunicación' },
  { key: 'negocio',      label: 'Negocio',          icon: '💼', desc: 'Producto, precio, diferencial, CTA' },
  { key: 'calificacion', label: 'Calificación',     icon: '🎯', desc: 'Cliente ideal, HIGH/LOW, descalificadores' },
  { key: 'ejemplos',     label: 'Guiones',          icon: '💬', desc: 'Ejemplos de conversación y scripts' },
]

function formatRelativeTime(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function ChatPanel({
  lead, messages, onClose, isSimulator,
}: {
  lead: Lead | null
  messages: Message[]
  onClose?: () => void
  isSimulator?: boolean
}) {
  const [input, setInput] = useState('')
  const [simMessages, setSimMessages] = useState<{ role: string; content: string }[]>([])
  const [simLoading, setSimLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, simMessages])

  async function sendSimMessage() {
    if (!input.trim() || simLoading) return
    const userMsg = input.trim()
    setInput('')
    setSimMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setSimLoading(true)
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: simMessages }),
      })
      const data = await res.json()
      setSimMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch {
      setSimMessages(prev => [...prev, { role: 'assistant', content: 'error al responder' }])
    }
    setSimLoading(false)
  }

  const displayMessages = isSimulator ? simMessages : messages

  return (
    <div style={{
      width: 320, flexShrink: 0,
      background: '#18182A', borderLeft: '1px solid #1C1C2E',
      display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid #1C1C2E',
        display: 'flex', alignItems: 'center', gap: 10, background: '#1C1C2E',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'linear-gradient(135deg, #E1306C, #F77737)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0,
        }}>
          {isSimulator ? '🤖' : (lead?.username?.[0]?.toUpperCase() || '?')}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#E8E8F0' }}>
            {isSimulator ? 'Simular conversación' : (lead?.username || lead?.ig_user_id || '—')}
          </div>
          <div style={{ fontSize: 10, color: '#3B3B5C' }}>
            {isSimulator ? 'Test del bot en vivo' : `ID: ${lead?.ig_user_id}`}
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#3B3B5C', cursor: 'pointer', fontSize: 16 }}>✕</button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {displayMessages.length === 0 && (
          <div style={{ color: '#2A2A40', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
            {isSimulator ? 'Escribe un mensaje para probar el bot' : 'Sin mensajes aún'}
          </div>
        )}
        {displayMessages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end' }}>
            <div style={{
              maxWidth: '82%', padding: '8px 12px',
              borderRadius: msg.role === 'user' ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
              background: msg.role === 'user' ? '#1A1A2E' : 'linear-gradient(135deg, #E1306C, #F77737)',
              fontSize: 12, lineHeight: 1.5, color: '#E8E8F0',
            }}>
              {msg.content}
              {'created_at' in msg && (
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 3, textAlign: 'right' }}>
                  {formatTime((msg as Message).created_at)}
                </div>
              )}
            </div>
          </div>
        ))}
        {simLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ padding: '8px 14px', borderRadius: '14px 4px 14px 14px', background: 'linear-gradient(135deg, #E1306C, #F77737)', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              escribiendo...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {isSimulator && (
        <div style={{ padding: '12px', borderTop: '1px solid #1C1C2E', display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendSimMessage()}
            placeholder="Escribe como si fueras un lead..."
            style={{
              flex: 1, background: '#1A1A2E', border: '1px solid #2A2A45',
              borderRadius: 10, color: '#E8E8F0', padding: '8px 12px',
              fontSize: 12, outline: 'none',
            }}
          />
          <button onClick={sendSimMessage} style={{
            background: 'linear-gradient(135deg, #E1306C, #F77737)',
            border: 'none', borderRadius: 10, color: 'white',
            width: 36, height: 36, cursor: 'pointer', fontSize: 14, flexShrink: 0,
          }}>↑</button>
        </div>
      )}
    </div>
  )
}

function AvatarView() {
  const [blocks, setBlocks] = useState<Blocks>({ identidad: '', negocio: '', calificacion: '', ejemplos: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.from('blocks').select('*').limit(1).single().then(({ data }) => {
    if (data) setBlocks({
      id: data.id,
      identidad: data.identidad?.content || '',
      negocio: data.negocio?.content || '',
      calificacion: data.calificacion?.content || '',
      ejemplos: data.ejemplos?.content || '',
    })
    })
  }, [])

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
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 24, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Avatar del Agente</div>
          <div style={{ fontSize: 12, color: '#3B3B5C' }}>Define cómo habla y cualifica tu agente de IA</div>
        </div>
        <button onClick={saveBlocks} disabled={saving} style={{
          background: saved ? '#10B981' : 'linear-gradient(135deg, #E1306C, #F77737)',
          border: 'none', color: 'white', padding: '10px 24px',
          borderRadius: 10, fontSize: 13, fontWeight: 600,
          cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
        }}>
          {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar todo'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {AVATAR_BLOCKS.map(block => (
          <div key={block.key} style={{
            background: '#1C1C2E', border: '1px solid #1C1C2E',
            borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>{block.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{block.label}</div>
                <div style={{ fontSize: 11, color: '#3B3B5C' }}>{block.desc}</div>
              </div>
            </div>
            <textarea
              value={blocks[block.key as keyof Blocks] as string}
              onChange={e => setBlocks(prev => ({ ...prev, [block.key]: e.target.value }))}
              style={{
                height: 200, background: '#161624', border: '1px solid #1C1C2E',
                borderRadius: 10, color: '#E8E8F0', fontSize: 11, lineHeight: 1.8,
                padding: 14, resize: 'none', outline: 'none',
                fontFamily: "'SF Mono', 'Fira Code', monospace",
              }}
              onFocus={e => e.target.style.borderColor = '#E1306C'}
              onBlur={e => e.target.style.borderColor = '#1C1C2E'}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function AgenteView({ leads }: { leads: Lead[] }) {
  const [subTab, setSubTab] = useState<'dashboard' | 'avatar'>('dashboard')
  const totalLeads = leads.length
  const hotLeads = leads.filter(l => l.score === 'high').length
  const newToday = leads.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ padding: '0 24px', borderBottom: '1px solid #1C1C2E', display: 'flex', gap: 0 }}>
        {[{ id: 'dashboard', label: 'Dashboard' }, { id: 'avatar', label: 'Avatar' }].map(tab => (
          <button key={tab.id} onClick={() => setSubTab(tab.id as any)} style={{
            padding: '14px 20px', background: 'none', border: 'none',
            color: subTab === tab.id ? '#E8E8F0' : '#3B3B5C',
            fontSize: 13, fontWeight: subTab === tab.id ? 600 : 400,
            cursor: 'pointer',
            borderBottom: subTab === tab.id ? '2px solid #E1306C' : '2px solid transparent',
            transition: 'all 0.15s',
          }}>{tab.label}</button>
        ))}
      </div>

      {subTab === 'dashboard' && (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Total Leads', value: totalLeads, icon: '👥', color: '#6366F1' },
                { label: 'High Score',  value: hotLeads,   icon: '🔥', color: '#E1306C' },
                { label: 'Hoy',         value: newToday,   icon: '✨', color: '#10B981' },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: '#1C1C2E', border: '1px solid #1C1C2E', borderRadius: 14, padding: '20px 24px',
                }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{stat.icon}</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: 11, color: '#3B3B5C', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            <div style={{ background: '#1C1C2E', border: '1px solid #1C1C2E', borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 11, color: '#3B3B5C', fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>
                Últimos leads
              </div>
              {leads.slice(0, 6).map(lead => {
                const score = SCORE_CONFIG[lead.score || 'low'] || SCORE_CONFIG['low']
                return (
                  <div key={lead.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 0', borderBottom: '1px solid #1E1E2E',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #E1306C, #F77737)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0,
                    }}>
                      {(lead.username || lead.ig_user_id)?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{lead.username || lead.ig_user_id}</div>
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: 700, color: score.color,
                      background: score.bg, padding: '3px 8px', borderRadius: 6,
                    }}>{score.label}</div>
                    <div style={{ fontSize: 11, color: '#3B3B5C' }}>{formatRelativeTime(lead.created_at)}</div>
                  </div>
                )
              })}
              {leads.length === 0 && (
                <div style={{ color: '#2A2A40', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Aún no hay leads</div>
              )}
            </div>
          </div>
          <ChatPanel lead={null} messages={[]} isSimulator />
        </div>
      )}

      {subTab === 'avatar' && <AvatarView />}
    </div>
  )
}

function LeadsView({ leads, onSelectLead, selectedLead, messages }: {
  leads: Lead[]
  onSelectLead: (lead: Lead | null) => void
  selectedLead: Lead | null
  messages: Message[]
}) {
  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #1C1C2E' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Leads</div>
          <div style={{ fontSize: 12, color: '#3B3B5C', marginTop: 2 }}>{leads.length} conversaciones</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 2fr 80px 130px 70px',
            padding: '10px 24px', borderBottom: '1px solid #1C1C2E',
            fontSize: 10, color: '#3B3B5C', fontWeight: 600, letterSpacing: 1,
            textTransform: 'uppercase', background: '#161624',
          }}>
            <span>Lead</span><span>Último mensaje</span><span>Score</span><span>Agenda</span><span>Hora</span>
          </div>

          {leads.length === 0 && (
            <div style={{ padding: 40, color: '#2A2A40', fontSize: 13, textAlign: 'center' }}>
              Cuando alguien escriba a tu Instagram, aparecerá aquí.
            </div>
          )}

          {leads.map(lead => {
            const score = SCORE_CONFIG[lead.score || 'low'] || SCORE_CONFIG['low']
            const isSelected = selectedLead?.id === lead.id
            return (
              <div key={lead.id} onClick={() => onSelectLead(isSelected ? null : lead)} style={{
                display: 'grid', gridTemplateColumns: '2fr 2fr 80px 130px 70px',
                padding: '12px 24px', borderBottom: '1px solid #1E1E2E',
                cursor: 'pointer', background: isSelected ? '#12121E' : 'transparent',
                transition: 'background 0.15s', alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #E1306C, #F77737)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0,
                  }}>
                    {(lead.username || lead.ig_user_id)?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{lead.username || lead.ig_user_id}</div>
                    <div style={{ fontSize: 10, color: '#3B3B5C' }}>ID: {lead.ig_user_id}</div>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: '#4B4B6B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>—</div>

                <div>
                  <select value={lead.score || 'low'}
                    onChange={async e => { e.stopPropagation(); await supabase.from('leads').update({ score: e.target.value }).eq('id', lead.id) }}
                    onClick={e => e.stopPropagation()}
                    style={{
                      background: score.bg, border: `1px solid ${score.color}30`,
                      color: score.color, padding: '4px 8px', borderRadius: 6,
                      fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none',
                    }}>
                    <option value="high">HIGH</option>
                    <option value="medium">MED</option>
                    <option value="low">LOW</option>
                  </select>
                </div>

                <div>
                  <select value={lead.status || 'new'}
                    onChange={async e => { e.stopPropagation(); await supabase.from('leads').update({ status: e.target.value }).eq('id', lead.id) }}
                    onClick={e => e.stopPropagation()}
                    style={{
                      background: lead.status === 'booked' ? '#10B98115' : '#1A1A2E',
                      border: `1px solid ${lead.status === 'booked' ? '#10B981' : '#2A2A45'}`,
                      color: lead.status === 'booked' ? '#10B981' : '#6B7280',
                      padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', outline: 'none',
                    }}>
                    <option value="new">Pendiente</option>
                    <option value="sent">Enviada</option>
                    <option value="booked">✅ Reservado</option>
                  </select>
                </div>

                <div style={{ fontSize: 11, color: '#3B3B5C' }}>{formatRelativeTime(lead.updated_at || lead.created_at)}</div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedLead && (
        <ChatPanel lead={selectedLead} messages={messages} onClose={() => onSelectLead(null)} />
      )}
    </div>
  )
}

function LinksView() {
  const [resources, setResources] = useState<Array<{
    id: string
    name: string
    url: string
    guide_text: string
    created_at: string
  }>>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', url: '', guide_text: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadResources() }, [])

  async function loadResources() {
    const { data } = await supabase.from('resources').select('*').order('created_at', { ascending: false })
    if (data) setResources(data)
  }

  async function saveResource() {
    if (!form.name.trim() || !form.url.trim()) return
    setSaving(true)
    if (editingId) {
      await supabase.from('resources').update({
        name: form.name, url: form.url, guide_text: form.guide_text
      }).eq('id', editingId)
    } else {
      await supabase.from('resources').insert({
        name: form.name, url: form.url, guide_text: form.guide_text
      })
    }
    await loadResources()
    setForm({ name: '', url: '', guide_text: '' })
    setShowForm(false)
    setEditingId(null)
    setSaving(false)
  }

  function startEdit(r: typeof resources[0]) {
    setForm({ name: r.name, url: r.url, guide_text: r.guide_text || '' })
    setEditingId(r.id)
    setShowForm(true)
  }

  async function deleteResource(id: string) {
    await supabase.from('resources').delete().eq('id', id)
    setResources(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid #1C1C2E',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Recursos</div>
          <div style={{ fontSize: 12, color: '#3B3B5C', marginTop: 2 }}>
            El bot enviará estos links cuando lo considere necesario
          </div>
        </div>
        <button onClick={() => { setForm({ name: '', url: '', guide_text: '' }); setEditingId(null); setShowForm(true) }} style={{
          background: 'linear-gradient(135deg, #E1306C, #F77737)',
          border: 'none', color: 'white', padding: '10px 20px',
          borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          + Añadir recurso
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Tabla */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Header tabla */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 2fr 80px',
            padding: '10px 24px', borderBottom: '1px solid #1C1C2E',
            fontSize: 10, color: '#3B3B5C', fontWeight: 600,
            letterSpacing: 1, textTransform: 'uppercase', background: '#141420',
          }}>
            <span>Nombre</span><span>Link</span><span>Texto guía IA</span><span></span>
          </div>

          {resources.length === 0 && (
            <div style={{ padding: 40, color: '#2A2A40', fontSize: 13, textAlign: 'center' }}>
              Añade tu primer recurso — lead magnets, reels, videos, etc.
            </div>
          )}

          {resources.map(r => (
            <div key={r.id} style={{
              display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 2fr 80px',
              padding: '14px 24px', borderBottom: '1px solid #1E1E2E',
              alignItems: 'start', transition: 'background 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#18182A')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontSize: 13, fontWeight: 600, paddingRight: 16 }}>{r.name}</div>
              <div style={{ paddingRight: 16 }}>
                <a href={r.url} target="_blank" rel="noreferrer" style={{
                  fontSize: 12, color: '#E1306C', textDecoration: 'none',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  display: 'block', maxWidth: 200,
                }}>
                  {r.url}
                </a>
              </div>
              <div style={{
                fontSize: 12, color: '#4B4B6B', lineHeight: 1.5,
                paddingRight: 16, display: '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {r.guide_text || '—'}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => startEdit(r)} style={{
                  background: '#1C1C2E', border: '1px solid #2A2A45',
                  color: '#E8E8F0', padding: '5px 10px', borderRadius: 7,
                  fontSize: 11, cursor: 'pointer',
                }}>✏️</button>
                <button onClick={() => deleteResource(r.id)} style={{
                  background: '#1C1C2E', border: '1px solid #2A2A45',
                  color: '#E1306C', padding: '5px 10px', borderRadius: 7,
                  fontSize: 11, cursor: 'pointer',
                }}>🗑</button>
              </div>
            </div>
          ))}
        </div>

        {/* Panel formulario */}
        {showForm && (
          <div style={{
            width: 360, flexShrink: 0, borderLeft: '1px solid #1C1C2E',
            background: '#18182A', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #1C1C2E',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {editingId ? 'Editar recurso' : 'Nuevo recurso'}
              </div>
              <button onClick={() => setShowForm(false)} style={{
                background: 'none', border: 'none', color: '#3B3B5C', cursor: 'pointer', fontSize: 18,
              }}>✕</button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
              <div>
                <div style={{ fontSize: 11, color: '#3B3B5C', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                  Nombre del recurso
                </div>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ej: Lead Magnet PDF, Reel transformación..."
                  style={{
                    width: '100%', background: '#0E0E18', border: '1px solid #1C1C2E',
                    borderRadius: 10, color: '#E8E8F0', padding: '10px 14px',
                    fontSize: 13, outline: 'none', boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = '#E1306C'}
                  onBlur={e => e.target.style.borderColor = '#1C1C2E'}
                />
              </div>

              <div>
                <div style={{ fontSize: 11, color: '#3B3B5C', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                  Link
                </div>
                <input
                  value={form.url}
                  onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                  placeholder="https://..."
                  style={{
                    width: '100%', background: '#0E0E18', border: '1px solid #1C1C2E',
                    borderRadius: 10, color: '#E8E8F0', padding: '10px 14px',
                    fontSize: 13, outline: 'none', boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = '#E1306C'}
                  onBlur={e => e.target.style.borderColor = '#1C1C2E'}
                />
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 11, color: '#3B3B5C', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                  Texto guía para la IA
                </div>
                <textarea
                  value={form.guide_text}
                  onChange={e => setForm(p => ({ ...p, guide_text: e.target.value }))}
                  placeholder="Ej: Envía este PDF cuando el lead pida más información sobre nutrición o cuando mencione que no sabe por dónde empezar..."
                  style={{
                    flex: 1, minHeight: 140, background: '#0E0E18', border: '1px solid #1C1C2E',
                    borderRadius: 10, color: '#E8E8F0', padding: '10px 14px',
                    fontSize: 13, lineHeight: 1.6, resize: 'none', outline: 'none',
                    fontFamily: 'inherit',
                  }}
                  onFocus={e => e.target.style.borderColor = '#E1306C'}
                  onBlur={e => e.target.style.borderColor = '#1C1C2E'}
                />
              </div>

              <button onClick={saveResource} disabled={saving || !form.name.trim() || !form.url.trim()} style={{
                background: 'linear-gradient(135deg, #E1306C, #F77737)',
                border: 'none', color: 'white', padding: '12px',
                borderRadius: 10, fontSize: 14, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: !form.name.trim() || !form.url.trim() ? 0.5 : 1,
              }}>
                {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Añadir recurso'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SettingsView() {
  const [settings, setSettings] = useState({
    id: '',
    response_delay_seconds: 5,
    active_hours_enabled: false,
    active_hours_start: '09:00',
    active_hours_end: '21:00',
    rules: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.from('settings').select('*').limit(1).single().then(({ data }) => {
      if (data) setSettings({
        id: data.id,
        response_delay_seconds: data.response_delay_seconds ?? 5,
        active_hours_enabled: data.active_hours_enabled ?? false,
        active_hours_start: data.active_hours_start ?? '09:00',
        active_hours_end: data.active_hours_end ?? '21:00',
        rules: data.rules ?? '',
      })
    })
  }, [])

  async function saveSettings() {
    setSaving(true)
    const payload = {
      response_delay_seconds: settings.response_delay_seconds,
      active_hours_enabled: settings.active_hours_enabled,
      active_hours_start: settings.active_hours_start,
      active_hours_end: settings.active_hours_end,
      updated_at: new Date().toISOString(),
      rules: settings.rules,
    }
    if (settings.id) {
      await supabase.from('settings').update(payload).eq('id', settings.id)
    } else {
      const { data } = await supabase.from('settings').insert(payload).select().single()
      if (data) setSettings(prev => ({ ...prev, id: data.id }))
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function formatDelay(seconds: number) {
    if (seconds < 60) return `${seconds} seg`
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min`
    return `${Math.floor(seconds / 3600)}h`
  }

  // Escala logarítmica: 1s → 1800s (30min)
  function sliderToSeconds(val: number) {
    if (val === 0) return 1
    return Math.round(Math.exp(val * Math.log(1800) / 100))
  }

  function secondsToSlider(seconds: number) {
    if (seconds <= 1) return 0
    return Math.round((Math.log(seconds) / Math.log(1800)) * 100)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid #1C1C2E',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Configuración</div>
          <div style={{ fontSize: 12, color: '#3B3B5C', marginTop: 2 }}>Comportamiento del agente</div>
        </div>
        <button onClick={saveSettings} disabled={saving} style={{
          background: saved ? '#10B981' : 'linear-gradient(135deg, #E1306C, #F77737)',
          border: 'none', color: 'white', padding: '10px 24px',
          borderRadius: 10, fontSize: 13, fontWeight: 600,
          cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
        }}>
          {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>

        {/* Tiempo de respuesta */}
        <div style={{
          background: '#1C1C2E', border: '1px solid #2A2A40',
          borderRadius: 14, padding: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>⏱ Tiempo de respuesta</div>
              <div style={{ fontSize: 12, color: '#3B3B5C', marginTop: 3 }}>
                Pausa antes de responder a leads reales. El simulador responde siempre al instante.
              </div>
            </div>
            <div style={{
              fontSize: 22, fontWeight: 700, color: '#E1306C',
              background: '#E1306C15', padding: '8px 16px', borderRadius: 10,
              minWidth: 80, textAlign: 'center',
            }}>
              {formatDelay(settings.response_delay_seconds)}
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <input
              type="range"
              min={0}
              max={100}
              value={secondsToSlider(settings.response_delay_seconds)}
              onChange={e => setSettings(prev => ({
                ...prev,
                response_delay_seconds: sliderToSeconds(Number(e.target.value))
              }))}
              style={{
                width: '100%',
                accentColor: '#E1306C',
                height: 6,
                cursor: 'pointer',
              }}
            />
            <div style={{ position: 'relative', height: 20, marginTop: 6 }}>
              {[
                { seconds: 1, label: '1s' },
                { seconds: 30, label: '30s' },
                { seconds: 60, label: '1m' },
                { seconds: 300, label: '5m' },
                { seconds: 900, label: '15m' },
                { seconds: 1800, label: '30m' },
              ].map(mark => (
                <span key={mark.seconds} style={{
                  position: 'absolute',
                  left: `${secondsToSlider(mark.seconds)}%`,
                  transform: 'translateX(-50%)',
                  fontSize: 10,
                  color: settings.response_delay_seconds === mark.seconds ? '#E1306C' : '#3B3B5C',
                }}>
                  {mark.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Horario activo */}
        <div style={{
          background: '#1C1C2E', border: '1px solid #2A2A40',
          borderRadius: 14, padding: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>🕐 Horario activo</div>
              <div style={{ fontSize: 12, color: '#3B3B5C', marginTop: 3 }}>
                Fuera de este horario los mensajes se encolan y se responden al inicio del siguiente horario
              </div>
            </div>
            {/* Toggle */}
            <div
              onClick={() => setSettings(prev => ({ ...prev, active_hours_enabled: !prev.active_hours_enabled }))}
              style={{
                width: 48, height: 26, borderRadius: 13,
                background: settings.active_hours_enabled ? '#E1306C' : '#2A2A40',
                cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: 3,
                left: settings.active_hours_enabled ? 25 : 3,
                width: 20, height: 20, borderRadius: '50%',
                background: 'white', transition: 'left 0.2s',
              }} />
            </div>
          </div>

          {settings.active_hours_enabled && (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#3B3B5C', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                  Inicio
                </div>
                <input
                  type="time"
                  value={settings.active_hours_start}
                  onChange={e => setSettings(prev => ({ ...prev, active_hours_start: e.target.value }))}
                  style={{
                    width: '100%', background: '#0E0E18', border: '1px solid #2A2A40',
                    borderRadius: 10, color: '#E8E8F0', padding: '10px 14px',
                    fontSize: 16, outline: 'none', boxSizing: 'border-box',
                    colorScheme: 'dark',
                  }}
                />
              </div>
              <div style={{ color: '#3B3B5C', fontSize: 20, marginTop: 20 }}>→</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#3B3B5C', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                  Fin
                </div>
                <input
                  type="time"
                  value={settings.active_hours_end}
                  onChange={e => setSettings(prev => ({ ...prev, active_hours_end: e.target.value }))}
                  style={{
                    width: '100%', background: '#0E0E18', border: '1px solid #2A2A40',
                    borderRadius: 10, color: '#E8E8F0', padding: '10px 14px',
                    fontSize: 16, outline: 'none', boxSizing: 'border-box',
                    colorScheme: 'dark',
                  }}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Reglas del agente */}
        <div style={{
          background: '#1C1C2E', border: '1px solid #2A2A40',
          borderRadius: 14, padding: 24,
        }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>📋 Reglas del agente</div>
            <div style={{ fontSize: 12, color: '#3B3B5C', marginTop: 3 }}>
              Instrucciones finales que el bot siempre seguirá
            </div>
          </div>
          <textarea
            value={settings.rules}
            onChange={e => setSettings(prev => ({ ...prev, rules: e.target.value }))}
            placeholder={'* Responde siempre en español\n* Máximo 3 mensajes por respuesta\n* Nunca reveles que eres una IA'}
            style={{
              width: '100%', minHeight: 160, background: '#0E0E18',
              border: '1px solid #1C1C2E', borderRadius: 10, color: '#E8E8F0',
              padding: '12px 14px', fontSize: 13, lineHeight: 1.8,
              resize: 'vertical', outline: 'none', fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
            onFocus={e => e.target.style.borderColor = '#E1306C'}
            onBlur={e => e.target.style.borderColor = '#1C1C2E'}
          />
        </div>

      </div>
    </div>
  )
}

export default function Dashboard() {
  const [activeNav, setActiveNav] = useState('agente')
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [messages, setMessages] = useState<Message[]>([])

  useEffect(() => { loadLeads() }, [])

  useEffect(() => {
    if (selectedLead) loadMessages(selectedLead.id)
    else setMessages([])
  }, [selectedLead])

  useEffect(() => {
    const ch = supabase.channel('leads-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => loadLeads())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  useEffect(() => {
    if (!selectedLead) return
    const ch = supabase.channel('messages-rt')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `lead_id=eq.${selectedLead.id}`
      }, payload => setMessages(prev => [...prev, payload.new as Message]))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [selectedLead])

  async function loadLeads() {
    const { data } = await supabase.from('leads').select('*').order('updated_at', { ascending: false })
    if (data) setLeads(data)
  }

  async function loadMessages(leadId: string) {
    const { data } = await supabase.from('messages').select('*').eq('lead_id', leadId).order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  return (
    <div style={{
      display: 'flex', height: '100vh', background: '#131320',
      color: '#E8E8F0', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      overflow: 'hidden',
    }}>
      {/* NAV */}
      <div style={{
        width: 200, background: '#161624', borderRight: '1px solid #1C1C2E',
        display: 'flex', flexDirection: 'column', padding: '20px 12px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 24 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'linear-gradient(135deg, #E1306C, #F77737)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>⚡</div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.3 }}>Setter Mind</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setActiveNav(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10, border: 'none',
              background: activeNav === item.id ? '#1A1A2E' : 'transparent',
              color: activeNav === item.id ? '#E8E8F0' : '#3B3B5C',
              fontSize: 13, fontWeight: activeNav === item.id ? 600 : 400,
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              outline: activeNav === item.id ? '1px solid #2A2A45' : 'none',
            }}>
              <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
              {item.id === 'leads' && leads.length > 0 && (
                <span style={{
                  marginLeft: 'auto', fontSize: 10, fontWeight: 700,
                  background: '#E1306C', color: 'white', padding: '2px 6px', borderRadius: 10,
                }}>{leads.length}</span>
              )}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />
        <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 10, border: 'none',
          background: 'transparent', color: '#3B3B5C', fontSize: 13, cursor: 'pointer',
        }}>
          <span style={{ fontSize: 16 }}>↩</span> Cerrar sesión
        </button>
      </div>

      {/* CONTENIDO */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {activeNav === 'home'     && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2A2A40', flexDirection: 'column', gap: 12 }}><div style={{ fontSize: 48 }}>⌂</div><div>Home — próximamente</div></div>}
        {activeNav === 'agente'   && <AgenteView leads={leads} />}
        {activeNav === 'leads'    && <LeadsView leads={leads} onSelectLead={setSelectedLead} selectedLead={selectedLead} messages={messages} />}
        {activeNav === 'links'    && <LinksView />}
        {activeNav === 'settings' && <SettingsView />}
      </div>
    </div>
  )
}