"use client";
import {useAuth} from "@forge/web-kit";
import {useSearchParams} from "next/navigation";
import {useEffect,useMemo,useState,type FormEvent} from "react";
import {createInspection,listInspectionPrograms,listInspectionTemplates,listOccupancies,type InspectionProgram,type InspectionTemplate,type OccupancySummary} from "@/lib/rms-api";
import styles from "../../page.module.css";

export default function NewInspectionPage(){
 const {me}=useAuth();const searchParams=useSearchParams();const requestedOccupancyId=searchParams.get("occupancyId")||"";const [occupancies,setOccupancies]=useState<OccupancySummary[]>([]);const [programs,setPrograms]=useState<InspectionProgram[]>([]);const [templates,setTemplates]=useState<InspectionTemplate[]>([]);
 const [occupancyId,setOccupancyId]=useState("");const [programId,setProgramId]=useState("");const [templateId,setTemplateId]=useState("");const [inspector,setInspector]=useState("");const [date,setDate]=useState(new Date().toISOString().slice(0,10));const [error,setError]=useState<string|null>(null);const [saving,setSaving]=useState(false);
 useEffect(()=>{if(!me?.tenantId)return;void Promise.all([listOccupancies(me.tenantId,{page:"1",pageSize:"200"}),listInspectionPrograms(me.tenantId,{page:"1",pageSize:"200"}),listInspectionTemplates(me.tenantId,{page:"1",pageSize:"200"})]).then(([o,p,t])=>{setOccupancies(o.data);setPrograms(p.data.filter(x=>x.active));setTemplates(t.data.filter(x=>x.lifecycleStatus==="PUBLISHED"));if(requestedOccupancyId&&o.data.some(x=>x.id===requestedOccupancyId))setOccupancyId(requestedOccupancyId);else if(o.data[0])setOccupancyId(o.data[0].id)}).catch(e=>setError(e instanceof Error?e.message:"Failed to load inspection setup"))},[me?.tenantId,requestedOccupancyId]);
 const available=useMemo(()=>templates.filter(t=>!programId||t.programId===programId),[templates,programId]);
 async function submit(e:FormEvent){e.preventDefault();if(!me?.tenantId||!occupancyId)return;setSaving(true);setError(null);try{const r=await createInspection(me.tenantId,{occupancyId,programId:programId||null,templateId:templateId||null,inspectorName:inspector||null,inspectionDate:date,status:"IN_PROGRESS",overallResult:"PENDING"});window.location.assign(`/inspections/${r.data.id}/`)}catch(x){setError(x instanceof Error?x.message:"Failed to start inspection")}finally{setSaving(false)}}
 return <section className={styles.page}><h1>Start inspection</h1><p className={styles.lead}>Create a persistent inspection run. Selected template fields are snapshotted at start.</p>{error?<p className={styles.error}>{error}</p>:null}<form className={styles.form} onSubmit={submit}>
 <div className={styles.formRow}><label>Occupancy<select required value={occupancyId} onChange={e=>setOccupancyId(e.target.value)}><option value="">Select occupancy</option>{occupancies.map(x=><option key={x.id} value={x.id}>{x.name} — {x.addressLine1??"No address"}</option>)}</select></label></div>
 <div className={styles.formRow}><label>Inspection program<select value={programId} onChange={e=>{setProgramId(e.target.value);setTemplateId("")}}><option value="">General / no program</option>{programs.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div>
 <div className={styles.formRow}><label>Template<select value={templateId} onChange={e=>setTemplateId(e.target.value)}><option value="">No template</option>{available.map(x=><option key={x.id} value={x.id}>{x.name} v{x.version} ({x.lifecycleStatus})</option>)}</select></label></div>
 <div className={styles.formRow}><label>Inspector<input value={inspector} onChange={e=>setInspector(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Inspection date<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label></div>
 <button className={styles.button} disabled={saving||!occupancyId}>{saving?"Starting…":"Start inspection"}</button></form></section>
}