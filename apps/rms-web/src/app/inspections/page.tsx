"use client";
import Link from "next/link";
import {useAuth} from "@forge/web-kit";
import {useCallback,useEffect,useState} from "react";
import {listInspections,listOccupancies,type InspectionSummary,type OccupancySummary} from "@/lib/rms-api";
import styles from "../page.module.css";

export default function InspectionsPage(){
 const {me}=useAuth();const [items,setItems]=useState<InspectionSummary[]>([]);const [occupancies,setOccupancies]=useState<Record<string,OccupancySummary>>({});const [status,setStatus]=useState("");const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null);
 const load=useCallback(async()=>{if(!me?.tenantId)return;setLoading(true);setError(null);try{const [ins,occ]=await Promise.all([listInspections(me.tenantId,{page:"1",pageSize:"100",...(status?{status}:{})}),listOccupancies(me.tenantId,{page:"1",pageSize:"200"})]);setItems(ins.data);setOccupancies(Object.fromEntries(occ.data.map(x=>[x.id,x])))}catch(e){setError(e instanceof Error?e.message:"Failed to load inspections")}finally{setLoading(false)}},[me?.tenantId,status]);useEffect(()=>{void load()},[load]);
 return <section className={styles.page}><h1>Inspections</h1><p className={styles.lead}>Occupancy inspection runs, findings, corrective actions, follow-up dates, and closeout.</p>
 <div className={styles.actions}><Link className={styles.button} href="/inspections/new/">Start inspection</Link></div>
 <div className={styles.formRow}><label htmlFor="inspectionStatus">Status</label><select id="inspectionStatus" value={status} onChange={e=>setStatus(e.target.value)}><option value="">All</option><option>SCHEDULED</option><option>IN_PROGRESS</option><option>COMPLETED</option><option>CANCELLED</option></select></div>
 {error?<p className={styles.error}>{error}</p>:null}<div className={styles.panel}>{loading?<p className={styles.muted}>Loading…</p>:null}{!loading&&items.length===0?<p className={styles.muted}>No inspections found.</p>:null}
 {items.length?<table className={styles.table}><thead><tr><th>Date</th><th>Occupancy</th><th>Status</th><th>Result</th><th>Inspector</th><th>Follow-up</th><th>Action</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td>{x.inspectionDate}</td><td>{occupancies[x.occupancyId]?.name??x.occupancyId}</td><td>{x.status}</td><td>{x.overallResult}</td><td>{x.inspectorName??"—"}</td><td>{x.followUpDate??"—"}</td><td><Link href={`/inspections/${x.id}/`}>Open</Link></td></tr>)}</tbody></table>:null}</div></section>
}