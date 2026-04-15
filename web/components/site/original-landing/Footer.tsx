import Link from 'next/link';
import { Instagram, Mail, MapPin, Phone } from 'lucide-react';
import { ADDRESS, INSTAGRAM_URL, MAPS_URL, PHONE_DISPLAY } from './siteConfig';

export function Footer({ storefrontHref }: { storefrontHref: string }) {
  return (
    <footer
      className="relative z-10 border-t py-14"
      style={{ backgroundColor: '#221714', borderColor: 'rgba(255,255,255,0.08)', color: 'white' }}
    >
      <div className="content-shell">
        <div className="grid gap-12 md:grid-cols-[1.2fr_0.8fr_0.9fr]">
          <div className="max-w-md">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-white/[42%]">Sabor Mineiro</span>
            <h3
              className="mt-4 text-[2.8rem] leading-none tracking-[-0.05em]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Comida com raiz, ritmo e calor de casa.
            </h3>
            <p className="mt-5 text-base leading-7 text-white/[64%]">
              Marmitas mineiras preparadas diariamente para quem quer almoçar com qualidade, memória afetiva e entrega
              confiável.
            </p>
          </div>

          <div>
            <p className="text-[0.78rem] font-semibold uppercase tracking-[0.24em] text-white/[42%]">Navegação</p>
            <div className="mt-5 space-y-3 text-base text-white/[72%]">
              <Link href={storefrontHref} className="block transition-colors hover:text-[var(--gold)]">
                Cardápio
              </Link>
              <Link href="/#sobre" className="block transition-colors hover:text-[var(--gold)]">
                Sobre nós
              </Link>
              <Link href="/#depoimentos" className="block transition-colors hover:text-[var(--gold)]">
                Avaliações
              </Link>
            </div>
          </div>

          <div>
            <p className="text-[0.78rem] font-semibold uppercase tracking-[0.24em] text-white/[42%]">Contato</p>
            <div className="mt-5 space-y-4 text-white/[72%]">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4" />
                <span>{PHONE_DISPLAY}</span>
              </div>
              <a
                href={MAPS_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-3 transition-colors hover:text-[var(--gold)]"
              >
                <MapPin className="mt-1 h-4 w-4 shrink-0" />
                <span>{ADDRESS}</span>
              </a>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 shrink-0" />
                <span>contato@sabormineiro.com</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 w-11 items-center justify-center rounded-full border transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
                style={{ borderColor: 'rgba(255,255,255,0.14)' }}
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <div
          className="mt-12 border-t pt-6 text-sm uppercase tracking-[0.2em] text-white/[34%]"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          © 2026 Sabor Mineiro. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
