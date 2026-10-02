"use client";
import {useAuth} from "@forge/web-kit";
import {useEffect,useMemo,useState,type FormEvent} from "react";
import {createTimeOffRequest,listPersons,listPersonnel,type PersonSummary,type RmsPersonnelSummary} from "@/lib/rms-api";
import styles from "../../../page.module.css";

export default function NewTimeOffPage(){
 const {me}=useAuth(); const [personnel,setPersonnel]=useState<RmsPersonnelSummary[]>([]); const [persons,setPersons]=useState<PersonSummary[]>([]); const [personnelId,setPersonnelId]=useState(""); const [startAt,setStartAt]=useState(""); const [endAt,setEndAt]=useState(""); const [leaveType,setLeaveType]=useState("VACATION"); const [reason,setReason]=useState(""); const [error,setError]=useState<string|null>(null); const [saving,setSaving]=useState(false);
 useEffect(()=>{if(!me?.tenantId)return;void Promise.all([listPersonnel(me.tenantId,{page:"1",pageSize:"200"}),listPersons(me.tenantId)]).then(([p,people])=>{setPersonnel(p.data);setPersons(people.data)}).catch(e=>setError(e instanceof Error?e.message:"Failed to load personnel"))},[me?.tenantId]);
 const names=useMemo(()=>new Map(persons.map(p=>[p.id,p.displayName])),[persons]);
 async function submit(e:FormEvent){e.preventDefault();if(!me?.tenantId)return;setSaving(true);setError(null);try{await createTimeOffRequest(me.tenantId,{personnelId,startAt:new Date(startAt).toISOString(),endAt:new Date(endAt).toISOString(),leaveType,status:"PENDING",reason:reason||null});window.location.assign("/scheduling/")}catch(x){setError(x instanceof Error?x.message:"Failed to submit time-off request")}finally{setSaving(false)}}
 return <section className={styles.page}><h1>Request time off</h1>{error?<p className={styles.error}>{error}</p>:null}<form className={styles.form} onSubmit={submit}>
 <div className={styles.formRow}><label>Personnel<select required value={personnelId} onChange={e=>setPersonnelId(e.target.value)}><option value="">Select personnel</option>{personnel.map(p=><option key={p.id} value={p.id}>{names.get(p.personId)??p.personId}</option>)}</select></label></div>
 <div className={styles.formRow}><label>Leave type<select value={leaveType} onChange={e=>setLeaveType(e.target.value)}><option>VACATION</option><option>SICK</option><option>KELLY</option><option>COMP</option><option>FMLA</option><option>MILITARY</option><option>OTHER</option></select></label></div>
 <div className={styles.formRow}><label>Start<input type="datetime-local" required value={startAt} onChange={e=>setStartAt(e.target.value)}/></label><label>End<input type="datetime-local" required value={endAt} onChange={e=>setEndAt(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Reason<textarea rows={4} value={reason} onChange={e=>setReason(e.target.value)}/></label></div>
 <button className={styles.button} disabled={saving}>{saving?"Submitting…":"Submit request"}</button></form></section>
}
