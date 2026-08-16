"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export function useApiData<T>(path:string){
  const[data,setData]=useState<T>();const[error,setError]=useState("");const[ready,setReady]=useState(false);const[version,setVersion]=useState(0);
  const reload=useCallback(()=>setVersion(value=>value+1),[]);
  useEffect(()=>{let active=true;setReady(false);setError("");api<T>(path).then(value=>{if(active)setData(value)}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"Unable to load this page")}).finally(()=>{if(active)setReady(true)});return()=>{active=false}},[path,version]);
  return{data,error,ready,reload};
}
