import Link from 'next/link';
import { MessageCircle, ShoppingCart } from 'lucide-react';
import { BrandLogo } from '@/components/site/BrandLogo';
import { getWhatsAppUrl } from './siteConfig';

export function Header({ storefrontHref }: { storefrontHref: string }) {
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
              className="premium-button hidden w-auto shrink-0 px-3 py-2.5 text-[0.9rem] md:inline-flex xl:px-6 xl:py-3"
              style={{ boxShadow: '0 12px 30px rgba(107, 62, 46, 0.16)', width: 'auto' }}
              aria-label="Pedir no WhatsApp"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden xl:inline">Pedir no WhatsApp</span>
              <span className="hidden md:inline xl:hidden">WhatsApp</span>
            </a>
            <Link
              href={storefrontHref}
              className="premium-button relative w-auto shrink-0 px-3 py-2.5 text-[0.9rem] sm:px-5 sm:py-3"
              style={{ boxShadow: '0 12px 30px rgba(107, 62, 46, 0.16)', width: 'auto' }}
              aria-label="Abrir carrinho"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden md:inline">Carrinho</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
