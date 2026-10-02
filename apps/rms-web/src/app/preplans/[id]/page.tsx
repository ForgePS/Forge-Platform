"use client";
import Link from "next/link";import {useParams} from "next/navigation";import {useAuth} from "@forge/web-kit";import {useEffect,useState} from "react";import {getOccupancyDetail,getPreplan,type OccupancyDetail,type PreplanSummary} from "@/lib/rms-api";import styles from "../../page.module.css";
export default function PreplanDetailPage(){const {me}=useAuth();const {id}=useParams<{id:string}>();const [p,setP]=useState<PreplanSummary|null>(null);const [o,setO]=useState<OccupancyDetail|null>(null);const [error,setError]=useState<string|null>(null);
useEffect(()=>{if(!me?.tenantId)return;void getPreplan(me.tenantId,id).then(async pre=>{setP(pre);setO(await getOccupancyDetail(me.tenantId!,pre.occupancyId))}).catch(e=>setError(e instanceof Error?e.message:"Failed to load preplan"))},[me?.tenantId,id]);
if(error)return <section className={styles.page}><p className={styles.error}>{error}</p></section>;if(!p)return <section className={styles.page}><p className={styles.muted}>Loading preplan…</p></section>;
return <section className={styles.page}><h1>Preplan v{p.versionLabel}</h1><p className={styles.lead}>{o?.name??p.occupancyId} · {p.approvalStatus}</p><div className={styles.actions}><Link className={styles.button} href={`/preplans/${p.id}/edit/`}>Edit / approve</Link><Link className={styles.button} href={`/occupancies/${p.occupancyId}/`}>Open occupancy</Link></div>
<div className={styles.panel}><h2>Tactical summary</h2><p>{p.tacticalSummary??"No tactical summary recorded."}</p></div>
<div className={styles.panel}><h2>Hazards</h2><p>{p.hazards??"No hazards recorded."}</p></div>
<div className={styles.panel}><h2>Access</h2><p>{p.accessNotes??"No access notes recorded."}</p></div>
<div className={styles.panel}><h2>Utilities</h2><p>{p.utilityNotes??"No utility notes recorded."}</p></div>
</section>}