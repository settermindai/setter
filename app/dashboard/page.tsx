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
  summary: string | null
  pain_points: string | null
  desires: string | null
  objections: string | null
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

const SCORE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  high:   { label: 'HIGH', color: '#F97316', bg: '#F9731620' },
  medium: { label: 'MED',  color: '#FBBF24', bg: '#FBBF2420' },
  low:    { label: 'LOW',  color: '#94A3B8', bg: '#94A3B820' },
}

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

type Theme = 'dark' | 'light'

const THEMES = {
  dark: {
    bg: '#0F0F17',
    surface: '#16161F',
    surface2: '#1C1C2A',
    border: '#252535',
    border2: '#2E2E42',
    text: '#F0F0F8',
    textMuted: '#6B6B8A',
    textFaint: '#3A3A55',
    accent: '#F97316',
    accentGrad: 'linear-gradient(135deg, #F97316, #FBBF24)',
    accentGradPink: 'linear-gradient(135deg, #E1306C, #F97316)',
    msgUser: '#1E1E2E',
    msgBot: 'linear-gradient(135deg, #E1306C, #F97316)',
    navActive: '#1E1E2E',
    navActiveText: '#F97316',
    navText: '#5A5A7A',
    shadow: '0 4px 24px rgba(0,0,0,0.3)',
  },
  light: {
    bg: '#F5F4FF',
    surface: '#FFFFFF',
    surface2: '#F0EFF8',
    border: '#E5E4F0',
    border2: '#D8D6ED',
    text: '#1A1A2E',
    textMuted: '#6B6B8A',
    textFaint: '#B0AECE',
    accent: '#F97316',
    accentGrad: 'linear-gradient(135deg, #F97316, #FBBF24)',
    accentGradPink: 'linear-gradient(135deg, #E1306C, #F97316)',
    msgUser: '#EEEDF8',
    msgBot: 'linear-gradient(135deg, #E1306C, #F97316)',
    navActive: '#FFF3EC',
    navActiveText: '#F97316',
    navText: '#9090B0',
    shadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
}

const NAV_ITEMS = [
  { id: 'inicio',        icon: '⌂',  label: 'Inicio' },
  { id: 'dashboard',     icon: '📊', label: 'Dashboard' },
  { id: 'leads',         icon: '👥', label: 'Leads' },
  { id: 'links',         icon: '🔗', label: 'Links' },
  { id: 'informes',      icon: '📈', label: 'Informes' },
  { id: 'agente',        icon: '⚡', label: 'Agente IA' },
  { id: 'configuracion', icon: '⚙',  label: 'Configuración' },
]

function ChatPanel({ lead, messages, onClose, isSimulator, t }: {
  lead: Lead | null; messages: Message[]; onClose?: () => void; isSimulator?: boolean; t: typeof THEMES['dark']
}) {
  const [input, setInput] = useState('')
  const [simMessages, setSimMessages] = useState<{ role: string; content: string }[]>([])
  const [simLoading, setSimLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [messages, simMessages])
  
  useEffect(() => {
    if (isSimulator) {
      fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true, message: '' }),
      })
    }
  }, [isSimulator])

  async function sendSimMessage() {
    if (!input.trim() || simLoading) return
    const userMsg = input.trim()
    setInput('')
    setSimMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setSimLoading(true)
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: simMessages }),
      })
      const data = await res.json()
      const parts = data.reply.split('|||').map((p: string) => p.trim()).filter(Boolean)
      for (const part of parts) setSimMessages(prev => [...prev, { role: 'assistant', content: part }])
    } catch {
      setSimMessages(prev => [...prev, { role: 'assistant', content: 'error al responder' }])
    }
    setSimLoading(false)
  }

  const displayMessages = isSimulator ? simMessages : messages

  return (
    <div style={{
      width: 320, flexShrink: 0, background: t.surface, borderLeft: `1px solid ${t.border}`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', alignSelf: 'stretch',
    }}>
      <div style={{
        padding: '14px 16px', borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', gap: 10, background: t.surface2, flexShrink: 0,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', background: t.accentGradPink,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0,
        }}>
          {isSimulator ? '🤖' : (lead?.username?.[0]?.toUpperCase() || '?')}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
            {isSimulator ? 'Simular conversación' : (lead?.username || lead?.ig_user_id || '—')}
          </div>
          <div style={{ fontSize: 10, color: t.textMuted }}>
            {isSimulator ? 'Test del bot en vivo' : `ID: ${lead?.ig_user_id}`}
          </div>
        </div>
        {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', fontSize: 16 }}>✕</button>}
      </div>

      {!isSimulator && lead && (
        <div style={{
          padding: '12px 16px', borderBottom: `1px solid ${t.border}`, background: t.surface2,
          display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, overflowY: 'auto', maxHeight: 220,
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {(() => {
              const score = SCORE_CONFIG[lead.score || 'low'] || SCORE_CONFIG['low']
              return <span style={{ fontSize: 10, fontWeight: 700, color: score.color, background: score.bg, padding: '3px 8px', borderRadius: 6 }}>{score.label}</span>
            })()}
            <span style={{
              fontSize: 10, color: lead.status === 'booked' ? '#10B981' : t.textMuted,
              background: lead.status === 'booked' ? '#10B98120' : t.surface,
              padding: '3px 8px', borderRadius: 6, fontWeight: 600, border: `1px solid ${t.border}`,
            }}>
              {lead.status === 'booked' ? '✅ Reservado' : lead.status === 'sent' ? '📤 Enviada' : '⏳ Pendiente'}
            </span>
          </div>
          {lead.summary && <div><div style={{ fontSize: 9, color: t.textFaint, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>📝 Resumen</div><div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>{lead.summary}</div></div>}
          {lead.pain_points && <div><div style={{ fontSize: 9, color: t.textFaint, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>💔 Dolores</div><div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>{lead.pain_points}</div></div>}
          {lead.desires && <div><div style={{ fontSize: 9, color: t.textFaint, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>✨ Deseos</div><div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>{lead.desires}</div></div>}
          {lead.objections && <div><div style={{ fontSize: 9, color: t.textFaint, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>🚧 Objeciones</div><div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>{lead.objections}</div></div>}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        {displayMessages.length === 0 && (
          <div style={{ color: t.textFaint, fontSize: 12, textAlign: 'center', marginTop: 40 }}>
            {isSimulator ? 'Escribe un mensaje para probar el bot' : 'Sin mensajes aún'}
          </div>
        )}
        {displayMessages.map((msg, i) =>
          msg.content.split('|||').map((part, j) => part.trim()).filter(Boolean).map((part, j) => (
            <div key={`${i}-${j}`} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end' }}>
              <div style={{
                maxWidth: '82%', padding: '8px 12px',
                borderRadius: msg.role === 'user' ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                background: msg.role === 'user' ? t.msgUser : t.msgBot,
                fontSize: 12, lineHeight: 1.5, color: msg.role === 'user' ? t.text : 'white',
              }}>
                {part}
                {'created_at' in msg && (
                  <div style={{ fontSize: 9, color: msg.role === 'user' ? t.textFaint : 'rgba(255,255,255,0.4)', marginTop: 3, textAlign: 'right' }}>
                    {formatTime((msg as Message).created_at)}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {simLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ padding: '8px 14px', borderRadius: '14px 4px 14px 14px', background: t.accentGradPink, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>escribiendo...</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {isSimulator && (
        <div style={{ padding: '12px', borderTop: `1px solid ${t.border}`, display: 'flex', gap: 8, flexShrink: 0 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendSimMessage()}
            placeholder="Escribe como si fueras un lead..."
            style={{ flex: 1, background: t.surface2, border: `1px solid ${t.border2}`, borderRadius: 10, color: t.text, padding: '8px 12px', fontSize: 12, outline: 'none' }}
          />
          <button onClick={sendSimMessage} style={{ background: t.accentGradPink, border: 'none', borderRadius: 10, color: 'white', width: 36, height: 36, cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>↑</button>
        </div>
      )}
    </div>
  )
}

function InicioView({ t }: { t: typeof THEMES['dark'] }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 56 }}>⌂</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: t.text }}>Inicio</div>
      <div style={{ fontSize: 13, color: t.textMuted }}>Próximamente</div>
    </div>
  )
}

function DashboardView({ leads, messages: allMessages, t }: { leads: Lead[], messages: Message[], t: typeof THEMES['dark'] }) {
  const totalLeads = leads.length
  const hotLeads = leads.filter(l => l.score === 'high').length
  const newToday = leads.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length
  const booked = leads.filter(l => l.status === 'booked').length

  const now = new Date()
  const hourlyData = Array.from({ length: 24 }, (_, i) => {
    const h = new Date(now); h.setHours(now.getHours() - 23 + i, 0, 0, 0)
    const next = new Date(h); next.setHours(h.getHours() + 1)
    const count = allMessages.filter(m => { const d = new Date(m.created_at); return d >= h && d < next }).length
    return { label: `${h.getHours()}h`, count }
  })
  const maxCount = Math.max(...hourlyData.map(d => d.count), 1)

  const scoreData = [
    { label: 'HIGH', count: leads.filter(l => l.score === 'high').length, color: '#F97316' },
    { label: 'MED',  count: leads.filter(l => l.score === 'medium').length, color: '#FBBF24' },
    { label: 'LOW',  count: leads.filter(l => l.score === 'low' || !l.score).length, color: '#94A3B8' },
  ]

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: 'Total Leads', value: totalLeads, icon: '👥', color: '#6366F1' },
          { label: 'High Score',  value: hotLeads,   icon: '🔥', color: '#F97316' },
          { label: 'Reservados',  value: booked,     icon: '✅', color: '#10B981' },
          { label: 'Hoy',         value: newToday,   icon: '✨', color: '#FBBF24' },
        ].map(stat => (
          <div key={stat.label} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: t.shadow }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{stat.icon}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: stat.color, letterSpacing: -1 }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 20, boxShadow: t.shadow }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>📨 Mensajes por hora</div>
          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 16 }}>Últimas 24 horas</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
            {hourlyData.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: '100%', borderRadius: '3px 3px 0 0',
                  height: `${(d.count / maxCount) * 64 + (d.count > 0 ? 4 : 0)}px`,
                  background: d.count > 0 ? t.accentGrad : t.surface2,
                  minHeight: 2,
                }} />
                {i % 6 === 0 && <div style={{ fontSize: 8, color: t.textFaint }}>{d.label}</div>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 20, boxShadow: t.shadow }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>🎯 Score leads</div>
          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 16 }}>Distribución actual</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {scoreData.map(s => (
              <div key={s.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: s.color, fontWeight: 700 }}>{s.label}</span>
                  <span style={{ fontSize: 11, color: t.textMuted }}>{s.count}</span>
                </div>
                <div style={{ height: 6, background: t.surface2, borderRadius: 3 }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${totalLeads > 0 ? (s.count / totalLeads) * 100 : 0}%`, background: s.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 20, boxShadow: t.shadow }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 16 }}>👥 Últimos leads</div>
        {leads.length === 0 && <div style={{ color: t.textFaint, fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Aún no hay leads</div>}
        {leads.slice(0, 6).map(lead => {
          const score = SCORE_CONFIG[lead.score || 'low'] || SCORE_CONFIG['low']
          return (
            <div key={lead.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${t.border}` }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: t.accentGradPink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                {(lead.username || lead.ig_user_id)?.[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{lead.username || lead.ig_user_id}</div>
                {lead.summary && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>{lead.summary}</div>}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: score.color, background: score.bg, padding: '3px 8px', borderRadius: 6 }}>{score.label}</span>
              <div style={{ fontSize: 11, color: t.textFaint }}>{formatRelativeTime(lead.created_at)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LeadsView({ leads, onSelectLead, selectedLead, messages, t }: {
  leads: Lead[]; onSelectLead: (lead: Lead | null) => void; selectedLead: Lead | null; messages: Message[]; t: typeof THEMES['dark']
}) {
  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>Leads</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{leads.length} conversaciones</div>
        </div>

        {/* Cabecera tabla */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1.2fr 2fr 1fr',
          padding: '10px 24px', borderBottom: `1px solid ${t.border}`,
          fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 1.2,
          textTransform: 'uppercase', background: t.surface2, flexShrink: 0,
        }}>
          <span>Información</span>
          <span>Estado</span>
          <span>Último mensaje</span>
          <span>Score</span>
        </div>

        {/* Filas */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {leads.length === 0 && (
            <div style={{ padding: 40, color: t.textFaint, fontSize: 13, textAlign: 'center' }}>
              Cuando alguien escriba a tu Instagram, aparecerá aquí.
            </div>
          )}
          {leads.map(lead => {
            const score = SCORE_CONFIG[lead.score || 'low'] || SCORE_CONFIG['low']
            const isSelected = selectedLead?.id === lead.id

            const estadoConfig: Record<string, { label: string; color: string; bg: string }> = {
              booked:  { label: 'Cliente',  color: '#10B981', bg: '#10B98120' },
              sent:    { label: 'Hablando', color: '#FBBF24', bg: '#FBBF2420' },
              new:     { label: 'Lead',     color: '#6366F1', bg: '#6366F120' },
            }
            const estado = estadoConfig[lead.status || 'new'] || estadoConfig['new']

            return (
              <div key={lead.id} onClick={() => onSelectLead(isSelected ? null : lead)} style={{
                display: 'grid', gridTemplateColumns: '2fr 1.2fr 2fr 1fr',
                padding: '14px 24px', borderBottom: `1px solid ${t.border}`,
                cursor: 'pointer', background: isSelected ? t.surface2 : 'transparent',
                transition: 'background 0.15s', alignItems: 'center',
              }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = t.surface2 }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                {/* Información */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: t.accentGradPink,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 700, color: 'white',
                  }}>
                    {(lead.username || lead.ig_user_id)?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                      {lead.full_name || lead.username || 'Sin nombre'}
                    </div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>
                      @{lead.username || lead.ig_user_id}
                    </div>
                  </div>
                </div>

                {/* Estado */}
                <div>
                  <select
                    value={lead.status || 'new'}
                    onChange={async e => { e.stopPropagation(); await supabase.from('leads').update({ status: e.target.value }).eq('id', lead.id) }}
                    onClick={e => e.stopPropagation()}
                    style={{
                      background: estado.bg, border: `1px solid ${estado.color}50`,
                      color: estado.color, padding: '5px 10px', borderRadius: 8,
                      fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none',
                    }}
                  >
                    <option value="new">Lead</option>
                    <option value="sent">Hablando</option>
                    <option value="booked">Cliente</option>
                  </select>
                </div>

                {/* Último mensaje */}
                <div style={{
                  fontSize: 12, color: t.textMuted, paddingRight: 16,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {lead.summary || '—'}
                </div>

                {/* Score */}
                <div>
                  <select
                    value={lead.score || 'low'}
                    onChange={async e => { e.stopPropagation(); await supabase.from('leads').update({ score: e.target.value }).eq('id', lead.id) }}
                    onClick={e => e.stopPropagation()}
                    style={{
                      background: score.bg, border: `1px solid ${score.color}50`,
                      color: score.color, padding: '5px 10px', borderRadius: 8,
                      fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none',
                    }}
                  >
                    <option value="high">HIGH</option>
                    <option value="medium">MEDIUM</option>
                    <option value="low">LOW</option>
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedLead && (
        <ChatPanel lead={selectedLead} messages={messages} onClose={() => onSelectLead(null)} t={t} />
      )}
    </div>
  )
}

function LinksView({ t }: { t: typeof THEMES['dark'] }) {
  const [resources, setResources] = useState<Array<{ id: string; name: string; url: string; guide_text: string; created_at: string }>>([])
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
    if (editingId) await supabase.from('resources').update({ name: form.name, url: form.url, guide_text: form.guide_text }).eq('id', editingId)
    else await supabase.from('resources').insert({ name: form.name, url: form.url, guide_text: form.guide_text })
    await loadResources()
    setForm({ name: '', url: '', guide_text: '' }); setShowForm(false); setEditingId(null); setSaving(false)
  }

  const inp = { width: '100%', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, padding: '10px 14px', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>Recursos</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>El bot enviará estos links cuando lo considere necesario</div>
        </div>
        <button onClick={() => { setForm({ name: '', url: '', guide_text: '' }); setEditingId(null); setShowForm(true) }} style={{ background: t.accentGradPink, border: 'none', color: 'white', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Añadir recurso</button>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 2fr 80px', padding: '10px 24px', borderBottom: `1px solid ${t.border}`, fontSize: 10, color: t.textMuted, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', background: t.surface2 }}>
            <span>Nombre</span><span>Link</span><span>Texto guía IA</span><span></span>
          </div>
          {resources.length === 0 && <div style={{ padding: 40, color: t.textFaint, fontSize: 13, textAlign: 'center' }}>Añade tu primer recurso</div>}
          {resources.map(r => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 2fr 80px', padding: '14px 24px', borderBottom: `1px solid ${t.border}`, alignItems: 'start' }}>
              <div style={{ fontSize: 13, fontWeight: 600, paddingRight: 16, color: t.text }}>{r.name}</div>
              <div style={{ paddingRight: 16 }}><a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: t.accent, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 200 }}>{r.url}</a></div>
              <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5, paddingRight: 16 }}>{r.guide_text || '—'}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { setForm({ name: r.name, url: r.url, guide_text: r.guide_text || '' }); setEditingId(r.id); setShowForm(true) }} style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text, padding: '5px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer' }}>✏️</button>
                <button onClick={async () => { await supabase.from('resources').delete().eq('id', r.id); setResources(p => p.filter(x => x.id !== r.id)) }} style={{ background: t.surface2, border: `1px solid ${t.border}`, color: '#E1306C', padding: '5px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer' }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
        {showForm && (
          <div style={{ width: 360, flexShrink: 0, borderLeft: `1px solid ${t.border}`, background: t.surface, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{editingId ? 'Editar recurso' : 'Nuevo recurso'}</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
              <div><div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Nombre</div><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Lead Magnet PDF..." style={inp} /></div>
              <div><div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Link</div><input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://..." style={inp} /></div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}><div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Texto guía para la IA</div><textarea value={form.guide_text} onChange={e => setForm(p => ({ ...p, guide_text: e.target.value }))} placeholder="Ej: Envía cuando el lead pida más info..." style={{ ...inp, flex: 1, minHeight: 120, resize: 'none', fontFamily: 'inherit', lineHeight: 1.6 }} /></div>
              <button onClick={saveResource} disabled={saving || !form.name.trim() || !form.url.trim()} style={{ background: t.accentGradPink, border: 'none', color: 'white', padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: !form.name.trim() || !form.url.trim() ? 0.5 : 1 }}>
                {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Añadir recurso'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function InformesView({ t }: { t: typeof THEMES['dark'] }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 56 }}>📈</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: t.text }}>Informes</div>
      <div style={{ fontSize: 13, color: t.textMuted }}>Próximamente</div>
    </div>
  )
}

function AgenteView({ t }: { t: typeof THEMES['dark'] }) {
  const [blocks, setBlocks] = useState<Blocks>({ identidad: '', negocio: '', calificacion: '', ejemplos: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.from('blocks').select('*').limit(1).single().then(({ data }) => {
      if (data) setBlocks({ id: data.id, identidad: data.identidad?.content || '', negocio: data.negocio?.content || '', calificacion: data.calificacion?.content || '', ejemplos: data.ejemplos?.content || '' })
    })
  }, [])

  async function saveBlocks() {
    setSaving(true)
    const payload = { identidad: { content: blocks.identidad }, negocio: { content: blocks.negocio }, calificacion: { content: blocks.calificacion }, ejemplos: { content: blocks.ejemplos }, updated_at: new Date().toISOString() }
    if ((blocks as any).id) await supabase.from('blocks').update(payload).eq('id', (blocks as any).id)
    else { const { data } = await supabase.from('blocks').insert(payload).select().single(); if (data) setBlocks(prev => ({ ...prev, id: data.id })) }
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>Avatar del Agente</div>
            <div style={{ fontSize: 12, color: t.textMuted }}>Define cómo habla y cualifica tu agente de IA</div>
          </div>
          <button onClick={saveBlocks} disabled={saving} style={{ background: saved ? '#10B981' : t.accentGradPink, border: 'none', color: 'white', padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar todo'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {AVATAR_BLOCKS.map(block => (
            <div key={block.key} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: t.shadow }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{block.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{block.label}</div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>{block.desc}</div>
                </div>
              </div>
              <textarea value={blocks[block.key as keyof Blocks] as string} onChange={e => setBlocks(prev => ({ ...prev, [block.key]: e.target.value }))}
                style={{ height: 200, background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, fontSize: 11, lineHeight: 1.8, padding: 14, resize: 'none', outline: 'none', fontFamily: "'SF Mono', 'Fira Code', monospace" }}
                onFocus={e => e.target.style.borderColor = t.accent}
                onBlur={e => e.target.style.borderColor = t.border}
              />
            </div>
          ))}
        </div>
      </div>
      <ChatPanel lead={null} messages={[]} isSimulator t={t} />
    </div>
  )
}

function ConfiguracionView({ theme, setTheme, t }: { theme: Theme; setTheme: (t: Theme) => void; t: typeof THEMES['dark'] }) {
  const [settings, setSettings] = useState({ id: '', response_delay_seconds: 5, active_hours_enabled: false, active_hours_start: '09:00', active_hours_end: '21:00', rules: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.from('settings').select('*').limit(1).single().then(({ data }) => {
      if (data) setSettings({ id: data.id, response_delay_seconds: data.response_delay_seconds ?? 5, active_hours_enabled: data.active_hours_enabled ?? false, active_hours_start: data.active_hours_start ?? '09:00', active_hours_end: data.active_hours_end ?? '21:00', rules: data.rules ?? '' })
    })
  }, [])

  async function saveSettings() {
    setSaving(true)
    const payload = { response_delay_seconds: settings.response_delay_seconds, active_hours_enabled: settings.active_hours_enabled, active_hours_start: settings.active_hours_start, active_hours_end: settings.active_hours_end, rules: settings.rules, updated_at: new Date().toISOString() }
    if (settings.id) await supabase.from('settings').update(payload).eq('id', settings.id)
    else { const { data } = await supabase.from('settings').insert(payload).select().single(); if (data) setSettings(prev => ({ ...prev, id: data.id })) }
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  function formatDelay(s: number) { 
  if (s === 0) return 'Instantáneo'
  if (s < 60) return `${s} seg`
  if (s < 3600) return `${Math.floor(s / 60)} min`
  return `${Math.floor(s / 3600)}h` 
  }
  function sliderToSeconds(v: number) { 
  if (v === 0) return 0
  return Math.round(Math.exp(v * Math.log(1800) / 100)) 
  }
  function secondsToSlider(s: number) { if (s <= 1) return 0; return Math.round((Math.log(s) / Math.log(1800)) * 100) }

  const card = { background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: 24, boxShadow: t.shadow }
  const inp = { width: '100%', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, padding: '10px 14px', fontSize: 16, outline: 'none', boxSizing: 'border-box' as const, colorScheme: theme as any }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>Configuración</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>Comportamiento del agente</div>
        </div>
        <button onClick={saveSettings} disabled={saving} style={{ background: saved ? '#10B981' : t.accentGradPink, border: 'none', color: 'white', padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 660 }}>
        {/* Apariencia */}
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 4 }}>🌗 Apariencia</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 16 }}>Cambia entre modo oscuro y claro</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['dark', 'light'] as Theme[]).map(mode => (
              <button key={mode} onClick={() => setTheme(mode)} style={{
                flex: 1, padding: '10px 0', borderRadius: 10,
                border: `2px solid ${theme === mode ? t.accent : t.border}`,
                background: theme === mode ? `${t.accent}20` : t.surface2,
                color: theme === mode ? t.accent : t.textMuted,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>{mode === 'dark' ? '🌙 Oscuro' : '☀️ Claro'}</button>
            ))}
          </div>
        </div>

        {/* Delay */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>⏱ Tiempo de respuesta</div>
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 3 }}>Pausa antes de responder. El simulador responde al instante.</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.accent, background: `${t.accent}20`, padding: '8px 16px', borderRadius: 10, minWidth: 80, textAlign: 'center' }}>
              {formatDelay(settings.response_delay_seconds)}
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <input type="range" min={0} max={100} value={secondsToSlider(settings.response_delay_seconds)} onChange={e => setSettings(prev => ({ ...prev, response_delay_seconds: sliderToSeconds(Number(e.target.value)) }))} style={{ width: '100%', accentColor: t.accent, height: 6, cursor: 'pointer' }} />
            <div style={{ position: 'relative', height: 20, marginTop: 6 }}>
              {[{ s: 1, l: '1s' }, { s: 30, l: '30s' }, { s: 60, l: '1m' }, { s: 300, l: '5m' }, { s: 900, l: '15m' }, { s: 1800, l: '30m' }].map(m => (
                <span key={m.s} style={{ position: 'absolute', left: `${secondsToSlider(m.s)}%`, transform: 'translateX(-50%)', fontSize: 10, color: settings.response_delay_seconds === m.s ? t.accent : t.textFaint }}>{m.l}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Horario */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>🕐 Horario activo</div>
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 3 }}>Fuera de este horario los mensajes se encolan</div>
            </div>
            <div onClick={() => setSettings(prev => ({ ...prev, active_hours_enabled: !prev.active_hours_enabled }))} style={{ width: 48, height: 26, borderRadius: 13, background: settings.active_hours_enabled ? t.accent : t.border2, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 3, left: settings.active_hours_enabled ? 25 : 3, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
            </div>
          </div>
          {settings.active_hours_enabled && (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Inicio</div>
                <input type="time" value={settings.active_hours_start} onChange={e => setSettings(prev => ({ ...prev, active_hours_start: e.target.value }))} style={inp} />
              </div>
              <div style={{ color: t.textFaint, fontSize: 20, marginTop: 20 }}>→</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Fin</div>
                <input type="time" value={settings.active_hours_end} onChange={e => setSettings(prev => ({ ...prev, active_hours_end: e.target.value }))} style={inp} />
              </div>
            </div>
          )}
        </div>

        {/* Reglas */}
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 4 }}>📋 Reglas del agente</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>Instrucciones finales que el bot siempre seguirá</div>
          <textarea value={settings.rules} onChange={e => setSettings(prev => ({ ...prev, rules: e.target.value }))}
            placeholder={'* Responde siempre en español\n* Máximo 3 mensajes por respuesta\n* Nunca reveles que eres una IA'}
            style={{ width: '100%', minHeight: 160, background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, padding: '12px 14px', fontSize: 13, lineHeight: 1.8, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = t.accent}
            onBlur={e => e.target.style.borderColor = t.border}
          />
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [activeNav, setActiveNav] = useState('dashboard')
  const [leads, setLeads] = useState<Lead[]>([])
  const [allMessages, setAllMessages] = useState<Message[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [theme, setTheme] = useState<Theme>('dark')
  const t = THEMES[theme]

  useEffect(() => { loadLeads() }, [])
  useEffect(() => { loadAllMessages() }, [])
  useEffect(() => { if (selectedLead) loadMessages(selectedLead.id); else setMessages([]) }, [selectedLead])

  useEffect(() => {
    const ch = supabase.channel('leads-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => loadLeads()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  useEffect(() => {
    if (!selectedLead) return
    const ch = supabase.channel('messages-rt').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `lead_id=eq.${selectedLead.id}` }, payload => setMessages(prev => [...prev, payload.new as Message])).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [selectedLead])

  async function loadLeads() {
    const { data } = await supabase.from('leads').select('*').order('updated_at', { ascending: false })
    if (data) setLeads(data)
  }
  async function loadAllMessages() {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true })
    if (data) setAllMessages(data)
  }
  async function loadMessages(leadId: string) {
    const { data } = await supabase.from('messages').select('*').eq('lead_id', leadId).order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: t.bg, color: t.text, fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", overflow: 'hidden', transition: 'background 0.2s, color 0.2s' }}>
      {/* NAV */}
      <div style={{ width: 210, background: t.surface, borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', padding: '20px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 28 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: t.accentGradPink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚡</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.3, color: t.text }}>Setter Mind</div>
            <div style={{ fontSize: 10, color: t.textMuted }}>AutoSetter IA</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setActiveNav(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: 'none',
              background: activeNav === item.id ? t.navActive : 'transparent',
              color: activeNav === item.id ? t.navActiveText : t.navText,
              fontSize: 13, fontWeight: activeNav === item.id ? 600 : 400, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
              {item.id === 'dashboard' && leads.length > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: t.accentGradPink, color: 'white', padding: '2px 6px', borderRadius: 10 }}>{leads.length}</span>
              )}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />
        <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: 'none', background: 'transparent', color: t.textMuted, fontSize: 13, cursor: 'pointer' }}>
          <span style={{ fontSize: 16 }}>↩</span> Cerrar sesión
        </button>
      </div>

      {/* CONTENIDO */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {activeNav === 'inicio'        && <InicioView t={t} />}
        {activeNav === 'dashboard'     && <DashboardView leads={leads} messages={allMessages} t={t} />}
        {activeNav === 'leads'         && <LeadsView leads={leads} onSelectLead={setSelectedLead} selectedLead={selectedLead} messages={messages} t={t} />}
        {activeNav === 'links'         && <LinksView t={t} />}
        {activeNav === 'informes'      && <InformesView t={t} />}
        {activeNav === 'agente'        && <AgenteView t={t} />}
        {activeNav === 'configuracion' && <ConfiguracionView theme={theme} setTheme={setTheme} t={t} />}
      </div>
    </div>
  )
}