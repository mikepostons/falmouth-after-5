import React, { useState } from 'react';
import { api } from './api';
import { Dialog } from './main';
import SubmissionDetails from './SubmissionDetails';

export default function SubmissionTable({ records, data, onReload }) {
  const [trash,setTrash]=useState(false), [selected,setSelected]=useState(null), [deleting,setDeleting]=useState(null), [busy,setBusy]=useState(false), [error,setError]=useState('');
  const rows=records.filter(r=>(r.status==='deleted')===trash).sort((a,b)=>String(b.consent_at).localeCompare(String(a.consent_at)));
  const viewed=records.find(r=>r.id===selected);
  const action=async (route,record)=>{
    if(busy)return;
    setBusy(true);setError('');
    try { await api(route,{id:record.id}); await onReload(); setDeleting(null);setSelected(null); }
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <>
    <div className="submission-table-toolbar" role="group" aria-label="Request folders">
      <button className={`button ${!trash?'primary':'secondary'}`} onClick={()=>{setTrash(false);setError('');}}>Requests ({records.filter(r=>r.status!=='deleted').length})</button>
      <button className={`button ${trash?'primary':'secondary'}`} onClick={()=>{setTrash(true);setError('');}}>Trash ({records.filter(r=>r.status==='deleted').length})</button>
    </div>
    {error&&!viewed&&!deleting&&<p className="error" role="alert">{error}</p>}
    <div className="submission-table-scroll">
      <table className="submission-table"><caption className="sr-only">{trash?'Deleted business requests':'Business requests, newest received first'}</caption>
        <thead><tr><th scope="col">Business / offer</th><th scope="col">Contact</th><th scope="col">Received</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
        <tbody>{rows.map(r=><tr key={r.id}>
          <th scope="row"><strong>{r.name}</strong><small>{r.offer_details?.title||r.offer}</small></th>
          <td>{r.contact}<small><a href={`mailto:${r.email}`}>{r.email}</a></small></td>
          <td>{new Date(r.consent_at).toLocaleDateString('en-GB')}</td>
          <td><span className={`status ${r.status==='new'?'published':''}`}>{r.status==='deleted'?'In trash':r.status}</span></td>
          <td><div className="submission-row-actions"><button className="text-link" onClick={()=>{setSelected(r.id);setError('');}}>View<span className="sr-only"> {r.name}</span></button>
            {trash?<button className="text-link" disabled={busy} onClick={()=>action('restore-submission',r)}>Restore<span className="sr-only"> {r.name}</span></button>:<button className="text-link submission-delete" disabled={busy} onClick={()=>{setDeleting(r);setError('');}}>Delete<span className="sr-only"> {r.name}</span></button>}
          </div></td>
        </tr>)}</tbody>
      </table>
      {!rows.length&&<p className="submission-table-empty">{trash?'No requests in trash.':'No requests to show.'}</p>}
    </div>
    {viewed&&<Dialog label={`Request from ${viewed.name}`} wide onClose={()=>{if(!busy)setSelected(null);}}><article className="submission-request-detail">
      <h2>{viewed.name}</h2><p>{viewed.address}</p><p>{viewed.contact} · <a href={`mailto:${viewed.email}`}>{viewed.email}</a></p><p>Received {new Date(viewed.consent_at).toLocaleDateString('en-GB')} · {viewed.status}</p>
      {error&&<p className="error" role="alert">{error}</p>}
      <SubmissionDetails record={viewed} data={data} expanded/>
      <div className="submission-row-actions">
        {viewed.status==='new'&&<button className="button primary" disabled={busy} onClick={()=>action('review-submission',viewed)}>Mark reviewed</button>}
        {viewed.status==='deleted'?<button className="button secondary" disabled={busy} onClick={()=>action('restore-submission',viewed)}>Restore request</button>:<button className="button secondary submission-delete" disabled={busy} onClick={()=>{setDeleting(viewed);setError('');}}>Delete request</button>}
      </div>
    </article></Dialog>}
    {deleting&&<Dialog label="Delete business request?" onClose={()=>{if(!busy)setDeleting(null);}}><div className="submission-request-detail"><h2>Delete this request?</h2><p>Move the request from <strong>{deleting.name}</strong> to Trash? You can restore it later. Existing business profiles and offers are unaffected.</p>{error&&<p className="error" role="alert">{error}</p>}<div className="submission-row-actions"><button className="button secondary" disabled={busy} onClick={()=>setDeleting(null)}>Cancel</button><button className="button primary" disabled={busy} onClick={()=>action('delete-submission',deleting)}>{busy?'Moving…':'Move to Trash'}</button></div></div></Dialog>}
  </>;
}
