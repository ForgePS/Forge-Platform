"use client";
import Link from "next/link";
import {useAuth} from "@forge/web-kit";
import {useCallback,useEffect,useState} from "react";
import {listInvestigations,type InvestigationCase} from "@/lib/rms-api";
import styles from "../page.module.css";

export default function InvestigationsPage(){
 const {me}=useAuth();const [items,setItems]=useState<InvestigationCase[]>([]);const [search,setSearch]=useState("");const [status,setStatus]=useState("");const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null);
 const load=useCallback(async()=>{if(!me?.tenantId)return;setLoading(true);setError(null);try{const r=await listInvestigations(me.tenantId,{page:"1",pageSize:"100",...(search.trim()?{search:search.trim()}:{}) ,...(status?{status}:{})});setItems(r.data)}catch(e){setError(e instanceof Error?e.message:"Failed to load investigations")}finally{setLoading(false)}},[me?.tenantId,search,status]);
 useEffect(()=>{void load()},[load]);
 return <section className={styles.page}><h1>Investigations</h1><p className={styles.lead}>Case intake, scene documentation, origin and cause analysis, evidence, chain of custody, supervisor review, and closeout.</p>
 <div className={styles.actions}><Link className={styles.button} href="/investigations/new/">Open investigation</Link></div>
 <div className={styles.formRow}><label>Search<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Case number, investigator, location"/></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All</option><option>OPEN</option><option>SCENE_SECURED</option><option>ANALYSIS</option><option>PENDING_REVIEW</option><option>CLOSED</option><option>VOID</option></select></label></div>
 {error?<p className={styles.error}>{error}</p>:null}<div className={styles.panel}>{loading?<p className={styles.muted}>Loading…</p>:null}{!loading&&!items.length?<p className={styles.muted}>No investigation cases found.</p>:null}
 {items.length?<table className={styles.table}><thead><tr><th>Case</th><th>Type</th><th>Status</th><th>Lead investigator</th><th>Scene</th><th>Review</th><th>Action</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td className={styles.mono}>{x.caseNumber}</td><td>{x.caseType}</td><td>{x.status}</td><td>{x.leadInvestigator??"—"}</td><td>{x.sceneStatus??"—"}</td><td>{x.supervisorReviewStatus}</td><td><Link href={`/investigations/${x.id}/`}>Open</Link></td></tr>)}</tbody></table>:null}</div></section>
}