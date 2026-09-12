import type { User } from '@/components/commerce-provider';

export function postLoginDestination(user:Pick<User,'roleId'>,returnTo:string) {
  if(user.roleId!=='customer') return '/admin';
  return returnTo.startsWith('/admin')?'/account':returnTo;
}
