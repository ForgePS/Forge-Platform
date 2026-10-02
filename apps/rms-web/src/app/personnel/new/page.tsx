"use client";
import {useAuth} from "@forge/web-kit";
import {useEffect,useState,type FormEvent} from "react";
import {createPerson,createRmsPersonnel,listPersons,lookupMasterData,type LookupRow,type PersonSummary} from "@/lib/rms-api";
import styles from "../../page.module.css";

export default function NewPersonnelPage(){
 const {me}=useAuth();
 const [mode,setMode]=useState<"existing"|"new">("existing");
 const [people,setPeople]=useState<PersonSummary[]>([]);const [personId,setPersonId]=useState("");
 const [firstName,setFirstName]=useState("");const [lastName,setLastName]=useState("");const [email,setEmail]=useState("");
 const [rank,setRank]=useState("");const [qualification,setQualification]=useState("");const [stationId,setStationId]=useState("");const [shiftId,setShiftId]=useState("");
 const [stations,setStations]=useState<LookupRow[]>([]);const [shifts,setShifts]=useState<LookupRow[]>([]);const [incidentEligible,setIncidentEligible]=useState(true);
 const [error,setError]=useState<string|null>(null);const [notice,setNotice]=useState<string|null>(null);const [saving,setSaving]=useState(false);
 useEffect(()=>{if(!me?.tenantId)return;void Promise.all([listPersons(me.tenantId),lookupMasterData(me.tenantId,"stations",""),lookupMasterData(me.tenantId,"shifts","")]).then(([p,s,sh])=>{setPeople(p.data);setStations(s);setShifts(sh)}).catch(e=>setError(e instanceof Error?e.message:"Failed to load personnel setup"))},[me?.tenantId]);
 async function submit(e:FormEvent){e.preventDefault();if(!me?.tenantId)return;setSaving(true);setError(null);setNotice(null);let selectedPersonId=personId;try{
   if(mode==="new"){
     const created=await createPerson(me.tenantId,{firstName:firstName.trim(),lastName:lastName.trim(),email:email.trim()||undefined,recordSource:"RMS_PERSONNEL"});
     selectedPersonId=created.data.id;setPersonId(selectedPersonId);setNotice("Person identity created. Completing RMS assignment…");
   }
   if(!selectedPersonId)throw new Error("Select or create a person.");
   const assignment=await createRmsPersonnel(me.tenantId,{personId:selectedPersonId,rank:rank.trim()||null,qualificationSummary:qualification.trim()||null,stationId:stationId||null,shiftId:shiftId||null,status:"ACTIVE",incidentEligible});
   window.location.assign(`/personnel/${assignment.data.id}/`);
 }catch(x){setError(x instanceof Error?x.message:"Failed to add personnel");if(selectedPersonId)setNotice(`Person ID ${selectedPersonId} is available for retry.`)}finally{setSaving(false)}}
 return <section className={styles.page}><h1>Add personnel</h1><p className={styles.lead}>Link an existing Forge Person or create a new identity, then assign the RMS fire-service record.</p>{error?<p className={styles.error}>{error}</p>:null}{notice?<p className={styles.muted}>{notice}</p>:null}<form className={styles.form} onSubmit={submit}>
 <div className={styles.formRow}><label>Identity mode<select value={mode} onChange={e=>setMode(e.target.value as "existing"|"new")}><option value="existing">Existing person</option><option value="new">Create new person</option></select></label></div>
 {mode==="existing"?<div className={styles.formRow}><label>Person<select required value={personId} onChange={e=>setPersonId(e.target.value)}><option value="">Select person</option>{people.filter(p=>p.status==="ACTIVE").map(p=><option key={p.id} value={p.id}>{p.displayName} — {p.forgePersonNumber}</option>)}</select></label></div>:<>
 <div className={styles.formRow}><label>First name<input required value={firstName} onChange={e=>setFirstName(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Last name<input required value={lastName} onChange={e=>setLastName(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label></div></>}
 <div className={styles.formRow}><label>Rank<input value={rank} onChange={e=>setRank(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Station<select value={stationId} onChange={e=>setStationId(e.target.value)}><option value="">Unassigned</option>{stations.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label></div>
 <div className={styles.formRow}><label>Shift<select value={shiftId} onChange={e=>setShiftId(e.target.value)}><option value="">Unassigned</option>{shifts.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label></div>
 <div className={styles.formRow}><label>Qualification summary<textarea rows={4} value={qualification} onChange={e=>setQualification(e.target.value)}/></label></div>
 <div className={styles.formRow}><label><input type="checkbox" checked={incidentEligible} onChange={e=>setIncidentEligible(e.target.checked)}/> Eligible for incident assignment</label></div>
 <button className={styles.button} disabled={saving}>{saving?"Saving…":"Add personnel"}</button></form></section>
}