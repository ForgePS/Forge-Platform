"use client";
import {useAuth} from "@forge/web-kit";
import {useEffect,useMemo,useState,type FormEvent} from "react";
import {createShiftSwap,listPersons,listPersonnel,listScheduleAssignments,type PersonSummary,type RmsPersonnelSummary,type ScheduleAssignment} from "@/lib/rms-api";
import styles from "../../../page.module.css";

export default function NewShiftSwapPage(){
 const {me}=useAuth(); const [assignments,setAssignments]=useState<ScheduleAssignment[]>([]); const [personnel,setPersonnel]=useState<RmsPersonnelSummary[]>([]); const [persons,setPersons]=useState<PersonSummary[]>([]); const [offeredAssignmentId,setOfferedAssignmentId]=useState(""); const [requesterPersonnelId,setRequesterPersonnelId]=useState(""); const [replacementPersonnelId,setReplacementPersonnelId]=useState(""); const [reason,setReason]=useState(""); const [error,setError]=useState<string|null>(null); const [saving,setSaving]=useState(false);
 useEffect(()=>{if(!me?.tenantId)return;void Promise.all([listScheduleAssignments(me.tenantId,{page:"1",pageSize:"200"}),listPersonnel(me.tenantId,{page:"1",pageSize:"200"}),listPersons(me.tenantId)]).then(([a,p,people])=>{setAssignments(a.data.filter(x=>x.status!=="CANCELED"));setPersonnel(p.data);setPersons(people.data)}).catch(e=>setError(e instanceof Error?e.message:"Failed to load swap form data"))},[me?.tenantId]);
 const names=useMemo(()=>{const people=new Map(persons.map(p=>[p.id,p.displayName]));return new Map(personnel.map(p=>[p.id,people.get(p.personId)??p.personId]))},[personnel,persons]);
 async function submit(e:FormEvent){e.preventDefault();if(!me?.tenantId)return;setSaving(true);setError(null);try{await createShiftSwap(me.tenantId,{offeredAssignmentId,requesterPersonnelId,replacementPersonnelId:replacementPersonnelId||null,status:"PENDING",reason:reason||null});window.location.assign("/scheduling/")}catch(x){setError(x instanceof Error?x.message:"Failed to submit shift swap")}finally{setSaving(false)}}
 return <section className={styles.page}><h1>Request shift swap</h1>{error?<p className={styles.error}>{error}</p>:null}<form className={styles.form} onSubmit={submit}>
 <div className={styles.formRow}><label>Requester<select required value={requesterPersonnelId} onChange={e=>setRequesterPersonnelId(e.target.value)}><option value="">Select requester</option>{personnel.map(p=><option key={p.id} value={p.id}>{names.get(p.id)??p.id}</option>)}</select></label></div>
 <div className={styles.formRow}><label>Offered assignment<select required value={offeredAssignmentId} onChange={e=>setOfferedAssignmentId(e.target.value)}><option value="">Select assignment</option>{assignments.filter(a=>!requesterPersonnelId||a.personnelId===requesterPersonnelId).map(a=><option key={a.id} value={a.id}>{new Date(a.startAt).toLocaleString()} · {a.assignmentType}</option>)}</select></label></div>
 <div className={styles.formRow}><label>Replacement<select value={replacementPersonnelId} onChange={e=>setReplacementPersonnelId(e.target.value)}><option value="">Replacement not selected yet</option>{personnel.filter(p=>p.id!==requesterPersonnelId).map(p=><option key={p.id} value={p.id}>{names.get(p.id)??p.id}</option>)}</select></label></div>
 <div className={styles.formRow}><label>Reason<textarea rows={4} value={reason} onChange={e=>setReason(e.target.value)}/></label></div>
 <button className={styles.button} disabled={saving}>{saving?"Submitting…":"Submit swap request"}</button></form></section>
}
