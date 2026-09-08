'use client';
import {usePathname} from 'next/navigation';
import {CartDrawer} from './cart-drawer';
import {SiteHeader} from './site-header';
import {SiteFooter} from './site-footer';
export function SiteShell({children}:{children:React.ReactNode}){const pathname=usePathname();if(pathname.startsWith('/admin'))return <>{children}</>;return <><a className="skip-link" href="#main-content">Skip to content</a><SiteHeader/><div id="main-content">{children}</div><SiteFooter/><CartDrawer/></>;}
