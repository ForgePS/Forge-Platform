"use client";
import {useSearchParams} from "next/navigation";
import {useAuth} from "@forge/web-kit";
import {useEffect,useMemo,useState,type FormEvent} from "react";
import {createPersonnelCertification,listCertificationTypes,listPersons,listPersonnel,type CertificationType,type PersonSummary,type RmsPersonnelSummary} from "@/lib/rms-api";
import styles from "../../../page.module.css";

export default function AssignCertificationPage(){
 const {me}=useAuth(); const searchParams=useSearchParams();
 const [types,setTypes]=useState<CertificationType[]>([]); const [personnel,setPersonnel]=useState<RmsPersonnelSummary[]>([]); const [persons,setPersons]=useState<PersonSummary[]>([]);
 const [personnelId,setPersonnelId]=useState(searchParams.get("personnelId")??""); const [certificationTypeId,setCertificationTypeId]=useState(""); const [credentialNumber,setCredentialNumber]=useState(""); const [issuedAt,setIssuedAt]=useState(""); const [expiresAt,setExpiresAt]=useState(""); const [verifiedBy,setVerifiedBy]=useState(""); const [notes,setNotes]=useState(""); const [error,setError]=useState<string|null>(null); const [saving,setSaving]=useState(false);
 useEffect(()=>{if(!me?.tenantId)return;void Promise.all([listCertificationTypes(me.tenantId,{page:"1",pageSize:"200",status:"ACTIVE"}),listPersonnel(me.tenantId,{page:"1",pageSize:"200"}),listPersons(me.tenantId)]).then(([t,p,people])=>{setTypes(t.data);setPersonnel(p.data);setPersons(people.data)}).catch(e=>setError(e instanceof Error?e.message:"Failed to load certification form data"))},[me?.tenantId]);
 const names=useMemo(()=>new Map(persons.map(p=>[p.id,p.displayName])),[persons]);
 async function submit(e:FormEvent){e.preventDefault();if(!me?.tenantId)return;setSaving(true);setError(null);try{await createPersonnelCertification(me.tenantId,{personnelId,certificationTypeId,credentialNumber:credentialNumber||null,issuedAt:issuedAt||null,expiresAt:expiresAt||null,status:"ACTIVE",verifiedAt:verifiedBy?new Date().toISOString():null,verifiedBy:verifiedBy||null,notes:notes||null});window.location.assign("/personnel/"+personnelId+"/")}catch(x){setError(x instanceof Error?x.message:"Failed to assign certification")}finally{setSaving(false)}}
 return <section className={styles.page}><h1>Assign certification</h1>{error?<p className={styles.error}>{error}</p>:null}<form className={styles.form} onSubmit={submit}>
 <div className={styles.formRow}><label>Personnel<select required value={personnelId} onChange={e=>setPersonnelId(e.target.value)}><option value="">Select personnel</option>{personnel.map(p=><option key={p.id} value={p.id}>{names.get(p.personId)??p.personId}{p.rank?" · "+p.rank:""}</option>)}</select></label></div>
 <div className={styles.formRow}><label>Certification type<select required value={certificationTypeId} onChange={e=>setCertificationTypeId(e.target.value)}><option value="">Select certification</option>{types.map(t=><option key={t.id} value={t.id}>{t.code} · {t.name}</option>)}</select></label></div>
 <div className={styles.formRow}><label>Credential number<input value={credentialNumber} onChange={e=>setCredentialNumber(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Issued date<input type="date" value={issuedAt} onChange={e=>setIssuedAt(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Expiration date<input type="date" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Verified by<input value={verifiedBy} onChange={e=>setVerifiedBy(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Notes<textarea rows={5} value={notes} onChange={e=>setNotes(e.target.value)}/></label></div>
 <button className={styles.button} disabled={saving}>{saving?"Saving…":"Assign certification"}</button>
 </form></section>
}
