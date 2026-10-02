"use client";
import Link from "next/link";
import {useAuth} from "@forge/web-kit";
import {useCallback,useEffect,useState} from "react";
import {listHydrants,type HydrantSummary} from "@/lib/rms-api";
import styles from "../page.module.css";

export default function HydrantsPage(){
 const {me}=useAuth(); const [items,setItems]=useState<HydrantSummary[]>([]); const [search,setSearch]=useState(""); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
 const load=useCallback(async()=>{if(!me?.tenantId)return;setLoading(true);setError(null);try{const r=await listHydrants(me.tenantId,{page:"1",pageSize:"100",...(search.trim()?{search:search.trim()}:{})});setItems(r.data)}catch(e){setError(e instanceof Error?e.message:"Failed to load hydrants")}finally{setLoading(false)}},[me?.tenantId,search]);
 useEffect(()=>{void load()},[load]);
 return <section className={styles.page}><h1>Hydrants</h1><p className={styles.lead}>Water-supply inventory, inspections, flow testing, damage reporting, and operational status.</p>
 <div className={styles.actions}><Link className={styles.button} href="/hydrants/new/">Add hydrant</Link></div>
 <div className={styles.formRow}><label htmlFor="hydrantSearch">Search hydrants</label><input id="hydrantSearch" value={search} onChange={e=>setSearch(e.target.value)} placeholder="ID, address, district, provider"/></div>
 {error?<p className={styles.error}>{error}</p>:null}<div className={styles.panel}>{loading?<p className={styles.muted}>Loading…</p>:null}
 {!loading&&items.length===0?<p className={styles.muted}>No hydrants found.</p>:null}
 {items.length?<table className={styles.table}><thead><tr><th>ID</th><th>Status</th><th>Location</th><th>Flow</th><th>Last test</th><th>Action</th></tr></thead><tbody>{items.map(h=><tr key={h.id}><td className={styles.mono}>{h.displayId}</td><td>{h.status}</td><td>{[h.addressLine1,h.city,h.district].filter(Boolean).join(" · ")||"—"}</td><td>{h.flowGpm!=null?`${h.flowGpm} GPM`:"—"}</td><td>{h.lastFlowTestDate??"—"}</td><td><Link href={`/hydrants/${h.id}/`}>Open</Link></td></tr>)}</tbody></table>:null}</div></section>
}