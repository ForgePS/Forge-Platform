"use client";
import Link from "next/link";
import {useAuth} from "@forge/web-kit";
import {useCallback,useEffect,useState} from "react";
import {listTrainingCourses,type TrainingCourse} from "@/lib/rms-api";
import styles from "../page.module.css";

export default function TrainingPage(){
 const {me}=useAuth();
 const [items,setItems]=useState<TrainingCourse[]>([]);
 const [search,setSearch]=useState("");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState<string|null>(null);
 const load=useCallback(async()=>{
  if(!me?.tenantId)return;
  setLoading(true);setError(null);
  try{const r=await listTrainingCourses(me.tenantId,{page:"1",pageSize:"100",...(search.trim()?{search:search.trim()}:{})});setItems(r.data)}
  catch(e){setError(e instanceof Error?e.message:"Failed to load training courses")}
  finally{setLoading(false)}
 },[me?.tenantId,search]);
 useEffect(()=>{void load()},[load]);
 return <section className={styles.page}>
  <h1>Training</h1>
  <p className={styles.lead}>Course catalog, recurring requirements, and personnel completion records.</p>
  <div className={styles.actions}><Link className={styles.button} href="/training/new/">Add course</Link><Link className={styles.button} href="/training/records/new/">Record completion</Link></div>
  <div className={styles.formRow}><label htmlFor="trainingSearch">Search courses</label><input id="trainingSearch" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Code, title, category"/></div>
  {error?<p className={styles.error}>{error}</p>:null}
  <div className={styles.panel}>{loading?<p className={styles.muted}>Loading…</p>:null}
   {!loading&&items.length===0?<p className={styles.muted}>No training courses found.</p>:null}
   {items.length?<table className={styles.table}><thead><tr><th>Code</th><th>Course</th><th>Category</th><th>Hours</th><th>Recurs</th><th>Required</th><th>Status</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td className={styles.mono}>{x.code}</td><td>{x.title}</td><td>{x.category}</td><td>{x.defaultHours??"—"}</td><td>{x.recurrenceMonths?String(x.recurrenceMonths)+" mo":"No"}</td><td>{x.requiredForIncidentEligibility?"Yes":"No"}</td><td>{x.status}</td></tr>)}</tbody></table>:null}
  </div>
 </section>
}
