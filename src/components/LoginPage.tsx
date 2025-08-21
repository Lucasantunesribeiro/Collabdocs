'use client';

import { useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { Card, CardContent } from './ui/Card';
import { Github, Chrome, User, CheckCircle, Info, Loader } from 'lucide-react';

interface LoginPageProps {
  error?: string;
  callbackUrl?: string;
}

export function LoginPage({ error, callbackUrl }: LoginPageProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const { data: session, status } = useSession();
  const router = useRouter();

  const handleLogin = async (provider: 'github' | 'google') => {
    setIsLoading(provider);
    
    try {
      const result = await signIn(provider, {
        callbackUrl: callbackUrl || '/',
        redirect: true,
      });
      
      if (result?.error) {
        console.error('Login error:', result.error);
      }
    } catch (error) {
      console.error(`Erro no login ${provider}:`, error);
    } finally {
      setIsLoading(null);
    }
  };

  // Se está carregando
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-50 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-600" />
            <p className="text-text-600">Verificando autenticação...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Se já estiver logado, redirecionar
  if (session?.user) {
    router.push(callbackUrl || '/');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-50 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-success-600" />
            </div>
            <h2 className="text-2xl font-semibold text-text-900 mb-2">
              Já está logado!
            </h2>
            <p className="text-text-600 mb-6">
              Bem-vindo, {session.user.name}!
            </p>
            <p className="text-sm text-text-500">
              Redirecionando...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-50 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-primary-600" />
            </div>
            <h1 className="text-2xl font-semibold text-text-900 mb-2">
              CollabDocs
            </h1>
            <p className="text-text-600">
              Editor colaborativo seguro
            </p>
          </div>

          {/* Mensagem de erro */}
          {error && (
            <Alert type="error" className="mb-6">
              {error === 'OAuthCallback' && 'Erro na autenticação OAuth. Tente novamente.'}
              {error === 'AccessDenied' && 'Acesso negado. Verifique suas permissões.'}
              {error === 'Verification' && 'Token de verificação inválido.'}
              {!['OAuthCallback', 'AccessDenied', 'Verification'].includes(error) && 
                `Erro: ${error}`}
            </Alert>
          )}

          {/* Botões de login */}
          <div className="space-y-3 mb-6">
            <Button
              onClick={() => handleLogin('github')}
              disabled={isLoading !== null}
              variant="secondary"
              size="lg"
              className="w-full"
            >
              {isLoading === 'github' ? (
                <>
                  <Loader className="w-4 h-4 animate-spin mr-2" />
                  Entrando...
                </>
              ) : (
                <>
                  <Github className="w-4 h-4 mr-2" />
                  Entrar com GitHub
                </>
              )}
            </Button>

            <Button
              onClick={() => handleLogin('google')}
              disabled={isLoading !== null}
              variant="secondary"
              size="lg"
              className="w-full"
            >
              {isLoading === 'google' ? (
                <>
                  <Loader className="w-4 h-4 animate-spin mr-2" />
                  Entrando...
                </>
              ) : (
                <>
                  <Chrome className="w-4 h-4 mr-2" />
                  Entrar com Google
                </>
              )}
            </Button>
          </div>

          {/* Informação de segurança */}
          <div className="mt-6 p-4 bg-info-50 rounded-lg border border-info-200">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-info-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Info className="w-3 h-3 text-info-600" />
              </div>
              <div className="text-sm text-info-700">
                <p className="font-medium mb-1">Autenticação Segura</p>
                <p>Login OAuth com GitHub ou Google para garantir segurança dos seus documentos</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}