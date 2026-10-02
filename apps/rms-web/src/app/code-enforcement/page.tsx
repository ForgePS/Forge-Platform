"use client";
import Link from "next/link";
import {useAuth} from "@forge/web-kit";
import {useCallback,useEffect,useState} from "react";
import {listCodeCases,listOccupancies,type CodeCase,type OccupancySummary} from "@/lib/rms-api";
import styles from "../page.module.css";

export default function CodeEnforcementPage(){
 const {me}=useAuth();const [cases,setCases]=useState<CodeCase[]>([]);const [occupancies,setOccupancies]=useState<Record<string,OccupancySummary>>({});const [search,setSearch]=useState("");const [status,setStatus]=useState("");const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null);
 const load=useCallback(async()=>{if(!me?.tenantId)return;setLoading(true);setError(null);try{const [c,o]=await Promise.all([listCodeCases(me.tenantId,{page:"1",pageSize:"100",...(search.trim()?{search:search.trim()}:{}) ,...(status?{status}:{})}),listOccupancies(me.tenantId,{page:"1",pageSize:"200"})]);setCases(c.data);setOccupancies(Object.fromEntries(o.data.map(x=>[x.id,x])))}catch(e){setError(e instanceof Error?e.message:"Failed to load code enforcement cases")}finally{setLoading(false)}},[me?.tenantId,search,status]);
 useEffect(()=>{void load()},[load]);
 return <section className={styles.page}><h1>Code Enforcement</h1><p className={styles.lead}>Violation cases, notices, correction deadlines, compliance verification, and closeout.</p>
 <div className={styles.actions}><Link className={styles.button} href="/code-enforcement/new/">Open case</Link></div>
 <div className={styles.formRow}><label>Search<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Case number, responsible party, summary"/></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All</option><option>OPEN</option><option>NOTICE_ISSUED</option><option>COMPLIANCE_PENDING</option><option>HEARING</option><option>CLOSED</option><option>VOID</option></select></label></div>
 {error?<p className={styles.error}>{error}</p>:null}<div className={styles.panel}>{loading?<p className={styles.muted}>Loading…</p>:null}{!loading&&!cases.length?<p className={styles.muted}>No enforcement cases found.</p>:null}
 {cases.length?<table className={styles.table}><thead><tr><th>Case</th><th>Occupancy</th><th>Status</th><th>Type</th><th>Due</th><th>Responsible party</th><th>Action</th></tr></thead><tbody>{cases.map(c=><tr key={c.id}><td className={styles.mono}>{c.caseNumber}</td><td>{occupancies[c.occupancyId]?.name??c.occupancyId}</td><td>{c.status}</td><td>{c.caseType}</td><td>{c.complianceDueDate??"—"}</td><td>{c.responsibleParty??"—"}</td><td><Link href={`/code-enforcement/${c.id}/`}>Open</Link></td></tr>)}</tbody></table>:null}</div></section>
}