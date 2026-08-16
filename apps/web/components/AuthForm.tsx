"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/api";

export function AuthForm({ mode = "login", admin = false }: { mode?: "login" | "register"; admin?: boolean }) {
  const router = useRouter(); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const submit=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();setBusy(true);setError("");const f=new FormData(e.currentTarget);try{const data=await api<{user:{role:string}}>(`/auth/${mode}`,{method:"POST",body:JSON.stringify(Object.fromEntries(f))}); if(admin&&data.user.role!=="ADMIN"){await api("/auth/logout",{method:"POST"});throw new Error("Administrator access required");}router.push(data.user.role==="ADMIN"?"/admin":"/creator");router.refresh();}catch(err){setError(err instanceof Error?err.message:"Unable to continue");}finally{setBusy(false)}};
  return <form onSubmit={submit}>{error&&<div className="alert" role="alert">{error}</div>}{mode==="register"&&<div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" autoComplete="name" minLength={2} maxLength={80} required placeholder="Your name"/></div>}<div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" maxLength={254} required placeholder="you@example.com"/></div>{mode==="register"&&<div className="field"><label htmlFor="phone">Phone <span className="hint">(optional)</span></label><input id="phone" name="phone" autoComplete="tel" maxLength={30} placeholder="+91 98765 43210"/></div>}<div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete={mode==="login"?"current-password":"new-password"} minLength={8} maxLength={128} required placeholder="At least 8 characters"/></div>{mode==="login"&&<div style={{textAlign:"right",marginTop:-9,marginBottom:18}}><Link className="hint" href="/forgot-password">Forgot password?</Link></div>}<button className="button accent" style={{width:"100%"}} disabled={busy}>{busy?"Please wait…":mode==="login"?"Sign in":"Create my studio"}<ArrowRight size={15}/></button></form>;
}
