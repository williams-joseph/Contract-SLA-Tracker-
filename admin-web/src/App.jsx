import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import { contractsApi, vendorsApi, usersApi, notificationsApi, auditApi, authApi, settingsApi } from './services/api';

const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email || !password) return setError('Please enter email and password.');
    setLoading(true); setError('');
    try {
      const data = await authApi.login(email.trim(), password.trim());
      localStorage.setItem('ccj_token', data.token);
      localStorage.setItem('ccj_user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-logo">
          <img src="/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div className="login-title">SLA Tracker</div>
        <div className="login-subtitle">Administration Portal</div>

        {error && <div style={{ background: 'var(--danger)', color: 'white', padding: '12px', borderRadius: '8px', fontSize: '12px', marginBottom: '20px', textAlign: 'center' }}>{error}</div>}

        <div className="form-group">
          <label className="form-label">Work Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. user@courtecowas.org"
            className="form-input" style={{ fontSize: '14px', padding: '12px' }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </div>

        <div className="form-group" style={{ marginBottom: '32px' }}>
          <label className="form-label">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
            className="form-input" style={{ fontSize: '14px', padding: '12px' }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </div>

        <button onClick={handleSubmit} disabled={loading} className="btn btn-primary"
          style={{ width: '100%', padding: '14px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', border: 'none' }}>
          {loading ? 'Authenticating…' : 'Log In to Dashboard'}
        </button>
      </div>
    </div>
  );
};

const StatusPill = ({ status }) => {
  const cls = { 'In Progress': 'sp-ip', 'Active': 'sp-ip', 'Expired': 'sp-ex', 'Completed': 'sp-co', 'Expiring Soon': 'sp-su' };
  const label = status === 'Active' ? 'In Progress' : status;
  return <span className={`status-pill ${cls[status] || ''}`}><span className="sdot"></span>{label}</span>;
};

const ContractPanel = ({ isOpen, mode, editData, vendors, onClose, onSave }) => {
  const empty = { vendor_id: '', vendor_name_input: '', title: '', description: '', category: 'Contract', contract_type: '', po_number: '', contract_value: '', currency: 'NGN', start_date: '', end_date: '', duration: '', service_quality: '', notes: '', parent_id: null, status: '', pdf_url: '' };
  const [form, setForm] = useState(empty);
  const [pdfFile, setPdfFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const bodyRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (error && bodyRef.current) {
      bodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [error]);

  useEffect(() => {
    if ((mode === 'edit' || mode === 'renew') && editData) {
      setForm({
        vendor_id: editData.vendor_id || '',
        vendor_name_input: editData.vendor_name || '',
        vendor_category: editData.vendor_category || 'Miscellaneous',
        title: mode === 'renew' ? `${editData.title} (Renewed)` : (editData.title || ''),
        description: editData.description || '',
        category: editData.category || 'Contract',
        contract_type: editData.contract_type || '',
        po_number: editData.po_number || '',
        contract_value: editData.contract_value || '',
        currency: editData.currency || 'NGN',
        start_date: mode === 'renew' ? new Date().toISOString().slice(0, 10) : (editData.start_date ? editData.start_date.slice(0, 10) : ''),
        end_date: mode === 'renew' ? '' : (editData.end_date ? editData.end_date.slice(0, 10) : ''),
        duration: editData.duration || '',
        service_quality: editData.service_quality || '',
        notes: editData.notes || '',
        parent_id: mode === 'renew' ? editData.id : null,
        status: mode === 'renew' ? '' : (editData.status || ''),
        pdf_url: editData.pdf_url || ''
      });
    } else { 
      setForm({ ...empty, vendor_category: 'Miscellaneous' }); 
    }
    setPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setError('');
  }, [isOpen, mode, editData]);

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleSave = async () => {
    if (!form.title || !form.end_date) return setError('Contract Description and End Date are required.');
    if (!form.vendor_id && !form.vendor_name_input) return setError('Vendor Name is required.');

    if (form.duration && form.start_date && form.end_date) {
      const match = form.duration.match(/^(\d+)\s*(year|yr|month|mo)/i);
      if (match) {
        const num = parseInt(match[1]);
        const type = match[2].toLowerCase();
        const start = new Date(form.start_date);
        const end = new Date(form.end_date);
        const expectedMonths = num * (type.startsWith('y') ? 12 : 1);

        let monthDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        if (end.getDate() < start.getDate()) monthDiff--;

        if (Math.abs(monthDiff - expectedMonths) > 1) {
          return setError(`The selected dates do not match the mapped duration of ${form.duration}. Please adjust the start or end date.`);
        }
      }
    }

    setSaving(true); setError('');
    try {
      let finalVendorId = form.vendor_id;
      if (!finalVendorId && form.vendor_name_input) {
        try {
          const nv = await vendorsApi.create({ 
            name: form.vendor_name_input, 
            external_id: form.po_number || '',
            category: form.vendor_category
          });
          finalVendorId = nv.id;
        } catch (e) { throw new Error('Failed to create new vendor entry: ' + e.message); }
      }

      const formData = new FormData();
      Object.keys(form).forEach(key => {
        if (form[key] !== null && form[key] !== undefined) {
          formData.append(key, form[key]);
        }
      });
      formData.set('vendor_id', finalVendorId);
      if (pdfFile) {
        formData.append('pdf', pdfFile);
      }

      if (mode === 'edit' && editData) await contractsApi.update(editData.id, formData);
      else if (mode === 'renew' && editData) await contractsApi.renew(editData.id, form); // Renew stays simple or also needs pdf? usually new term might need new pdf. boss said "include uploads when adding contracts".
      else await contractsApi.create(formData);

      onSave(); onClose();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <>
      {isOpen && <div className="ccj-modal-overlay" onClick={onClose} style={{ zIndex: 1001 }}></div>}
      <div className={`form-panel ${isOpen ? 'open' : ''}`} style={{ zIndex: 1002 }}>
        <div className="fp-header">
          <div className="fp-title">
            {mode === 'edit' ? 'Edit Record' : mode === 'renew' ? 'Service Renewal' : 'Add New Record'}
          </div>
          <button className="fp-close" onClick={onClose}>✕</button>
        </div>
        <div className="fp-body" ref={bodyRef}>
          {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '14px' }}>{error}</div>}

          {mode !== 'renew' && (
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Classification</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className={`filter-btn ${form.category === 'Contract' ? 'active' : ''}`} onClick={() => set('category', 'Contract')} style={{ flex: 1 }}>Service Contract</button>
                  <button className={`filter-btn ${form.category === 'Purchase' ? 'active' : ''}`} onClick={() => set('category', 'Purchase')} style={{ flex: 1 }}>Direct Purchase</button>
                </div>
              </div>
              {mode === 'edit' && form.category === 'Contract' && (
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Manual Status Override</label>
                  <select className="form-select" value={form.status === 'Completed' ? 'Completed' : 'Auto'} onChange={e => set('status', e.target.value === 'Auto' ? '' : 'Completed')}>
                    <option value="Auto">Auto (Based on end date)</option>
                    <option value="Completed">Mark as Completed</option>
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Vendor Name</label>
            <input
              className="form-input"
              list="vendors-list"
              placeholder="e.g. DUALNET NIGERIA LIMITED"
              value={form.vendor_name_input || ''}
              onChange={e => {
                const val = e.target.value.toUpperCase();
                const matched = vendors.find(v => v.name.toUpperCase() === val);
                if (matched) {
                  setForm(f => ({ 
                    ...f, 
                    vendor_name_input: val, 
                    vendor_id: matched.id, 
                    po_number: matched.external_id || f.po_number,
                    vendor_category: matched.category || ''
                  }));
                } else {
                  setForm(f => ({ ...f, vendor_name_input: val, vendor_id: '' }));
                }
              }}
              disabled={mode === 'renew'}
            />
            <datalist id="vendors-list">
              {vendors.map(v => <option key={v.id} value={v.name} />)}
            </datalist>
            {mode === 'renew' && <small style={{ color: 'var(--muted)', fontSize: '10px', marginTop: '4px', display: 'block' }}>Vendor is locked for renewal. Create a new contract for a different vendor.</small>}
          </div>

          <div className="form-group">
            <label className="form-label">Vendor Category</label>
            <select 
              className="form-select" 
              value={form.vendor_category || ''} 
              onChange={e => set('vendor_category', e.target.value)}
              disabled={!!form.vendor_id || mode === 'renew'}
            >
              <option value="">None / Uncategorized</option>
              <option value="IT Contracts">IT Contracts</option>
              <option value="General Services">General Services</option>
              <option value="Miscellaneous">Miscellaneous</option>
            </select>
            {form.vendor_id && <small style={{ color: 'var(--muted)', fontSize: '10px', marginTop: '4px', display: 'block' }}>Category is linked to the existing vendor profile.</small>}
          </div>
          <div className="form-group">
            <label className="form-label">{form.category === 'Purchase' ? 'Purchase Description' : 'Contract Description'}</label>
            <input className="form-input" type="text" placeholder={form.category === 'Purchase' ? 'e.g. DSTV Subscription' : 'e.g. Cleaning Services'} value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{form.category === 'Purchase' ? 'Vendor ID' : 'Vendor ID'}</label>
              <input className="form-input" type="text" placeholder={form.category === 'Purchase' ? 'e.g. 202666' : 'e.g. 202666'} value={form.po_number || ''} onChange={e => set('po_number', e.target.value.toUpperCase())} />
            </div>
            <div className="form-group">
              <label className="form-label">Duration</label>
              <input className="form-input" type="text" placeholder="e.g. 1 Year" value={form.duration || ''} onChange={e => set('duration', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Contract Value</label>
              <input className="form-input" type="number" placeholder="e.g. 5000000" value={form.contract_value || ''} onChange={e => set('contract_value', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Currency</label>
              <select className="form-select" value={form.currency} onChange={e => set('currency', e.target.value)}>
                <option value="NGN">NGN (₦)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Transaction Description</label>
            <textarea className="form-textarea" placeholder="Brief description…" value={form.description || ''} onChange={e => set('description', e.target.value)}></textarea>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input className="form-input" type="date" value={form.start_date || ''} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">End Date *</label>
              <input className="form-input" type="date" value={form.end_date || ''} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Contract Type</label>
              <input className="form-input" type="text" placeholder="e.g. Supply, Service" value={form.contract_type} onChange={e => set('contract_type', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Service Quality</label>
              <select className="form-select" value={form.service_quality} onChange={e => set('service_quality', e.target.value)}>
                <option value="">— Select —</option>
                <option>Excellent</option><option>Good</option><option>Satisfactory</option><option>Poor</option>
              </select>
            </div>
          </div>


          <div className="form-group">
            <label className="form-label">Contract PDF Attachment</label>
            <div className="file-upload-container" style={{ border: '2px dashed #e5e7eb', padding: '16px', borderRadius: '10px', textAlign: 'center', background: '#f9fafb' }}>
              <input 
                type="file" 
                accept=".pdf" 
                onChange={e => setPdfFile(e.target.files[0])} 
                ref={fileInputRef}
                style={{ fontSize: '12px' }}
              />
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px' }}>Only PDF files allowed (Max 10MB)</div>
            </div>
            {form.pdf_url && (
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent)' }}>📎 Existing PDF:</span>
                <a href={`http://localhost:5000${form.pdf_url}`} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'underline' }}>View PDF</a>
              </div>
            )}
          </div>
        </div>
        <div className="fp-footer">
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Processing…' : mode === 'edit' ? 'Update Details' : mode === 'renew' ? 'Confirm Renewal' : 'Save Record'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </>
  );
};
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, danger }) => {
  if (!isOpen) return null;
  return (
    <div className="ccj-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div className="modal-card" style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '380px', boxShadow: '0 24px 48px rgba(0,0,0,0.15)', animation: 'fadeUp 0.3s', zIndex: 1101 }}>
        <div style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'Syne', marginBottom: '12px', color: danger ? 'var(--danger)' : 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '28px', lineHeight: '1.6' }}>{message}</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-ghost" style={{ flex: 1, padding: '12px' }} onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1, padding: '12px', background: danger ? 'var(--danger)' : 'var(--accent)', borderColor: danger ? 'var(--danger)' : 'var(--accent)' }} onClick={onConfirm}>
            {danger ? 'Confirm Delete' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

const UserPanel = ({ isOpen, mode, editData, currentUser, onClose, onSave }) => {
  const empty = { full_name: '', email: '', password: '', role: 'officer', is_active: true };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const bodyRef = useRef(null);

  useEffect(() => {
    if (error && bodyRef.current) {
      bodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [error]);

  useEffect(() => {
    if (mode === 'edit' && editData) {
      setForm({ ...editData, password: '' });
    } else { setForm(empty); }
    setError('');
  }, [isOpen, mode, editData]);

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleSave = async () => {
    if (!form.full_name || !form.email) return setError('Name and email are required.');
    if (mode === 'add' && !form.password) return setError('Password is required for new users.');
    setSaving(true); setError('');
    try {
      if (mode === 'edit' && editData) await usersApi.update(editData.id, form);
      else await usersApi.create(form);
      onSave(); onClose();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const isSuperadmin = currentUser?.email === 'eamoakwa@courtecowas.org';

  return (
    <>
      {isOpen && <div className="ccj-modal-overlay" onClick={onClose} style={{ zIndex: 1001 }}></div>}
      <div className={`form-panel ${isOpen ? 'open' : ''}`} style={{ zIndex: 1002 }}>
        <div className="fp-header">
          <div className="fp-title">{mode === 'edit' ? 'Edit User' : 'Add New User'}</div>
          <button className="fp-close" onClick={onClose}>✕</button>
        </div>
        <div className="fp-body" ref={bodyRef}>
          {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '14px' }}>{error}</div>}
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" type="text" value={form.full_name} onChange={e => set('full_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{mode === 'edit' ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
            <input className="form-input" type="password" value={form.password} onChange={e => set('password', e.target.value)} />
          </div>
          {isSuperadmin && (
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="officer">Officer</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          )}
          {mode === 'edit' && (
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.is_active ? '1' : '0'} onChange={e => set('is_active', e.target.value === '1')}>
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
          )}
        </div>
        <div className="fp-footer">
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>{saving ? 'Processing…' : 'Save Details'}</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </>
  );
};

const VendorEditPanel = ({ isOpen, editData, onClose, onSave }) => {
  const [form, setForm] = useState({ name: '', category: 'Miscellaneous', contact_email: '', contact_phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editData) {
      setForm({
        name: editData.name || '',
        category: editData.category || 'Miscellaneous',
        contact_email: editData.contact_email || '',
        contact_phone: editData.contact_phone || ''
      });
    }
    setError('');
  }, [isOpen, editData]);

  const handleSave = async () => {
    if (!form.name) return setError('Vendor name is required.');
    setSaving(true);
    try {
      await vendorsApi.update(editData.id, form);
      onSave();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {isOpen && <div className="ccj-modal-overlay" onClick={onClose} style={{ zIndex: 1001 }}></div>}
      <div className={`form-panel ${isOpen ? 'open' : ''}`} style={{ zIndex: 1002 }}>
        <div className="fp-header">
          <div className="fp-title">Edit Vendor</div>
          <button className="fp-close" onClick={onClose}>✕</button>
        </div>
        <div className="fp-body">
          {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '14px' }}>{error}</div>}
          <div className="form-group">
            <label className="form-label">Vendor Name</label>
            <input className="form-input" type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value.toUpperCase() })} />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="">None / Uncategorized</option>
              <option value="IT Contracts">IT Contracts</option>
              <option value="General Services">General Services</option>
              <option value="Miscellaneous">Miscellaneous</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Contact Email</label>
            <input className="form-input" type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Contact Phone</label>
            <input className="form-input" type="text" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} />
          </div>
        </div>
        <div className="fp-footer">
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>{saving ? 'Updating…' : 'Save Changes'}</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </>
  );
};

function App() {
  const storedUser = JSON.parse(localStorage.getItem('ccj_user') || 'null');
  const [user, setUser] = useState(storedUser);
  const [contracts, setContracts] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, expiring_soon: 0, expired: 0 });
  const [vendors, setVendors] = useState([]);
  const [users, setUsers] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [notifLog, setNotifLog] = useState([]);
  const [activeNav, setActiveNav] = useState('contracts');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState('add');
  const [editData, setEditData] = useState(null);

  const [isUserPanelOpen, setIsUserPanelOpen] = useState(false);
  const [userPanelMode, setUserPanelMode] = useState('add');
  const [userEditData, setUserEditData] = useState(null);

  const [isVendorPanelOpen, setIsVendorPanelOpen] = useState(false);
  const [vendorEditData, setVendorEditData] = useState(null);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('In Progress');
  const [filterVendorCategory, setFilterVendorCategory] = useState('All');
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000); };

  const loadContracts = useCallback(async () => {
    setLoading(true);
    try {
      const [data, statsData] = await Promise.all([contractsApi.getAll(), contractsApi.getStats()]);
      setContracts(data); setStats(statsData);
    } catch (err) { showToast('Error: ' + err.message); }
    finally { setLoading(false); }
  }, []);

  const loadVendors = useCallback(async () => { try { setVendors(await vendorsApi.getAll()); } catch { } }, []);
  const loadUsers = useCallback(async () => { try { setUsers(await usersApi.getAll()); } catch { } }, []);
  const loadAuditLog = useCallback(async () => { try { setAuditLog(await auditApi.getLog()); } catch { } }, []);
  const loadNotifLog = async () => { try { setNotifLog(await notificationsApi.getLog()); } catch { } };

  const [systemSettings, setSystemSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const loadSettings = async () => {
    try { 
      const data = await settingsApi.get();
      if (!data || Object.keys(data).length === 0) {
        setSettingsError('No system settings found. Please run the setup script.');
      } else {
        setSystemSettings(data); 
      }
    }
    catch (err) { setSettingsError('Could not load settings: ' + err.message); }
  };

  const handleUpdateSettings = async (newSettings) => {
    setSavingSettings(true); setSettingsError('');
    try {
      await settingsApi.update(newSettings);
      showToast('Settings updated successfully.');
      loadSettings();
    } catch (err) { setSettingsError(err.message); }
    finally { setSavingSettings(false); }
  };

  useEffect(() => { if (!user) return; loadContracts(); loadVendors(); }, [user]);
  useEffect(() => {
    if (!user) return;
    if (activeNav === 'audit') loadAuditLog();
    if (activeNav === 'notifications') {
      loadNotifLog();
      loadSettings();
    }
    if (activeNav === 'vendors') loadVendors();
    if (activeNav === 'users') loadUsers();
  }, [activeNav, user]);

  const [confirmDelete, setConfirmDelete] = useState(null); // stores id if confirming

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await contractsApi.delete(confirmDelete);
      showToast('Contract deleted permanently.');
      loadContracts();
    } catch (err) { showToast('Delete failed: ' + err.message); }
    finally { setConfirmDelete(null); }
  };

  const [confirmUserDeactivate, setConfirmUserDeactivate] = useState(null);
  const handleDeactivateUser = async () => {
    if (!confirmUserDeactivate) return;
    try {
      await usersApi.deactivate(confirmUserDeactivate);
      showToast('User deactivated successfully.');
      loadUsers();
    } catch (err) { showToast('Deactivation failed: ' + err.message); }
    finally { setConfirmUserDeactivate(null); }
  };

  const handleLogout = () => {
    localStorage.removeItem('ccj_token');
    localStorage.removeItem('ccj_user');
    window.location.reload();
  };

  if (!user) return <LoginScreen onLogin={(u) => setUser(u)} />;

  const filteredContracts = contracts.filter(c => {
    const label = (c.status === 'Active' || c.status === 'Expiring Soon') ? 'In Progress' : c.status;
    const matchStatus = filterStatus === 'All' || label === filterStatus || c.status === filterStatus;
    const matchSearch = (c.vendor_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.po_number || '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  }).sort((a, b) => new Date(b.end_date) - new Date(a.end_date));

  const dbUser = users.find(u => u.id === user.id);
  const displayName = dbUser ? dbUser.full_name : user.full_name;

  return (
    <>
      {toastMsg && <div style={{ position: 'fixed', top: '20px', right: '20px', background: '#1f2937', color: 'white', padding: '12px 20px', borderRadius: '8px', fontSize: '13px', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>{toastMsg}</div>}

      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Delete Record"
        message="Are you sure you want to delete this contract? this action will be documented in the audit log and cannot be undone."
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <aside className="sidebar">
        <div className="sb-logo" onClick={() => setActiveNav('contracts')} style={{ cursor: 'pointer' }}>
          <div className="sb-logo-icon" style={{ background: 'white', borderRadius: '50%', padding: '2px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/logo.png" alt="ECOWAS Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div><div className="sb-logo-text">SLA Tracker</div><div className="sb-logo-sub">CCJ Admin</div></div>
        </div>
        <div className="sb-section-label">Management</div>
        <a className={`sb-item ${activeNav === 'contracts' ? 'active' : ''}`} onClick={() => setActiveNav('contracts')}>
          <span className="icon">📋</span> Contracts
          {stats.expiring_soon > 0 && <span className="sb-badge">{stats.expiring_soon}</span>}
        </a>
        <a className={`sb-item ${activeNav === 'vendors' ? 'active' : ''}`} onClick={() => setActiveNav('vendors')}><span className="icon">🏢</span> Vendors</a>
        {user.role === 'admin' && <a className={`sb-item ${activeNav === 'users' ? 'active' : ''}`} onClick={() => setActiveNav('users')}><span className="icon">👤</span> Officers</a>}
        <div className="sb-section-label">System</div>
        <a className={`sb-item ${activeNav === 'notifications' ? 'active' : ''}`} onClick={() => setActiveNav('notifications')}><span className="icon">🔔</span> Notifications</a>
        <a className={`sb-item ${activeNav === 'audit' ? 'active' : ''}`} onClick={() => setActiveNav('audit')}><span className="icon">📝</span> Audit Log</a>
        <div className="sb-bottom">
          <div className="sb-user">
            <div className="sb-avatar">{(displayName || 'U')[0].toUpperCase()}</div>
            <div>
              <div className="sb-user-name" style={{ wordBreak: 'break-word' }}>{displayName}</div>
              <div className="sb-user-role">{user.role === 'admin' ? 'Admin' : 'Officer'}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '12px', marginTop: '8px', width: '100%', textAlign: 'left', padding: '0 4px' }}>Sign out</button>
        </div>
      </aside>

      <ContractPanel isOpen={isPanelOpen} mode={panelMode} editData={editData} vendors={vendors} onClose={() => setIsPanelOpen(false)}
        onSave={() => { loadContracts(); showToast(panelMode === 'edit' ? 'Contract updated.' : 'Contract added.'); }} />

      <UserPanel isOpen={isUserPanelOpen} mode={userPanelMode} editData={userEditData} currentUser={user} onClose={() => setIsUserPanelOpen(false)}
        onSave={() => { loadUsers(); showToast(userPanelMode === 'edit' ? 'User profile updated.' : 'New user added.'); }} />

      <VendorEditPanel isOpen={isVendorPanelOpen} editData={vendorEditData} onClose={() => setIsVendorPanelOpen(false)}
        onSave={() => { loadVendors(); showToast('Vendor updated.'); }} />

      <div className="main-content">
        <div className="topbar">
          <div className="topbar-title">
            {activeNav === 'contracts' ? 'Contract Management' : activeNav === 'vendors' ? 'Vendors' : activeNav === 'users' ? 'Officers' : activeNav === 'notifications' ? 'Notifications' : 'Audit Log'}
          </div>
          <div className="topbar-right">
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            {activeNav === 'contracts' && <button className="btn btn-primary" onClick={() => { setPanelMode('add'); setEditData(null); setIsPanelOpen(true); }}>+ Add Contract</button>}
            {activeNav === 'users' && displayName === 'Ernest Amoakwa' && <button className="btn btn-primary" onClick={() => { setUserPanelMode('add'); setUserEditData(null); setIsUserPanelOpen(true); }}>+ Add Officer</button>}
          </div>
        </div>
        <div className="content">

          {activeNav === 'contracts' && (
            <div className="section active">
              <div className="stats-grid" style={{ marginTop: '14px' }}>
                <div className="stat-card c-blue"><div className="stat-label">Total Contracts</div><div className="stat-value">{stats.total}</div><div className="stat-sub">All records</div></div>
                <div className="stat-card c-green"><div className="stat-label">In Progress</div><div className="stat-value">{stats.active}</div><div className="stat-sub">Running</div></div>
                <div className="stat-card c-warn"><div className="stat-label">Expiring Soon</div><div className="stat-value">{stats.expiring_soon || 0}</div><div className="stat-sub">Within 90 days</div></div>
                <div className="stat-card c-red"><div className="stat-label">Expired</div><div className="stat-value">{stats.expired}</div><div className="stat-sub">Need renewal</div></div>
              </div>
              <div className="filter-bar">
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input className="search-input" placeholder="Search vendor, title or PO…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingRight: search ? '28px' : undefined }} />
                  {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '14px', lineHeight: 1, padding: '2px' }}>✕</button>}
                </div>
                {['All', 'In Progress', 'Expired', 'Completed'].map(f => (
                  <button key={f} className={`filter-btn ${filterStatus === f ? 'active' : ''}`} onClick={() => setFilterStatus(f)}>{f}</button>
                ))}
              </div>
              {loading ? <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Loading…</div> : (
                <div className="table-wrapper">
                  <table className="contract-table">
                    <thead><tr><th>PO/Contract ID</th><th>Vendor / Description</th><th>Value</th><th>End Date</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {filteredContracts.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: '700', color: 'var(--accent)', fontSize: '13px' }}>{c.vendor_external_id || '—————'}</td>
                          <td>
                            <div className={`cat-label ${c.category === 'Purchase' ? 'cat-purchase' : 'cat-contract'}`}>
                              {c.category === 'Purchase' ? '📦 Purchase' : '📄 Contract'}
                            </div>
                            <div className="vendor-name">{c.vendor_name || '—'}</div>
                            <div className="vendor-desc">{c.title}</div>
                          </td>
                          <td style={{ fontWeight: 500 }}>{c.contract_value !== null && c.contract_value !== undefined ? `${c.currency || 'NGN'} ${Number(c.contract_value).toLocaleString()}` : <strong style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: '700' }}>Subject to Contract</strong>}</td>
                          <td>{new Date(c.end_date).toLocaleDateString('en-GB')}</td>
                          <td><StatusPill status={c.status} /></td>
                          <td>
                            <div className="action-btns">
                              <button className="act-btn primary" onClick={() => { setEditData(c); setPanelMode('edit'); setIsPanelOpen(true); }}>Edit</button>
                              {(c.status === 'Expired' || c.status === 'Expiring Soon') && c.category === 'Contract' && (
                                <button className="act-btn primary" onClick={() => { setEditData(c); setPanelMode('renew'); setIsPanelOpen(true); }} style={{ color: 'var(--accent2)', borderColor: 'rgba(0,130,68,0.2)' }}>Renew</button>
                              )}
                              {user.role === 'admin' && <button className="act-btn danger" onClick={() => setConfirmDelete(c.id)}>Delete</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredContracts.length === 0 && <tr><td colSpan="6" className="empty-state">No contracts found.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeNav === 'vendors' && (
            <div className="section active">
              <div className="filter-bar" style={{ marginTop: '14px' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input className="search-input" placeholder="Search vendor name..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                {['All', 'IT Contracts', 'General Services', 'Miscellaneous', 'Uncategorized'].map(f => (
                  <button key={f} className={`filter-btn ${filterVendorCategory === f ? 'active' : ''}`} onClick={() => setFilterVendorCategory(f)}>{f}</button>
                ))}
              </div>
              <div className="table-wrapper">
                <table className="contract-table">
                  <thead><tr><th>DB ID</th><th>Ref ID</th><th>Vendor Name</th><th>Category</th><th>Email</th><th>Contracts</th><th>Actions</th></tr></thead>
                  <tbody>
                    {vendors
                      .filter(v => {
                        if (filterVendorCategory === 'All') return true;
                        if (filterVendorCategory === 'Uncategorized') return !v.category || v.category === '';
                        return v.category === filterVendorCategory;
                      })
                      .filter(v => v.name.toLowerCase().includes(search.toLowerCase()))
                      .map(v => (
                      <tr key={v.id}>
                        <td style={{ color: 'var(--muted)', fontSize: '11px' }}>{v.id}</td>
                        <td style={{ fontWeight: '600', color: 'var(--accent)' }}>{v.external_id || '—————'}</td>
                        <td><div className="vendor-name">{v.name}</div></td>
                        <td>
                          <span style={{ 
                            fontSize: '10px', 
                            fontWeight: '700', 
                            textTransform: 'uppercase', 
                            padding: '2px 8px', 
                            borderRadius: '4px',
                            background: v.category === 'IT Contracts' ? 'rgba(59, 130, 246, 0.1)' : v.category === 'General Services' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                            color: v.category === 'IT Contracts' ? '#3b82f6' : v.category === 'General Services' ? '#10b981' : '#6b7280'
                          }}>
                            {v.category || 'Uncategorized'}
                          </span>
                        </td>
                        <td>{v.contact_email || '—'}</td>
                        <td>
                          <span style={{
                            background: v.contract_count > 0 ? 'rgba(0,130,68,0.1)' : 'rgba(107,114,128,0.1)',
                            color: v.contract_count > 0 ? '#008244' : '#6b7280',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {v.contract_count === 0 || v.contract_count === '0' ? 'No contracts' :
                              v.contract_count === 1 || v.contract_count === '1' ? '1 contract' :
                                `${v.contract_count} contracts`}
                          </span>
                        </td>
                        <td>
                          <button className="act-btn primary" onClick={() => { setVendorEditData(v); setIsVendorPanelOpen(true); }}>Edit</button>
                        </td>
                      </tr>
                    ))}
                    {vendors.length === 0 && <tr><td colSpan="7" className="empty-state">No vendors found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeNav === 'users' && (
            <div className="section active">
              <ConfirmModal
                isOpen={!!confirmUserDeactivate}
                title="Deactivate Officer Profile"
                message="Are you sure you want to suspend this officer? They will no longer be able to log in, but their past audit logs remain."
                danger
                onConfirm={handleDeactivateUser}
                onCancel={() => setConfirmUserDeactivate(null)}
              />
              <div className="table-wrapper">
                <table className="contract-table">
                  <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td style={{ color: 'var(--muted)', fontSize: '11px' }}>{u.id}</td>
                        <td><div className="vendor-name">{u.full_name}</div></td>
                        <td>{u.email}</td>
                        <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
                        <td><span style={{ background: u.is_active ? '#f0fdf4' : '#fef2f2', color: u.is_active ? '#16a34a' : '#dc2626', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                        <td>
                          <div className="action-btns">
                            {/* Superadmin manages Everyone, regular Admin manages only regular Officers */}
                            {(user.email === 'eamoakwa@courtecowas.org' || u.role === 'officer') && (
                              <button className="act-btn primary" onClick={() => { setUserEditData(u); setUserPanelMode('edit'); setIsUserPanelOpen(true); }}>Edit</button>
                            )}
                            {/* Prevent self-suspension and ensure only Superadmin can suspend other Admins */}
                            {(u.email !== user.email) && (user.email === 'eamoakwa@courtecowas.org' || u.role === 'officer') && (
                              <button className="act-btn danger" onClick={() => setConfirmUserDeactivate(u.id)}>Suspend</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && <tr><td colSpan="6" className="empty-state">No officers found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeNav === 'notifications' && (
            <div className="section active">
              <div className="section-header"><div className="section-title">Notification Configuration</div></div>
              
              <div className="notif-card" style={{ marginBottom: '32px' }}>
                {settingsError ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--danger)' }}>
                    <div>⚠️ {settingsError}</div>
                    <button className="btn btn-ghost" style={{ marginTop: '10px', fontSize: '11px' }} onClick={loadSettings}>Try Again</button>
                  </div>
                ) : systemSettings ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                    <div>
                      <h4 style={{ fontSize: '12px', color: 'var(--accent)', marginBottom: '16px', letterSpacing: '0.05em' }}>🔔 ALERT RULES</h4>
                      <div className="form-group">
                        <label className="form-label">Notification Recipients (Comma separated)</label>
                        <input className="form-input" value={systemSettings.notify_emails} onChange={e => setSystemSettings({...systemSettings, notify_emails: e.target.value})} placeholder="admin@ccj.org, contracts@ccj.org" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Alert Milestones (Days before expiry)</label>
                        <input className="form-input" value={systemSettings.alert_milestones} onChange={e => setSystemSettings({...systemSettings, alert_milestones: e.target.value})} placeholder="90, 60, 30, 15, 7, 1" />
                        <small style={{ color: 'var(--muted)', fontSize: '10px' }}>Final 2 days always trigger urgent daily alerts.</small>
                      </div>
                      <div className="notif-row">
                        <div className="notif-label">Enable Automated Notifications</div>
                        <div className={`toggle ${systemSettings.enable_notifications === 'true' ? '' : 'off'}`} 
                             onClick={() => setSystemSettings({...systemSettings, enable_notifications: systemSettings.enable_notifications === 'true' ? 'false' : 'true'})}></div>
                      </div>
                    </div>
                    <div>
                      <h4 style={{ fontSize: '12px', color: 'var(--accent)', marginBottom: '16px', letterSpacing: '0.05em' }}>✉️ SMTP SETTINGS</h4>
                      <div className="form-row">
                        <div className="form-group"><label className="form-label">SMTP Host</label><input className="form-input" value={systemSettings.smtp_host} onChange={e => setSystemSettings({...systemSettings, smtp_host: e.target.value})} /></div>
                        <div className="form-group"><label className="form-label">Port</label><input className="form-input" value={systemSettings.smtp_port} onChange={e => setSystemSettings({...systemSettings, smtp_port: e.target.value})} /></div>
                      </div>
                      <div className="form-group"><label className="form-label">SMTP User / Email</label><input className="form-input" value={systemSettings.smtp_user} onChange={e => setSystemSettings({...systemSettings, smtp_user: e.target.value})} /></div>
                      <div className="form-group">
                        <label className="form-label">SMTP Password / App Secret</label>
                        <input className="form-input" type="password" value={systemSettings.smtp_pass} onChange={e => setSystemSettings({...systemSettings, smtp_pass: e.target.value})} placeholder="••••••••" />
                      </div>
                      <div className="form-group"><label className="form-label">Display "From" Name</label><input className="form-input" value={systemSettings.email_from} onChange={e => setSystemSettings({...systemSettings, email_from: e.target.value})} /></div>
                    </div>
                    <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {settingsError && <div style={{ color: 'var(--danger)', fontSize: '12px' }}>⚠️ {settingsError}</div>}
                      <button className="btn btn-primary" style={{ padding: '10px 24px', fontWeight: '700' }} onClick={() => handleUpdateSettings(systemSettings)} disabled={savingSettings}>
                        {savingSettings ? 'Updating System...' : 'Update System Configuration'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>Loading system settings...</div>
                )}
              </div>

              <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="section-title">Notification Log</div>
                <button className="btn btn-primary" style={{ fontSize: '12px', padding: '6px 14px' }} onClick={async () => {
                  try { await notificationsApi.triggerCheck(); showToast('Notification check triggered.'); loadNotifLog(); }
                  catch (err) { showToast('Error: ' + err.message); }
                }}>▶ Run Check Now</button>
              </div>
              <div className="table-wrapper">
                <table className="contract-table">
                  <thead><tr><th>Contract</th><th>Sent To</th><th>Days Remaining</th><th>Sent At</th></tr></thead>
                  <tbody>
                    {notifLog.map(n => (
                      <tr key={n.id}>
                        <td><div className="vendor-name">{n.contract_title || '—'}</div><div className="vendor-desc">{n.end_date ? new Date(n.end_date).toLocaleDateString('en-GB') : ''}</div></td>
                        <td>{n.sent_to}</td>
                        <td><span style={{ color: n.days_remaining <= 2 ? '#dc2626' : n.days_remaining <= 30 ? '#d97706' : '#374151', fontWeight: '600' }}>{n.days_remaining} days</span></td>
                        <td style={{ fontSize: '12px', color: 'var(--muted)' }}>{new Date(n.sent_at).toLocaleString('en-GB')}</td>
                      </tr>
                    ))}
                    {notifLog.length === 0 && <tr><td colSpan="4" className="empty-state">No notifications sent yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeNav === 'audit' && (
            <div className="section active">
              <div className="section-header"><div className="section-title">Audit Log</div></div>
              <div className="table-wrapper" style={{ padding: '4px 20px' }}>
                {auditLog.map(entry => (
                  <div className="audit-item" key={entry.id}>
                    <div className={`audit-dot ${entry.action === 'CREATE' ? 'green' : entry.action === 'DELETE' ? 'red' : 'blue'}`}></div>
                    <div>
                      <div className="audit-text"><b>{entry.performed_by || 'System'}</b> {entry.action === 'CREATE' ? 'added' : entry.action === 'UPDATE' ? 'updated' : 'deleted'} record in <span style={{ color: 'var(--accent)' }}>{entry.table_name}</span>{entry.record_id ? ` #${entry.record_id}` : ''}</div>
                      <div className="audit-time">{new Date(entry.performed_at).toLocaleString('en-GB')}</div>
                    </div>
                  </div>
                ))}
                {auditLog.length === 0 && <div className="empty-state" style={{ padding: '40px', textAlign: 'center' }}>No audit entries yet.</div>}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

export default App;
