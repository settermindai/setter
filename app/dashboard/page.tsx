import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Dashboard() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  return (
    <div style={{ background: '#09090B', minHeight: '100vh', color: '#FAFAFA', padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Bienvenido, {user.email} ✅</h1>
      <p style={{ color: '#52525B', marginTop: 8 }}>Login funcionando correctamente</p>
    </div>
  )
}