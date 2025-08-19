'use client';

import { useState } from 'react';

export function Dashboard() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleCreateDocument = () => {
    alert('Funcionalidade de criação de documentos em desenvolvimento!');
  };

  return (
    <div className="space-y-6">
      {/* Documentos de Exemplo */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Documentos Recentes</h3>
        
        <div className="grid gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-blue-900">📋 Documento de Exemplo 1</h4>
                <p className="text-sm text-blue-700">Criado há 2 horas</p>
              </div>
              <button className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm">
                Abrir
              </button>
            </div>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-green-900">📝 Documento de Exemplo 2</h4>
                <p className="text-sm text-green-700">Criado há 1 dia</p>
              </div>
              <button className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm">
                Abrir
              </button>
            </div>
          </div>
          
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-purple-900">📊 Documento de Exemplo 3</h4>
                <p className="text-sm text-purple-700">Criado há 3 dias</p>
              </div>
              <button className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-sm">
                Abrir
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Botão Criar Documento */}
      <div className="text-center">
        <button
          onClick={handleCreateDocument}
          className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          ✨ Criar Novo Documento
        </button>
      </div>
      
      {/* Estatísticas */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-indigo-600">3</div>
          <div className="text-sm text-gray-600">Documentos</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">12</div>
          <div className="text-sm text-gray-600">Colaboradores</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">24h</div>
          <div className="text-sm text-gray-600">Ativo</div>
        </div>
      </div>
    </div>
  );
}