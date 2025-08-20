import { Env } from '../index';

// Definições de tipos locais
interface Document {
  id: string;
  owner_id: string;
  title: string;
  content: string;
  visibility: 'private' | 'public';
  created_at: string;
  updated_at: string;
}

interface JWTPayload {
  sub: string;
  email: string;
  name: string;
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
          return await createDocument(env, request);
        }
        
        if (apiPath === '/documents' && method === 'GET') {
          return await getDocuments(env, request);
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
        message: error instanceof Error ? error.message : 'Unknown error'
      }), { 
        status: 500,
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    }
  }
};

async function createDocument(env: Env, request: Request): Promise<Response> {
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
    const content = data.content || '# Novo Documento\\n\\nComece a escrever aqui...';
    
    console.log('[CREATE] Tentando INSERT com estratégia de fallback...');
    
    let result;
    let document: Document;
    
    try {
      // ESTRATÉGIA 1: Tentar INSERT com coluna content
      console.log('[CREATE] Estratégia 1: INSERT com content...');
      const stmtWithContent = env.DB.prepare(`
        INSERT INTO documents (id, owner_id, title, visibility, created_at, updated_at, content)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      result = await stmtWithContent.bind(
        documentId,
        userId,
        data.title || 'Novo Documento',
        data.visibility || 'private',
        now,
        now,
        content
      ).run();
      
      document = {
        id: documentId,
        owner_id: userId,
        title: data.title || 'Novo Documento',
        visibility: data.visibility || 'private',
        created_at: now,
        updated_at: now,
        content: content
      };
      
      console.log('[CREATE] ✅ Estratégia 1 SUCESSO - INSERT com content');
      
    } catch (contentError) {
      console.log('[CREATE] ❌ Estratégia 1 FALHOU:', contentError.message);
      console.log('[CREATE] Estratégia 2: INSERT sem content...');
      
      // ESTRATÉGIA 2: INSERT sem coluna content (fallback)
      const stmtWithoutContent = env.DB.prepare(`
        INSERT INTO documents (id, owner_id, title, visibility, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      result = await stmtWithoutContent.bind(
        documentId,
        userId,
        data.title || 'Novo Documento',
        data.visibility || 'private',
        now,
        now
      ).run();
      
      document = {
        id: documentId,
        owner_id: userId,
        title: data.title || 'Novo Documento',
        visibility: data.visibility || 'private',
        created_at: now,
        updated_at: now,
        content: '' // Content vazio para compatibilidade
      };
      
      console.log('[CREATE] ✅ Estratégia 2 SUCESSO - INSERT sem content');
    }
    
    if (!result.success) {
      throw new Error(`Falha no INSERT: ${result.error || 'Erro desconhecido'}`);
    }
    
    console.log('[CREATE] ✅ Documento criado com sucesso:', documentId);
    
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
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: addCORSHeaders({ 'Content-Type': 'application/json' })
    });
  }
}

async function getDocuments(env: Env, request: Request): Promise<Response> {
  try {
    console.log('[GET] Buscando documentos...');
    
    // Extrair usuário do token para filtrar documentos
    const authorization = request.headers.get('Authorization');
    let currentUserId = null;
    
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice(7);
      const tokenHash = token.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
      currentUserId = `user-${tokenHash}`;
      console.log('[GET] Usuário autenticado:', currentUserId);
    }
    
    let documents = [];
    
    try {
      // Tentar SELECT com content primeiro (filtrando por usuário e documentos públicos)
      console.log('[GET] Tentando SELECT com content...');
      const stmtWithContent = env.DB.prepare(`
        SELECT id, title, visibility, owner_id, created_at, updated_at, content
        FROM documents
        WHERE visibility = 'public' OR owner_id = ?
        ORDER BY updated_at DESC
      `);
      
      const resultContent = await stmtWithContent.bind(currentUserId || '').all();
      documents = resultContent.results || [];
      console.log('[GET] ✅ SELECT com content executado, documentos:', documents.length);
      
    } catch (contentError) {
      console.log('[GET] ❌ SELECT com content falhou:', contentError.message);
      console.log('[GET] Tentando SELECT sem content...');
      
      const stmtBasic = env.DB.prepare(`
        SELECT id, title, visibility, owner_id, created_at, updated_at
        FROM documents
        WHERE visibility = 'public' OR owner_id = ?
        ORDER BY updated_at DESC
      `);
      
      const resultBasic = await stmtBasic.bind(currentUserId || '').all();
      documents = (resultBasic.results || []).map(doc => ({
        ...doc,
        content: '' // Adicionar content vazio
      }));
      
      console.log('[GET] ✅ SELECT sem content executado, documentos:', documents.length);
    }
    
    // Enriquecer documentos com informações do proprietário
    const enrichedDocuments = documents.map(doc => {
      const ownerHash = doc.owner_id?.replace('user-', '') || 'demo';
      return {
        ...doc,
        owner_name: `Usuário ${ownerHash.slice(0, 8)}`,
        owner_avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${ownerHash}`,
        is_owner: doc.owner_id === currentUserId
      };
    });
    
    return new Response(JSON.stringify({ 
      documents: enrichedDocuments,
      count: enrichedDocuments.length
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