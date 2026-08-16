import Link from "next/link";
import { ArrowRight, Check, ChevronUp, ShieldCheck } from "lucide-react";

export default function Home() {
  return <main className="marketing" id="top">
    <header className="topbar">
      <Link href="/#top" className="brand" aria-label="StoryBoard homepage"><span className="brand-mark">S</span><span>StoryBoard</span></Link>
      <nav className="navlinks" aria-label="Website navigation">
        <Link href="/#top">Home</Link>
        <Link href="/#process">How it works</Link>
        <Link href="/terms">Submission terms</Link>
        <Link href="/login">Sign in</Link>
        <Link className="button" href="/register">Create account <ArrowRight size={15}/></Link>
      </nav>
    </header>
    <section className="hero">
      <div><div className="eyebrow">For writers, filmmakers & storytellers</div><h1>Give your story somewhere to go.</h1><p className="hero-copy">A considered space to submit original scripts, stories, screenplays, films and pitches—then follow every step of the review with confidence.</p><div className="hero-actions"><Link className="button accent" href="/register">Submit your work <ArrowRight size={15}/></Link><Link className="button secondary" href="/login">Continue a draft</Link></div><p className="hint" style={{marginTop:22}}><ShieldCheck size={14} style={{verticalAlign:"middle",marginRight:7}}/>Private files · secure review · your rights stay yours</p></div>
      <div className="folio" aria-label="Platform features"><article className="folio-card"><span className="folio-number">01</span><div><h3>A beautiful submission journey</h3><p>Guided, saveable, and calm from first word to final upload.</p></div></article><article className="folio-card"><span className="folio-number">02</span><div><h3>Track what happens next</h3><p>Clear status updates and a permanent reference ID for every work.</p></div></article></div>
    </section>
    <section id="process" className="process-section" aria-labelledby="process-title">
      <div className="process-heading"><div><div className="eyebrow">A thoughtful process</div><h2 id="process-title">From first draft to decision.</h2></div><Link className="back-to-top" href="/#top">Back to home <ChevronUp size={15}/></Link></div>
      <div className="cards">{[["Prepare","Describe your work and add scripts, artwork, or video."],["Submit","Confirm your rights and receive a permanent SB reference ID."],["Follow","See review progress and messages in your private studio."]].map(([t,c],i)=><article className="card" key={t}><div className="card-kicker"><span>0{i+1}</span><Check size={15}/></div><h3>{t}</h3><p>{c}</p></article>)}</div>
      <div className="process-cta"><div><strong>Ready to share your work?</strong><p>Create your private studio and move through the five guided steps.</p></div><Link className="button accent" href="/register">Start a submission <ArrowRight size={15}/></Link></div>
    </section>
    <footer className="site-footer"><Link href="/#top" className="brand"><span className="brand-mark">S</span><span>StoryBoard</span></Link><p>A private home for original stories, scripts, films, and pitches.</p><nav aria-label="Footer navigation"><Link href="/terms">Submission terms</Link><Link href="/login">Sign in</Link><Link href="/#top">Back to top</Link></nav></footer>
  </main>;
}
