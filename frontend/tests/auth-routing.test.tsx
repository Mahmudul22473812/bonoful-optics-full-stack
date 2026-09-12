import { describe,expect,it } from 'vitest';
import { postLoginDestination } from '@/lib/auth-routing';

describe('post-login routing',()=>{
  it.each(['staff','admin','super_admin','inventory_manager'])('sends %s users to administration',roleId=>{
    expect(postLoginDestination({roleId},'/account')).toBe('/admin');
  });

  it('keeps a customer return destination',()=>{
    expect(postLoginDestination({roleId:'customer'},'/checkout')).toBe('/checkout');
  });

  it('does not send customers into administration',()=>{
    expect(postLoginDestination({roleId:'customer'},'/admin/orders')).toBe('/account');
  });
});
