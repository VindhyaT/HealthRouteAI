import { useEffect, useRef, useState } from 'react';
import { Building2, Stethoscope, MapPin, CircleHelp, CalendarDays, Plus, Search, Pencil, Trash2, ShieldCheck, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '../services/api';
import { useAuthContext } from '../context/AuthContext';

type Item = { id: string; [key: string]: unknown };
type Field = { key: string; label: string; type?: 'textarea' | 'department' | 'service' | 'checkbox' | 'tags' | 'locations' | 'appointment' | 'lines'; optional?: boolean; max?: number };
const areas: Record<string, { label: string; fields: Field[] }> = {
  departments: { label: 'Departments', fields: [{ key: 'name', label: 'Name', max: 150 }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'icon', label: 'Icon', max: 80 }, { key: 'location_ids', label: 'Locations', type: 'locations', optional: true }] },
  services: { label: 'Services', fields: [{ key: 'department_id', label: 'Department', type: 'department' }, { key: 'name', label: 'Name', max: 150 }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'appointment_info', label: 'Appointment information', type: 'textarea' }, { key: 'tags', label: 'Search tags (comma separated)', type: 'tags', optional: true }] },
  locations: { label: 'Locations', fields: [{ key: 'name', label: 'Name', max: 150 }, { key: 'address', label: 'Address', max: 500 }, { key: 'phone', label: 'Phone', max: 80 }, { key: 'hours', label: 'Hours', max: 500 }] },
  faqs: { label: 'FAQs', fields: [{ key: 'question', label: 'Question', max: 500 }, { key: 'answer', label: 'Answer', type: 'textarea' }] },
  appointment_guidance: { label: 'Appointment guidance', fields: [{ key: 'service_id', label: 'Service', type: 'service' }, { key: 'title', label: 'Title', max: 200 }, { key: 'instructions', label: 'Instructions', type: 'textarea' }, { key: 'appointment_recommended', label: 'Appointment recommended', type: 'appointment', optional: true }, { key: 'how_to_schedule', label: 'How to schedule (administrative only)', type: 'textarea', optional: true }, { key: 'documents_to_bring', label: 'Documents to bring (one per line)', type: 'lines', optional: true }, { key: 'arrival_guidance', label: 'Arrival guidance (administrative only)', type: 'textarea', optional: true }, { key: 'is_demo', label: 'Demo administrative information', type: 'checkbox' }, { key: 'referral_required', label: 'Referral required', type: 'checkbox' }, { key: 'booking_url', label: 'Booking URL or site path', optional: true, max: 2000 }] }
};
const areaIcons = [Building2, Stethoscope, MapPin, CircleHelp, CalendarDays];
export default function AdminPage() {
  const { user } = useAuthContext();
  const [area, setArea] = useState('departments');
  const [items, setItems] = useState<Item[]>([]);
  const [related, setRelated] = useState<Record<string, Item[]>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const editor = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (pendingDelete) deleteDialog.current?.showModal(); else deleteDialog.current?.close();
  }, [pendingDelete]);
  useEffect(() => {
    if (user?.role !== 'admin') return;
    const controller = new AbortController();
    setLoading(true); setError(''); setDraft(null); setItems([]); setFieldErrors({});
    Promise.all([
      api<{ items: Item[] }>(`/admin/${area}`, { signal: controller.signal }),
      api<Record<string, number>>('/admin/summary', { signal: controller.signal }),
      ...['departments', 'services', 'locations'].map(key => api<{ items: Item[] }>(`/admin/${key}`, { signal: controller.signal }))
    ]).then(([data, summary, departments, services, locations]) => {
      if (controller.signal.aborted) return;
      setItems((data as { items: Item[] }).items); setCounts(summary as Record<string, number>);
      setRelated({ departments: (departments as { items: Item[] }).items, services: (services as { items: Item[] }).items, locations: (locations as { items: Item[] }).items });
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [area, refresh, user?.role]);
  if (user?.role !== 'admin') return <main className="admin-page"><p role="alert">Administrator access is required.</p></main>;
  function edit(item?: Item) {
    const values: Record<string, unknown> = {};
    for (const field of areas[area].fields) {
      const value = item?.[field.key];
      values[field.key] = field.type === 'lines' ? (value as string[] || []).join('\n') : field.type === 'tags' ? (value as string[] || []).join(', ') : value ?? (field.type === 'checkbox' ? false : field.type === 'locations' ? [] : field.key === 'icon' ? 'stethoscope' : '');
    }
    setDraft(values); setEditing(item?.id || null); setError(''); setNotice(''); setFieldErrors({});
    requestAnimationFrame(() => { editor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!draft || saving) return;
    setError(''); setFieldErrors({});
    const errors: Record<string, string[]> = {};
    for (const field of areas[area].fields) {
      const value = String(draft[field.key] ?? '').trim();
      if (['checkbox', 'appointment'].includes(field.type || '')) continue;
      if (field.type === 'locations') { if ((draft[field.key] as string[]).length > 100) errors[field.key] = ['Select at most 100 locations.']; continue; }
      if (!field.optional && !value) { errors[field.key] = [`${field.label} is required.`]; continue; }
      const max = field.max || (field.type === 'textarea' ? 5000 : 2500);
      if (value.length > max && !['tags', 'lines'].includes(field.type || '')) errors[field.key] = [`Use ${max} characters or fewer.`];
      if (field.type === 'tags' || field.type === 'lines') {
        const entries = value.split(field.type === 'tags' ? ',' : /\r?\n/).map(item => item.trim()).filter(Boolean);
        const count = field.type === 'tags' ? 30 : 20;
        const length = field.type === 'tags' ? 80 : 300;
        if (entries.length > count || entries.some(item => item.length > length)) errors[field.key] = [`Use at most ${count} entries, each ${length} characters or fewer.`];
      }
      if (field.key === 'booking_url' && value) {
        let valid = /^\/(?![\/\\])[^\s\\]*$/.test(value);
        try { const url = new URL(value); valid = /^https?:$/.test(url.protocol) && !!url.hostname && !/\s/.test(value); } catch { /* Site paths are also supported. */ }
        if (!valid) errors[field.key] = ['Enter a valid http(s) URL or a site path starting with /.'];
      }
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors); setError('Please complete the highlighted fields.');
      requestAnimationFrame(() => editor.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return;
    }
    setSaving(true);
    const body = { ...draft };
    if ('tags' in body) body.tags = String(body.tags).split(',').map(s => s.trim()).filter(Boolean);
    if ('documents_to_bring' in body) body.documents_to_bring = String(body.documents_to_bring).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if ('appointment_recommended' in body) body.appointment_recommended = body.appointment_recommended === '' ? null : String(body.appointment_recommended) === 'true';
    if ('booking_url' in body && !body.booking_url) body.booking_url = null;
    try {
      await api(`/admin/${area}${editing ? `/${editing}` : ''}`, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) });
      setNotice(editing ? 'Changes saved.' : 'Record created.'); setDraft(null); setRefresh(value => value + 1);
    } catch (e) { setError((e as Error).message); if (e instanceof ApiError) setFieldErrors(e.fields || {}); } finally { setSaving(false); }
  }
  async function remove() {
    if (!pendingDelete || saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await api(`/admin/${area}/${pendingDelete.id}`, { method: 'DELETE' });
      setPendingDelete(null); setNotice('Record deleted.'); setRefresh(value => value + 1);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }
  const filtered = items.filter(item => String([item.name, item.question, item.title, item.description, item.address, item.answer, item.instructions].filter(Boolean).join(' ')).toLowerCase().includes(search.toLowerCase().trim()));
  const cascade = area === 'departments' ? 'Its services, appointment guidance, and location links will also be deleted.' : area === 'services' ? 'Its appointment guidance will also be deleted.' : area === 'locations' ? 'Its department links will also be deleted.' : '';
  return <main id="admin-main" tabIndex={-1} className="admin-page admin-dashboard"><div className="admin-header"><div><span className="eyebrow">HEALTHROUTE ADMINISTRATION</span><h1>Directory workspace</h1><p>Keep every patient's next step clear and up to date.</p></div><span className="admin-badge"><ShieldCheck aria-hidden="true" size={18}/> Administrator access</span></div>
    <div className="dashboard-stats">{Object.entries(areas).map(([key, config], index) => { const Icon = areaIcons[index]; return <button className="dashboard-stat" key={key} disabled={saving || !!draft} onClick={() => { setArea(key); setSearch(''); setNotice(''); }} aria-label={`Manage ${config.label}`}><Icon aria-hidden="true" size={20}/><strong>{counts[key] ?? '—'}</strong><span>{config.label}</span></button>; })}</div>
    <div className="dashboard-layout"><aside className="dashboard-sidebar"><span className="eyebrow">CONTENT MANAGEMENT</span><nav aria-label="Admin content areas">{Object.entries(areas).map(([key, config], index) => { const Icon = areaIcons[index]; return <button key={key} disabled={saving || !!draft} aria-current={area === key ? 'page' : undefined} onClick={() => { setArea(key); setSearch(''); setNotice(''); }}><Icon aria-hidden="true" size={17}/>{config.label}<span>{counts[key] ?? '—'}</span></button>; })}</nav><p>Changes are reflected in the public directory. Review content before saving.</p></aside><section className="dashboard-content" aria-label={areas[area].label}>
    {error && !pendingDelete && <p className="form-error" role="alert">{error} {!draft && <button onClick={() => setRefresh(v => v + 1)}>Retry</button>}</p>}
    {notice && <p className="success-message" role="status"><CheckCircle2 aria-hidden="true" size={17}/>{notice}</p>}
    {loading ? <div className="dashboard-loading" role="status"><RefreshCw aria-hidden="true" size={20}/> Loading {areas[area].label.toLowerCase()}...</div> : <>
      <div className="table-heading"><div><h2>{areas[area].label}</h2><p>{items.length} records in your directory</p></div><button className="primary-button" onClick={() => edit()} disabled={saving || !!draft || !!error && !items.length}><Plus aria-hidden="true" size={16}/>Add record</button></div>
      <div className="dashboard-search"><Search aria-hidden="true" size={18}/><label className="sr-only" htmlFor="admin-record-search">Search admin records</label><input id="admin-record-search" aria-label="Search admin records" placeholder={`Search ${areas[area].label.toLowerCase()}...`} value={search} onChange={e => setSearch(e.target.value)}/></div>
      {draft && <form noValidate ref={editor} className="admin-editor" onSubmit={save} onChange={event => {
        const label = (event.target as HTMLElement).getAttribute('aria-label');
        const field = areas[area].fields.find(item => item.label === label);
        if (field) setFieldErrors(current => { const next = { ...current }; delete next[field.key]; return next; });
      }}><h3>{editing ? 'Edit record' : 'New record'}</h3><fieldset disabled={saving}>
        {areas[area].fields.map(field => <label key={field.key} className={fieldErrors[field.key] ? 'field-invalid' : ''}>{field.label}{field.optional && <small className="field-optional">Optional</small>}
          {field.type === 'appointment' ? <select autoFocus={field.key === areas[area].fields[0].key} aria-label={field.label} aria-invalid={!!fieldErrors[field.key]} aria-describedby={fieldErrors[field.key] ? `error-${field.key}` : undefined} value={String(draft[field.key])} onChange={e => setDraft({ ...draft, [field.key]: e.target.value })}><option value="">Not specified</option><option value="true">Yes</option><option value="false">No</option></select> : field.type === 'checkbox' ? <input autoFocus={field.key === areas[area].fields[0].key} aria-label={field.label} aria-invalid={!!fieldErrors[field.key]} aria-describedby={fieldErrors[field.key] ? `error-${field.key}` : undefined} type="checkbox" checked={Boolean(draft[field.key])} onChange={e => setDraft({ ...draft, [field.key]: e.target.checked })}/> : field.type === 'locations' ? <select autoFocus={field.key === areas[area].fields[0].key} aria-label={field.label} aria-invalid={!!fieldErrors[field.key]} aria-describedby={fieldErrors[field.key] ? `error-${field.key}` : undefined} multiple value={draft[field.key] as string[]} onChange={e => setDraft({ ...draft, [field.key]: Array.from(e.target.selectedOptions, o => o.value) })}>{related.locations?.map(item => <option value={item.id} key={item.id}>{String(item.name)}</option>)}</select> : field.type === 'department' || field.type === 'service' ? <select autoFocus={field.key === areas[area].fields[0].key} aria-label={field.label} aria-invalid={!!fieldErrors[field.key]} aria-describedby={fieldErrors[field.key] ? `error-${field.key}` : undefined} required value={String(draft[field.key])} onChange={e => setDraft({ ...draft, [field.key]: e.target.value })}><option value="">Select {field.label.toLowerCase()}</option>{related[field.type === 'department' ? 'departments' : 'services']?.map(item => <option key={item.id} value={item.id}>{String(item.name)}</option>)}</select> : field.type === 'textarea' || field.type === 'lines' ? <textarea autoFocus={field.key === areas[area].fields[0].key} aria-label={field.label} aria-invalid={!!fieldErrors[field.key]} aria-describedby={fieldErrors[field.key] ? `error-${field.key}` : undefined} required={!field.optional} rows={3} maxLength={field.type === 'lines' ? 6019 : 5000} value={String(draft[field.key])} onChange={e => setDraft({ ...draft, [field.key]: e.target.value })}/> : <input autoFocus={field.key === areas[area].fields[0].key} aria-label={field.label} aria-invalid={!!fieldErrors[field.key]} aria-describedby={fieldErrors[field.key] ? `error-${field.key}` : undefined} required={!field.optional} maxLength={field.max || 2500} value={String(draft[field.key])} onChange={e => setDraft({ ...draft, [field.key]: e.target.value })}/>}
          {fieldErrors[field.key] && <span id={`error-${field.key}`} className="field-error" role="alert">{fieldErrors[field.key].join(' ')}</span>}
        </label>)}<div className="editor-actions"><button className="primary-button" type="submit">{saving ? 'Saving...' : 'Save changes'}</button><button type="button" onClick={() => setDraft(null)}>Cancel</button></div>
      </fieldset></form>}
      {!filtered.length && !error && <div className="dashboard-empty"><Search aria-hidden="true" size={28}/><h3>{search ? 'No matching records' : 'No records yet'}</h3><p>{search ? 'Try another search or clear the filter.' : 'Add a record to get started.'}</p>{search && <button className="text-button" onClick={() => setSearch('')}>Clear search</button>}</div>}
      <div className="admin-records">{filtered.map(item => <article className="admin-record" key={item.id}><div><strong>{String(item.name || item.question || item.title)}</strong>{item.department_id != null && <small className="record-relation">{String(related.departments?.find(d => d.id === item.department_id)?.name || 'Department unavailable')}</small>}{item.service_id != null && <small className="record-relation">{String(related.services?.find(d => d.id === item.service_id)?.name || 'Service unavailable')}</small>}<p>{String(item.description || item.address || item.answer || item.instructions || '')}</p></div><div className="editor-actions"><button aria-label={`Edit ${String(item.name || item.question || item.title)}`} disabled={saving || !!draft} onClick={() => edit(item)}><Pencil aria-hidden="true" size={14}/>Edit</button><button aria-label={`Delete ${String(item.name || item.question || item.title)}`} className="delete-button" disabled={saving || !!draft} onClick={() => { setError(''); setPendingDelete(item); }}><Trash2 aria-hidden="true" size={14}/>Delete</button></div></article>)}</div>
    </>}
    </section></div>
    <dialog ref={deleteDialog} className="delete-dialog" aria-labelledby="delete-title" aria-describedby="delete-description" onCancel={event => { event.preventDefault(); if (!saving) setPendingDelete(null); }}>
      <span className="delete-icon"><Trash2 aria-hidden="true" size={24}/></span><h2 id="delete-title">Delete this record?</h2><p id="delete-description">“{String(pendingDelete?.name || pendingDelete?.question || pendingDelete?.title || '')}” will be permanently removed. {cascade}</p>
      {error && <p className="form-error" role="alert">{error}</p>}<div className="editor-actions"><button autoFocus disabled={saving} onClick={() => setPendingDelete(null)}>Cancel</button><button className="confirm-delete" disabled={saving} onClick={remove}>{saving ? 'Deleting...' : 'Delete record'}</button></div>
    </dialog>
  </main>;
}
