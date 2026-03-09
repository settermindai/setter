'use client'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const supabase = createClient()

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`
      }
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#09090B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#FAFAFA', fontSize: 32, marginBottom: 8 }}>AutoSetter IA</h1>
        <p style={{ color: '#52525B', marginBottom: 32 }}>Tu sistema de leads para Instagram</p>
        <button
          onClick={handleLogin}
          style={{ padding: '14px 28px', background: 'linear-gradient(135deg, #7C3AED, #A855F7)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
        >
          Continuar con Google
        </button>
      </div>
    </div>
  )
}