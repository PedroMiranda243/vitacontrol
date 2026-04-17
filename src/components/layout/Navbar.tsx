'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface NavbarProps {
  userName: string
  userRole: string
}

export default function Navbar({ userName, userRole }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  const isAdmin = userRole === 'ADMIN'

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    ...(isAdmin ? [
      { href: '/upload', label: 'Novo Lançamento', icon: '📤' },
      { href: '/upload/history', label: 'Histórico', icon: '📋' },
    ] : []),
  ]

  const handleSignOut = async () => {
    const { signOut } = await import('next-auth/react')
    signOut({ callbackUrl: '/login' })
  }

  return (
    <nav className="sticky top-0 z-40 w-full">
      <div className="glass-card rounded-none border-x-0 border-t-0" style={{ borderRadius: 0 }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-teal-500/20">
                VC
              </div>
              <span className="font-bold text-lg gradient-text hidden sm:block">
                VitaControl
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                    pathname === item.href
                      ? 'bg-teal-500/15 text-teal-400 border border-teal-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  )}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>

            {/* User info + Sign out */}
            <div className="hidden md:flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm font-medium text-slate-200">{userName}</div>
                <div className="text-xs text-slate-500">
                  {isAdmin ? 'Administrador' : 'Visualização'}
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="btn btn-ghost btn-sm"
                id="btn-sign-out"
              >
                Sair
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
              id="btn-mobile-menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {mobileMenuOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M3 12h18M3 6h18M3 18h18" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-700/30 animate-fade-in">
            <div className="p-4 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                    pathname === item.href
                      ? 'bg-teal-500/15 text-teal-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  )}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
              <div className="pt-4 mt-4 border-t border-slate-700/30">
                <div className="px-4 mb-3">
                  <div className="text-sm font-medium text-slate-200">{userName}</div>
                  <div className="text-xs text-slate-500">
                    {isAdmin ? 'Administrador' : 'Visualização'}
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full btn btn-secondary btn-sm"
                >
                  Sair
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
