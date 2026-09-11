import {render,screen,fireEvent} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {AdminNavigation} from '@/components/admin/admin-navigation';
vi.mock('next/link',()=>({default:({children,scroll,...props}:any)=><a {...props}>{children}</a>}));
const items=[{path:'',label:'Overview',permission:'reports.read',group:'STORE'},{path:'products',label:'Products',permission:'products.read',group:'CATALOG'},{path:'staff',label:'Team members',permission:'users.manage',group:'SETTINGS'}];
test('groups collapse and current destination opens on navigation',()=>{
 const {rerender}=render(<AdminNavigation items={items} view="products"/>);
 expect(screen.getByRole('link',{name:'Products'})).toHaveAttribute('aria-current','page');
 expect(screen.queryByRole('link',{name:'Team members'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Products & catalog'}));
 expect(screen.queryByRole('link',{name:'Products'})).not.toBeInTheDocument();
 rerender(<AdminNavigation items={items} view="staff"/>);
 expect(screen.getByRole('link',{name:'Team members'})).toHaveAttribute('aria-current','page');
});
test('does not add navigation items beyond the permitted input',()=>{
 render(<AdminNavigation items={[items[1]]} view="products"/>);
 expect(screen.queryByRole('button',{name:'Team & settings'})).not.toBeInTheDocument();
});
