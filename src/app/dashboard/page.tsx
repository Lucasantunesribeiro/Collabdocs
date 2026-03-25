'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Dashboard from '@/components/Dashboard'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/signin')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!session) return null

  return <Dashboard />
}
