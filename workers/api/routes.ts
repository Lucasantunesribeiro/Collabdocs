import { Document, Permission, JWTPayload } from '@collab-docs/shared';
import { Env } from '../index';

interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

// Função atob() para Cloudflare Workers
function atob(str: string): string {
  try {
    // Para MVP, vamos usar uma abordagem simplificada
    // Em produção, usar uma biblioteca JWT compatível com Workers
    return decodeURIComponent(escape(str));
  } catch {
    return str;
  }
}

// Helper function para adicionar headers CORS - Updated: 2025-08-20 01:41
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
      
      console.log(`🌐 ${method} ${path}`);
      
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
        
        if (apiPath === '/documents' && method === 'GET') {
          try {
            const authenticatedRequest = await authenticateRequest(request, env);
            return await getDocuments(env, authenticatedRequest.user!);
          } catch (error) {
            if (error instanceof Error && error.message === 'Unauthorized') {
              return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: addCORSHeaders({ 'Content-Type': 'application/json' })
              });
            }
            throw error;
          }
        }
        
        if (apiPath === '/documents' && method === 'POST') {
          try {
            const authenticatedRequest = await authenticateRequest(request, env);
            return await createDocument(env, authenticatedRequest.user!, await request.json());
          } catch (error) {
            if (error instanceof Error && error.message === 'Unauthorized') {
              return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: addCORSHeaders({ 'Content-Type': 'application/json' })
              });
            }
            throw error;
          }
        }
        
        if (apiPath.startsWith('/documents/') && method === 'GET') {
          const documentId = apiPath.split('/')[1];
          try {
            const authenticatedRequest = await authenticateRequest(request, env);
            return await getDocument(env, authenticatedRequest.user!, documentId);
          } catch (error) {
            if (error instanceof Error && error.message === 'Unauthorized') {
              return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: addCORSHeaders({ 'Content-Type': 'application/json' })
              });
            }
            throw error;
          }
        }
        
        if (apiPath.startsWith('/documents/') && apiPath.endsWith('/snapshot') && method === 'GET') {
          const documentId = apiPath.split('/')[1];
          try {
            const authenticatedRequest = await authenticateRequest(request, env);
            return await getDocumentSnapshot(env, authenticatedRequest.user!, documentId);
          } catch (error) {
            if (error instanceof Error && error.message === 'Unauthorized') {
              return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: addCORSHeaders({ 'Content-Type': 'application/json' })
              });
            }
            throw error;
          }
        }
        
        if (apiPath.startsWith('/documents/') && apiPath.endsWith('/permissions') && method === 'POST') {
          const documentId = apiPath.split('/')[1];
          try {
            const authenticatedRequest = await authenticateRequest(request, env);
            return await updatePermissions(env, authenticatedRequest.user!, documentId, await request.json());
          } catch (error) {
            if (error instanceof Error && error.message === 'Unauthorized') {
              return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: addCORSHeaders({ 'Content-Type': 'application/json' })
              });
            }
            throw error;
          }
        }
        
        if (apiPath.startsWith('/documents/') && apiPath.endsWith('/history') && method === 'GET') {
          const documentId = apiPath.split('/')[1];
          try {
            const authenticatedRequest = await authenticateRequest(request, env);
            return await getDocumentHistory(env, authenticatedRequest.user!, documentId);
          } catch (error) {
            if (error instanceof Error && error.message === 'Unauthorized') {
              return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: addCORSHeaders({ 'Content-Type': 'application/json' })
              });
            }
            throw error;
          }
        }
        
        if (apiPath.startsWith('/documents/') && method === 'PUT') {
          const documentId = apiPath.split('/')[1];
          try {
            const authenticatedRequest = await authenticateRequest(request, env);
            return await updateDocument(env, authenticatedRequest.user!, documentId, await request.json());
          } catch (error) {
            if (error instanceof Error && error.message === 'Unauthorized') {
              return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: addCORSHeaders({ 'Content-Type': 'application/json' })
              });
            }
            throw error;
          }
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
      console.error('API error:', error);
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

async function authenticateRequest(request: Request, env: Env): Promise<AuthenticatedRequest> {
  console.log('🔍 Iniciando autenticação...');
  console.log('🔍 Headers recebidos:', Object.fromEntries(request.headers.entries()));
  
  const authorization = request.headers.get('Authorization');
  console.log('🔍 Header Authorization:', authorization);
  
  if (!authorization?.startsWith('Bearer ')) {
    console.log('⚠️ Sem token de autorização ou formato incorreto');
    throw new Error('Unauthorized');
  }

  const token = authorization.slice(7);
  console.log('🔑 Token extraído:', token.slice(0, 20) + '...');
  
  // Extrair perfil do usuário dos headers
  const userProfileHeader = request.headers.get('X-User-Profile');
  console.log('🔍 Header X-User-Profile:', userProfileHeader);
  
  let userProfile = null;
  
  if (userProfileHeader) {
    try {
      userProfile = JSON.parse(userProfileHeader);
      console.log('👤 Perfil extraído dos headers:', userProfile);
    } catch (error) {
      console.log('⚠️ Erro ao parsear perfil do usuário:', error);
    }
  }
  
  console.log('🔍 Chamando verifyJWT...');
  const user = await verifyJWT(token, env, userProfile);
  
  if (!user) {
    console.log('❌ Falha na verificação do token');
    throw new Error('Unauthorized');
  }
  
  console.log('✅ Usuário autenticado:', { id: user.sub, name: user.name });
  
  return Object.assign(request, { user }) as AuthenticatedRequest;
}

async function verifyJWT(token: string, env: Env, userProfile?: any): Promise<JWTPayload | null> {
  try {
    // Para MVP, vamos criar usuários únicos baseados no token
    // Em produção, usar uma biblioteca JWT compatível com Workers
    
    // Gerar um ID único baseado no hash do token
    // Usar uma parte mais significativa do token para evitar duplicatas
    const tokenHash = token.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
    const userId = `user-${tokenHash}`;
    
    console.log('🔍 Verificando token:', token.slice(0, 20) + '...');
    console.log('🔍 Token hash gerado:', tokenHash);
    console.log('🔍 User ID gerado:', userId);
    console.log('👤 Perfil recebido:', userProfile);
    
    // Verificar se o usuário já existe no banco
    let user = await env.DB.prepare(`
      SELECT id, email, name, avatar_url, provider, provider_id, created_at
      FROM users WHERE id = ?
    `).bind(userId).first();
    
    if (!user) {
      // Criar novo usuário se não existir
      const userEmail = userProfile?.email || `${userId}@collabdocs.local`;
      const userName = userProfile?.name || `Usuário ${tokenHash.slice(0, 6)}`;
      
      console.log('🆕 Criando novo usuário:', { 
        id: userId, 
        name: userName, 
        email: userEmail,
        profile_source: userProfile ? 'header' : 'generated'
      });
      
      await env.DB.prepare(`
        INSERT INTO users (id, email, name, provider, provider_id, created_at)
        VALUES (?, ?, ?, 'github', ?, ?)
      `).bind(userId, userEmail, userName, tokenHash, new Date().toISOString()).run();
      
      user = {
        id: userId,
        email: userEmail,
        name: userName,
        avatar_url: null,
        provider: 'github',
        provider_id: tokenHash,
        created_at: new Date().toISOString()
      };
    } else {
      console.log('✅ Usuário encontrado:', { id: user.id, name: user.name, email: user.email });
      
      // Atualizar nome e email se o perfil mudou
      if (userProfile && (userProfile.name !== user.name || userProfile.email !== user.email)) {
        console.log('🔄 Atualizando perfil do usuário:', { 
          old: { name: user.name, email: user.email },
          new: { name: userProfile.name, email: userProfile.email }
        });
        
        await env.DB.prepare(`
          UPDATE users SET name = ?, email = ? WHERE id = ?
        `).bind(userProfile.name, userProfile.email, userId).run();
        
        user.name = userProfile.name;
        user.email = userProfile.email;
        
        console.log('✅ Perfil atualizado com sucesso');
      }
    }
    
    const jwtPayload = {
      sub: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      provider: user.provider as 'github' | 'google',
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + 3600, // 1 hora
    };
    
    console.log('🔑 JWT Payload retornado:', { sub: jwtPayload.sub, name: jwtPayload.name });
    
    return jwtPayload as JWTPayload;
  } catch (error) {
    console.error('❌ Erro na verificação JWT:', error);
    return null;
  }
}

async function getDocuments(env: Env, user: JWTPayload): Promise<Response> {
  try {
    console.log('📋 Buscando documentos para usuário:', user);
    console.log('🔍 User.sub value:', user.sub);
    console.log('🔍 User.sub type:', typeof user.sub);
    
    // Primeiro, vamos testar uma consulta simples
    console.log('🔍 Testando consulta simples...');
    const simpleStmt = env.DB.prepare(`
      SELECT COUNT(*) as total FROM documents
    `);
    const simpleResult = await simpleStmt.first();
    console.log('🔍 Total de documentos na tabela:', simpleResult);
    
    // Agora vamos testar uma consulta sem parâmetros
    console.log('🔍 Testando consulta sem parâmetros...');
    const noParamStmt = env.DB.prepare(`
      SELECT 
        id,
        title,
        visibility,
        owner_id,
        created_at,
        updated_at
      FROM documents
      ORDER BY updated_at DESC
    `);
    
    const noParamResult = await noParamStmt.all();
    console.log('🔍 Resultado sem parâmetros:', noParamResult);
    
    // Filtrar no JavaScript em vez de SQL
    const allDocuments = noParamResult.results || [];
    const userDocuments = allDocuments.filter(doc => 
      doc.visibility === 'public' || doc.owner_id === user.sub
    );
    
    console.log('🔍 Documentos filtrados para usuário:', userDocuments.length);
    console.log('🔍 Documentos retornados:', userDocuments);
    
    return new Response(JSON.stringify({ documents: userDocuments }), {
      status: 200,
      headers: addCORSHeaders({ 'Content-Type': 'application/json' })
    });
  } catch (error) {
    console.error('❌ Erro ao buscar documentos:', error);
    console.error('❌ Stack trace:', error.stack);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: addCORSHeaders({ 'Content-Type': 'application/json' })
    });
  }
}

async function createDocument(env: Env, user: JWTPayload, data: any): Promise<Response> {
  try {
    console.log('📝 Criando documento:', data);
    
    const documentId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Primeiro, vamos testar uma inserção simples com apenas as colunas essenciais
    console.log('🔍 Testando inserção com colunas essenciais...');
    
    const stmt = env.DB.prepare(`
      INSERT INTO documents (id, owner_id, title, visibility, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    console.log('🔍 Parâmetros para INSERT:', {
      id: documentId,
      owner_id: user.sub,
      title: data.title,
      visibility: data.visibility || 'private',
      created_at: now,
      updated_at: now
    });
    
    const result = await stmt.run(
      documentId,           // id
      user.sub,            // owner_id
      data.title,           // title
      data.visibility || 'private', // visibility
      now,                 // created_at
      now                  // updated_at
    );
    
    console.log('🔍 Resultado do INSERT:', result);
    
    if (result.changes === 0) {
      throw new Error('Falha ao criar documento - nenhuma linha inserida');
    }
    
    // Buscar o documento criado com consulta simples
    console.log('🔍 Buscando documento criado...');
    const getStmt = env.DB.prepare(`
      SELECT id, title, visibility, owner_id, created_at, updated_at
      FROM documents
      WHERE id = ?
    `);
    
    const document = await getStmt.bind(documentId).first();
    
    if (!document) {
      throw new Error('Documento criado mas não encontrado na busca');
    }
    
    console.log('✅ Documento criado com sucesso:', document);
    
    return new Response(JSON.stringify({ document }), {
      status: 201,
      headers: addCORSHeaders({ 'Content-Type': 'application/json' })
    });
  } catch (error) {
    console.error('❌ Erro ao criar documento:', error);
    console.error('❌ Stack trace:', error.stack);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: addCORSHeaders({ 'Content-Type': 'application/json' })
    });
  }
}

async function getDocument(env: Env, user: JWTPayload, documentId: string): Promise<Response> {
  // Check permissions
  const permission = await env.DB.prepare(`
    SELECT p.role FROM permissions p
    WHERE p.document_id = ? AND p.user_id = ?
    UNION
    SELECT 'owner' as role FROM documents d
    WHERE d.id = ? AND d.owner_id = ?
  `).bind(documentId, user.sub, documentId, user.sub).first();

  if (!permission) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { 
      status: 403,
      headers: addCORSHeaders({ 'Content-Type': 'application/json' })
    });
  }

  const document = await env.DB.prepare(`
    SELECT d.id, d.owner_id, d.title, d.content, d.visibility, d.created_at, d.updated_at, d.last_snapshot_r2_key,
           u.name as owner_name, u.avatar_url as owner_avatar_url
    FROM documents d
    LEFT JOIN users u ON d.owner_id = u.id
    WHERE d.id = ?
  `).bind(documentId).first();

  if (!document) {
    return new Response(JSON.stringify({ error: 'Document not found' }), { 
      status: 404,
      headers: addCORSHeaders({ 'Content-Type': 'application/json' })
    });
  }

  return new Response(JSON.stringify({ 
    document,
    permission: permission.role 
  }), {
    headers: addCORSHeaders({ 'Content-Type': 'application/json' })
  });
}

async function getDocumentSnapshot(env: Env, user: JWTPayload, documentId: string): Promise<Response> {
  // Check permissions
  const hasAccess = await checkDocumentAccess(env, documentId, user.sub);
  if (!hasAccess) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { 
      status: 403,
      headers: addCORSHeaders({ 'Content-Type': 'application/json' })
    });
  }

  const document = await env.DB.prepare(`
    SELECT last_snapshot_r2_key FROM documents WHERE id = ?
  `).bind(documentId).first();

  if (!document?.last_snapshot_r2_key) {
    return new Response(JSON.stringify({ snapshot: null }), {
      headers: addCORSHeaders()
    });
  }

  // Get signed URL for R2 object
  // const snapshot = await env.SNAPSHOTS.get(document.last_snapshot_r2_key);
  // if (!snapshot) {
  //   return new Response(JSON.stringify({ error: 'Snapshot not found' }), { status: 404 });
  // }

  // const buffer = await snapshot.arrayBuffer();
  
  // return new Response(buffer, {
  //   headers: { 
  //     'Content-Type': 'application/octet-stream',
  //     'Content-Encoding': 'gzip'
  //   }
  // });
  
  return new Response(JSON.stringify({ error: 'Snapshots temporarily disabled' }), { 
    status: 501,
    headers: addCORSHeaders()
  });
}

async function updatePermissions(env: Env, user: JWTPayload, documentId: string, body: { user_id: string; role: string }): Promise<Response> {
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Check if user is owner
  const document = await env.DB.prepare(`
    SELECT owner_id FROM documents WHERE id = ?
  `).bind(documentId).first();

  if (!document || document.owner_id !== user.sub) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  if (!body.user_id || !['editor', 'viewer'].includes(body.role)) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
  }

  // Upsert permission
  await env.DB.prepare(`
    INSERT INTO permissions (document_id, user_id, role, granted_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT (document_id, user_id) 
    DO UPDATE SET role = excluded.role, granted_at = CURRENT_TIMESTAMP
  `).bind(documentId, body.user_id, body.role).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: addCORSHeaders()
  });
}

async function updateDocument(env: Env, user: JWTPayload, documentId: string, body: { content: string; title?: string }): Promise<Response> {
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Check permissions (only owners and editors can update)
  const permission = await env.DB.prepare(`
    SELECT p.role FROM permissions p
    WHERE p.document_id = ? AND p.user_id = ?
    UNION
    SELECT 'owner' as role FROM documents d
    WHERE d.id = ? AND d.owner_id = ?
  `).bind(documentId, user.sub, documentId, user.sub).first();

  if (!permission || (permission.role !== 'owner' && permission.role !== 'editor')) {
    return new Response(JSON.stringify({ error: 'Forbidden - Read-only access' }), { status: 403 });
  }

  if (!body.content) {
    return new Response(JSON.stringify({ error: 'Content is required' }), { status: 400 });
  }

  const now = new Date().toISOString();

  // Update document content and timestamp
  await env.DB.prepare(`
    UPDATE documents 
    SET content = ?, updated_at = ?
    ${body.title ? ', title = ?' : ''}
    WHERE id = ?
  `).bind(
    body.content,
    now,
    ...(body.title ? [body.title] : []),
    documentId
  ).run();

  // Get updated document
  const document = await env.DB.prepare(`
    SELECT * FROM documents WHERE id = ?
  `).bind(documentId).first();

  if (!document) {
    return new Response(JSON.stringify({ error: 'Document not found' }), { status: 404 });
  }

  return new Response(JSON.stringify({ 
    document,
    message: 'Document updated successfully'
  }), {
    headers: addCORSHeaders()
  });
}

async function getDocumentHistory(env: Env, user: JWTPayload, documentId: string): Promise<Response> {
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const hasAccess = await checkDocumentAccess(env, documentId, user.sub);
  if (!hasAccess) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const snapshots = await env.DB.prepare(`
    SELECT s.*, u.name as author_name 
    FROM snapshots s
    LEFT JOIN users u ON s.author_id = u.id
    WHERE s.document_id = ?
    ORDER BY s.created_at DESC
    LIMIT 50
  `).bind(documentId).all();

  return new Response(JSON.stringify({ snapshots: snapshots.results }), {
    headers: addCORSHeaders()
  });
}

async function checkDocumentAccess(env: Env, documentId: string, userId: string): Promise<boolean> {
  const result = await env.DB.prepare(`
    SELECT 1 FROM permissions p
    WHERE p.document_id = ? AND p.user_id = ?
    UNION
    SELECT 1 FROM documents d
    WHERE d.id = ? AND d.owner_id = ?
  `).bind(documentId, userId, documentId, userId).first();

  return !!result;
}