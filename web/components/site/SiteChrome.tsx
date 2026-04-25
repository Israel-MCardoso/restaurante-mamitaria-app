'use client';

import Link from 'next/link';
import { ArrowLeft, Instagram, Mail, MapPin, MessageCircle, Phone, ShoppingBag } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { BrandLogo } from '@/components/site/BrandLogo';
import { ADDRESS, getWhatsAppUrl, MAPS_URL, PHONE_DISPLAY } from '@/components/site/original-landing/siteConfig';

function CartShortcut({ href, label = 'Carrinho' }: { href: string; label?: string }) {
  const { itemCount } = useCart();

  return (
    <Link
      href={href}
      className="premium-button relative w-auto shrink-0 px-3 py-2.5 text-[0.9rem] sm:px-5 sm:py-3"
      style={{ boxShadow: '0 12px 30px rgba(107, 62, 46, 0.16)', width: 'auto' }}
      aria-label="Abrir carrinho"
    >
      <ShoppingBag className="h-4 w-4" />
      <span className="hidden md:inline">{label}</span>
      {itemCount ? (
        <span
          className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold"
          style={{ backgroundColor: 'var(--surface-dark)', color: 'white' }}
        >
          {itemCount}
        </span>
      ) : null}
    </Link>
  );
}

export function MarketingHeader({ storefrontHref = '/checkout' }: { storefrontHref?: string }) {
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
              href={storefrontHref}
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
              href="/#depoimentos"
              className="text-[0.8rem] font-semibold uppercase tracking-[0.22em] transition-colors hover:text-[var(--brand)]"
              style={{ color: 'rgba(53, 39, 34, 0.74)' }}
            >
              Avaliações
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
            <CartShortcut href={storefrontHref} />
          </div>
        </div>
      </div>
    </header>
  );
}

export function StorefrontHeader({ storefrontHref }: { storefrontHref: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-[rgba(255,250,244,0.92)] px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="content-shell">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="min-w-0 flex-1 md:flex-none">
            <BrandLogo compact />
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <Link
              href="/"
              className="text-[0.78rem] font-semibold uppercase tracking-[0.22em] transition-colors hover:text-[var(--brand)]"
              style={{ color: 'rgba(53, 39, 34, 0.72)' }}
            >
              Início
            </Link>
            <Link
              href={storefrontHref}
              className="text-[0.78rem] font-semibold uppercase tracking-[0.22em] transition-colors hover:text-[var(--brand)]"
              style={{ color: 'rgba(53, 39, 34, 0.72)' }}
            >
              Cardápio
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href={getWhatsAppUrl()}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border px-4 py-3 text-sm font-semibold transition hover:bg-white"
              style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
            >
              <span className="inline-flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">WhatsApp</span>
              </span>
            </a>
            <CartShortcut href={storefrontHref} />
          </div>
        </div>
      </div>
    </header>
  );
}

export function AppHeader({
  backHref,
  backLabel,
}: {
  backHref: string;
  backLabel: string;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-[rgba(255,250,244,0.96)] px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="content-shell">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="min-w-0 flex-1 md:flex-none">
            <BrandLogo compact />
          </Link>

          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition hover:bg-white"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{backLabel}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ storefrontHref = '/' }: { storefrontHref?: string }) {
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
                href="https://www.instagram.com/daianaxavier_marmitaria?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
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

export function AppFooter() {
  return (
    <footer className="border-t px-4 py-6 sm:px-6 lg:px-8" style={{ borderColor: 'var(--line)', backgroundColor: 'rgba(255,250,244,0.72)' }}>
      <div className="content-shell flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p style={{ color: 'var(--ink-muted)' }}>Sabor Mineiro</p>
        <p style={{ color: 'var(--ink-muted)' }}>Atendimento: {PHONE_DISPLAY}</p>
      </div>
    </footer>
  );
}
