import { Inter, Fraunces } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

export const metadata = {
  title: 'Munshi — Personal Finance Coach',
  description: 'Private, zero-cost personal finance management and projection bahi-khata for India.',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg'
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="bg-canvas text-ink font-sans min-h-screen selection:bg-primary-tint selection:text-primary">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#FFFFFF',
              color: '#14201B',
              border: '1px solid #E7E2D8',
              borderRadius: '10px',
              fontFamily: 'var(--font-inter), sans-serif',
              boxShadow: '0 4px 12px rgba(20, 32, 27, 0.08)',
            },
          }}
        />
      </body>
    </html>
  );
}
