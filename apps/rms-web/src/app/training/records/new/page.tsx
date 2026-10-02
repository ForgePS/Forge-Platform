"use client";
import {useSearchParams} from "next/navigation";
import {useAuth} from "@forge/web-kit";
import {useEffect,useMemo,useState,type FormEvent} from "react";
import {createTrainingRecord,listPersons,listPersonnel,listTrainingCourses,type PersonSummary,type RmsPersonnelSummary,type TrainingCourse} from "@/lib/rms-api";
import styles from "../../../page.module.css";

export default function NewTrainingRecordPage(){
 const {me}=useAuth(); const searchParams=useSearchParams();
 const [courses,setCourses]=useState<TrainingCourse[]>([]); const [personnel,setPersonnel]=useState<RmsPersonnelSummary[]>([]); const [persons,setPersons]=useState<PersonSummary[]>([]);
 const [courseId,setCourseId]=useState(""); const [personnelId,setPersonnelId]=useState(searchParams.get("personnelId")??"");
 const [completedAt,setCompletedAt]=useState(new Date().toISOString().slice(0,16)); const [hours,setHours]=useState(""); const [instructor,setInstructor]=useState(""); const [location,setLocation]=useState(""); const [score,setScore]=useState(""); const [notes,setNotes]=useState("");
 const [error,setError]=useState<string|null>(null); const [saving,setSaving]=useState(false);
 useEffect(()=>{if(!me?.tenantId)return;void Promise.all([listTrainingCourses(me.tenantId,{page:"1",pageSize:"200",status:"ACTIVE"}),listPersonnel(me.tenantId,{page:"1",pageSize:"200"}),listPersons(me.tenantId)]).then(([c,p,people])=>{setCourses(c.data);setPersonnel(p.data);setPersons(people.data)}).catch(e=>setError(e instanceof Error?e.message:"Failed to load training form data"))},[me?.tenantId]);
 const names=useMemo(()=>new Map(persons.map(p=>[p.id,p.displayName])),[persons]);
 async function submit(e:FormEvent){e.preventDefault();if(!me?.tenantId)return;setSaving(true);setError(null);try{await createTrainingRecord(me.tenantId,{courseId,personnelId,completedAt:new Date(completedAt).toISOString(),hours:hours?Number(hours):null,instructor:instructor||null,location:location||null,score:score?Number(score):null,notes:notes||null,status:"COMPLETED",source:"MANUAL"});window.location.assign("/personnel/"+personnelId+"/")}catch(x){setError(x instanceof Error?x.message:"Failed to record training completion")}finally{setSaving(false)}}
 return <section className={styles.page}><h1>Record training completion</h1>{error?<p className={styles.error}>{error}</p>:null}<form className={styles.form} onSubmit={submit}>
 <div className={styles.formRow}><label>Personnel<select required value={personnelId} onChange={e=>setPersonnelId(e.target.value)}><option value="">Select personnel</option>{personnel.map(p=><option key={p.id} value={p.id}>{names.get(p.personId)??p.personId}{p.rank?" · "+p.rank:""}</option>)}</select></label></div>
 <div className={styles.formRow}><label>Course<select required value={courseId} onChange={e=>setCourseId(e.target.value)}><option value="">Select course</option>{courses.map(c=><option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}</select></label></div>
 <div className={styles.formRow}><label>Completed at<input type="datetime-local" required value={completedAt} onChange={e=>setCompletedAt(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Hours<input type="number" min="0" step="0.25" value={hours} onChange={e=>setHours(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Instructor<input value={instructor} onChange={e=>setInstructor(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Location<input value={location} onChange={e=>setLocation(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Score<input type="number" min="0" max="100" step="0.1" value={score} onChange={e=>setScore(e.target.value)}/></label></div>
 <div className={styles.formRow}><label>Notes<textarea rows={5} value={notes} onChange={e=>setNotes(e.target.value)}/></label></div>
 <button className={styles.button} disabled={saving}>{saving?"Saving…":"Save completion"}</button>
 </form></section>
}
