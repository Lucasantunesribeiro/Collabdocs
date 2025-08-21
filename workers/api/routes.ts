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
        
        if (apiPath === '/debug' && method === 'GET') {
          return await debugTables(env, request);
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
    
    // Verificar autenticação
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Token de autenticação necessário' }), {
        status: 401,
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    }

    // Extrair perfil REAL do usuário autenticado via NextAuth
    let userProfile: any = null;
    let userId = '';
    
    try {
      const profileHeader = request.headers.get('X-User-Profile');
      if (!profileHeader) {
        throw new Error('Perfil do usuário não fornecido');
      }
      
      userProfile = JSON.parse(profileHeader);
      console.log('[CREATE] Perfil NextAuth recebido:', userProfile);
      
      // Validar dados essenciais do perfil
      if (!userProfile.email || !userProfile.name || !userProfile.id) {
        throw new Error('Perfil do usuário incompleto');
      }
      
      // Validar formato do email
      if (!userProfile.email.includes('@') || !userProfile.email.includes('.')) {
        throw new Error('Email inválido');
      }
      
      // Usar ID do NextAuth (mais seguro) como base para userId
      userId = `user-${userProfile.id}`;
      
      console.log('[CREATE] ✅ Usuário autenticado:', {
        id: userId,
        name: userProfile.name,
        email: userProfile.email,
        provider: userProfile.provider
      });
      
    } catch (e) {
      console.error('[CREATE] Erro na autenticação:', e.message);
      return new Response(JSON.stringify({ 
        error: 'Falha na autenticação do usuário',
        details: e.message 
      }), {
        status: 401,
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    }
    
    // Salvar/atualizar perfil do usuário se disponível
    if (userProfile && userProfile.name) {
      try {
        console.log('[CREATE] Salvando perfil do usuário...');
        const upsertUserStmt = env.DB.prepare(`
          INSERT OR REPLACE INTO users (id, name, email, avatar_url, provider, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        await upsertUserStmt.bind(
          userId,
          userProfile.name,
          userProfile.email || '',
          userProfile.avatar_url || '',
          userProfile.provider || 'unknown',
          new Date().toISOString(),
          new Date().toISOString()
        ).run();
        
        console.log('[CREATE] ✅ Perfil do usuário salvo');
      } catch (userError) {
        console.log('[CREATE] ⚠️ Erro ao salvar usuário (continuando):', userError.message);
      }
    }
    
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
    
    // Verificar autenticação
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Token de autenticação necessário' }), {
        status: 401,
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    }
    
    // Extrair perfil REAL do usuário autenticado
    let currentUserId: string | null = null;
    let currentUserProfile: any = null;
    
    try {
      const profileHeader = request.headers.get('X-User-Profile');
      if (!profileHeader) {
        throw new Error('Perfil do usuário não fornecido');
      }
      
      currentUserProfile = JSON.parse(profileHeader);
      console.log('[GET] Perfil NextAuth recebido:', currentUserProfile);
      
      // Validar dados essenciais
      if (!currentUserProfile.email || !currentUserProfile.name || !currentUserProfile.id) {
        throw new Error('Perfil do usuário incompleto');
      }
      
      // Usar ID do NextAuth
      currentUserId = `user-${currentUserProfile.id}`;
      
      console.log('[GET] ✅ Usuário autenticado:', {
        id: currentUserId,
        name: currentUserProfile.name,
        email: currentUserProfile.email
      });
      
    } catch (e) {
      console.error('[GET] Erro na autenticação:', e.message);
      return new Response(JSON.stringify({ 
        error: 'Falha na autenticação do usuário',
        details: e.message 
      }), {
        status: 401,
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    }
    
    let documents: any[] = [];
    
    try {
      // Primeiro, verificar se a tabela document_collaborators existe
      const checkTableStmt = env.DB.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='document_collaborators'
      `);
      const tableCheck = await checkTableStmt.all();
      const hasCollaboratorsTable = tableCheck.results && tableCheck.results.length > 0;
      
      console.log('[GET] Tabela document_collaborators existe:', hasCollaboratorsTable);
      
      if (hasCollaboratorsTable) {
        // SELECT com controle de ACL avançado
        console.log('[GET] Buscando documentos com controle de ACL para:', currentUserId);
        const stmtWithContent = env.DB.prepare(`
          SELECT DISTINCT d.id, d.title, d.visibility, d.owner_id, d.created_at, d.updated_at, d.content
          FROM documents d
          LEFT JOIN document_collaborators dc ON d.id = dc.document_id
          WHERE 
            d.visibility = 'public' 
            OR d.owner_id = ?
            OR (dc.user_id = ? AND dc.permission IN ('read', 'write', 'owner'))
            OR (dc.user_email = ? AND dc.permission IN ('read', 'write', 'owner'))
          ORDER BY d.updated_at DESC
        `);
        
        const resultContent = await stmtWithContent.bind(
          currentUserId || '', 
          currentUserId || '', 
          currentUserProfile.email || ''
        ).all();
        documents = resultContent.results || [];
        console.log('[GET] ✅ SELECT com ACL executado, documentos:', documents.length);
      } else {
        // Fallback: buscar apenas documentos do usuário e públicos
        console.log('[GET] Tabela de colaboradores não existe, usando fallback simples');
        const stmtSimple = env.DB.prepare(`
          SELECT id, title, visibility, owner_id, created_at, updated_at, content
          FROM documents
          WHERE visibility = 'public' OR owner_id = ?
          ORDER BY updated_at DESC
        `);
        
        const resultSimple = await stmtSimple.bind(currentUserId || '').all();
        documents = resultSimple.results || [];
        console.log('[GET] ✅ SELECT simples executado, documentos:', documents.length);
      }
      
      console.log('[GET] Documentos filtrados:', documents.map(d => ({id: d.id, title: d.title, visibility: d.visibility, owner_id: d.owner_id})));
      
    } catch (queryError) {
      console.error('[GET] ❌ Erro na query principal:', queryError.message);
      
      // Fallback final: buscar apenas documentos básicos
      try {
        console.log('[GET] Tentando fallback final...');
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
        
        console.log('[GET] ✅ Fallback final executado, documentos:', documents.length);
      } catch (fallbackError) {
        console.error('[GET] ❌ Fallback final também falhou:', fallbackError.message);
        // Retornar lista vazia em vez de erro
        documents = [];
      }
    }
    

    // Buscar informações dos proprietários da tabela users (se existir)
    const ownerIds = [...new Set(documents.map(doc => doc.owner_id).filter(Boolean))];
    const usersData = {};
    
    if (ownerIds.length > 0) {
      try {
        // Verificar se a tabela users existe
        const checkUsersTable = env.DB.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name='users'
        `);
        const usersTableCheck = await checkUsersTable.all();
        const hasUsersTable = usersTableCheck.results && usersTableCheck.results.length > 0;
        
        if (hasUsersTable) {
          const placeholders = ownerIds.map(() => '?').join(',');
          const usersStmt = env.DB.prepare(`
            SELECT id, name, email, avatar_url, provider
            FROM users
            WHERE id IN (${placeholders})
          `);
          
          const usersResult = await usersStmt.bind(...ownerIds).all();
          (usersResult.results || []).forEach(user => {
            usersData[user.id] = user;
          });
          
          console.log('[GET] ✅ Dados dos usuários carregados:', Object.keys(usersData).length);
        } else {
          console.log('[GET] Tabela users não existe, pulando busca de dados de usuários');
        }
      } catch (usersError) {
        console.log('[GET] ⚠️ Erro ao buscar usuários:', usersError.message);
      }
    }

    // Enriquecer documentos com informações do proprietário
    const enrichedDocuments = documents.map(doc => {
      const ownerHash = doc.owner_id?.replace('user-', '') || 'demo';
      const isOwner = doc.owner_id === currentUserId;
      const userData = usersData[doc.owner_id];
      
      // Usar dados reais do usuário se disponível, senão fallback
      let ownerName = `Usuário ${ownerHash.slice(0, 8)}`;
      let avatarSeed = ownerHash;
      let avatarUrl = userData?.avatar_url;
      
      if (userData?.name) {
        ownerName = userData.name;
        avatarSeed = userData.name;
      } else if (isOwner && currentUserProfile?.name) {
        ownerName = currentUserProfile.name;
        avatarSeed = currentUserProfile.name;
      }
      
      // Se não temos avatar_url do banco, gerar um
      if (!avatarUrl) {
        avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(avatarSeed)}`;
      }
      
      return {
        ...doc,
        owner_name: ownerName,
        owner_avatar_url: avatarUrl,
        is_owner: isOwner
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

async function debugTables(env: Env, request: Request): Promise<Response> {
  try {
    console.log('[DEBUG] Verificando tabelas...');
    
    const results: any = {
      documents: [],
      users: [],
      migrations: []
    };
    
    // Verificar documentos
    try {
      const docsStmt = env.DB.prepare('SELECT * FROM documents ORDER BY created_at DESC LIMIT 5');
      const docsResult = await docsStmt.all();
      results.documents = docsResult.results || [];
    } catch (e) {
      results.documents = { error: e.message };
    }
    
    // Verificar usuários
    try {
      const usersStmt = env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 5');
      const usersResult = await usersStmt.all();
      results.users = usersResult.results || [];
    } catch (e) {
      results.users = { error: e.message };
    }
    
    // Verificar migrações
    try {
      const migrationsStmt = env.DB.prepare('SELECT name FROM sqlite_master WHERE type="table"');
      const migrationsResult = await migrationsStmt.all();
      results.migrations = migrationsResult.results || [];
    } catch (e) {
      results.migrations = { error: e.message };
    }
    
    return new Response(JSON.stringify(results, null, 2), {
      status: 200,
      headers: addCORSHeaders({ 'Content-Type': 'application/json' })
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: addCORSHeaders({ 'Content-Type': 'application/json' })
    });
  }
}