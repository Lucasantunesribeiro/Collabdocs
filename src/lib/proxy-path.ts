// Só repassa segmentos "simples": impede que "..", "." ou barras codificadas
// (%2F, %5C) façam o proxy /api/dotnet alcançar rotas fora de DOTNET_API_URL.
const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/

export function buildTargetUrl(baseUrl: string, segments: string[] | undefined): string | null {
  if (!segments || segments.length === 0 || !segments.every((s) => SAFE_SEGMENT.test(s))) return null
  return `${baseUrl.replace(/\/+$/, '')}/${segments.join('/')}`
}
