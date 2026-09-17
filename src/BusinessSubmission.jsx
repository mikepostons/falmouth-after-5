import {siteCopy} from "./site-copy";
import React, { useEffect, useRef, useState, Suspense } from 'react';
import Icon from './icons';
import PhotoDropzone from './PhotoDropzone';
import { api } from './api';
import { prepareSubmissionImage } from './submission-image';
import { dateLabel, ukDay } from './domain';
import './business-submission.css';
const steps = ['Business', 'Location', 'Offer', 'Campaigns', 'Photos', 'Review & contact'];
const initial = { name:'', description:'', address:'', lat:'', lng:'', website:'', booking:'', facebook:'', instagram:'', phone:'', offer_title:'', offer_description:'', offer_redemption:'', offer_terms:'', offer_time_note:'', categories:[], schedule_mode:'all', campaign_ids:[], roll_over:false, start_time:'17:00', end_time:'21:00', image_alt:'', offer_image_alt:'', contact:'', email:'', consent:false, image_rights:false, website_confirm:'' };
export default function BusinessSubmission({ data, MapView, onClose, onDirty, onBusy }) {
  const [values,setValues] = useState(initial), [step,setStep] = useState(0), [errors,setErrors] = useState({}), [error,setError] = useState(''), [busy,setBusy] = useState(false), [processing,setProcessing] = useState(false), [sent,setSent] = useState(false), [photos,setPhotos] = useState({});
  const form = useRef(null), photosRef = useRef({}), heading = useRef(null), mounted = useRef(true);
  useEffect(() => { onBusy?.(busy || processing); return () => onBusy?.(false); }, [busy, processing, onBusy]);
  const campaigns = data.dates.filter(d => d.date >= ukDay(new Date())).sort((a,b)=>a.date.localeCompare(b.date));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; Object.values(photosRef.current).forEach(p=>URL.revokeObjectURL(p.url)); }; }, []);
  useEffect(() => { heading.current?.focus(); }, [step]);
  const update = (key,value) => { setValues(v=>({...v,[key]:value})); setErrors(e=>{const copy={...e};delete copy[key];return copy;}); onDirty?.(true); };
  const toggle = (key,value) => update(key,values[key].includes(value)?values[key].filter(v=>v!==value):[...values[key],value]);
  const validate = (index) => {
    const found={};
    for (const input of form.current.querySelectorAll(`[data-submission-step="${index}"] input, [data-submission-step="${index}"] textarea`)) {
      if (!input.validity.valid) found[input.name] = input.validity.valueMissing ? 'This field is required.' : input.validationMessage;
      else if(input.required && input.type!=='checkbox' && !input.value.trim()) found[input.name]='This field is required.';
      else if(input.type==='url' && input.value && !/^https?:\/\//i.test(input.value)) found[input.name]='Use a complete https:// or http:// link.';
      else if(input.type!=='checkbox' && /<\/?[a-z!]/i.test(input.value)) found[input.name]='Use plain text without HTML.';
    }
    if(index===1 && (values.lat===''||values.lng==='')) found.lat='Place the pin on the map or enter both coordinates.';
    if(index===2 && !values.categories.length) found.categories='Choose at least one category.';
    if(index===3) {
      if(values.schedule_mode==='specific'&&!values.campaign_ids.length) found.campaign_ids='Choose at least one campaign.';
      if(values.start_time===values.end_time) found.end_time='Start and end times must differ.';
    }
    return found;
  };
  const showErrors = (found,index) => {
    setErrors(found);setStep(index);
    requestAnimationFrame(()=>{ const field=form.current?.elements.namedItem(Object.keys(found)[0]);field?.focus?.();field?.scrollIntoView?.({block:'center'}); });
  };
  const next = () => { const found=validate(step); if(Object.keys(found).length) showErrors(found,step);else {setErrors({});setStep(step+1);} };
  const upload = async (slot,file) => {
    if(processing||busy)return;
    setProcessing(true);setError('');
    try {
      const blob=await prepareSubmissionImage(file);
      if(!mounted.current)return;
      const photo={blob,url:URL.createObjectURL(blob)};
      if(photosRef.current[slot])URL.revokeObjectURL(photosRef.current[slot].url);
      photosRef.current={...photosRef.current,[slot]:photo};setPhotos(photosRef.current);onDirty?.(true);
    }catch(e){if(mounted.current)setError(e.message);}finally{if(mounted.current)setProcessing(false);}
  };
  const remove = (slot) => { const copy={...photosRef.current};URL.revokeObjectURL(copy[slot].url);delete copy[slot];photosRef.current=copy;setPhotos(copy);update(slot==='business_image'?'image_alt':'offer_image_alt',''); };
  const submit = async(e) => {
    e.preventDefault();if(busy||processing)return;
    if(step<5){next();return;}
    for(let i=0;i<6;i++){const found=validate(i);if(Object.keys(found).length){showErrors(found,i);return;}}
    setBusy(true);setError('');
    try {
      await api('session');
      const payload={...values,lat:Number(values.lat),lng:Number(values.lng),consent:values.consent?'yes':'',image_rights:values.image_rights?'yes':''};
      const body=new FormData();body.set('data',JSON.stringify(payload));
      for(const [slot,photo] of Object.entries(photos))body.set(slot,photo.blob,`${slot}.webp`);
      await api('submit-business',body);setSent(true);onDirty?.(false);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const field = (key,label,{max=200,required=false,type='text',area=false,...props}={}) => {
    const Tag=area?'textarea':'input';
    return <label className="submission-field" key={key}><span>{label}{required?' *':''}</span><Tag name={key} value={values[key]} onChange={e=>update(key,e.target.value)} required={required} maxLength={max} {...(!area?{type}:{rows:3})} {...props} aria-invalid={!!errors[key]} aria-describedby={errors[key]?`submission-error-${key}`:undefined}/>{area&&<small>{values[key].length}/{max} characters</small>}{errors[key]&&<small className="field-error" id={`submission-error-${key}`}>{errors[key]}</small>}</label>;
  };
  const check = (key,label) => <label className="submission-check"><input type="checkbox" name={key} checked={values[key]} onChange={e=>update(key,e.target.checked)}/><span>{label}</span></label>;
  if(sent)return <div className="submission-success" role="status"><Icon name="check" size={36}/><h2>Submission received</h2><p>Your business, offer and any photos have been sent to Falmouth BID for review. Nothing is published automatically.</p><button className="button primary" onClick={onClose}>Back to exploring</button></div>;
  return <form ref={form} className="business-submission submission-wizard" noValidate onSubmit={submit}>
    <p>{siteCopy(data).submissionIntro}</p>
    <nav className="submission-steps" aria-label="Submission steps">{steps.map((name,i)=><button type="button" key={name} disabled={busy||processing||i>step} aria-current={step===i?'step':undefined} onClick={()=>{setErrors({});setStep(i);}}><span>{i+1}</span>{name}</button>)}</nav>
    <h2 ref={heading} tabIndex={-1}>Step {step+1} of 6 · {steps[step]}</h2>
    {(error||Object.keys(errors).length>0)&&<div className="submission-error-summary" role="alert">{error||'Please check the highlighted fields before continuing.'}</div>}
    <fieldset disabled={busy||processing}>
      <section data-submission-step="0" hidden={step!==0}>
        {field('name','Business name',{max:120,required:true,autoComplete:'organization'})}
        {field('description','About your business',{max:500,required:true,area:true})}
        {field('phone','Public phone number',{max:40,type:'tel',pattern:'[+0-9 .\\(\\)\\-]{5,40}',autoComplete:'tel'})}
        {field('website','Website',{max:1000,type:'url',placeholder:'https://'})}
        {field('booking','Booking link',{max:1000,type:'url',placeholder:'https://'})}
        {field('facebook','Facebook link',{max:1000,type:'url',placeholder:'https://www.facebook.com/…'})}
        {field('instagram','Instagram link',{max:1000,type:'url',placeholder:'https://www.instagram.com/…'})}
      </section>
      <section data-submission-step="1" hidden={step!==1}>
        {field('address','Business address',{max:400,required:true,area:true,autoComplete:'street-address'})}
        <p>Click the map or drag the pin to your entrance, then check the coordinates below.</p>
        {step===1&&<div className="submission-map"><Suspense fallback={<p>Loading map…</p>}><MapView picker config={data.config} businesses={[{id:'submission',name:values.name||'Your business',lat:values.lat===''?50.1541:Number(values.lat),lng:values.lng===''?-5.0678:Number(values.lng)}]} offers={[]} categories={[]} onPick={p=>{update('lat',Number(p.lat.toFixed(6)));update('lng',Number(p.lng.toFixed(6)));}}/></Suspense></div>}
        <div className="submission-columns">{field('lat','Latitude',{required:true,type:'number',min:-90,max:90,step:'any'})}{field('lng','Longitude',{required:true,type:'number',min:-180,max:180,step:'any'})}</div>
        <small>If the map is unavailable, you can enter coordinates here.</small>
      </section>
      <section data-submission-step="2" hidden={step!==2}>
        {field('offer_title','Offer heading',{max:160,required:true})}
        {field('offer_description','Offer description',{max:250,area:true,required:true})}
        <fieldset className="submission-options"><legend>Offer categories *</legend>{data.categories.filter(c=>c.active!==false).map(c=><label className="submission-check" key={c.id}><input type="checkbox" checked={values.categories.includes(c.id)} onChange={()=>toggle('categories',c.id)}/><Icon name={c.icon}/>{c.name}</label>)}{errors.categories&&<small className="field-error">{errors.categories}</small>}</fieldset>
        {field('offer_redemption','How to redeem or book',{max:1000,area:true,required:true})}
        {field('offer_terms','Conditions and exclusions',{max:1500,area:true})}
      </section>
      <section data-submission-step="3" hidden={step!==3}>
        <label className="submission-check"><input type="checkbox" checked={values.schedule_mode==='specific'} onChange={e=>update('schedule_mode',e.target.checked?'specific':'all')}/><span>Set specific campaigns</span></label>
        {values.schedule_mode==='all'?<p>No specific dates: the offer is proposed for all published campaigns, including future campaigns, until staff withdraw it.</p>:<fieldset className="submission-options"><legend>Choose campaigns *</legend>{campaigns.map(d=><label className="submission-check" key={d.id}><input type="checkbox" checked={values.campaign_ids.includes(d.id)} onChange={()=>toggle('campaign_ids',d.id)}/><span>{d.label} · {dateLabel(d.date)}</span></label>)}{!campaigns.length&&<p>No upcoming campaigns are available. Use no specific dates or contact Falmouth BID.</p>}{errors.campaign_ids&&<small className="field-error">{errors.campaign_ids}</small>}{check('roll_over','Roll over onto future campaigns after my last selected campaign')}</fieldset>}
        <div className="submission-columns">{field('start_time','Starts',{required:true,type:'time'})}{field('end_time','Ends',{required:true,type:'time'})}</div>
        <small>UK local time. An end time earlier than the start runs into the following day.</small>
        {field('offer_time_note','Additional opening-hours note',{max:200})}
      </section>
      <section data-submission-step="4" hidden={step!==4}>
        <p>Photos are optional. We resize and convert them to WebP on your device before submitting. The offer can use the business photo if you leave its photo empty.</p>
        {['business_image','offer_image'].map((slot,i)=><div className="submission-photo" key={slot}><h3>{i?'Offer photo':'Business photo'}</h3><PhotoDropzone onUpload={file=>upload(slot,file)} busy={processing||busy}/>{photos[slot]&&<><img src={photos[slot].url} alt="Selected photo preview"/><small>Ready to send · {Math.ceil(photos[slot].blob.size/1024)} KB · WebP</small><button type="button" className="text-link" onClick={()=>remove(slot)}>Remove photo</button>{field(i?'offer_image_alt':'image_alt','Image description',{max:200,required:true})}</>}</div>)}
        {Object.keys(photos).length>0&&<label className="submission-check"><input type="checkbox" name="image_rights" checked={values.image_rights} onChange={e=>update('image_rights',e.target.checked)} required/><span>I have permission to submit these photos for Falmouth BID to use in this promotion. *</span></label>}
        {errors.image_rights&&<small className="field-error">{errors.image_rights}</small>}
      </section>
      <section data-submission-step="5" hidden={step!==5}>
        <div className="submission-review-card"><h3>{values.name}</h3><p>{values.description}</p><p>{values.address}<br/>{values.lat}, {values.lng}</p>{['phone','website','booking','facebook','instagram'].filter(k=>values[k]).map(k=><p key={k}><strong>{k}: </strong>{values[k]}</p>)}<button type="button" className="text-link" onClick={()=>setStep(0)}>Edit business details</button></div>
        <div className="submission-review-card"><h3>{values.offer_title}</h3><p>{values.offer_description}</p><p>{data.categories.filter(c=>values.categories.includes(c.id)).map(c=>c.name).join(' · ')}</p><p><strong>How to redeem:</strong> {values.offer_redemption}</p>{values.offer_terms&&<p><strong>Conditions:</strong> {values.offer_terms}</p>}<p>{values.schedule_mode==='all'?'All published campaigns':campaigns.filter(d=>values.campaign_ids.includes(d.id)).map(d=>dateLabel(d.date)).join(', ')}{values.schedule_mode==='specific'&&values.roll_over?' · Roll-over enabled':''}<br/>{values.start_time}–{values.end_time} (UK time)<br/>{values.offer_time_note}</p><button type="button" className="text-link" onClick={()=>setStep(2)}>Edit offer</button></div>
        <p>{Object.keys(photos).length} photo(s) ready to send. <button type="button" className="text-link" onClick={()=>setStep(4)}>Review photos</button></p>
        {field('contact','Your name (private)',{max:120,required:true,autoComplete:'name'})}
        {field('email','Your email (private)',{max:254,required:true,type:'email',autoComplete:'email'})}
        <label className="submission-honeypot" aria-hidden="true">Leave blank<input name="website_confirm" tabIndex={-1} autoComplete="off" value={values.website_confirm} onChange={e=>update('website_confirm',e.target.value)}/></label>
        <label className="submission-check"><input type="checkbox" name="consent" required checked={values.consent} onChange={e=>update('consent',e.target.checked)}/><span>I agree that Falmouth BID may use these details to review my submission and contact me about taking part. *</span></label>
        {errors.consent&&<small className="field-error">{errors.consent}</small>}
        <p className="submission-note">Your contact name and email are only shared with authorised staff. Business contact links are intended for publication after approval. Submitting does not publish your business or offer.</p>
      </section>
    </fieldset>
    <div className="submission-navigation"><button className="button secondary" type="button" disabled={busy||processing||step===0} onClick={()=>{setErrors({});setStep(step-1);}}><Icon name="back"/>Back</button><button className="button primary" disabled={busy||processing}>{processing?'Preparing photo…':busy?'Submitting…':step===5?'Submit for review':'Continue'}<Icon name="right"/></button></div>
  </form>;
}
