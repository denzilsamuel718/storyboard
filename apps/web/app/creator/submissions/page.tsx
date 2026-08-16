"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { Empty, SubmissionCard } from "@/components/UI";

function SubmissionLibrary(){
  const params=useSearchParams(); const query=(params.get("q")||"").trim();
  const[items,setItems]=useState<any[]>([]);const[ready,setReady]=useState(false);const[error,setError]=useState("");
  useEffect(()=>{let active=true;setReady(false);setError("");api<any>("/submissions").then(r=>{if(active)setItems(r.submissions)}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"Unable to load your work")}).finally(()=>{if(active)setReady(true)});return()=>{active=false}},[]);
  const filtered=useMemo(()=>{if(!query)return items;const needle=query.toLowerCase();return items.filter(item=>[item.title,item.publicSubmissionId,item.genre,item.submissionType].some(value=>String(value||"").toLowerCase().includes(needle)))},[items,query]);
  return <div className="page"><div className="page-head"><div><div className="eyebrow">Your library</div><h1>Submitted work.</h1><p className="page-sub">{query?`Results for “${query}”.`:"Drafts, active reviews, and past decisions—all kept together."}</p></div><Link className="button accent" href="/creator/submissions/new"><Plus size={16}/>New submission</Link></div>{error&&<div className="alert" role="alert">{error}</div>}{!ready?<div className="empty">Loading your work…</div>:filtered.length?<div className="cards">{filtered.map(item=><SubmissionCard key={item.id} item={item}/>)}</div>:<Empty title={query?"No matching work":"A blank page, ready for you"} copy={query?"Try another title, genre, type, or submission ID.":undefined}/>}</div>;
}

export default function Submissions(){return <Suspense fallback={<div className="page"><div className="empty">Loading your work…</div></div>}><SubmissionLibrary/></Suspense>}
