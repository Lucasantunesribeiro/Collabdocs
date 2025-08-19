'use client';

import { useState } from 'react';

export function LoginPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLogin = () => {
    setIsLoggedIn(true);
    alert('Sistema de autenticação em desenvolvimento!');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  if (isLoggedIn) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <div className="text-2xl">✅</div>
        </div>
        <h3 className="text-lg font-medium text-gray-900">Logado com Sucesso!</h3>
        <p className="text-sm text-gray-600">Usuário: Usuário Demo</p>
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Sair
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          🔐 Autenticação
        </h3>
        <p className="text-sm text-gray-600">
          Faça login para acessar o sistema
        </p>
      </div>
      
      <div className="space-y-3">
        <button
          onClick={handleLogin}
          className="w-full bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <span>🐙</span>
          Entrar com GitHub
        </button>
        
        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <span>🔍</span>
          Entrar com Google
        </button>
        
        <button
          onClick={handleLogin}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <span>👤</span>
          Modo Demo
        </button>
      </div>
      
      <div className="text-center text-xs text-gray-500">
        <p>Funcionalidade em desenvolvimento</p>
        <p>Use "Modo Demo" para testar</p>
      </div>
    </div>
  );
}