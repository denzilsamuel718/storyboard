"use client";
import Link from "next/link";

export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){return <main className="auth-panel" style={{minHeight:"calc(100vh - 44px)"}}><div className="auth-card"><Link href="/" className="brand"><span className="brand-mark">S</span>StoryBoard</Link><div className="eyebrow" style={{marginTop:56}}>Something went wrong</div><h1>We couldn’t open this page.</h1><p>Your information is safe. Try the request again or return to the homepage.</p><div className="hero-actions"><button type="button" className="button accent" onClick={reset}>Try again</button><Link className="button secondary" href="/">Return home</Link></div></div></main>}
