'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { LoginPage } from '@/components/LoginPage'

function SignInContent() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const error = searchParams.get('error') || undefined

  return <LoginPage error={error} callbackUrl={callbackUrl} />
}

export default function SignIn() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  )
}
