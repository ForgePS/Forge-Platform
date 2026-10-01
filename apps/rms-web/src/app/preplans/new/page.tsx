"use client";
import {useSearchParams} from "next/navigation";
import {useAuth} from "@forge/web-kit";
import {useEffect,useState,type FormEvent} from "react";
import {createPreplan,getOccupancyDetail,listOccupancies,patchOccupancy,type OccupancySummary} from "@/lib/rms-api";
import styles from "../../page.module.css";

export default function NewPreplanPage(){
 const {me}=useAuth();const params=useSearchParams();const [occupancies,setOccupancies]=useState<OccupancySummary[]>([]);
 const [occupancyId,setOccupancyId]=useState(params.get("occupancyId")??"");const [version,setVersion]=useState("1");const [status,setStatus]=useState("DRAFT");
 const [summary,setSummary]=useState("");const [hazards,setHazards]=useState("");const [access,setAccess]=useState("");const [utilities,setUtilities]=useState("");const [error,setError]=useState<string|null>(null);const [saving,setSaving]=useState(false);
 useEffect(()=>{if(me?.tenantId)void listOccupancies(me.tenantId,{page:"1",pageSize:"100"}).then(r=>setOccupancies(r.data)).catch(e=>setError(e instanceof Error?e.message:"Failed to load occupancies"))},[me?.tenantId]);
 async function submit(e:FormEvent){e.preventDefault();if(!me?.tenantId||!occupancyId)return;setSaving(true);setError(null);try{
   const created=await createPreplan(me.tenantId,{occupancyId,versionLabel:version,approvalStatus:status,tacticalSummary:summary||null,hazards:hazards||null,accessNotes:access||null,utilityNotes:utilities||null});
   const occupancy=await getOccupancyDetail(me.tenantId,occupancyId);
   await patchOccupancy(me.tenantId,occupancyId,{preplanId:created.data.id},occupancy.recordVersion);
   window.location.assign(`/preplans/${created.data.id}/`);
 }catch(x){setError(x instanceof Error?x.message:"Failed to create preplan")}finally{setSaving(false)}}
 return <section className={styles.page}><h1>New preplan</h1><p className={styles.lead}>Create responder tactical information for an occupancy.</p>{error?<p className={styles.error}>{error}</p>:null}<form className={styles.form} onSubmit={submit}>
 <div className={styles.formRow}><label>Occupancy<select required value={occupancyId} onChange={e=>setOccupancyId(e.target.value)}><option value="">Select occupancy</option>{occupancies.map(o=><option key={o.id} value={o.id}>{o.name} — {[o.addressLine1,o.city].filter(Boolean).join(", ")}</option>)}</select></label></div>
 <div className={styles.formRow}><label>Version<input required value={version} onChange={e=>setVersion(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Approval status<select value={status} onChange={e=>setStatus(e.target.value)}><option>DRAFT</option><option>APPROVED</option><option>SUPERSEDED</option></select></label></div>
 <div className={styles.formRow}><label>Tactical summary<textarea rows={5} value={summary} onChange={e=>setSummary(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Hazards<textarea rows={5} value={hazards} onChange={e=>setHazards(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Access notes<textarea rows={4} value={access} onChange={e=>setAccess(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Utility notes<textarea rows={4} value={utilities} onChange={e=>setUtilities(e.target.value)}/></label></div>
 <button className={styles.button} disabled={saving}>{saving?"Creating…":"Create preplan"}</button></form></section>
}