import type {ReactNode} from 'react';
import {AdminDashboard} from '@/components/admin/admin-dashboard';
export default function AdminLayout({children}:{children:ReactNode}){return <><AdminDashboard/>{children}</>;}
