-- Adicionar coluna content à tabela documents se não existir
ALTER TABLE documents ADD COLUMN content TEXT DEFAULT '';