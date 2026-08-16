import Link from "next/link";

export default function NotFound(){return <main className="auth-panel" style={{minHeight:"calc(100vh - 44px)"}}><div className="auth-card"><Link href="/" className="brand"><span className="brand-mark">S</span>StoryBoard</Link><div className="eyebrow" style={{marginTop:56}}>Page not found</div><h1>This page has left the story.</h1><p>The address may be incorrect, or the page may have moved.</p><Link className="button accent" href="/">Return home</Link></div></main>}
