"use client";
import Link from "next/link";
import {useAuth} from "@forge/web-kit";
import {useCallback,useEffect,useState} from "react";
import {listOccupancies,type OccupancySummary} from "@/lib/rms-api";
import styles from "../page.module.css";

export default function OccupanciesPage(){
 const {me}=useAuth();const [items,setItems]=useState<OccupancySummary[]>([]);const [search,setSearch]=useState("");const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null);
 const load=useCallback(async()=>{if(!me?.tenantId)return;setLoading(true);setError(null);try{const r=await listOccupancies(me.tenantId,{page:"1",pageSize:"100",...(search.trim()?{search:search.trim()}:{})});setItems(r.data)}catch(e){setError(e instanceof Error?e.message:"Failed to load occupancies")}finally{setLoading(false)}},[me?.tenantId,search]);
 useEffect(()=>{void load()},[load]);
 return <section className={styles.page}><h1>Occupancies</h1><p className={styles.lead}>Buildings and response locations used by preplans, inspections, and incident intelligence.</p><div className={styles.actions}><Link className={styles.button} href="/occupancies/new/">Add occupancy</Link></div><div className={styles.formRow}><label htmlFor="occupancySearch">Search occupancies</label><input id="occupancySearch" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, address, type"/></div>{error?<p className={styles.error}>{error}</p>:null}<div className={styles.panel}>{loading?<p className={styles.muted}>Loading…</p>:null}{!loading&&items.length===0?<p className={styles.muted}>No occupancies found.</p>:null}{items.length?<table className={styles.table}><thead><tr><th>Name</th><th>Type</th><th>Address</th><th>Status</th><th>Preplan</th><th>Action</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td>{x.name}</td><td>{x.occupancyType??"—"}</td><td>{[x.addressLine1,x.city,x.state].filter(Boolean).join(", ")||"—"}</td><td>{x.status}</td><td>{x.preplanId?"Linked":"—"}</td><td><Link href={`/occupancies/${x.id}/`}>Open</Link></td></tr>)}</tbody></table>:null}</div></section>
}