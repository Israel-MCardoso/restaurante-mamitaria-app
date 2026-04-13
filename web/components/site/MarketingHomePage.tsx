import Link from 'next/link';
import { ArrowRight, MessageCircle, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { BrandLogo } from '@/components/site/BrandLogo';

function getWhatsAppUrl(message = 'Olá! Gostaria de fazer um pedido.') {
  return `https://wa.me/5515991442274?text=${encodeURIComponent(message)}`;
}

export function MarketingHomePage({
  storefrontHref,
}: {
  storefrontHref: string | null;
}) {
  const primaryHref = storefrontHref ?? '/checkout';

  return (
    <main className="page-shell">
      <section className="relative flex min-h-screen items-end overflow-hidden pt-32">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1621179816782-1c39a6583fbc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicmF6aWxpYW4lMjBmZWlqb2FkYSUyMGZvb2R8ZW58MXx8fHwxNzc1NzU3MTcxfDA&ixlib=rb-4.1.0&q=80&w=1600')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(18, 12, 10, 0.86) 0%, rgba(18, 12, 10, 0.58) 44%, rgba(18, 12, 10, 0.34) 100%)',
          }}
        />
        <div className="hero-orb absolute -left-10 top-40 h-48 w-48 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(200, 135, 63, 0.24)' }} />
        <div className="hero-orb absolute bottom-24 right-12 h-64 w-64 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(111, 143, 114, 0.18)', animationDelay: '1.5s' }} />

        <div className="content-shell relative z-10 w-full pb-14 sm:pb-18 lg:pb-24">
          <div className="grid items-end gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.34fr)] lg:gap-10">
            <div className="max-w-4xl text-white">
              <div
                className="hero-reveal inline-flex items-center gap-3 rounded-full px-4 py-2"
                style={{
                  backgroundColor: 'rgba(255, 250, 244, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                }}
              >
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-white/88">
                  Almoço caseiro entregue no mesmo dia
                </span>
              </div>

              <div className="hero-reveal hero-reveal-delay mt-8 max-w-4xl">
                <div className="mb-6 max-w-max rounded-[2rem] bg-white/10 px-6 py-4 backdrop-blur">
                  <BrandLogo />
                </div>
                <span className="mb-4 block text-sm font-semibold uppercase tracking-[0.28em] text-white/58">
                  Marmitaria premium
                </span>
                <h1
                  className="max-w-[12ch] text-[clamp(4rem,9vw,8.4rem)] font-semibold leading-[0.92] tracking-[-0.055em]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Comida mineira com sabor de almoço feito em casa.
                </h1>
                <p className="mt-7 max-w-2xl text-[clamp(1.05rem,1.8vw,1.32rem)] leading-8 text-white/80 sm:leading-9">
                  Escolha seus pratos favoritos, monte seu pedido em poucos passos e finalize com praticidade pelo site.
                </p>
              </div>

              <div className="hero-reveal hero-reveal-delay mt-10 flex flex-col items-start gap-4 sm:flex-row">
                <Link href={primaryHref} className="premium-button px-8 py-4 sm:w-auto">
                  Fazer pedido
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <a
                  href={getWhatsAppUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="premium-button premium-button--ghost px-8 py-4 text-white sm:w-auto"
                  style={{ color: 'white' }}
                >
                  <MessageCircle className="h-5 w-5" />
                  WhatsApp
                </a>
              </div>

              <div className="hero-reveal hero-reveal-delay mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-white/14 pt-6 text-sm text-white/72">
                <span>Pedido online com confirmação rápida</span>
                <span className="hidden h-1.5 w-1.5 rounded-full bg-white/28 sm:block" />
                <span>Acompanhamento do pedido em tempo real</span>
              </div>
            </div>

            <div className="hidden gap-6 text-white/84 lg:grid">
              <div className="border-t border-white/14 pt-5">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-white/48">Cozinha do dia</p>
                <p className="mt-3 text-lg leading-8 text-white/82">
                  Pratos montados em pequenos lotes para manter textura, aroma e temperatura até a entrega.
                </p>
              </div>

              <div className="border-t border-white/14 pt-5">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-white/48">Experiência</p>
                <p className="mt-3 text-lg leading-8 text-white/82">
                  Uma experiência acolhedora, pensada para quem quer pedir com rapidez e confiança.
                </p>
              </div>

              <div className="border-t border-white/14 pt-5">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-white/48">Atendimento</p>
                <p className="mt-3 text-lg leading-8 text-white/82">
                  Do primeiro clique até a confirmação, cada etapa foi desenhada para transmitir segurança e clareza.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="sobre" className="section-shell section-divider">
        <div className="content-shell grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <span className="section-kicker">Sobre a casa</span>
            <h2 className="section-title mt-4">Raiz mineira com cuidado em cada detalhe do pedido.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Sparkles,
                title: 'Visual marcante',
                copy: 'Uma apresentação calorosa, com identidade própria e navegação simples para o cliente escolher sem esforço.',
              },
              {
                icon: Truck,
                title: 'Pedido fácil',
                copy: 'Da escolha do prato ao acompanhamento da entrega, o fluxo foi desenhado para ser claro e direto.',
              },
              {
                icon: ShieldCheck,
                title: 'Mais confiança',
                copy: 'Valores e etapas do pedido são confirmados antes da finalização para oferecer uma experiência mais segura.',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="soft-card rounded-[2rem] p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-[var(--brand)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-3xl leading-none tracking-[-0.04em]" style={{ color: 'var(--ink-strong)', fontFamily: 'var(--font-display)' }}>
                    {item.title}
                  </h3>
                  <p className="mt-4 text-sm leading-7" style={{ color: 'var(--ink-muted)' }}>
                    {item.copy}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="experiencia" className="section-shell section-divider overflow-hidden" style={{ backgroundColor: 'rgba(255, 255, 255, 0.55)' }}>
        <div className="content-shell">
          <div className="grid gap-6 lg:grid-cols-2">
            <article className="soft-card rounded-[2rem] p-8">
              <span className="section-kicker">Storefront</span>
              <h2 className="mt-4 text-[2.8rem] leading-none tracking-[-0.05em]" style={{ color: 'var(--ink-strong)', fontFamily: 'var(--font-display)' }}>
                Hero, identidade e cardápio com linguagem acolhedora.
              </h2>
              <p className="mt-5 text-base leading-7" style={{ color: 'var(--ink-muted)' }}>
                A loja online apresenta os pratos com destaque, boa leitura e um caminho simples para começar o pedido.
              </p>
            </article>
            <article className="soft-card rounded-[2rem] p-8">
              <span className="section-kicker">Checkout e acompanhamento</span>
              <h2 className="mt-4 text-[2.8rem] leading-none tracking-[-0.05em]" style={{ color: 'var(--ink-strong)', fontFamily: 'var(--font-display)' }}>
                Compra fluida, do carrinho à confirmação.
              </h2>
              <p className="mt-5 text-base leading-7" style={{ color: 'var(--ink-muted)' }}>
                O cliente acompanha cada etapa com clareza, desde os dados de entrega até a confirmação do pedido.
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
