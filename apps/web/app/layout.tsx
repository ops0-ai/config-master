import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://ops0.com'),
  title: 'Pulse - Enterprise IT Configurations Management',
  description: "Enterprise configuration management for Kubernetes, servers, and cloud infrastructure. Auto-detects drift, fixes misconfigs, patches systems, and maintains compliance 24/7. Your infrastructure's immune system.",
  keywords: 'configuration management, devops, automation, infrastructure, IT management, kubernetes, cloud, compliance, drift detection',
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Pulse - Enterprise IT Configurations Management',
    description: "Enterprise configuration management for Kubernetes, servers, and cloud infrastructure. Auto-detects drift, fixes misconfigs, patches systems, and maintains compliance 24/7. Your infrastructure's immune system.",
    url: 'https://ops0.com',
    siteName: 'Pulse',
    images: [
      {
        url: '/images/share.png',
        width: 1200,
        height: 630,
        alt: 'Pulse - Enterprise IT Configurations Management',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pulse - Enterprise IT Configurations Management',
    description: "Enterprise configuration management for Kubernetes, servers, and cloud infrastructure. Auto-detects drift, fixes misconfigs, patches systems, and maintains compliance 24/7. Your infrastructure's immune system.",
    images: ['/images/share.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}