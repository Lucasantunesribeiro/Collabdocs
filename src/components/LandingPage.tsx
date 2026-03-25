'use client'

import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface text-on-surface overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 glass border-b border-outline-variant">
        <span className="font-display font-bold text-xl gradient-text">CollabDocs</span>
        <Link
          href="/auth/signin"
          className="font-display font-semibold text-sm px-5 py-2 rounded-xl border border-outline text-on-surface hover:bg-surface-high transition-colors"
        >
          Entrar
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-20 pb-16 text-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary opacity-10 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-outline-variant bg-surface-container mb-8 text-sm text-on-surface-variant">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Colaboração em tempo real
          </div>

          <h1 className="font-display font-bold text-5xl md:text-7xl leading-tight mb-6">
            Documentos que
            <br />
            <span className="gradient-text">vivem juntos</span>
          </h1>

          <p className="text-lg md:text-xl text-on-surface-variant max-w-2xl mx-auto mb-10 leading-relaxed">
            Edite, colabore e compartilhe documentos em tempo real.
            Construído sobre Cloudflare Workers e ASP.NET Core.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signin" className="btn-primary text-base px-8 py-3">
              Começar Agora
            </Link>
            <Link
              href="/document/demo"
              className="font-display font-semibold text-base px-8 py-3 rounded-xl border border-outline text-on-surface hover:bg-surface-high transition-colors"
            >
              Ver Demo
            </Link>
          </div>
        </div>

        {/* Decorative cards */}
        <div className="relative z-10 mt-20 w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 px-4">
          {[
            { icon: 'bolt', label: 'Cloudflare Workers', desc: 'WebSocket em tempo real com Durable Objects. Zero cold-start.' },
            { icon: 'storage', label: 'ASP.NET Core 9', desc: 'CRUD, regras de negócio, Clean Architecture + PostgreSQL.' },
            { icon: 'brush', label: 'Next.js 14', desc: 'App Router, NextAuth OAuth, proxy seguro para a API.' },
          ].map((item) => (
            <div key={item.label} className="glass rounded-2xl p-6 text-left hover:border-outline transition-all group">
              <span
                className="material-symbols-outlined text-primary text-3xl mb-3 block"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
              >
                {item.icon}
              </span>
              <h3 className="font-display font-semibold text-base text-on-surface mb-2">{item.label}</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 max-w-5xl mx-auto">
        <h2 className="font-display font-bold text-3xl md:text-4xl text-center mb-16">
          Tudo que você precisa para
          <span className="gradient-text"> colaborar</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { icon: 'group', title: 'Colaboração em tempo real', desc: 'WebSocket via Durable Objects. Veja quem está editando ao vivo com presença de usuários.' },
            { icon: 'lock', title: 'Controle de acesso', desc: 'Documentos públicos ou privados. Convide colaboradores por email com permissões granulares.' },
            { icon: 'shield', title: 'Autenticação segura', desc: 'OAuth via GitHub e Google. JWT HS256 compartilhado entre todos os serviços.' },
            { icon: 'history', title: 'Audit trail completo', desc: 'Todas as operações registradas. Rate limiting por IP via Durable Object.' },
          ].map((f) => (
            <div key={f.title} className="glass rounded-2xl p-6 flex gap-4 hover:border-outline transition-all">
              <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center flex-shrink-0">
                <span
                  className="material-symbols-outlined text-secondary text-xl"
                  style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
                >
                  {f.icon}
                </span>
              </div>
              <div>
                <h3 className="font-display font-semibold text-base text-on-surface mb-1">{f.title}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 text-center">
        <div className="glass rounded-3xl max-w-2xl mx-auto p-12">
          <h2 className="font-display font-bold text-3xl mb-4">Pronto para começar?</h2>
          <p className="text-on-surface-variant mb-8">Crie sua conta gratuitamente e comece a colaborar agora.</p>
          <Link href="/auth/signin" className="btn-primary text-base px-10 py-4 inline-block">
            Criar conta grátis
          </Link>
        </div>
      </section>
    </div>
  )
}
