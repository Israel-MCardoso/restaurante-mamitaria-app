import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function FinalCTA({ storefrontHref }: { storefrontHref: string }) {
  return (
    <section className="section-shell overflow-hidden" style={{ backgroundColor: 'var(--surface-dark)' }}>
      <div
        className="absolute -left-16 top-10 h-56 w-56 rounded-full blur-3xl"
        style={{ backgroundColor: 'rgba(200, 135, 63, 0.18)' }}
      />
      <div
        className="absolute -right-16 bottom-10 h-64 w-64 rounded-full blur-3xl"
        style={{ backgroundColor: 'rgba(111, 143, 114, 0.16)' }}
      />

      <div className="content-shell relative z-10">
        <div className="mx-auto max-w-4xl text-center">
          <span className="section-kicker" style={{ color: 'rgba(255,255,255,0.42)' }}>
            Pedido imediato
          </span>
          <h2
            className="mx-auto mt-4 max-w-[10ch] text-[clamp(3.2rem,6vw,5.4rem)] leading-[0.94] tracking-[-0.05em] text-white"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Seu próximo almoço pode sair daqui em minutos.
          </h2>
          <p className="mx-auto mt-7 max-w-2xl text-[1.1rem] leading-8 text-white/74">
            Monte seu pedido pelo cardápio e receba uma marmita quentinha, bem montada e pronta para transformar a
            pausa do dia em um momento melhor.
          </p>

          <div className="mt-10 flex justify-center">
            <Link href={storefrontHref} className="premium-button px-8 py-4 sm:w-auto">
              Pedir agora
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>

          <p className="mt-6 text-sm uppercase tracking-[0.22em] text-white/46">
            Atendimento complementar pelo WhatsApp
          </p>
        </div>
      </div>
    </section>
  );
}
