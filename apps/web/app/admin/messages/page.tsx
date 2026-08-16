"use client";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { date } from "@/lib/api";
import { useApiData } from "@/lib/useApiData";

export default function Messages(){const{data,error,ready,reload}=useApiData<any>("/admin/messages");const items=data?.messages||[];return <div className="page"><div className="page-head"><div><div className="eyebrow">Contact history</div><h1>Creator messages.</h1><p className="page-sub">Messages intentionally shared with creators from the review desk.</p></div></div>{error&&<div className="alert" role="alert">{error} <button type="button" className="text-button" onClick={reload}>Try again</button></div>}{!ready?<div className="empty">Loading messages…</div>:items.length?<div className="detail-stack">{items.map((message:any)=><Link className="card" key={message.id} href={`/admin/submissions/${message.submission.id}`}><div className="card-kicker"><span>{message.submission.publicSubmissionId}</span><span>{date(message.createdAt)}</span></div><h3>{message.submission.title}</h3><p className="prose">{message.body}</p><span className="hint">To {message.submission.creator.name} · {message.submission.creator.email}</span></Link>)}</div>:<div className="empty"><MessageSquare size={30}/><h3>No messages yet</h3><p>Creator-visible messages sent during review will appear here.</p></div>}</div>}
