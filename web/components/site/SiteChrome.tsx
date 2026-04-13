'use client';

import Link from 'next/link';
import { MessageCircle, ShoppingBag } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useStorefront } from '@/contexts/StorefrontContext';
import { BrandLogo } from '@/components/site/BrandLogo';

const PHONE_DISPLAY = '+55 15 99144-2274';
const WHATSAPP_NUMBER = '5515991442274';
const ADDRESS = 'R. Gustavo Teixeira, 42 - Vila Independência';
const MAPS_URL = 'https://maps.app.goo.gl/B2EL1dMpC4auAbj96';

function getWhatsAppUrl(message = 'Olá! Gostaria de fazer um pedido.') {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function SiteHeader({ fallbackMenuHref = '/checkout' }: { fallbackMenuHref?: string }) {
  const { itemCount } = useCart();
  const { restaurant } = useStorefront();
  const menuHref = restaurant?.slug ? `/${restaurant.slug}` : fallbackMenuHref;

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6 lg:px-8">
      <div className="content-shell">
        <div
          className="premium-surface flex items-center justify-between gap-3 rounded-[2rem] px-3 py-3 sm:px-6 sm:py-4"
          style={{ borderColor: 'rgba(255, 255, 255, 0.68)' }}
        >
          <Link href="/" className="min-w-0 flex-1 md:flex-none">
            <BrandLogo compact />
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <Link
              href={menuHref}
              className="text-[0.8rem] font-semibold uppercase tracking-[0.22em] transition-colors hover:text-[var(--brand)]"
              style={{ color: 'rgba(53, 39, 34, 0.74)' }}
            >
              Cardápio
            </Link>
            <Link
              href="/#sobre"
              className="text-[0.8rem] font-semibold uppercase tracking-[0.22em] transition-colors hover:text-[var(--brand)]"
              style={{ color: 'rgba(53, 39, 34, 0.74)' }}
            >
              Sobre nós
            </Link>
            <Link
              href="/#experiencia"
              className="text-[0.8rem] font-semibold uppercase tracking-[0.22em] transition-colors hover:text-[var(--brand)]"
              style={{ color: 'rgba(53, 39, 34, 0.74)' }}
            >
              Experiência
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href={getWhatsAppUrl()}
              target="_blank"
              rel="noreferrer"
              className="premium-button hidden w-auto shrink-0 px-3 py-2.5 text-[0.9rem] lg:inline-flex xl:px-6 xl:py-3"
              style={{ boxShadow: '0 12px 30px rgba(107, 62, 46, 0.16)', width: 'auto' }}
              aria-label="Pedir no WhatsApp"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden xl:inline">Pedir no WhatsApp</span>
              <span className="hidden lg:inline xl:hidden">WhatsApp</span>
            </a>
            <Link
              href={menuHref}
              className="premium-button relative w-auto shrink-0 px-3 py-2.5 text-[0.9rem] sm:px-5 sm:py-3"
              style={{ boxShadow: '0 12px 30px rgba(107, 62, 46, 0.16)', width: 'auto' }}
              aria-label="Abrir carrinho"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden md:inline">Carrinho</span>
              {itemCount ? (
                <span
                  className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold"
                  style={{ backgroundColor: 'var(--surface-dark)', color: 'white' }}
                >
                  {itemCount}
                </span>
              ) : null}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer
      className="relative z-10 border-t py-14"
      style={{ backgroundColor: '#221714', borderColor: 'rgba(255,255,255,0.08)', color: 'white' }}
    >
      <div className="content-shell">
        <div className="grid gap-12 md:grid-cols-[1.2fr_0.8fr_0.9fr]">
          <div className="max-w-md">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-white/42">Família Mineira</span>
            <h3
              className="mt-4 text-[2.8rem] leading-none tracking-[-0.05em]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Comida com raiz, ritmo e calor de casa.
            </h3>
            <p className="mt-5 text-base leading-7 text-white/64">
              Marmitas mineiras preparadas diariamente para quem quer almoçar com qualidade, memória afetiva e entrega
              confiável.
            </p>
          </div>

          <div>
            <p className="text-[0.78rem] font-semibold uppercase tracking-[0.24em] text-white/42">Navegação</p>
            <div className="mt-5 space-y-3 text-base text-white/72">
              <Link href="/" className="block transition-colors hover:text-[var(--gold)]">
                Início
              </Link>
              <Link href="/#sobre" className="block transition-colors hover:text-[var(--gold)]">
                Sobre nós
              </Link>
              <Link href="/#experiencia" className="block transition-colors hover:text-[var(--gold)]">
                Experiência
              </Link>
            </div>
          </div>

          <div>
            <p className="text-[0.78rem] font-semibold uppercase tracking-[0.24em] text-white/42">Contato</p>
            <div className="mt-5 space-y-4 text-white/72">
              <div>{PHONE_DISPLAY}</div>
              <a href={MAPS_URL} target="_blank" rel="noreferrer" className="block transition-colors hover:text-[var(--gold)]">
                {ADDRESS}
              </a>
              <div>contato@sabormineiro.com</div>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t pt-6 text-sm uppercase tracking-[0.2em] text-white/34" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          © 2026 Família Mineira. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
