import { CollaborativeEditor } from '@/components/CollaborativeEditor';

export default function DocumentPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Documento Colaborativo
        </h1>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="text-center text-gray-500 py-20">
            <div className="text-4xl mb-4">📝</div>
            <p className="text-lg font-medium">Editor Colaborativo</p>
            <p className="text-sm">Funcionalidade em desenvolvimento</p>
          </div>
        </div>
      </div>
    </div>
  );
}