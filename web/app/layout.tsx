import './globals.css';
import { Inter } from 'next/font/google';
import { CartProvider } from '@/contexts/CartContext';
import { StorefrontProvider } from '@/contexts/StorefrontContext';

const inter = Inter({ subsets: ['latin'] });

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
      <body className={inter.className}>
        <StorefrontProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </StorefrontProvider>
      </body>
    </html>
  );
}
