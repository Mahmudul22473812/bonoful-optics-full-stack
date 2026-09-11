'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
type Item={path:string;label:string;permission:string;group:string};
const names:Record<string,string>={STORE:'Daily overview',CATALOG:'Products & catalog',OPERATIONS:'Stock & purchasing',RELATIONSHIPS:'Customers & promotions',SETTINGS:'Team & settings'};
export function AdminNavigation({items,view}:{items:Item[];view:string}){
 const activeGroup=items.find(item=>item.path===view)?.group;
 const [expanded,setExpanded]=useState<string[]>(['STORE',...(activeGroup?[activeGroup]:[])]);
 const [mobileOpen,setMobileOpen]=useState(false);
 useEffect(()=>{if(activeGroup)setExpanded(previous=>previous.includes(activeGroup)?previous:[...previous,activeGroup]);setMobileOpen(false);},[activeGroup,view]);
 const groups=[...new Set(items.map(item=>item.group))];
 return <><button className="admin-menu-toggle" aria-expanded={mobileOpen} aria-controls="admin-navigation" onClick={()=>setMobileOpen(value=>!value)}>Management menu <span aria-hidden="true">{mobileOpen?'−':'＋'}</span></button><nav id="admin-navigation" className={mobileOpen?'management-navigation is-open':'management-navigation'} aria-label="Administration">{groups.map(group=><section className="management-nav-group" key={group}><button className="management-group-toggle" aria-expanded={expanded.includes(group)} aria-controls={'admin-group-'+group} onClick={()=>setExpanded(previous=>previous.includes(group)?previous.filter(value=>value!==group):[...previous,group])}><span>{names[group]??group}</span><span aria-hidden="true">{expanded.includes(group)?'−':'＋'}</span></button><div id={'admin-group-'+group} hidden={!expanded.includes(group)}>{items.filter(item=>item.group===group).map(item=><Link key={item.path} scroll={false} href={`/admin${item.path?`/${item.path}`:''}`} aria-current={view===item.path?'page':undefined}><span>{item.label}</span><span className="management-nav-arrow" aria-hidden="true">›</span></Link>)}</div></section>)}</nav></>;
}
