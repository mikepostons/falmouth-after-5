import React from 'react';
import { dateLabel } from './domain';
export default function SubmissionDetails({ record, data, expanded = false }) {
  if(!record.business || !record.offer_details)return <p className="preserve-lines">{record.offer}</p>;
  const b=record.business,o=record.offer_details;
  return <details className="submission-full-details" open={expanded}><summary>View business, offer and photos</summary>
    <h3>Business details</h3><p className="preserve-lines">{b.description}</p><p>Map position: {b.lat}, {b.lng}</p>
    <dl>{['phone','website','booking','facebook','instagram'].filter(k=>b[k]).map(k=><React.Fragment key={k}><dt>{k}</dt><dd>{b[k]}</dd></React.Fragment>)}</dl>
    <h3>{o.title}</h3><p className="preserve-lines">{o.description}</p><p>{data.categories.filter(c=>o.categories.includes(c.id)).map(c=>c.name).join(' · ')}</p>
    <h4>How to redeem</h4><p className="preserve-lines">{o.redemption}</p><h4>Conditions</h4><p className="preserve-lines">{o.terms||'None supplied'}</p>
    <h4>Campaigns and hours</h4><p>{o.schedule_mode==='all'?'All published campaigns':o.campaign_ids.map(id=>{const d=data.dates.find(c=>c.id===id);return d?`${d.label} (${dateLabel(d.date)})`:'Campaign no longer available';}).join(', ')}{o.roll_over?' · Roll-over enabled':''}</p><p>{o.start_time}–{o.end_time} (UK time)<br/>{o.time_note}</p>
    {['business','offer_details'].map(slot=>record[slot].image&&<figure key={slot}><img loading="lazy" src={`./api.php?action=submission-image&id=${encodeURIComponent(record.id)}&slot=${slot}`} alt={record[slot].image_alt}/><figcaption>{slot==='business'?'Business photo':'Offer photo'} · {record[slot].image_alt}</figcaption><a className="text-link" href={`./api.php?action=submission-image&id=${encodeURIComponent(record.id)}&slot=${slot}`} download={`${slot}.webp`}>Download photo for the CMS</a></figure>)}
    {record.image_rights_confirmed&&<p>Submitter confirmed permission to use the photos.</p>}
    <p>Marking reviewed does not publish or create a business/offer. Use these details to create the CMS records after checking the submission.</p>
  </details>;
}
