'use client'

import { getProviders, signIn, getSession } from 'next-auth/react'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface Provider {
  id: string
  name: string
  type: string
  signinUrl: string
  callbackUrl: string
}

function SignInContent() {
  const [providers, setProviders] = useState<Record<string, Provider>>({})
  const [loading, setLoading] = useState(true)
  const [signingIn, setSigningIn] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const error = searchParams.get('error')

  useEffect(() => {
    // Verificar se já está logado
    getSession().then((session) => {
      if (session) {
        console.log('[SignIn] User already authenticated, redirecting...')
        router.push(callbackUrl)
        return
      }
    })

    // Carregar providers disponíveis
    getProviders().then((providers) => {
      if (providers) {
        setProviders(providers)
        console.log('[SignIn] Providers loaded:', Object.keys(providers))
      }
      setLoading(false)
    })
  }, [callbackUrl, router])

  const handleSignIn = async (providerId: string) => {
    try {
      setSigningIn(providerId)
      console.log('[SignIn] Starting sign in with provider:', providerId)
      
      const result = await signIn(providerId, {
        callbackUrl,
        redirect: true
      })
      
      if (result?.error) {
        console.error('[SignIn] Error:', result.error)
        setSigningIn(null)
      }
    } catch (error) {
      console.error('[SignIn] Sign in failed:', error)
      setSigningIn(null)
    }
  }

  const getProviderButtonText = (providerId: string) => {
    switch (providerId) {
      case 'google':
        return 'Continuar com Google'
      case 'github':
        return 'Continuar com GitHub'
      default:
        return `Continuar com ${providers[providerId]?.name}`
    }
  }

  const getProviderIcon = (providerId: string) => {
    switch (providerId) {
      case 'google':
        return '🔍'
      case 'github':
        return '🐙'
      default:
        return '🔐'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Entre na sua conta
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            ColabDocs - Documentos colaborativos
          </p>
        </div>
        
        <Card className="p-8">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">
                {error === 'InvalidSession' && 'Sessão inválida. Faça login novamente.'}
                {error === 'Callback' && 'Erro no callback de autenticação.'}
                {error === 'OAuthCallback' && 'Erro na autenticação OAuth.'}
                {error === 'Verification' && 'Erro na verificação do email.'}
                {!['InvalidSession', 'Callback', 'OAuthCallback', 'Verification'].includes(error) && 'Erro na autenticação.'}
              </p>
            </div>
          )}

          <div className="space-y-4">
            {Object.values(providers).map((provider) => (
              <Button
                key={provider.id}
                onClick={() => handleSignIn(provider.id)}
                disabled={signingIn !== null}
                className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {signingIn === provider.id ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Conectando...
                  </>
                ) : (
                  <>
                    <span className="mr-2">{getProviderIcon(provider.id)}</span>
                    {getProviderButtonText(provider.id)}
                  </>
                )}
              </Button>
            ))}
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Login seguro via OAuth
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Ao fazer login, você concorda com nossos termos de uso.
              Seus dados são protegidos e não são compartilhados.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default function SignIn() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando página de login...</p>
        </div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  )
}