import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const DESCRIPTION =
  'Free online architecture diagram board with 250+ cloud & AWS icons, smart self-routing connections and PNG/SVG/JSON export — no sign-up, runs in your browser.'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Atom Flow',
  alternateName: 'Atom Flow Beta',
  url: 'https://atomflow.app',
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Web',
  browserRequirements: 'Requires JavaScript',
  inLanguage: 'en',
  description: DESCRIPTION,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  featureList: [
    'Drag-and-drop shapes, text, tags, tables and code snippets',
    '250+ built-in icons: AWS, databases, browsers, frameworks, languages, OS and file types',
    'Smart self-routing connections that bend around obstacles',
    'Solid, dashed and animated flowing edge styles',
    'PNG, SVG and JSON export with JSON import',
    'Browser autosave — no sign-up, works offline',
    'Lock/present mode, fullscreen, light and dark themes',
    'Grid and dot backgrounds with a radial quick menu',
  ],
  author: { '@type': 'Organization', name: 'Atom Labs' },
}

export const metadata: Metadata = {
  metadataBase: new URL('https://atomflow.app'),
  title: {
    default: 'Atom Flow — Free Online Architecture Diagram Tool',
    template: '%s · Atom Flow',
  },
  description: DESCRIPTION,
  applicationName: 'Atom Flow',
  authors: [{ name: 'Atom Labs' }],
  creator: 'Atom Labs',
  publisher: 'Atom Labs',
  keywords: [
    'architecture diagram tool',
    'cloud architecture diagram',
    'aws diagram tool',
    'network diagram maker',
    'system design diagram',
    'flow diagram online',
    'diagram editor',
    'free diagram tool',
    'online whiteboard',
    'aws icons',
    'cloud diagram software',
    'atom flow',
  ],
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Atom Flow',
    locale: 'en_US',
    title: 'Atom Flow — Free Online Architecture Diagram Tool',
    description: DESCRIPTION,
    images: [
      {
        url: '/og.png',
        width: 1440,
        height: 704,
        alt: 'Atom Flow — draw architecture diagrams with smart connections and 250+ cloud icons',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Atom Flow — Free Online Architecture Diagram Tool',
    description: DESCRIPTION,
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  category: 'technology',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
