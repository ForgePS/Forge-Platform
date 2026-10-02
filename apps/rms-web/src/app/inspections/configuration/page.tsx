"use client";
import {useAuth} from "@forge/web-kit";
import {useCallback,useEffect,useState} from "react";
import {
  createInspectionProgram,createInspectionTemplate,listInspectionPrograms,listInspectionTemplates,
  patchInspectionProgram,patchInspectionTemplate,type InspectionProgram,type InspectionTemplate
} from "@/lib/rms-api";
import styles from "../../page.module.css";

const starterSections=JSON.stringify([
  {id:"general",title:"General",fields:[
    {key:"occupancy_notes",label:"Occupancy notes",type:"long_text",required:false,autoCreateViolation:false},
    {key:"overall_result",label:"Overall result",type:"pass_fail",required:true,autoCreateViolation:false}
  ]},
  {id:"life-safety",title:"Life Safety",fields:[
    {key:"exits_clear",label:"Exits clear and unobstructed",type:"pass_fail_na",required:true,severity:"HIGH",autoCreateViolation:true},
    {key:"extinguishers",label:"Fire extinguishers present and current",type:"pass_fail_na",required:true,severity:"MODERATE",autoCreateViolation:true}
  ]}
],null,2);

export default function InspectionConfigurationPage(){
 const {me}=useAuth();const [programs,setPrograms]=useState<InspectionProgram[]>([]);const [templates,setTemplates]=useState<InspectionTemplate[]>([]);
 const [programName,setProgramName]=useState("");const [programFrequency,setProgramFrequency]=useState("Annual");
 const [templateName,setTemplateName]=useState("");const [templateProgramId,setTemplateProgramId]=useState("");const [sectionsText,setSectionsText]=useState(starterSections);
 const [error,setError]=useState<string|null>(null);const [message,setMessage]=useState("");const [saving,setSaving]=useState(false);

 const load=useCallback(async()=>{if(!me?.tenantId)return;try{const [p,t]=await Promise.all([listInspectionPrograms(me.tenantId,{page:"1",pageSize:"200"}),listInspectionTemplates(me.tenantId,{page:"1",pageSize:"200"})]);setPrograms(p.data);setTemplates(t.data);if(!templateProgramId&&p.data[0])setTemplateProgramId(p.data[0].id)}catch(e){setError(e instanceof Error?e.message:"Failed to load inspection configuration")}},[me?.tenantId,templateProgramId]);
 useEffect(()=>{void load()},[load]);

 async function addProgram(){if(!me?.tenantId||!programName.trim())return;setSaving(true);setError(null);try{await createInspectionProgram(me.tenantId,{name:programName.trim(),frequency:programFrequency||null,active:true});setProgramName("");setMessage("Inspection program created.");await load()}catch(e){setError(e instanceof Error?e.message:"Failed to create program")}finally{setSaving(false)}}
 async function toggleProgram(program:InspectionProgram){if(!me?.tenantId)return;setSaving(true);try{await patchInspectionProgram(me.tenantId,program.id,{active:!program.active},program.recordVersion);await load()}catch(e){setError(e instanceof Error?e.message:"Failed to update program")}finally{setSaving(false)}}
 async function addTemplate(){if(!me?.tenantId||!templateName.trim())return;setSaving(true);setError(null);try{let sections:unknown;try{sections=JSON.parse(sectionsText)}catch{throw new Error("Checklist JSON is invalid.")}if(!Array.isArray(sections))throw new Error("Checklist JSON must be an array of sections.");await createInspectionTemplate(me.tenantId,{programId:templateProgramId||null,name:templateName.trim(),lifecycleStatus:"DRAFT",version:1,sectionsJson:sections});setTemplateName("");setMessage("Inspection template created as DRAFT.");await load()}catch(e){setError(e instanceof Error?e.message:"Failed to create template")}finally{setSaving(false)}}
 async function templateStatus(template:InspectionTemplate,status:"DRAFT"|"PUBLISHED"|"RETIRED"){if(!me?.tenantId)return;setSaving(true);setError(null);try{await patchInspectionTemplate(me.tenantId,template.id,{lifecycleStatus:status},template.recordVersion);setMessage(`Template marked ${status}.`);await load()}catch(e){setError(e instanceof Error?e.message:"Failed to update template")}finally{setSaving(false)}}

 return <section className={styles.page}><h1>Inspection Configuration</h1><p className={styles.lead}>Manage inspection programs and versioned checklist templates used by persistent inspections.</p>
 {error?<p className={styles.error}>{error}</p>:null}{message?<p>{message}</p>:null}
 <div className={styles.panel}><h2>Inspection programs</h2><div className={styles.form}><div className={styles.formRow}><label>Program name<input value={programName} onChange={e=>setProgramName(e.target.value)}/></label></div><div className={styles.formRow}><label>Frequency<input value={programFrequency} onChange={e=>setProgramFrequency(e.target.value)}/></label></div><button type="button" className={styles.button} disabled={saving||!programName.trim()} onClick={()=>void addProgram()}>Add program</button></div>
 {programs.length?<table className={styles.table}><thead><tr><th>Name</th><th>Frequency</th><th>Status</th><th>Action</th></tr></thead><tbody>{programs.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.frequency??"—"}</td><td>{p.active?"ACTIVE":"INACTIVE"}</td><td><button className={styles.button} disabled={saving} onClick={()=>void toggleProgram(p)}>{p.active?"Deactivate":"Activate"}</button></td></tr>)}</tbody></table>:<p className={styles.muted}>No inspection programs configured.</p>}</div>

 <div className={styles.panel}><h2>Checklist templates</h2><div className={styles.form}><div className={styles.formRow}><label>Template name<input value={templateName} onChange={e=>setTemplateName(e.target.value)}/></label></div><div className={styles.formRow}><label>Program<select value={templateProgramId} onChange={e=>setTemplateProgramId(e.target.value)}><option value="">No program</option>{programs.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div><div className={styles.formRow}><label>Sections JSON<textarea rows={18} value={sectionsText} onChange={e=>setSectionsText(e.target.value)}/></label></div><button type="button" className={styles.button} disabled={saving||!templateName.trim()} onClick={()=>void addTemplate()}>Create draft template</button></div>
 {templates.length?<table className={styles.table}><thead><tr><th>Name</th><th>Version</th><th>Status</th><th>Fields</th><th>Action</th></tr></thead><tbody>{templates.map(t=><tr key={t.id}><td>{t.name}</td><td>{t.version}</td><td>{t.lifecycleStatus}</td><td>{t.sectionsJson.reduce((n,s:any)=>n+(Array.isArray(s.fields)?s.fields.length:0),0)}</td><td>{t.lifecycleStatus==="DRAFT"?<button className={styles.button} disabled={saving} onClick={()=>void templateStatus(t,"PUBLISHED")}>Publish</button>:t.lifecycleStatus==="PUBLISHED"?<button className={styles.button} disabled={saving} onClick={()=>void templateStatus(t,"RETIRED")}>Retire</button>:<button className={styles.button} disabled={saving} onClick={()=>void templateStatus(t,"DRAFT")}>Return to draft</button>}</td></tr>)}</tbody></table>:<p className={styles.muted}>No inspection templates configured.</p>}</div>
 </section>
}
