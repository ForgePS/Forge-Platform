"use client";
import {useAuth} from "@forge/web-kit";
import {useState,type FormEvent} from "react";
import {createTrainingCourse} from "@/lib/rms-api";
import styles from "../../page.module.css";

export default function NewTrainingCoursePage(){
 const {me}=useAuth();
 const [code,setCode]=useState(""); const [title,setTitle]=useState(""); const [category,setCategory]=useState("GENERAL");
 const [hours,setHours]=useState(""); const [recurrence,setRecurrence]=useState(""); const [required,setRequired]=useState(false);
 const [description,setDescription]=useState(""); const [error,setError]=useState<string|null>(null); const [saving,setSaving]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();if(!me?.tenantId)return;setSaving(true);setError(null);try{
  await createTrainingCourse(me.tenantId,{code:code.trim(),title:title.trim(),category:category.trim()||"GENERAL",description:description.trim()||null,defaultHours:hours?Number(hours):null,recurrenceMonths:recurrence?Number(recurrence):null,requiredForIncidentEligibility:required,status:"ACTIVE"});
  window.location.assign("/training/");
 }catch(x){setError(x instanceof Error?x.message:"Failed to create course")}finally{setSaving(false)}}
 return <section className={styles.page}><h1>Add training course</h1>{error?<p className={styles.error}>{error}</p>:null}<form className={styles.form} onSubmit={submit}>
  <div className={styles.formRow}><label>Code<input required value={code} onChange={e=>setCode(e.target.value)}/></label></div>
  <div className={styles.formRow}><label>Title<input required value={title} onChange={e=>setTitle(e.target.value)}/></label></div>
  <div className={styles.formRow}><label>Category<input value={category} onChange={e=>setCategory(e.target.value)}/></label></div>
  <div className={styles.formRow}><label>Default hours<input type="number" min="0" step="0.25" value={hours} onChange={e=>setHours(e.target.value)}/></label></div>
  <div className={styles.formRow}><label>Recurrence months<input type="number" min="1" value={recurrence} onChange={e=>setRecurrence(e.target.value)}/></label></div>
  <div className={styles.formRow}><label><input type="checkbox" checked={required} onChange={e=>setRequired(e.target.checked)}/> Required for incident eligibility</label></div>
  <div className={styles.formRow}><label>Description<textarea rows={5} value={description} onChange={e=>setDescription(e.target.value)}/></label></div>
  <button className={styles.button} disabled={saving}>{saving?"Saving…":"Create course"}</button>
 </form></section>
}
