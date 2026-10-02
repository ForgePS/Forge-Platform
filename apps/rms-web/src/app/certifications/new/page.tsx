"use client";
import {useAuth} from "@forge/web-kit";
import {useState,type FormEvent} from "react";
import {createCertificationType} from "@/lib/rms-api";
import styles from "../../page.module.css";

export default function NewCertificationTypePage(){
 const {me}=useAuth();
 const [code,setCode]=useState(""); const [name,setName]=useState(""); const [authority,setAuthority]=useState("");
 const [category,setCategory]=useState("GENERAL"); const [months,setMonths]=useState(""); const [required,setRequired]=useState(false);
 const [error,setError]=useState<string|null>(null); const [saving,setSaving]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();if(!me?.tenantId)return;setSaving(true);setError(null);try{
  await createCertificationType(me.tenantId,{code:code.trim(),name:name.trim(),issuingAuthority:authority.trim()||null,category:category.trim()||"GENERAL",defaultValidityMonths:months?Number(months):null,requiredForIncidentEligibility:required,status:"ACTIVE"});
  window.location.assign("/certifications/");
 }catch(x){setError(x instanceof Error?x.message:"Failed to create certification type")}finally{setSaving(false)}}
 return <section className={styles.page}><h1>Add certification type</h1>{error?<p className={styles.error}>{error}</p>:null}<form className={styles.form} onSubmit={submit}>
 <div className={styles.formRow}><label>Code<input required value={code} onChange={e=>setCode(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Name<input required value={name} onChange={e=>setName(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Issuing authority<input value={authority} onChange={e=>setAuthority(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Category<input value={category} onChange={e=>setCategory(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Default validity months<input type="number" min="1" value={months} onChange={e=>setMonths(e.target.value)}/></label></div>
 <div className={styles.formRow}><label><input type="checkbox" checked={required} onChange={e=>setRequired(e.target.checked)}/> Required for incident eligibility</label></div>
 <button className={styles.button} disabled={saving}>{saving?"Saving…":"Create certification type"}</button>
 </form></section>
}
