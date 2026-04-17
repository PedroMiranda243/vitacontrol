import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import { SessionProvider } from 'next-auth/react'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-navy-950">
        <Navbar
          userName={session.user?.name || 'Usuário'}
          userRole={session.user?.role || 'VIEWER'}
        />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
      </div>
    </SessionProvider>
  )
}
