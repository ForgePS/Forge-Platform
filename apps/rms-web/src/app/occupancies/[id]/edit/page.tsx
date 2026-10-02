"use client";
import {useParams} from "next/navigation";
import {useAuth} from "@forge/web-kit";
import {useEffect,useState,type FormEvent} from "react";
import {getOccupancyDetail,patchOccupancy,type OccupancyDetail} from "@/lib/rms-api";
import styles from "../../../page.module.css";

export default function EditOccupancyPage(){
 const {me}=useAuth();const {id}=useParams<{id:string}>();const [o,setO]=useState<OccupancyDetail|null>(null);const [error,setError]=useState<string|null>(null);const [saving,setSaving]=useState(false);
 useEffect(()=>{if(me?.tenantId)getOccupancyDetail(me.tenantId,id).then(setO).catch(e=>setError(e instanceof Error?e.message:"Failed to load occupancy"))},[me?.tenantId,id]);
 if(!o)return <section className={styles.page}>{error?<p className={styles.error}>{error}</p>:<p className={styles.muted}>Loading…</p>}</section>;
 const set=(key:keyof OccupancyDetail,value:unknown)=>setO({...o,[key]:value});
 async function submit(e:FormEvent){e.preventDefault();if(!me?.tenantId)return;setSaving(true);setError(null);try{const r=await patchOccupancy(me.tenantId,id,{name:o.name,addressLine1:o.addressLine1,city:o.city,state:o.state,postalCode:o.postalCode,latitude:o.latitude,longitude:o.longitude,primaryContact:o.primaryContact,occupancyType:o.occupancyType,status:o.status,preplanId:o.preplanId},o.recordVersion);window.location.assign(`/occupancies/${r.data.id}/`)}catch(x){setError(x instanceof Error?x.message:"Failed to update occupancy")}finally{setSaving(false)}}
 return <section className={styles.page}><h1>Edit occupancy</h1>{error?<p className={styles.error}>{error}</p>:null}<form className={styles.form} onSubmit={submit}>
 {([["name","Name"],["addressLine1","Street address"],["city","City"],["state","State"],["postalCode","Postal code"],["primaryContact","Primary contact"],["occupancyType","Occupancy type"]] as const).map(([k,label])=><div className={styles.formRow} key={k}><label>{label}<input required={k==="name"} value={String(o[k]??"")} onChange={e=>set(k,e.target.value||null)}/></label></div>)}
 <div className={styles.formRow}><label>Status<select value={o.status} onChange={e=>set("status",e.target.value)}><option>ACTIVE</option><option>INACTIVE</option></select></label></div>
 <div className={styles.formRow}><label>Latitude<input type="number" step="any" value={o.latitude??""} onChange={e=>set("latitude",e.target.value?Number(e.target.value):null)}/></label></div>
 <div className={styles.formRow}><label>Longitude<input type="number" step="any" value={o.longitude??""} onChange={e=>set("longitude",e.target.value?Number(e.target.value):null)}/></label></div>
 <button className={styles.button} disabled={saving}>{saving?"Saving…":"Save occupancy"}</button></form></section>
}