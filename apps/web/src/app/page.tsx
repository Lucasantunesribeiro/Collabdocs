import { Dashboard } from '@/components/Dashboard';
import { LoginPage } from '@/components/LoginPage';

export default function HomePage() {
  // Para export estático, sempre mostrar o dashboard
  // A autenticação será implementada no cliente
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🚀 CollabDocs
          </h1>
          <p className="text-xl text-gray-600">
            Sistema de Documentos Colaborativos
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              📝 Dashboard
            </h2>
            <Dashboard />
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              🔐 Autenticação
            </h2>
            <LoginPage />
          </div>
        </div>
      </div>
    </div>
  );
}