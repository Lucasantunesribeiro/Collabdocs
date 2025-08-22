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
      
      // LOGS DETALHADOS PARA DEBUG
      console.log(`[API] 🚀 REQUISIÇÃO RECEBIDA`);
      console.log(`[API] URL completa: ${request.url}`);
      console.log(`[API] Path: ${path}`);
      console.log(`[API] Method: ${method}`);
      // Log dos headers principais para debug
      const headers = {};
      request.headers.forEach((value, key) => {
        headers[key] = value;
      });
      console.log(`[API] Headers:`, headers);
      console.log(`[API] Timestamp: ${new Date().toISOString()}`);
      
      console.log(`[API] ${method} ${path}`);
      
      // Handle CORS preflight
      if (method === 'OPTIONS') {
        return new Response(null, {
          status: 200,
          headers: addCORSHeaders()
        });
      }

      // Handle favicon.ico requests
      if (path === '/favicon.ico') {
        console.log(`[API] 📎 Favicon request - serving SVG favicon`);
        const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect width="32" height="32" rx="6" fill="#3b82f6"/>
  <text x="16" y="22" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle" fill="white">📝</text>
</svg>`;
        return new Response(faviconSvg, {
          status: 200,
          headers: addCORSHeaders({ 
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=31536000' // Cache por 1 ano
          })
        });
      }

      // Handle root path requests
      if (path === '/') {
        console.log(`[API] 🏠 Root request - returning app info`);
        return new Response(JSON.stringify({
          app: 'CollabDocs API',
          version: '1.0.0',
          status: 'online',
          timestamp: new Date().toISOString(),
          endpoints: {
            documents: '/api/documents',
            debug: '/api/debug',
            health: '/api/health'
          },
          frontend: 'https://collabdocs-app.vercel.app'
        }), {
          status: 200,
          headers: addCORSHeaders({ 'Content-Type': 'application/json' })
        });
      }
      
      // API routes
      if (path.startsWith('/api/')) {
        const apiPath = path.slice(4); // Remove '/api' prefix
        console.log(`[API] API Path: ${apiPath}`);
          
        // 1. ROTA DE TESTE PRIMEIRO (antes de qualquer startsWith)
        if (apiPath === '/debug/test' && method === 'GET') {
          console.log(`[API] 🧪 ROTA DE TESTE ATIVADA`);
          return new Response(JSON.stringify({ 
            message: 'Rota de teste funcionando',
            debug: {
              apiPath: apiPath,
              method: method,
              timestamp: new Date().toISOString(),
              path: path
            }
          }), { 
            status: 200,
            headers: addCORSHeaders({ 'Content-Type': 'application/json' })
          });
        }
          
        // 2. ROTA DE DEBUG DE DOCUMENTOS (depois da rota específica)
        if (apiPath.startsWith('/debug/documents/') && method === 'GET') {
          const pathParts = apiPath.split('/');
          console.log(`[API] 🚨 DEBUG DOCUMENT ROUTE ATIVADA`);
          console.log(`[API] Path completo: ${apiPath}`);
          console.log(`[API] Path parts:`, pathParts);
          console.log(`[API] Path parts length: ${pathParts.length}`);
          console.log(`[API] Path parts detalhado:`, pathParts.map((part, index) => `${index}: "${part}"`));
          
          if (pathParts.length >= 4) {
            // ANÁLISE: apiPath = "/debug/documents/04ea2a05-e18d-438f-80c2-bd768939dfda"
            // split('/') = ["", "debug", "documents", "04ea2a05-e18d-438f-80c2-bd768939dfda"]
            // pathParts[3] = "04ea2a05-e18d-438f-80c2-bd768939dfda" ✅
            
            const documentId = pathParts[3]; // Índice 3 para o UUID (corrigido)
            console.log(`[API] 🚨 DEBUG DOCUMENT ROUTE ATIVADA - ID: ${documentId}`);
            console.log(`[API] ID extraído do índice 3: "${documentId}"`);
            console.log(`[API] Análise completa:`, {
              apiPath: apiPath,
              splitResult: pathParts,
              expectedIndex: 3,
              actualValue: pathParts[3],
              isValidUUID: documentId && documentId.length === 36 && documentId.includes('-')
            });
            
            if (documentId && documentId.length === 36 && documentId.includes('-')) {
              console.log(`[API] ✅ UUID válido, chamando debugDocument...`);
              return await debugDocument(env, request, documentId);
            } else {
              console.error(`[API] ID do documento inválido: "${documentId}"`);
              return new Response(JSON.stringify({ 
                error: 'ID do documento inválido',
                debug: {
                  receivedId: documentId,
                  pathParts: pathParts,
                  expectedFormat: 'UUID v4 (36 caracteres com hífens)',
                  explanation: `apiPath.split("/") resulta em ${JSON.stringify(pathParts)}`,
                  analysis: {
                    apiPath: apiPath,
                    splitResult: pathParts,
                    expectedIndex: 3,
                    actualValue: pathParts[3],
                    isValidUUID: documentId && documentId.length === 36 && documentId.includes('-')
                  }
                }
              }), { 
                status: 400,
                headers: addCORSHeaders({ 'Content-Type': 'application/json' })
              });
            }
          } else {
            console.error(`[API] Estrutura de URL inválida para debug: ${apiPath}`);
            return new Response(JSON.stringify({ 
              error: 'Estrutura de URL inválida',
              debug: {
                pathParts: pathParts,
                expectedFormat: '/debug/documents/{uuid}'
              }
            }), { 
              status: 400,
              headers: addCORSHeaders({ 'Content-Type': 'application/json' })
            });
          }
        }
        
        if (apiPath === '/documents' && method === 'POST') {
          return await createDocument(env, request);
        }
        
        if (apiPath === '/documents' && method === 'GET') {
          return await getDocuments(env, request);
        }
        
        if (apiPath.startsWith('/documents/') && apiPath.endsWith('/collaborators') && method === 'GET') {
          console.log(`[API] 🎯 ROTA DE COLABORADORES ATIVADA`);
          console.log(`[API] apiPath: "${apiPath}"`);
          console.log(`[API] method: "${method}"`);
          
          const pathParts = apiPath.split('/');
          console.log(`[API] Path parts:`, pathParts);
          
          if (pathParts.length >= 4) {
            const documentId = pathParts[2];
            console.log(`[API] Document ID extraído: "${documentId}"`);
            
            if (documentId && documentId.length === 36 && documentId.includes('-')) {
              console.log(`[API] ✅ UUID válido, chamando getDocumentCollaborators...`);
              return await getDocumentCollaborators(env, request, documentId);
            } else {
              console.error(`[API] ❌ ID do documento inválido: "${documentId}"`);
              return new Response(JSON.stringify({ 
                error: 'ID do documento inválido',
                debug: {
                  receivedId: documentId,
                  pathParts: pathParts,
                  expectedFormat: 'UUID v4 (36 caracteres com hífens)'
                }
              }), { 
                status: 400,
                headers: addCORSHeaders({ 'Content-Type': 'application/json' })
              });
            }
          } else {
            console.error(`[API] ❌ Estrutura de URL inválida para colaboradores: ${apiPath}`);
            return new Response(JSON.stringify({ 
              error: 'Estrutura de URL inválida',
              debug: {
                apiPath: apiPath,
                pathParts: pathParts,
                expectedFormat: '/documents/{id}/collaborators'
              }
            }), { 
              status: 400,
              headers: addCORSHeaders({ 'Content-Type': 'application/json' })
            });
          }
        }

        if (apiPath.startsWith('/documents/') && method === 'GET') {
          console.log(`[API] 🎯 ROTA DE DOCUMENTO ESPECÍFICO GET ATIVADA`);
          console.log(`[API] apiPath: "${apiPath}"`);
          console.log(`[API] method: "${method}"`);
          
          const pathParts = apiPath.split('/');
          console.log(`[API] Path parts:`, pathParts);
          console.log(`[API] Path parts length: ${pathParts.length}`);
          console.log(`[API] Path parts detalhado:`, pathParts.map((part, index) => `${index}: "${part}"`));
          
          // CORREÇÃO: Mudança na condição e índice
          if (pathParts.length >= 3) {
            // apiPath = "/documents/82379623-3f41-4aea-a149-676998c6f293"
            // split('/') = ["", "documents", "82379623-3f41-4aea-a149-676998c6f293"]
            // pathParts[2] = "82379623-3f41-4aea-a149-676998c6f293" ✅
            
            const documentId = pathParts[2]; // CORREÇÃO: Índice 2 para o UUID
            console.log(`[API] Document ID extraído: "${documentId}"`);
            console.log(`[API] ID válido: ${documentId && documentId.length === 36 && documentId.includes('-')}`);
            
            if (documentId && documentId.length === 36 && documentId.includes('-')) {
              console.log(`[API] ✅ UUID válido, chamando getDocument...`);
              return await getDocument(env, request, documentId);
            } else {
              console.error(`[API] ❌ ID do documento inválido: "${documentId}"`);
              return new Response(JSON.stringify({ 
                error: 'ID do documento inválido',
                debug: {
                  receivedId: documentId,
                  pathParts: pathParts,
                  expectedFormat: 'UUID v4 (36 caracteres com hífens)',
                  explanation: `apiPath.split("/") resulta em ${JSON.stringify(pathParts)}`,
                  analysis: {
                    apiPath: apiPath,
                    splitResult: pathParts,
                    expectedIndex: 2,
                    actualValue: pathParts[2],
                    isValidUUID: documentId && documentId.length === 36 && documentId.includes('-')
                  }
                }
              }), { 
                status: 400,
                headers: addCORSHeaders({ 'Content-Type': 'application/json' })
              });
            }
          } else {
            console.error(`[API] ❌ Estrutura de URL inválida: ${apiPath}`);
            console.error(`[API] Path parts length: ${pathParts.length}, esperado: >= 3`);
          }
        }

        if (apiPath.startsWith('/documents/') && method === 'PUT') {
          console.log(`[API] 🎯 ROTA DE DOCUMENTO ESPECÍFICO PUT ATIVADA`);
          console.log(`[API] apiPath: "${apiPath}"`);
          console.log(`[API] method: "${method}"`);
          
          const pathParts = apiPath.split('/');
          console.log(`[API] Path parts:`, pathParts);
          console.log(`[API] Path parts length: ${pathParts.length}`);
          
          if (pathParts.length >= 3) {
            const documentId = pathParts[2];
            console.log(`[API] Document ID extraído: "${documentId}"`);
            console.log(`[API] ID válido: ${documentId && documentId.length === 36 && documentId.includes('-')}`);
            
            if (documentId && documentId.length === 36 && documentId.includes('-')) {
              console.log(`[API] ✅ UUID válido, chamando updateDocument...`);
              return await updateDocument(env, request, documentId);
            } else {
              console.error(`[API] ❌ ID do documento inválido: "${documentId}"`);
              return new Response(JSON.stringify({ 
                error: 'ID do documento inválido',
                debug: {
                  receivedId: documentId,
                  pathParts: pathParts,
                  expectedFormat: 'UUID v4 (36 caracteres com hífens)'
                }
              }), { 
                status: 400,
                headers: addCORSHeaders({ 'Content-Type': 'application/json' })
              });
            }
          } else {
            console.error(`[API] ❌ Estrutura de URL inválida para PUT: ${apiPath}`);
            console.error(`[API] Path parts length: ${pathParts.length}, esperado: >= 3`);
            return new Response(JSON.stringify({ 
              error: 'Estrutura de URL inválida',
              debug: {
                apiPath: apiPath,
                pathParts: pathParts,
                expectedLength: 3
              }
            }), { 
              status: 400,
              headers: addCORSHeaders({ 'Content-Type': 'application/json' })
            });
          }
                }
          
        if (apiPath === '/debug' && method === 'GET') {
          return await debugTables(env, request);
        }

        // Health check endpoint
        if (apiPath === '/health' && method === 'GET') {
          console.log(`[API] 🏥 Health check request`);
          return new Response(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            database: 'connected'
          }), {
            status: 200,
            headers: addCORSHeaders({ 'Content-Type': 'application/json' })
          });
        }
            
        console.log(`[API] ❌ ROTA NÃO ENCONTRADA`);
        console.log(`[API] apiPath: "${apiPath}"`);
        console.log(`[API] method: "${method}"`);
        console.log(`[API] path: "${path}"`);
        console.log(`[API] Rotas disponíveis:`, [
          '/documents', 
          '/debug', 
          '/debug/test',
          '/debug/documents/{id}'
        ]);
        
        return new Response(JSON.stringify({ 
          error: 'Not Found',
          debug: {
            requestedPath: path,
            apiPath: apiPath,
            method: method,
            availableRoutes: [
              '/documents', 
              '/debug', 
              '/debug/test',
              '/debug/documents/{id}'
            ],
            explanation: 'Verifique se a URL está correta e se o método HTTP é suportado'
          }
        }), { 
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
      
      // VALIDAÇÃO CRÍTICA: Verificar se o userId está sendo definido corretamente
      if (!userId || userId === 'user-undefined' || userId === 'user-null') {
        throw new Error(`userId inválido: "${userId}" - userProfile.id: "${userProfile.id}"`);
      }
      
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
    const title = data.title || 'Novo Documento';
    const visibility = data.visibility || 'public';
    const content = data.content || `# ${title}\\n\\nComece a escrever aqui...`;
    
    // LOG CRÍTICO: Verificar dados antes do INSERT
    console.log('[CREATE] 🔍 DADOS FINAIS PARA INSERT:', {
      documentId,
      userId,
      title,
      visibility,
      now,
      content: content.substring(0, 100) + '...'
    });
    
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
         title,
         visibility,
         now,
         now,
         content
       ).run();
       
       document = {
         id: documentId,
         owner_id: userId,
         title: title,
         visibility: visibility,
         created_at: now,
         updated_at: now,
         content: content
       };
      
      console.log('[CREATE] ✅ Estratégia 1 SUCESSO - INSERT com content');
      
      // VERIFICAÇÃO CRÍTICA: Confirmar o que foi salvo no banco
      console.log('[CREATE] 🔍 VERIFICANDO DOCUMENTO SALVO NO BANCO...');
      try {
        const verifyStmt = env.DB.prepare('SELECT * FROM documents WHERE id = ?');
        const savedDoc = await verifyStmt.bind(documentId).first();
        console.log('[CREATE] 📋 DOCUMENTO SALVO NO BANCO:', savedDoc);
        
        if (savedDoc.owner_id !== userId) {
          console.error('[CREATE] 🚨 ALERTA: owner_id diferente do esperado!');
          console.error('[CREATE] Esperado:', userId);
          console.error('[CREATE] Encontrado:', savedDoc.owner_id);
        }
      } catch (verifyError) {
        console.log('[CREATE] ⚠️ Erro ao verificar documento salvo:', verifyError.message);
      }
      
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
         title,
         visibility,
         now,
         now
       ).run();
       
       document = {
         id: documentId,
         owner_id: userId,
         title: title,
         visibility: visibility,
         created_at: now,
         updated_at: now,
         content: '' // Content vazio para compatibilidade
       };
      
      console.log('[CREATE] ✅ Estratégia 2 SUCESSO - INSERT sem content');
      
      // VERIFICAÇÃO CRÍTICA: Confirmar o que foi salvo no banco
      console.log('[CREATE] 🔍 VERIFICANDO DOCUMENTO SALVO NO BANCO (Estratégia 2)...');
      try {
        const verifyStmt = env.DB.prepare('SELECT * FROM documents WHERE id = ?');
        const savedDoc = await verifyStmt.bind(documentId).first();
        console.log('[CREATE] 📋 DOCUMENTO SALVO NO BANCO:', savedDoc);
        
        if (savedDoc.owner_id !== userId) {
          console.error('[CREATE] 🚨 ALERTA: owner_id diferente do esperado!');
          console.error('[CREATE] Esperado:', userId);
          console.error('[CREATE] Encontrado:', savedDoc.owner_id);
        }
      } catch (verifyError) {
        console.log('[CREATE] ⚠️ Erro ao verificar documento salvo:', verifyError.message);
      }
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
        // CORREÇÃO: Buscar apenas documentos do usuário atual e públicos
        console.log('[GET] Tabela de colaboradores não existe, usando fallback seguro');
        const stmtSimple = env.DB.prepare(`
          SELECT id, title, visibility, owner_id, created_at, updated_at, content
          FROM documents
          WHERE visibility = 'public' OR owner_id = ?
          ORDER BY updated_at DESC
        `);
        
        const resultSimple = await stmtSimple.bind(currentUserId || '').all();
        documents = resultSimple.results || [];
        console.log('[GET] ✅ SELECT seguro executado, documentos:', documents.length);
      }
      
      console.log('[GET] Documentos filtrados:', documents.map(d => ({id: d.id, title: d.title, visibility: d.visibility, owner_id: d.owner_id})));
      
    } catch (queryError) {
      console.error('[GET] ❌ Erro na query principal:', queryError.message);
      
      // CORREÇÃO: Fallback final seguro - apenas documentos do usuário e públicos
      try {
        console.log('[GET] Tentando fallback final seguro...');
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
        
        console.log('[GET] ✅ Fallback final seguro executado, documentos:', documents.length);
      } catch (fallbackError) {
        console.error('[GET] ❌ Fallback final também falhou:', fallbackError.message);
        // Retornar lista vazia em vez de erro
        documents = [];
      }
    }
    

    // Buscar informações dos proprietários da tabela users (se existir)
    const ownerIds = Array.from(new Set(documents.map(doc => doc.owner_id).filter(Boolean)));
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

async function getDocument(env: Env, request: Request, documentId: string): Promise<Response> {
  try {
    console.log(`[GET_DOC] Buscando documento com ID: "${documentId}"`);
    console.log(`[GET_DOC] Tipo do ID: ${typeof documentId}`);
    console.log(`[GET_DOC] Comprimento do ID: ${documentId?.length}`);

    // Validação do ID
    if (!documentId || documentId.trim() === '') {
      console.error(`[GET_DOC] ID do documento inválido: "${documentId}"`);
      return new Response(JSON.stringify({ error: 'ID do documento inválido' }), {
        status: 400,
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    }

    // Verificar autenticação
    const authorization = request.headers.get('Authorization');
    console.log('[GET_DOC] 🔍 Verificando autenticação...');
    console.log('[GET_DOC] Authorization header:', authorization);
    console.log('[GET_DOC] Headers completos:', Object.fromEntries(request.headers.entries()));
    
    if (!authorization?.startsWith('Bearer ')) {
      console.error('[GET_DOC] ❌ Token de autenticação inválido ou ausente');
      return new Response(JSON.stringify({ error: 'Token de autenticação necessário' }), {
        status: 401,
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    }
    
    console.log('[GET_DOC] ✅ Token de autorização válido');

    // Extrair perfil REAL do usuário autenticado
    let currentUserId: string | null = null;
    let currentUserProfile: any = null;
    
    try {
      const profileHeader = request.headers.get('X-User-Profile');
      if (!profileHeader) {
        throw new Error('Perfil do usuário não fornecido');
      }
      
      currentUserProfile = JSON.parse(profileHeader);
      console.log('[GET_DOC] Perfil NextAuth recebido:', currentUserProfile);
      
      // Validar dados essenciais
      if (!currentUserProfile.email || !currentUserProfile.name || !currentUserProfile.id) {
        throw new Error('Perfil do usuário incompleto');
      }
      
      // Usar ID do NextAuth
      currentUserId = `user-${currentUserProfile.id}`;
      
      console.log('[GET_DOC] ✅ Usuário autenticado:', {
        id: currentUserId,
        name: currentUserProfile.name,
        email: currentUserProfile.email
      });
      
    } catch (e) {
      console.error('[GET_DOC] Erro na autenticação:', e.message);
      return new Response(JSON.stringify({ 
        error: 'Falha na autenticação do usuário',
        details: e.message 
      }), {
        status: 401,
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    }

    // Verificar permissão do documento
    console.log(`[GET_DOC] Executando query para ID: "${documentId}"`);
    
    const document = await env.DB.prepare(`
      SELECT d.id, d.owner_id, d.title, d.visibility, d.content, d.created_at, d.updated_at
      FROM documents d
      WHERE d.id = ?
    `).bind(documentId).first();

    console.log(`[GET_DOC] Resultado da query:`, document);

    if (!document) {
      console.error(`[GET_DOC] Documento não encontrado para ID: "${documentId}"`);
      
      // Verificar se o documento existe na tabela
      try {
        const checkStmt = await env.DB.prepare(`SELECT COUNT(*) as count FROM documents WHERE id = ?`).bind(documentId).first();
        console.log(`[GET_DOC] Contagem de documentos com este ID:`, checkStmt);
        
        const totalDocs = await env.DB.prepare(`SELECT COUNT(*) as count FROM documents`).first();
        console.log(`[GET_DOC] Total de documentos na tabela:`, totalDocs);
        
        return new Response(JSON.stringify({ 
          error: 'Documento não encontrado',
          details: `ID: ${documentId}`,
          debug: {
            documentExists: checkStmt?.count > 0,
            totalDocuments: totalDocs?.count,
            requestedId: documentId
          }
        }), {
          status: 404,
          headers: addCORSHeaders({ 'Content-Type': 'application/json' })
        });
      } catch (checkError) {
        console.error(`[GET_DOC] Erro ao verificar existência:`, checkError);
        return new Response(JSON.stringify({ 
          error: 'Documento não encontrado',
          details: `ID: ${documentId}`,
          debug: {
            error: checkError.message
          }
        }), {
          status: 404,
          headers: addCORSHeaders({ 'Content-Type': 'application/json' })
        });
      }
    }



    // CORREÇÃO: Verificar permissões ANTES de retornar erro
    const isOwner = document.owner_id === currentUserId;
    console.log(`[GET_DOC] Verificando permissões:`, {
      documentOwner: document.owner_id,
      currentUser: currentUserId,
      isOwner: isOwner,
      documentVisibility: document.visibility
    });
    
    // Verificar se é colaborador (simplificado por enquanto)
    let isCollaborator = false;
    try {
      const collaboratorCheck = await env.DB.prepare(`
        SELECT permission FROM document_collaborators 
        WHERE document_id = ? AND user_id = ?
      `).bind(documentId, currentUserId).first();
      
      isCollaborator = !!collaboratorCheck;
      console.log(`[GET_DOC] É colaborador: ${isCollaborator}`);
    } catch (e) {
      // Se a tabela não existir, considerar apenas como owner
      isCollaborator = false;
      console.log(`[GET_DOC] Tabela de colaboradores não existe`);
    }

    // CORREÇÃO: Retornar 403 em vez de 404 para problemas de permissão
    if (!isOwner && !isCollaborator && document.visibility !== 'public') {
      console.error(`[GET_DOC] ❌ ACESSO NEGADO - Usuário não tem permissão`);
      console.error(`[GET_DOC] Detalhes:`, {
        isOwner,
        isCollaborator,
        visibility: document.visibility,
        currentUser: currentUserId,
        documentOwner: document.owner_id
      });
      
      return new Response(JSON.stringify({ 
        error: 'Você não tem permissão para acessar este documento',
        details: {
          reason: 'Documento privado e você não é o proprietário',
          documentId: documentId,
          documentVisibility: document.visibility,
          currentUser: currentUserId,
          documentOwner: document.owner_id
        }
      }), {
        status: 403, // CORREÇÃO: 403 Forbidden em vez de 404 Not Found
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    }

    console.log(`[GET_DOC] ✅ Permissão concedida - carregando documento`);

    // Enriquecer documento com informações do proprietário
    const ownerHash = document.owner_id?.replace('user-', '') || 'demo';
    let userData: any = null;
    
    try {
      userData = await env.DB.prepare(`
        SELECT id, name, email, avatar_url, provider
        FROM users
        WHERE id = ?
      `).bind(document.owner_id).first();
    } catch (e) {
      console.log('[GET_DOC] Tabela users não existe ou erro ao buscar usuário');
    }

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

    if (!avatarUrl) {
      avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(avatarSeed)}`;
    }

    const enrichedDocument = {
      ...document,
      owner_name: ownerName,
      owner_avatar_url: avatarUrl,
      is_owner: isOwner
    };

    return new Response(JSON.stringify({ 
      document: enrichedDocument,
      message: 'Documento encontrado com sucesso'
    }), {
      status: 200,
      headers: addCORSHeaders({ 'Content-Type': 'application/json' })
    });

  } catch (error) {
    console.error(`[GET_DOC] Erro final:`, error);
    return new Response(JSON.stringify({ 
      error: 'Erro ao buscar documento',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: addCORSHeaders({ 'Content-Type': 'application/json' })
    });
  }
}

async function updateDocument(env: Env, request: Request, documentId: string): Promise<Response> {
  try {
    console.log(`[UPDATE_DOC] Atualizando documento com ID: "${documentId}"`);
    console.log(`[UPDATE_DOC] Tipo do ID: ${typeof documentId}`);
    console.log(`[UPDATE_DOC] Comprimento do ID: ${documentId?.length}`);

    // Validação do ID
    if (!documentId || documentId.trim() === '') {
      console.error(`[UPDATE_DOC] ID do documento inválido: "${documentId}"`);
      return new Response(JSON.stringify({ error: 'ID do documento inválido' }), {
        status: 400,
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    }

    // Verificar autenticação
    const authorization = request.headers.get('Authorization');
    console.log('[UPDATE_DOC] 🔍 Verificando autenticação...');
    console.log('[UPDATE_DOC] Authorization header:', authorization);
    
    if (!authorization?.startsWith('Bearer ')) {
      console.error('[UPDATE_DOC] ❌ Token de autenticação inválido ou ausente');
      return new Response(JSON.stringify({ error: 'Token de autenticação necessário' }), {
        status: 401,
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    }
    
    console.log('[UPDATE_DOC] ✅ Token de autorização válido');

    // Extrair perfil REAL do usuário autenticado
    let currentUserId: string | null = null;
    let currentUserProfile: any = null;
    
    try {
      const profileHeader = request.headers.get('X-User-Profile');
      if (!profileHeader) {
        throw new Error('Perfil do usuário não fornecido');
      }
      
      currentUserProfile = JSON.parse(profileHeader);
      console.log('[UPDATE_DOC] Perfil NextAuth recebido:', currentUserProfile);
      
      // Validar dados essenciais
      if (!currentUserProfile.email || !currentUserProfile.name || !currentUserProfile.id) {
        throw new Error('Perfil do usuário incompleto');
      }
      
      // Usar ID do NextAuth
      currentUserId = `user-${currentUserProfile.id}`;
      
      console.log('[UPDATE_DOC] ✅ Usuário autenticado:', {
        id: currentUserId,
        name: currentUserProfile.name,
        email: currentUserProfile.email
      });
      
    } catch (e) {
      console.error('[UPDATE_DOC] Erro na autenticação:', e.message);
      return new Response(JSON.stringify({ 
        error: 'Falha na autenticação do usuário',
        details: e.message 
      }), {
        status: 401,
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    }

    // Extrair dados da requisição
    let updateData: any = {};
    try {
      updateData = await request.json();
      console.log('[UPDATE_DOC] Dados recebidos:', updateData);
    } catch (e) {
      console.error('[UPDATE_DOC] Erro ao parsear JSON:', e.message);
      return new Response(JSON.stringify({ 
        error: 'Dados inválidos',
        details: 'JSON malformado' 
      }), {
        status: 400,
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    }

    // Verificar se o documento existe e se o usuário tem permissão
    console.log(`[UPDATE_DOC] Executando query para ID: "${documentId}"`);
    
    const document = await env.DB.prepare(`
      SELECT d.id, d.owner_id, d.title, d.visibility, d.content, d.created_at, d.updated_at
      FROM documents d
      WHERE d.id = ?
    `).bind(documentId).first();

    console.log(`[UPDATE_DOC] Resultado da query:`, document);

    if (!document) {
      console.error(`[UPDATE_DOC] Documento não encontrado para ID: "${documentId}"`);
      return new Response(JSON.stringify({ 
        error: 'Documento não encontrado',
        details: `ID: ${documentId}`
      }), {
        status: 404,
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    }

    // Verificar permissões
    const isOwner = document.owner_id === currentUserId;
    console.log(`[UPDATE_DOC] Verificando permissões:`, {
      documentOwner: document.owner_id,
      currentUser: currentUserId,
      isOwner: isOwner,
      documentVisibility: document.visibility
    });
    
    // Verificar se é colaborador com permissão de escrita
    let canWrite = isOwner;
    try {
      const collaboratorCheck = await env.DB.prepare(`
        SELECT permission FROM document_collaborators 
        WHERE document_id = ? AND user_id = ? AND permission IN ('write', 'owner')
      `).bind(documentId, currentUserId).first();
      
      if (collaboratorCheck) {
        canWrite = true;
        console.log(`[UPDATE_DOC] É colaborador com permissão de escrita`);
      }
    } catch (e) {
      // Se a tabela não existir, considerar apenas como owner
      console.log(`[UPDATE_DOC] Tabela de colaboradores não existe`);
    }

    if (!canWrite) {
      console.error(`[UPDATE_DOC] ❌ ACESSO NEGADO - Usuário não tem permissão de escrita`);
      console.error(`[UPDATE_DOC] Detalhes:`, {
        isOwner,
        canWrite,
        visibility: document.visibility,
        currentUser: currentUserId,
        documentOwner: document.owner_id
      });
      
      return new Response(JSON.stringify({ 
        error: 'Você não tem permissão para editar este documento',
        details: {
          reason: 'Permissão de escrita necessária',
          documentId: documentId,
          currentUser: currentUserId,
          documentOwner: document.owner_id
        }
      }), {
        status: 403,
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    }

    console.log(`[UPDATE_DOC] ✅ Permissão de escrita concedida - atualizando documento`);

    // Preparar dados para atualização
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    if (updateData.content !== undefined) {
      updateFields.push('content = ?');
      updateValues.push(updateData.content);
    }
    
    if (updateData.title !== undefined) {
      updateFields.push('title = ?');
      updateValues.push(updateData.title);
    }
    
    if (updateFields.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Nenhum campo para atualizar',
        details: 'Forneça pelo menos content ou title'
      }), {
        status: 400,
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    }

    // Adicionar updated_at
    updateFields.push('updated_at = ?');
    updateValues.push(new Date().toISOString());
    
    // Adicionar documentId no final
    updateValues.push(documentId);

    // Executar atualização
    const updateQuery = `
      UPDATE documents 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;
    
    console.log('[UPDATE_DOC] Query de atualização:', updateQuery);
    console.log('[UPDATE_DOC] Valores:', updateValues);

    const updateResult = await env.DB.prepare(updateQuery).bind(...updateValues).run();
    console.log('[UPDATE_DOC] Resultado da atualização:', updateResult);

    if (!updateResult.success) {
      throw new Error('Falha ao atualizar documento na base de dados');
    }

    // Buscar documento atualizado
    const updatedDocument = await env.DB.prepare(`
      SELECT d.id, d.owner_id, d.title, d.visibility, d.content, d.created_at, d.updated_at
      FROM documents d
      WHERE d.id = ?
    `).bind(documentId).first();

    console.log('[UPDATE_DOC] Documento atualizado:', updatedDocument);

    // Enriquecer documento com informações do proprietário (mesmo código do GET)
    const ownerHash = updatedDocument.owner_id?.replace('user-', '') || 'demo';
    let userData: any = null;
    
    try {
      userData = await env.DB.prepare(`
        SELECT id, name, email, avatar_url, provider
        FROM users
        WHERE id = ?
      `).bind(updatedDocument.owner_id).first();
    } catch (e) {
      console.log('[UPDATE_DOC] Tabela users não existe ou erro ao buscar usuário');
    }

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

    if (!avatarUrl) {
      avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(avatarSeed)}`;
    }

    const enrichedDocument = {
      ...updatedDocument,
      owner_name: ownerName,
      owner_avatar_url: avatarUrl,
      is_owner: isOwner
    };

    return new Response(JSON.stringify({ 
      document: enrichedDocument,
      message: 'Documento atualizado com sucesso'
    }), {
      status: 200,
      headers: addCORSHeaders({ 'Content-Type': 'application/json' })
    });

  } catch (error) {
    console.error(`[UPDATE_DOC] Erro final:`, error);
    return new Response(JSON.stringify({ 
      error: 'Erro ao atualizar documento',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: addCORSHeaders({ 'Content-Type': 'application/json' })
    });
  }
}

async function getDocumentCollaborators(env: Env, request: Request, documentId: string): Promise<Response> {
  try {
    console.log(`[COLLAB] Buscando colaboradores para documento: "${documentId}"`);

    // Verificar autenticação
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Token de autenticação necessário' }), {
        status: 401,
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    }

    // Extrair perfil do usuário autenticado
    let currentUserId: string | null = null;
    let currentUserProfile: any = null;
    
    try {
      const profileHeader = request.headers.get('X-User-Profile');
      if (!profileHeader) {
        throw new Error('Perfil do usuário não fornecido');
      }
      
      currentUserProfile = JSON.parse(profileHeader);
      currentUserId = `user-${currentUserProfile.id}`;
      
      console.log('[COLLAB] ✅ Usuário autenticado:', {
        id: currentUserId,
        name: currentUserProfile.name,
        email: currentUserProfile.email
      });
      
    } catch (e) {
      console.error('[COLLAB] Erro na autenticação:', e.message);
      return new Response(JSON.stringify({ 
        error: 'Falha na autenticação do usuário',
        details: e.message 
      }), {
        status: 401,
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    }

    // Verificar se o documento existe
    const document = await env.DB.prepare(`
      SELECT id, owner_id, visibility
      FROM documents
      WHERE id = ?
    `).bind(documentId).first();

    if (!document) {
      return new Response(JSON.stringify({ 
        error: 'Documento não encontrado',
        details: `ID: ${documentId}`
      }), {
        status: 404,
        headers: addCORSHeaders({ 'Content-Type': 'application/json' })
      });
    }

    // Buscar colaboradores ativos
    let collaborators: any[] = [];
    
    try {
      // Verificar se a tabela de colaboradores existe
      const checkTableStmt = env.DB.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='document_collaborators'
      `);
      const tableCheck = await checkTableStmt.all();
      const hasCollaboratorsTable = tableCheck.results && tableCheck.results.length > 0;
      
      if (hasCollaboratorsTable) {
        // Buscar colaboradores da tabela
        const collabStmt = env.DB.prepare(`
          SELECT 
            dc.user_id,
            dc.user_email,
            dc.permission,
            u.name,
            u.avatar_url,
            u.provider
          FROM document_collaborators dc
          LEFT JOIN users u ON dc.user_id = u.id
          WHERE dc.document_id = ?
          ORDER BY 
            CASE dc.permission 
              WHEN 'owner' THEN 1 
              WHEN 'write' THEN 2 
              WHEN 'read' THEN 3 
              ELSE 4 
            END,
            u.name ASC
        `);
        
        const collabResult = await collabStmt.bind(documentId).all();
        collaborators = collabResult.results || [];
        
        console.log('[COLLAB] ✅ Colaboradores encontrados:', collaborators.length);
      } else {
        console.log('[COLLAB] Tabela de colaboradores não existe, usando apenas proprietário');
      }
    } catch (e) {
      console.error('[COLLAB] Erro ao buscar colaboradores:', e.message);
    }

    // Se não há colaboradores na tabela, incluir pelo menos o proprietário
    if (collaborators.length === 0) {
      try {
        const ownerStmt = env.DB.prepare(`
          SELECT 
            id,
            name,
            email,
            avatar_url,
            provider
          FROM users
          WHERE id = ?
        `).bind(document.owner_id).first();
        
        if (ownerStmt) {
          collaborators.push({
            user_id: document.owner_id,
            user_email: ownerStmt.email || 'owner@unknown.com',
            permission: 'owner',
            name: ownerStmt.name || 'Proprietário',
            avatar_url: ownerStmt.avatar_url,
            provider: ownerStmt.provider || 'unknown'
          });
        }
      } catch (e) {
        console.log('[COLLAB] Erro ao buscar proprietário:', e.message);
        // Fallback: criar colaborador básico
        collaborators.push({
          user_id: document.owner_id,
          user_email: 'owner@unknown.com',
          permission: 'owner',
          name: 'Proprietário',
          avatar_url: null,
          provider: 'unknown'
        });
      }
    }

    // Enriquecer colaboradores com informações adicionais
    const enrichedCollaborators = collaborators.map(collab => {
      const isCurrentUser = collab.user_id === currentUserId;
      const isOwner = collab.permission === 'owner';
      const canEdit = collab.permission === 'owner' || collab.permission === 'write';
      
      // Gerar avatar se não existir
      let avatarUrl = collab.avatar_url;
      if (!avatarUrl) {
        const seed = collab.name || collab.user_email || collab.user_id;
        avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`;
      }

      return {
        id: collab.user_id,
        email: collab.user_email,
        name: collab.name || `Usuário ${collab.user_id.slice(-8)}`,
        permission: collab.permission,
        avatar_url: avatarUrl,
        provider: collab.provider,
        is_current_user: isCurrentUser,
        is_owner: isOwner,
        can_edit: canEdit,
        status: isCurrentUser ? 'editando' : (canEdit ? 'disponível' : 'visualizando')
      };
    });

    console.log('[COLLAB] ✅ Colaboradores enriquecidos:', enrichedCollaborators.length);

    return new Response(JSON.stringify({ 
      collaborators: enrichedCollaborators,
      document_id: documentId,
      total: enrichedCollaborators.length
    }), {
      status: 200,
      headers: addCORSHeaders({ 'Content-Type': 'application/json' })
    });

  } catch (error) {
    console.error(`[COLLAB] Erro final:`, error);
    return new Response(JSON.stringify({ 
      error: 'Erro ao buscar colaboradores',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: addCORSHeaders({ 'Content-Type': 'application/json' })
    });
  }
}

async function debugDocument(env: Env, request: Request, documentId: string): Promise<Response> {
  try {
    console.log(`[DEBUG_DOC] 🚨 FUNÇÃO ATIVADA - Verificando documento: ${documentId}`);
    
    const results: any = {
      documentId,
      exists: false,
      document: null,
      tableInfo: null,
      allDocuments: [],
      debug: {
        functionCalled: true,
        timestamp: new Date().toISOString()
      }
    };
    
    // Verificar se o documento existe
    try {
      console.log(`[DEBUG_DOC] Executando query: SELECT * FROM documents WHERE id = '${documentId}'`);
      const docStmt = env.DB.prepare('SELECT * FROM documents WHERE id = ?');
      const docResult = await docStmt.bind(documentId).first();
      results.exists = !!docResult;
      results.document = docResult;
      console.log(`[DEBUG_DOC] ✅ Documento existe: ${results.exists}`);
    } catch (e) {
      results.document = { error: e.message };
      console.error(`[DEBUG_DOC] ❌ Erro ao buscar documento:`, e.message);
    }
    
    // Verificar estrutura da tabela
    try {
      console.log(`[DEBUG_DOC] Verificando estrutura da tabela documents...`);
      const tableStmt = env.DB.prepare("PRAGMA table_info(documents)");
      const tableResult = await tableStmt.all();
      results.tableInfo = tableResult.results || [];
      console.log(`[DEBUG_DOC] ✅ Estrutura da tabela:`, results.tableInfo);
    } catch (e) {
      results.tableInfo = { error: e.message };
      console.error(`[DEBUG_DOC] ❌ Erro ao verificar estrutura da tabela:`, e.message);
    }
    
    // Listar todos os documentos (limitado)
    try {
      console.log(`[DEBUG_DOC] Listando documentos na tabela...`);
      const allDocsStmt = env.DB.prepare('SELECT id, title, owner_id FROM documents LIMIT 10');
      const allDocsResult = await allDocsStmt.all();
      results.allDocuments = allDocsResult.results || [];
      console.log(`[DEBUG_DOC] ✅ Total de documentos na tabela: ${results.allDocuments.length}`);
    } catch (e) {
      results.allDocuments = { error: e.message };
      console.error(`[DEBUG_DOC] ❌ Erro ao listar documentos:`, e.message);
    }
    
    console.log(`[DEBUG_DOC] 🎯 Retornando resultado:`, JSON.stringify(results, null, 2));
    
    return new Response(JSON.stringify(results, null, 2), {
      status: 200,
      headers: addCORSHeaders({ 'Content-Type': 'application/json' })
    });
    
  } catch (error) {
    console.error(`[DEBUG_DOC] 💥 ERRO FINAL:`, error);
    return new Response(JSON.stringify({ 
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      debug: {
        functionCalled: true,
        error: true,
        timestamp: new Date().toISOString()
      }
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