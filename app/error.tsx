'use client';
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){return <main className="page-shell"><div className="empty-state" role="alert"><h2>Something interrupted your visit.</h2><p>Please try again. If an order was submitted, check your order history before placing it again.</p><button className="button button-dark" onClick={reset}>Try again</button></div></main>;}
