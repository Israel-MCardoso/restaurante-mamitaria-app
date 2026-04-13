import './globals.css';
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
  title: 'Meu Delivery',
  description: 'Peça online agora mesmo!',
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
          <CartProvider>
            {children}
          </CartProvider>
        </StorefrontProvider>
      </body>
    </html>
  );
}
