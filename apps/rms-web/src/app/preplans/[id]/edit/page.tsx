"use client";
import {useParams} from "next/navigation";
import {useAuth} from "@forge/web-kit";
import {useEffect,useState,type FormEvent} from "react";
import {getPreplan,patchPreplan,type PreplanSummary} from "@/lib/rms-api";
import styles from "../../../page.module.css";

export default function EditPreplanPage(){
 const {me}=useAuth();const {id}=useParams<{id:string}>();const [p,setP]=useState<PreplanSummary|null>(null);const [error,setError]=useState<string|null>(null);const [saving,setSaving]=useState(false);
 useEffect(()=>{if(me?.tenantId)getPreplan(me.tenantId,id).then(setP).catch(e=>setError(e instanceof Error?e.message:"Failed to load preplan"))},[me?.tenantId,id]);
 if(!p)return <section className={styles.page}>{error?<p className={styles.error}>{error}</p>:<p className={styles.muted}>Loading…</p>}</section>;
 const set=(key:keyof PreplanSummary,value:unknown)=>setP({...p,[key]:value});
 async function submit(e:FormEvent){e.preventDefault();if(!me?.tenantId)return;setSaving(true);setError(null);try{const r=await patchPreplan(me.tenantId,id,{occupancyId:p.occupancyId,versionLabel:p.versionLabel,approvalStatus:p.approvalStatus,tacticalSummary:p.tacticalSummary,hazards:p.hazards,accessNotes:p.accessNotes,utilityNotes:p.utilityNotes,primaryStationId:p.primaryStationId},p.recordVersion);window.location.assign(`/preplans/${r.data.id}/`)}catch(x){setError(x instanceof Error?x.message:"Failed to update preplan")}finally{setSaving(false)}}
 return <section className={styles.page}><h1>Edit preplan</h1>{error?<p className={styles.error}>{error}</p>:null}<form className={styles.form} onSubmit={submit}>
 <div className={styles.formRow}><label>Version<input required value={p.versionLabel} onChange={e=>set("versionLabel",e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Approval status<select value={p.approvalStatus} onChange={e=>set("approvalStatus",e.target.value as PreplanSummary["approvalStatus"])}><option>DRAFT</option><option>APPROVED</option><option>SUPERSEDED</option></select></label></div>
 <div className={styles.formRow}><label>Tactical summary<textarea rows={6} value={p.tacticalSummary??""} onChange={e=>set("tacticalSummary",e.target.value||null)}/></label></div>
 <div className={styles.formRow}><label>Hazards<textarea rows={6} value={p.hazards??""} onChange={e=>set("hazards",e.target.value||null)}/></label></div>
 <div className={styles.formRow}><label>Access notes<textarea rows={5} value={p.accessNotes??""} onChange={e=>set("accessNotes",e.target.value||null)}/></label></div>
 <div className={styles.formRow}><label>Utility notes<textarea rows={5} value={p.utilityNotes??""} onChange={e=>set("utilityNotes",e.target.value||null)}/></label></div>
 <button className={styles.button} disabled={saving}>{saving?"Saving…":"Save preplan"}</button></form></section>
}