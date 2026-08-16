import Link from "next/link";
import { ArrowUpRight, Feather } from "lucide-react";
import { formatLabel } from "@storyboard/shared";
import { date } from "@/lib/api";
export function Status({ value }: { value: string }) { return <span className={`status ${value}`}>{formatLabel(value)}</span>; }
export function Stat({ label, value }: { label: string; value: string | number }) { return <div className="stat"><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div>; }
export function SubmissionCard({ item, admin = false }: { item: any; admin?: boolean }) { return <Link className="card" href={`${admin ? "/admin" : "/creator"}/submissions/${item.id}`}><div className="card-kicker"><span>{item.publicSubmissionId || "Draft"}</span><ArrowUpRight size={15}/></div><h3>{item.title}</h3><p>{formatLabel(item.submissionType)} · {item.genre}<br/>{date(item.updatedAt)}</p><Status value={item.status}/></Link>; }
export function Empty({ title = "A blank page, ready for you", copy = "Your submitted work will live here, safely organized and easy to track." }: { title?: string; copy?: string }) { return <div className="empty"><Feather size={30}/><h3>{title}</h3><p>{copy}</p></div>; }
