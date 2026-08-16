"use client";
import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { api, date } from "@/lib/api";
import { Status } from "@/components/UI";
import { SUBMISSION_STATUSES, formatLabel } from "@storyboard/shared";

function ReviewQueue(){
  const params=useSearchParams(); const routeQuery=(params.get("q")||"").trim();
  const[items,setItems]=useState<any[]>([]);const[q,setQ]=useState(routeQuery);const[status,setStatus]=useState("");const[page,setPage]=useState(1);const[pages,setPages]=useState(1);const[ready,setReady]=useState(false);const[error,setError]=useState("");
  const load=async(query=q,statusValue=status,targetPage=page)=>{setReady(false);setError("");try{const response=await api<any>(`/admin/submissions?q=${encodeURIComponent(query)}&status=${encodeURIComponent(statusValue)}&page=${targetPage}`);setItems(response.submissions);setPage(response.page);setPages(Math.max(1,response.pages))}catch(cause){setError(cause instanceof Error?cause.message:"Unable to load submissions")}finally{setReady(true)}};
  useEffect(()=>{setQ(routeQuery);void load(routeQuery,"",1)},[routeQuery]);
  const submit=(event:FormEvent)=>{event.preventDefault();void load(q,status,1)};
  const move=(target:number)=>{if(target<1||target>pages)return;void load(q,status,target)};
  return <div className="page"><div className="page-head"><div><div className="eyebrow">Editorial queue</div><h1>All submissions.</h1><p className="page-sub">Search by title, creator, email, or permanent submission ID.</p></div></div><form onSubmit={submit} className="filter-bar" role="search"><div className="search"><Search size={15} aria-hidden="true"/><input type="search" aria-label="Search review queue" value={q} onChange={event=>setQ(event.target.value)} placeholder="Search the library…"/></div><label className="visually-hidden" htmlFor="submission-status-filter">Filter by status</label><select id="submission-status-filter" className="button secondary" value={status} onChange={event=>setStatus(event.target.value)}><option value="">All active statuses</option>{SUBMISSION_STATUSES.filter(value=>value!=="DRAFT").map(value=><option key={value} value={value}>{formatLabel(value)}</option>)}</select><button className="button">Apply</button></form>{error&&<div className="alert" role="alert">{error}</div>}<div className="table-wrap" aria-busy={!ready}><table><thead><tr><th>Submission</th><th>Creator</th><th>Type</th><th>Status</th><th>Received</th></tr></thead><tbody>{!ready?<tr><td colSpan={5}>Loading submissions…</td></tr>:items.length?items.map(item=><tr key={item.id}><td><Link href={`/admin/submissions/${item.id}`}><strong>{item.title}</strong><br/><span className="hint">{item.publicSubmissionId}</span></Link></td><td>{item.creator.name}<br/><span className="hint">{item.creator.email}</span></td><td>{formatLabel(item.submissionType)}</td><td><Status value={item.status}/></td><td>{date(item.submittedAt)}</td></tr>):<tr><td colSpan={5}>No submissions match these filters.</td></tr>}</tbody></table></div>{pages>1&&<nav className="pagination" aria-label="Submission pages"><button type="button" className="button secondary" disabled={page<=1||!ready} onClick={()=>move(page-1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" className="button secondary" disabled={page>=pages||!ready} onClick={()=>move(page+1)}>Next</button></nav>}</div>;
}

export default function AdminSubmissions(){return <Suspense fallback={<div className="page"><div className="empty">Loading submissions…</div></div>}><ReviewQueue/></Suspense>}
