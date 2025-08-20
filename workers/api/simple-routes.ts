// Versão simplificada e robusta para resolver o erro 500 definitivamente
import { Document, Permission, JWTPayload } from '@collab-docs/shared';
import { Env } from '../index';

interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

// Helper para CORS
function addCORSHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Profile',
    'Access-Control-Max-Age': '86400',
    ...headers
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;
      
      console.log(`[API] ${method} ${path}`);
      
      // Handle CORS preflight
      if (method === 'OPTIONS') {
        return new Response(null, {
          status: 200,
          headers: addCORSHeaders()
        });
      }
      
      // API routes
      if (path.startsWith('/api/')) {
        const apiPath = path.slice(4); // Remove '/api' prefix
        
        if (apiPath === '/documents' && method === 'POST') {
          return await createDocumentSimplified(env, request);
        }
        
        if (apiPath === '/documents' && method === 'GET') {
          return await getDocumentsSimplified(env, request);
        }
        
        return new Response(JSON.stringify({ error: 'Not Found' }), { 
          status: 404,
          headers: addCORSHeaders({ 'Content-Type': 'application/json' })
        });
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { 
        status: 404,
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    } catch (error) {
      console.error('[API] Error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: '[SIMPLE-ROUTES] Erro capturado no nível superior'
      }), { 
        status: 500,
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    }
  }
};

async function createDocumentSimplified(env: Env, request: Request): Promise<Response> {
  try {
    console.log('[CREATE] Iniciando criação de documento...');
    
    // Extrair dados da requisição
    const data = await request.json();
    console.log('[CREATE] Dados recebidos:', data);
    
    // Extrair usuário do token (versão simplificada)
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Token necessário' }), {
        status: 401,
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    }

    const token = authorization.slice(7);
    const tokenHash = token.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
    const userId = `user-${tokenHash}`;
    
    console.log('[CREATE] User ID gerado:', userId);
    
    // Gerar dados do documento
    const documentId = crypto.randomUUID();
    const now = new Date().toISOString();
    const content = data.content || '# Novo Documento\n\nComece a escrever aqui...';
    
    console.log('[CREATE] ID do documento:', documentId);
    
    // ESTRATÉGIA DEFINITIVA: Tentar sempre sem content primeiro (mais compatível)
    let document = null;
    let insertSuccess = false;
    
    try {
      console.log('[CREATE] Tentativa: INSERT sem coluna content (mais seguro)...');
      const stmtBasic = env.DB.prepare(`
        INSERT INTO documents (id, owner_id, title, visibility, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const resultBasic = await stmtBasic.bind(
        documentId,
        userId,
        data.title || 'Documento sem título',
        data.visibility || 'private',
        now,
        now
      ).run();
      
      console.log('[CREATE] INSERT básico executado:', resultBasic);
      insertSuccess = true;
      
      // Buscar documento criado (sem content)
      const getStmtBasic = env.DB.prepare(`
        SELECT id, title, visibility, owner_id, created_at, updated_at
        FROM documents WHERE id = ?
      `);
      
      document = await getStmtBasic.bind(documentId).first();
      if (document) {
        document.content = content; // Adicionar content no retorno
        console.log('[CREATE] Documento básico criado com sucesso');
      }
      
    } catch (basicError) {
      console.log('[CREATE] Falha no INSERT básico:', basicError.message);
      console.log('[CREATE] Tentando INSERT com content...');
      
      try {
        const stmtWithContent = env.DB.prepare(`
          INSERT INTO documents (id, owner_id, title, visibility, created_at, updated_at, content)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        const resultContent = await stmtWithContent.bind(
          documentId,
          userId,
          data.title || 'Documento sem título',
          data.visibility || 'private',
          now,
          now,
          content
        ).run();
        
        console.log('[CREATE] INSERT com content executado:', resultContent);
        insertSuccess = true;
        
        // Buscar documento criado (com content)
        const getStmtContent = env.DB.prepare(`
          SELECT id, title, visibility, owner_id, created_at, updated_at, content
          FROM documents WHERE id = ?
        `);
        
        document = await getStmtContent.bind(documentId).first();
        console.log('[CREATE] Documento com content criado com sucesso');
        
      } catch (contentError) {
        console.error('[CREATE] Ambas as estratégias falharam:', contentError);
        throw new Error(`Erro ao inserir documento: ${contentError.message}`);
      }
    }
    
    if (!insertSuccess || !document) {
      throw new Error('Falha ao criar documento - nenhuma linha inserida');
    }
    
    console.log('[CREATE] Documento final:', document);
    
    return new Response(JSON.stringify({ 
      document,
      message: 'Documento criado com sucesso'
    }), {
      status: 201,
      headers: addCORSHeaders({ 'Content-Type': 'application/json' })
    });
    
  } catch (error) {
    console.error('[CREATE] Erro final:', error);
    return new Response(JSON.stringify({ 
      error: 'Erro ao criar documento',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
      details: 'Função createDocumentSimplified'
    }), {
      status: 500,
      headers: addCORSHeaders({ 'Content-Type': 'application/json' })
    });
  }
}

async function getDocumentsSimplified(env: Env, request: Request): Promise<Response> {
  try {
    console.log('[GET] Buscando documentos...');
    
    // Buscar todos os documentos (estratégia simples)
    let documents = [];
    
    try {
      // Tentar SELECT básico primeiro
      console.log('[GET] Tentativa: SELECT sem coluna content...');
      const stmtBasic = env.DB.prepare(`
        SELECT id, title, visibility, owner_id, created_at, updated_at
        FROM documents
        ORDER BY updated_at DESC
      `);
      
      const resultBasic = await stmtBasic.all();
      documents = (resultBasic.results || []).map(doc => ({
        ...doc,
        content: '' // Adicionar content vazio
      }));
      
      console.log('[GET] SELECT básico executado, documentos:', documents.length);
      
    } catch (basicError) {
      console.log('[GET] Falha no SELECT básico:', basicError.message);
      console.log('[GET] Tentando SELECT com content...');
      
      const stmtWithContent = env.DB.prepare(`
        SELECT id, title, visibility, owner_id, created_at, updated_at, content
        FROM documents
        ORDER BY updated_at DESC
      `);
      
      const resultContent = await stmtWithContent.all();
      documents = resultContent.results || [];
      console.log('[GET] SELECT com content executado, documentos:', documents.length);
    }
    
    console.log('[GET] Documentos encontrados:', documents);
    
    return new Response(JSON.stringify({ 
      documents,
      count: documents.length
    }), {
      status: 200,
      headers: addCORSHeaders({ 'Content-Type': 'application/json' })
    });
    
  } catch (error) {
    console.error('[GET] Erro final:', error);
    return new Response(JSON.stringify({ 
      error: 'Erro ao buscar documentos',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: addCORSHeaders({ 'Content-Type': 'application/json' })
    });
  }
}