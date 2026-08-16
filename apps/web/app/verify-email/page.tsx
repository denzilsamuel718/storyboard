"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

function Verification() {
  const params = useSearchParams();
  const [state, setState] = useState("Verifying your email...");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let active = true;
    const token = params.get("token");
    if (!token) {
      setState("This verification link is missing its token.");
      return () => { active = false; };
    }

    api<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((result) => {
        if (!active) return;
        setOk(true);
        setState(result.message);
      })
      .catch((error: Error) => {
        if (active) setState(error.message);
      });

    return () => { active = false; };
  }, [params]);
  return <div className="auth-card"><Link href="/" className="brand"><span className="brand-mark">S</span>StoryBoard</Link>{ok&&<CheckCircle2 size={38} color="var(--green)" style={{marginTop:48}}/>}<div className="eyebrow" style={{marginTop:ok?18:48}}>Email verification</div><h1>{ok?"You’re verified.":"Confirming access."}</h1><p role="status">{state}</p><Link className="button accent" href={ok?"/creator":"/login"}>{ok?"Open creator studio":"Back to sign in"}</Link></div>;
}
export default function VerifyEmail(){return <main className="auth-panel" style={{minHeight:"calc(100vh - 44px)"}}><Suspense fallback={<div className="empty">Verifying...</div>}><Verification/></Suspense></main>}
