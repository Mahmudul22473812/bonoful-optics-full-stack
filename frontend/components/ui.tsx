import Link from 'next/link';
export function EmptyState({title,children,href,label}:{title:string;children?:React.ReactNode;href?:string;label?:string}){return <div className="empty-state"><span className="empty-mark" aria-hidden="true">○</span><h2>{title}</h2>{children&&<p>{children}</p>}{href&&<Link className="button button-dark" href={href}>{label??'Continue'}</Link>}</div>;}
export function Alert({children}:{children:React.ReactNode}){return <p className="form-alert" role="alert">{children}</p>;}
export function Status({value}:{value:string}){return <span className={`status status-${value.toLowerCase()}`}>{value.replaceAll('_',' ').toLowerCase()}</span>;}
export function Breadcrumb({items}:{items:{label:string;href?:string}[]}){return <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link>{items.map((item,i)=><span key={i}><span aria-hidden="true">/</span>{item.href?<Link href={item.href}>{item.label}</Link>:<span aria-current="page">{item.label}</span>}</span>)}</nav>;}
export function Loading(){return <div role="status" className="loading-state"><span className="loading-line"/><span className="loading-line"/><p>Loading…</p></div>;}
