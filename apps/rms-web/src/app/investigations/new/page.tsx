"use client";
import {useSearchParams} from "next/navigation";
import {useAuth} from "@forge/web-kit";
import {useEffect,useState,type FormEvent} from "react";
import {createInvestigation,listIncidents,listOccupancies,type IncidentSummary,type OccupancySummary} from "@/lib/rms-api";
import styles from "../../page.module.css";

export default function NewInvestigationPage(){
 const {me}=useAuth();const searchParams=useSearchParams();const requestedIncident=searchParams.get("incidentId")||"";const requestedOccupancy=searchParams.get("occupancyId")||"";
 const [incidents,setIncidents]=useState<IncidentSummary[]>([]);const [occupancies,setOccupancies]=useState<OccupancySummary[]>([]);const [incidentId,setIncidentId]=useState(requestedIncident);const [occupancyId,setOccupancyId]=useState(requestedOccupancy);
 const [caseType,setCaseType]=useState("FIRE_INVESTIGATION");const [lead,setLead]=useState("");const [location,setLocation]=useState("");const [sceneStatus,setSceneStatus]=useState("SECURED");const [weather,setWeather]=useState("");const [observations,setObservations]=useState("");const [error,setError]=useState<string|null>(null);const [saving,setSaving]=useState(false);
 useEffect(()=>{if(!me?.tenantId)return;void Promise.all([listIncidents(me.tenantId,{page:"1",pageSize:"100"}),listOccupancies(me.tenantId,{page:"1",pageSize:"200"})]).then(([i,o])=>{setIncidents(i.data);setOccupancies(o.data)}).catch(e=>setError(e instanceof Error?e.message:"Failed to load investigation context"))},[me?.tenantId]);
 async function submit(e:FormEvent){e.preventDefault();if(!me?.tenantId)return;setSaving(true);setError(null);try{const r=await createInvestigation(me.tenantId,{incidentId:incidentId||null,occupancyId:occupancyId||null,caseType,leadInvestigator:lead||null,status:"OPEN",location:location||null,sceneStatus:sceneStatus||null,weather:weather||null,initialObservations:observations||null,supervisorReviewStatus:"NOT_SUBMITTED"});window.location.assign(`/investigations/${r.data.id}/`)}catch(x){setError(x instanceof Error?x.message:"Failed to open investigation")}finally{setSaving(false)}}
 return <section className={styles.page}><h1>Open investigation</h1><p className={styles.lead}>Create a persistent investigation case and begin scene/evidence documentation.</p>{error?<p className={styles.error}>{error}</p>:null}<form className={styles.form} onSubmit={submit}>
 <div className={styles.formRow}><label>Incident<select value={incidentId} onChange={e=>setIncidentId(e.target.value)}><option value="">No linked incident</option>{incidents.map(i=><option key={i.id} value={i.id}>{i.incidentNumber} — {i.dispatchDescription??i.primaryIncidentTypeCode??"Incident"}</option>)}</select></label></div>
 <div className={styles.formRow}><label>Occupancy<select value={occupancyId} onChange={e=>setOccupancyId(e.target.value)}><option value="">No linked occupancy</option>{occupancies.map(o=><option key={o.id} value={o.id}>{o.name} — {o.addressLine1??"No address"}</option>)}</select></label></div>
 <div className={styles.formRow}><label>Case type<select value={caseType} onChange={e=>setCaseType(e.target.value)}><option>FIRE_INVESTIGATION</option><option>ORIGIN_CAUSE</option><option>CODE_REFERRAL</option><option>ADMIN_REVIEW</option></select></label></div>
 <div className={styles.formRow}><label>Lead investigator<input value={lead} onChange={e=>setLead(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Scene location<input value={location} onChange={e=>setLocation(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Scene status<select value={sceneStatus} onChange={e=>setSceneStatus(e.target.value)}><option>SECURED</option><option>RELEASED</option><option>RESTRICTED</option></select></label></div>
 <div className={styles.formRow}><label>Weather<input value={weather} onChange={e=>setWeather(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Initial observations<textarea rows={6} value={observations} onChange={e=>setObservations(e.target.value)}/></label></div>
 <button className={styles.button} disabled={saving}>{saving?"Opening…":"Open investigation"}</button></form></section>
}