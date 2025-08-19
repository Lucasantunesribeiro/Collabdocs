'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

interface LoginPageProps {
  onLogin?: (user: any) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
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
        // Simular um token JWT
        const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI${userData.id}IiwibmFtZSI6Ii${userData.name}IiwiZW1haWwiOiIi${userData.email}IiwiYXZhdGFyX3VybCI6Ii${userData.avatar_url || ''}IiwicHJvdmlkZXIiOiIi${userData.provider}IiwiZXhwIjoxNzM0NzI5NjAwLCJpYXQiOjE3MzQ3MjYwMDB9.signature`;
        
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
    
    if (onLogin) {
      onLogin(demoUser);
    }
    
    // Salvar no localStorage para persistir
    localStorage.setItem('collabdocs_user', JSON.stringify(demoUser));
    localStorage.setItem('collabdocs_token', 'demo-token');
    
    // Recarregar a página para aplicar as mudanças
    window.location.reload();
  };

  // Se já estiver logado, mostrar mensagem
  if (user) {
    return (
      <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 p-8 animate-slide-up">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-2xl">✅</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Já está logado!
          </h2>
          <p className="text-gray-600 text-lg mb-4">
            Bem-vindo, {user.name}!
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            Ir para o Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 p-8 animate-slide-up">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-2xl">🔐</span>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Bem-vindo ao CollabDocs
        </h2>
        <p className="text-gray-600 text-lg">
          Faça login para começar a colaborar
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* GitHub Login */}
        <button
          onClick={handleGitHubLogin}
          disabled={isLoading}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-1 group"
        >
          <svg className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          Entrar com GitHub
        </button>

        {/* Google Login */}
        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-4 px-6 rounded-2xl border-2 border-gray-200 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-1 group"
        >
          <svg className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Entrar com Google
        </button>

        {/* Separador */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300/50"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white/90 text-gray-500 font-medium">ou</span>
          </div>
        </div>

        {/* Demo Mode */}
        <button
          onClick={handleDemoMode}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-1 group"
        >
          <svg className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Modo Demo
        </button>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <div className="flex items-center justify-center gap-2 text-blue-700 mb-2">
            <span className="text-lg">💡</span>
            <span className="font-medium">Dica</span>
          </div>
          <p className="text-blue-600 text-sm">
            Use "Modo Demo" para testar o sistema sem criar uma conta
          </p>
        </div>
      </div>

      {/* Status dos serviços */}
      <div className="mt-6 pt-6 border-t border-gray-200/50">
        <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>OAuth Ativo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span>Frontend Ativo</span>
          </div>
        </div>
      </div>
    </div>
  );
}