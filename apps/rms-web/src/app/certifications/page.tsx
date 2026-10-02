"use client";
import Link from "next/link";
import {useAuth} from "@forge/web-kit";
import {useCallback,useEffect,useState} from "react";
import {listCertificationTypes,type CertificationType} from "@/lib/rms-api";
import styles from "../page.module.css";

export default function CertificationsPage(){
 const {me}=useAuth(); const [items,setItems]=useState<CertificationType[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
 const load=useCallback(async()=>{if(!me?.tenantId)return;setLoading(true);setError(null);try{const r=await listCertificationTypes(me.tenantId,{page:"1",pageSize:"100"});setItems(r.data)}catch(e){setError(e instanceof Error?e.message:"Failed to load certification types")}finally{setLoading(false)}},[me?.tenantId]);
 useEffect(()=>{void load()},[load]);
 return <section className={styles.page}><h1>Certifications</h1><p className={styles.lead}>Credential definitions, expiration rules, and response-readiness requirements.</p>
 <div className={styles.actions}><Link className={styles.button} href="/certifications/new/">Add certification type</Link><Link className={styles.button} href="/certifications/assign/new/">Assign credential</Link></div>
 {error?<p className={styles.error}>{error}</p>:null}<div className={styles.panel}>{loading?<p className={styles.muted}>Loading…</p>:null}
 {items.length?<table className={styles.table}><thead><tr><th>Code</th><th>Name</th><th>Authority</th><th>Category</th><th>Validity</th><th>Required</th><th>Status</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td className={styles.mono}>{x.code}</td><td>{x.name}</td><td>{x.issuingAuthority??"—"}</td><td>{x.category}</td><td>{x.defaultValidityMonths?String(x.defaultValidityMonths)+" mo":"No default"}</td><td>{x.requiredForIncidentEligibility?"Yes":"No"}</td><td>{x.status}</td></tr>)}</tbody></table>:!loading?<p className={styles.muted}>No certification types found.</p>:null}
 </div></section>
}
