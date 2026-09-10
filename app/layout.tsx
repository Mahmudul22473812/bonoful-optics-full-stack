import type { Metadata } from 'next';

import { CommerceProvider } from '@/components/commerce-provider';
import { SiteShell } from '@/components/site-shell';
import { FormValidation } from '@/components/form-validation';
import './globals.css';
import './account-polish.css';
import './product-viewer.css';
import './admin-polish.css';
import './readability.css';




export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'Bonoful Optics — Eyeglasses & Sunglasses', template: '%s · Bonoful Optics' },
  description: 'Shop eyeglasses, sunglasses and everyday frames at Bonoful Optics.',
  openGraph: { title:'Bonoful Optics', description:'See well. Look entirely yourself.', images:[{ url:'/og.png', width:1672, height:941, alt:'Bonoful Optics tortoiseshell eyewear' }] },
  twitter: { card:'summary_large_image', title:'Bonoful Optics', description:'See well. Look entirely yourself.', images:['/og.png'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><FormValidation/><CommerceProvider><SiteShell>{children}</SiteShell></CommerceProvider></body></html>;
}
