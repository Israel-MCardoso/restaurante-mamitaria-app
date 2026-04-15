import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { getWhatsAppUrl } from './siteConfig';

export function Hero({ storefrontHref }: { storefrontHref: string }) {
  return (
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
      <div
        className="hero-orb absolute -left-10 top-40 h-48 w-48 rounded-full blur-3xl"
        style={{ backgroundColor: 'rgba(200, 135, 63, 0.24)' }}
      />
      <div
        className="hero-orb absolute bottom-24 right-12 h-64 w-64 rounded-full blur-3xl"
        style={{ backgroundColor: 'rgba(111, 143, 114, 0.18)', animationDelay: '1.5s' }}
      />

      <div className="content-shell relative z-10 w-full pb-14 sm:pb-[4.5rem] lg:pb-24">
        <div className="grid items-end gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.34fr)] lg:gap-10">
          <div className="max-w-4xl text-white">
            <div
              className="eyebrow-dot hero-reveal inline-flex items-center gap-3 rounded-full px-4 py-2"
              style={{
                backgroundColor: 'rgba(255, 250, 244, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
              }}
            >
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-white/[88%]">
                Almoço caseiro entregue no mesmo dia
              </span>
            </div>

            <div className="hero-reveal hero-reveal-delay mt-8 max-w-4xl">
              <span className="mb-4 block text-sm font-semibold uppercase tracking-[0.28em] text-white/[58%]">
                Sabor Mineiro
              </span>
              <h2
                className="max-w-[12ch] text-[clamp(4rem,9vw,8.4rem)] font-semibold leading-[0.92] tracking-[-0.055em]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Comida mineira com presença de almoço especial.
              </h2>
              <p className="mt-7 max-w-2xl text-[clamp(1.05rem,1.8vw,1.32rem)] leading-8 text-white/80 sm:leading-9">
                Marmitas preparadas diariamente com receitas tradicionais, ingredientes frescos e o cuidado de quem
                trata cada pedido como visita esperada para o almoço.
              </p>
            </div>

            <div className="hero-reveal hero-reveal-delay mt-10 flex flex-col items-start gap-4 sm:flex-row">
              <Link href={storefrontHref} className="premium-button px-8 py-4 sm:w-auto">
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

            <div className="hero-reveal hero-reveal-delay mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-white/[14%] pt-6 text-sm text-white/[72%]">
              <span>4,9 de média com mais de 2.500 pedidos avaliados</span>
              <span className="hidden h-1.5 w-1.5 rounded-full bg-white/[28%] sm:block" />
              <span>Atendimento direto pelo WhatsApp oficial da casa</span>
            </div>
          </div>

          <div className="hidden gap-6 text-white/[84%] lg:grid">
            <div className="border-t border-white/[14%] pt-5">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-white/[48%]">Cozinha do dia</p>
              <p className="mt-3 text-lg leading-8 text-white/[82%]">
                Pratos montados em pequenos lotes para manter textura, aroma e temperatura até a entrega.
              </p>
            </div>
            <div className="border-t border-white/[14%] pt-5">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-white/[48%]">Receita de casa</p>
              <p className="mt-3 text-lg leading-8 text-white/[82%]">
                Temperos feitos do zero, sem atalhos industriais, com repertório de mesa mineira tradicional.
              </p>
            </div>
            <div className="border-t border-white/[14%] pt-5">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-white/[48%]">Atendimento</p>
              <p className="mt-3 text-lg leading-8 text-white/[82%]">
                Pedido pelo WhatsApp com resposta rápida para almoço prático, elegante e sem surpresa.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 md:block">
        <div className="flex h-12 w-7 items-start justify-center rounded-full border border-white/[28%] p-2">
          <div className="h-2.5 w-1 rounded-full bg-white/80" />
        </div>
      </div>
    </section>
  );
}
