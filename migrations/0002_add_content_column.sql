-- CollabDocs Migration: Add content column to documents
-- Migration: 0002_add_content_column.sql

-- Adicionar coluna content para armazenar o texto do documento
ALTER TABLE documents ADD COLUMN content TEXT DEFAULT '';

-- Atualizar documentos existentes com conteúdo padrão
UPDATE documents SET content = '# Novo Documento

## Bem-vindo ao CollabDocs! 🎉

Este é um documento em branco. Comece a digitar para criar seu conteúdo.

### ✨ Funcionalidades Disponíveis

- **Edição em tempo real** - Veja as alterações instantaneamente
- **Salvamento automático** - Seu trabalho é preservado automaticamente
- **Histórico de versões** - Acompanhe todas as mudanças
- **Colaboração simultânea** - Múltiplos usuários podem editar juntos

### 🚀 Como Usar

1. **Digite** no editor abaixo
2. **Clique em Salvar** para persistir suas alterações
3. **Compartilhe** o documento com sua equipe
4. **Colabore** em tempo real

*Este documento foi criado automaticamente. Experimente editar o conteúdo!*' WHERE content IS NULL OR content = '';

-- Criar índice para melhorar performance de busca por conteúdo
CREATE INDEX idx_documents_content ON documents(content);
