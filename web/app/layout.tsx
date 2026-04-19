import './globals.css';
import '@/components/site/landing.css';
import { Cormorant_Garamond, Manrope } from 'next/font/google';
import { CartProvider } from '@/contexts/CartContext';
import { StorefrontProvider } from '@/contexts/StorefrontContext';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-cormorant',
});

export const metadata = {
  title: 'Família Mineira | Marmitaria e Doceria',
  description: 'Peça online pratos caseiros preparados com sabor de comida feita em casa.',
  icons: {
    icon: '/daiana-xavier.png',
    shortcut: '/daiana-xavier.png',
    apple: '/daiana-xavier.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={`${manrope.variable} ${cormorant.variable}`}>
        <StorefrontProvider>
          <CartProvider>{children}</CartProvider>
        </StorefrontProvider>
      </body>
    </html>
  );
}
