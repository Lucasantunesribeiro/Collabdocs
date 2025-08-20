'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { Card, CardContent } from './ui/Card';
import { Github, Chrome, User, CheckCircle, Info } from 'lucide-react';

export function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, login } = useAuth();

  // Verificar se há dados de usuário na URL (OAuth callback)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('user');
    const errorParam = urlParams.get('error');
    
    if (errorParam) {
      setError(`Erro na autenticação: ${errorParam}`);
      // Limpar a URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
    
    if (userParam) {
      try {
        const userData = JSON.parse(decodeURIComponent(userParam));
        console.log('Dados OAuth recebidos:', userData);
        
        // Mapear dados OAuth para o formato JWTPayload
        const jwtPayload = {
          sub: userData.id,
          email: userData.email || 'no-email@example.com',
          name: userData.name,
          avatar_url: userData.avatar_url,
          provider: userData.provider,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 horas
        };
        
        // Simular um token JWT com os dados corretos
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payload = btoa(JSON.stringify(jwtPayload));
        const token = `${header}.${payload}.signature`;
        
        console.log('Token JWT gerado:', token);
        console.log('Payload JWT:', jwtPayload);
        
        login(token);
        
        // Limpar a URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Redirecionar para a página principal
        window.location.href = '/';
      } catch (error) {
        console.error('Error parsing user data:', error);
        setError('Erro ao processar dados do usuário');
      }
    }
  }, [login]);

  const handleGitHubLogin = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Redirecionar para a rota de autenticação GitHub
      window.location.href = '/api/auth/[...nextauth]?provider=github';
    } catch (error) {
      console.error('Erro no login GitHub:', error);
      setError('Erro ao fazer login com GitHub');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Redirecionar para a rota de autenticação Google
      window.location.href = '/api/auth/[...nextauth]?provider=google';
    } catch (error) {
      console.error('Erro no login Google:', error);
      setError('Erro ao fazer login com Google');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoMode = () => {
    // Modo demo com dados simulados
    const demoUser = {
      id: 'demo-user',
      name: 'Usuário Demo',
      email: 'demo@collabdocs.com',
      avatar_url: null,
      provider: 'demo'
    };
    
    // Salvar no localStorage para persistir
    localStorage.setItem('collabdocs_user', JSON.stringify(demoUser));
    localStorage.setItem('collabdocs_token', 'demo-token');
    
    // Recarregar a página para aplicar as mudanças
    window.location.reload();
  };

  // Se já estiver logado, mostrar mensagem
  if (user) {
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
              Bem-vindo, {user.name}!
            </p>
            <Button
              onClick={() => window.location.href = '/'}
              size="lg"
              className="w-full"
            >
              Ir para o Dashboard
            </Button>
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
              Acesse sua conta
            </h1>
            <p className="text-text-600">
              Faça login para começar a colaborar
            </p>
          </div>

          {/* Mensagem de erro */}
          {error && (
            <Alert type="error" className="mb-6">
              {error}
            </Alert>
          )}

          {/* Botões de login */}
          <div className="space-y-3 mb-6">
            <Button
              onClick={handleGitHubLogin}
              disabled={isLoading}
              variant="secondary"
              size="lg"
              icon={Github}
              className="w-full"
            >
              Entrar com GitHub
            </Button>

            <Button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              variant="secondary"
              size="lg"
              icon={Chrome}
              className="w-full"
            >
              Entrar com Google
            </Button>
          </div>

          {/* Separador */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-text-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-text-500 font-medium">ou</span>
            </div>
          </div>

          {/* Modo Demo */}
          <Button
            onClick={handleDemoMode}
            disabled={isLoading}
            size="lg"
            className="w-full"
          >
            Modo Demo
          </Button>

          {/* Dica */}
          <div className="mt-6 p-4 bg-info-50 rounded-lg border border-info-200">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-info-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Info className="w-3 h-3 text-info-600" />
              </div>
              <div className="text-sm text-info-700">
                <p className="font-medium mb-1">Dica</p>
                <p>Use "Modo Demo" para testar o sistema sem criar uma conta</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}