'use client';

import { useState } from 'react';
import { Document } from '@/lib/api';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { 
  FileText, 
  Eye, 
  Edit, 
  Trash2, 
  MoreVertical, 
  Clock, 
  RefreshCw, 
  User,
  Lock,
  Globe
} from 'lucide-react';

interface DocumentCardProps {
  document: Document;
  onDelete: (id: string) => void;
  formatTimeAgo: (dateString: string) => string;
}

export function DocumentCard({ document, onDelete, formatTimeAgo }: DocumentCardProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  const handleDelete = () => {
    if (confirm('Tem certeza que deseja deletar este documento?')) {
      onDelete(document.id);
    }
    setShowDropdown(false);
  };

  const handleOpen = () => {
    // Redirecionar para a página do documento
    window.location.href = `/document/${document.id}`;
  };

  const handleEdit = () => {
    // Redirecionar para a página de edição do documento
    window.location.href = `/document/${document.id}?edit=true`;
  };

  const getVisibilityIcon = () => {
    return document.visibility === 'private' ? Lock : Globe;
  };

  const getVisibilityColor = () => {
    return document.visibility === 'private' 
      ? 'bg-warning-100 text-warning-800 border-warning-200' 
      : 'bg-success-100 text-success-800 border-success-200';
  };

  const VisibilityIcon = getVisibilityIcon();

  return (
    <Card hover>
      <CardContent>
        {/* Header do Card */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-text-900 group-hover:text-primary-600 transition-colors duration-200">
                  {document.title}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getVisibilityColor()}`}>
                    <VisibilityIcon className="w-3 h-3 mr-1" />
                    {document.visibility === 'private' ? 'Privado' : 'Público'}
                  </span>
                </div>
                
                {/* Informações do proprietário */}
                <div className="flex items-center gap-2 mt-3">
                  {document.owner_avatar_url ? (
                    <img 
                      src={document.owner_avatar_url} 
                      alt={`Avatar de ${document.owner_name || 'Usuário'}`}
                      className="w-5 h-5 rounded-full object-cover border border-text-200"
                    />
                  ) : (
                    <div className="w-5 h-5 bg-primary-100 rounded-full flex items-center justify-center">
                      <User className="w-3 h-3 text-primary-600" />
                    </div>
                  )}
                  <span className="text-sm text-text-600">
                    Criado por <span className="font-medium text-text-700">{document.owner_name || 'Usuário Demo'}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Menu de ações */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              icon={MoreVertical}
              onClick={() => setShowDropdown(!showDropdown)}
              className="p-2"
            >
              {' '}
            </Button>
            
            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-large border border-text-200 z-10 animate-slide-up">
                <div className="py-2">
                  <button
                    onClick={handleOpen}
                    className="w-full px-4 py-3 text-left text-text-700 hover:bg-primary-50 hover:text-primary-600 transition-colors duration-200 flex items-center gap-3 group"
                  >
                    <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center group-hover:bg-primary-200 transition-colors duration-200">
                      <Eye className="w-4 h-4 text-primary-600" />
                    </div>
                    <span className="font-medium">Abrir</span>
                  </button>
                  
                  <button
                    onClick={handleEdit}
                    className="w-full px-4 py-3 text-left text-text-700 hover:bg-success-50 hover:text-success-600 transition-colors duration-200 flex items-center gap-3 group"
                  >
                    <div className="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center group-hover:bg-success-200 transition-colors duration-200">
                      <Edit className="w-4 h-4 text-success-600" />
                    </div>
                    <span className="font-medium">Editar</span>
                  </button>
                  
                  <div className="border-t border-text-200 my-1"></div>
                  
                  <button
                    onClick={handleDelete}
                    className="w-full px-4 py-3 text-left text-error-600 hover:bg-error-50 transition-colors duration-200 flex items-center gap-3 group"
                  >
                    <div className="w-8 h-8 bg-error-100 rounded-lg flex items-center justify-center group-hover:bg-error-200 transition-colors duration-200">
                      <Trash2 className="w-4 h-4 text-error-600" />
                    </div>
                    <span className="font-medium">Deletar</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Informações do documento */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-900">Criado</p>
                <p className="text-sm text-text-600">{formatTimeAgo(document.created_at)}</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-success-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-900">Atualizado</p>
                <p className="text-sm text-text-600">{formatTimeAgo(document.updated_at)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer do Card */}
        <div className="mt-6 pt-4 border-t border-text-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {document.owner_avatar_url ? (
                  <img 
                    src={document.owner_avatar_url} 
                    alt={`Avatar de ${document.owner_name || 'Usuário'}`}
                    className="w-6 h-6 rounded-full object-cover border-2 border-white shadow-soft"
                  />
                ) : (
                  <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                    <User className="w-3 h-3 text-primary-600" />
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-xs text-text-500">Proprietário</span>
                  <span className="text-sm font-medium text-text-700">
                    {document.owner_name || 'Usuário Demo'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse-soft"></div>
              <span className="text-xs text-text-500">Online</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}