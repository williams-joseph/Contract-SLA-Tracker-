import { useState, useMemo, useEffect } from 'react';
import './App.css';
import { contractsApi, vendorsApi } from './services/api';

const StatusPill = ({ status }) => {
  const getStatusClass = (s) => {
    if (s === 'In Progress' || s === 'Active') return 'sp-ip';
    if (s === 'Expired') return 'sp-ex';
    if (s === 'Completed') return 'sp-co';
    if (s === 'Expiring Soon') return 'sp-su';
    return '';
  };
  const label = status === 'Active' ? 'In Progress' : status;
  return (
    <span className={`status-pill ${getStatusClass(status)}`}>
      <span className="sdot"></span>{label}
    </span>
  );
};

const ContractModal = ({ contract, onClose }) => {
  if (!contract) return null;
  let progress = Math.min(100, Math.max(0, Number(contract.progress_percent) || 0));
  
  const getProgressColor = (p) => { if (p > 90) return 'fr'; if (p > 70) return 'fy'; return 'fg'; };
  const formatValue = (val, currency) => (val === null || val === undefined) 
    ? <strong style={{ color:'var(--muted)', fontWeight:'700' }}>Subject to Contract</strong>
    : `${currency || 'NGN'} ${Number(val).toLocaleString()}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{contract.vendor_name || 'Unknown Vendor'}</div>
            <div className="modal-sub">{contract.po_number ? `${contract.po_number} · ` : ''}{contract.title}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="detail-grid">
            <div><div className="dl">Vendor ID</div><div className="dv2" style={{ fontWeight:'700', color:'var(--accent)' }}>{contract.vendor_external_id || '—————'}</div></div>
            <div><div className="dl">Contract Value</div><div className="dv2">{formatValue(contract.contract_value, contract.currency)}</div></div>
            <div><div className="dl">Status</div><StatusPill status={contract.status} /></div>
            <div><div className="dl">Start Date</div><div className="dv2">{contract.start_date ? new Date(contract.start_date).toLocaleDateString('en-GB') : 'N/A'}</div></div>
            <div><div className="dl">End Date</div><div className="dv2">{new Date(contract.end_date).toLocaleDateString('en-GB')}</div></div>
            <div className="df"><div className="dl">Service Quality</div><div className="dv2">{contract.service_quality || 'N/A'}</div></div>
          </div>
          <div className="timeline-section">
            <div className="tl-label">Contract Progress</div>
            <div className="tl-bar">
              <div className={`tl-fill ${getProgressColor(progress)}`} style={{ width: `${progress}%` }}></div>
            </div>
            <div className="tl-meta">
              <span>{progress}% Elapsed</span>
              <span>{new Date(contract.end_date).toLocaleDateString('en-GB')}</span>
            </div>
          </div>
          {contract.days_remaining !== null && (
            <div style={{ marginTop: '12px', fontSize: '13px', color: contract.days_remaining <= 30 ? '#dc2626' : '#6b7280' }}>
              {contract.days_remaining > 0 ? `⏱ ${contract.days_remaining} day(s) remaining` : `⚠️ Expired ${Math.abs(contract.days_remaining)} day(s) ago`}
            </div>
          )}
          {contract.description && (
            <div style={{ marginTop:'16px', padding:'12px 14px', background:'var(--bg)', borderRadius:'8px', border:'1px solid var(--border)' }}>
              <div className="dl" style={{ marginBottom:'6px' }}>Transaction Description</div>
              <div style={{ fontSize:'13px', lineHeight:'1.6', color:'var(--text)' }}>{contract.description}</div>
            </div>
          )}
          {contract.pdf_url && (
            <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,130,68,0.05)', borderRadius: '10px', border: '1px solid rgba(0,130,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>📄</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--accent)' }}>Contract Document</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Official PDF Attachment</div>
                </div>
              </div>
              <a 
                href={`http://localhost:5000${contract.pdf_url}`} 
                target="_blank" 
                rel="noreferrer"
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '12px', textDecoration: 'none', borderRadius: '6px' }}
              >
                Open PDF
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function App() {
  const [contracts, setContracts] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, expiring_soon: 0, expired: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('contracts');
  const [filter, setFilter] = useState('In Progress');
  const [search, setSearch] = useState('');
  const [selectedContract, setSelectedContract] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [historyYear, setHistoryYear] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [filterVendorCategory, setFilterVendorCategory] = useState('All');

  const handleGoHome = () => {
    setActiveTab('contracts');
    setFilter('In Progress');
    setFilterVendorCategory('All');
    setSearch('');
    setVendorSearch('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [contractsData, statsData, vendorsData] = await Promise.all([
          contractsApi.getAll(),
          contractsApi.getStats(),
          vendorsApi.getAll()
        ]);
        setContracts(contractsData);
        setStats(statsData);
        setVendors(vendorsData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredContracts = useMemo(() => contracts.filter((c) => {
    const statusLabel = (c.status === 'Active' || c.status === 'Expiring Soon') ? 'In Progress' : c.status;
    const matchFilter = filter === 'All' || statusLabel === filter || c.status === filter;
    const matchSearch = (c.vendor_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.po_number || '').toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  }).sort((a, b) => new Date(b.end_date) - new Date(a.end_date)), [contracts, filter, search]);

  const historicalContracts = useMemo(() => {
    return contracts
      .filter((c) => c.status === 'Expired' || c.status === 'Completed')
      .filter((c) => historyYear === 'All' || new Date(c.end_date).getFullYear() === Number(historyYear))
      .filter((c) => 
        (c.vendor_name || '').toLowerCase().includes(historySearch.toLowerCase()) ||
        (c.title || '').toLowerCase().includes(historySearch.toLowerCase())
      )
      .sort((a, b) => new Date(b.end_date) - new Date(a.end_date));
  }, [contracts, historyYear, historySearch]);

  const historyYears = useMemo(() => {
    const years = contracts
      .filter(c => c.status === 'Expired' || c.status === 'Completed')
      .map(c => new Date(c.end_date).getFullYear())
      .filter(y => !isNaN(y));
    return ['All', ...new Set(years)].sort((a, b) => a === 'All' ? -1 : b - a);
  }, [contracts]);

  // Auto-select the latest year when data first loads
  useEffect(() => {
    if (historyYears.length > 1 && historyYear === '') {
      const latestYear = historyYears.find(y => y !== 'All');
      if (latestYear) setHistoryYear(String(latestYear));
    }
  }, [historyYears]);

  const filteredVendors = useMemo(() => vendors.filter(v => {
    const matchCategory = filterVendorCategory === 'All' || 
      (v.category === filterVendorCategory) || 
      (filterVendorCategory === 'Uncategorized' && (!v.category || v.category === ''));
    const matchSearch = v.name.toLowerCase().includes(vendorSearch.toLowerCase()) || 
      (v.external_id || '').toLowerCase().includes(vendorSearch.toLowerCase());
    return matchCategory && matchSearch;
  }), [vendors, vendorSearch, filterVendorCategory]);

  const getContractLabel = (count) => {
    if (count === 0 || count === '0') return 'No contracts at the moment';
    if (count === 1 || count === '1') return '1 contract ongoing';
    return `${count} contracts ongoing`;
  };

  return (
    <div className="app-container">
      <header>
        <div className="container">
          <div className="header-inner">
            <div className="logo" onClick={handleGoHome}>
              <div className="logo-badge" style={{ background:'white', borderRadius:'50%', padding:'4px', boxShadow:'0 2px 8px rgba(0,0,0,0.08)', width:'56px', height:'56px' }}>
                <img src="/logo.png" alt="ECOWAS Logo" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
              </div>
              <div>
                <div className="logo-text" style={{ fontSize:'18px' }}>Contract SLA Tracker</div>
                <div className="logo-sub">Community Court of Justice - Ecowas</div>
              </div>
            </div>
          </div>
          <div className="nav-tabs">
            <button className={`tab ${activeTab === 'contracts' ? 'active' : ''}`} onClick={() => setActiveTab('contracts')}>Active Tracking</button>
            <button className={`tab ${activeTab === 'vendors' ? 'active' : ''}`} onClick={() => setActiveTab('vendors')}>Vendors</button>
            <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>Historical Data</button>
          </div>
        </div>
      </header>

      <main className="container">
        {loading && <div style={{ textAlign:'center', padding:'60px', color:'#6b7280' }}>Loading contracts…</div>}
        {error && (
          <div style={{ textAlign:'center', padding:'40px', color:'#dc2626', background:'#fef2f2', borderRadius:'8px', margin:'20px 0' }}>
            ⚠️ Could not load contracts: {error}<br /><small>No connection to the server</small>
          </div>
        )}

        {!loading && !error && activeTab === 'contracts' && (
          <div className="section active">
            <div className="stats-grid">
              <div className="stat-card c-blue"><div className="stat-label">Total Volume</div><div className="stat-value">{stats.total}</div><div className="stat-sub">All Records</div></div>
              <div className="stat-card c-green"><div className="stat-label">In Progress</div><div className="stat-value">{stats.active}</div><div className="stat-sub">Ongoing services</div></div>
              <div className="stat-card c-amber"><div className="stat-label">Expiring Soon</div><div className="stat-value">{stats.expiring_soon}</div><div className="stat-sub">Within 90 days</div></div>
              <div className="stat-card c-red"><div className="stat-label">Expired</div><div className="stat-value">{stats.expired}</div><div className="stat-sub">Immediate action</div></div>
            </div>
            
            <div className="section-header"><div className="section-title">Contract Portfolio</div></div>
            

            <div className="filter-bar">
              <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                <input type="text" className="search-input" placeholder="Search vendor or service..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingRight: search ? '28px' : undefined }} />
                {search && <button onClick={() => setSearch('')} style={{ position:'absolute', right:'12px', background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:'16px', lineHeight:1, padding:'2px' }}>✕</button>}
              </div>
              {['All', 'In Progress', 'Expired', 'Completed'].map((f) => (
                <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
              ))}
            </div>
            <div className="table-wrapper">
              <table className="contract-table">
                <thead><tr><th>Vendor ID</th><th> Vendor Name </th><th>Value</th><th>End Date</th><th>Status</th></tr></thead>
                <tbody>
                  {filteredContracts.map((c) => (
                    <tr key={c.id} onClick={() => setSelectedContract(c)}>
                      <td style={{ fontWeight:'700', color:'var(--accent)', fontSize:'13px' }}>{c.vendor_external_id || '—————'}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' }}>
                          <span style={{ fontSize:'9px', fontWeight:'700', textTransform:'uppercase', color:c.category==='Purchase'?'#004c71':'#008244', background:c.category==='Purchase'?'rgba(0,76,113,0.1)':'rgba(0,130,68,0.1)', padding:'2px 5px', borderRadius:'3px' }}>
                            {c.category === 'Purchase' ? '📦 Purchase' : '📄 Contract'}
                          </span>
                        </div>
                        <div className="vendor-name">{c.vendor_name}</div>
                        <div className="vendor-desc">{c.title}</div>
                      </td>
                      <td style={{ fontWeight:500 }}>{c.contract_value !== null && c.contract_value !== undefined ? `${c.currency || 'NGN'} ${Number(c.contract_value).toLocaleString()}` : <span style={{fontSize:'13px', fontWeight:'700', color:'var(--muted)'}}>Subject to Contract</span>}</td>
                      <td>{new Date(c.end_date).toLocaleDateString('en-GB')}</td>
                      <td><StatusPill status={c.status} /></td>
                    </tr>
                  ))}
                  {filteredContracts.length === 0 && <tr><td colSpan="5" className="empty-state">No contracts found matching your criteria.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !error && activeTab === 'history' && (
          <div className="section active">
            <div className="section-header">
              <div className="section-title">Historical Data</div>
              <div style={{ fontSize:'13px', color:'var(--muted)', fontWeight:'500' }}>{historicalContracts.length} record{historicalContracts.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="filter-bar">
              <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                <input type="text" className="search-input" placeholder="Search vendor or transaction…" value={historySearch} onChange={e => setHistorySearch(e.target.value)} style={{ paddingRight: historySearch ? '28px' : undefined }} />
                {historySearch && <button onClick={() => setHistorySearch('')} style={{ position:'absolute', right:'8px', background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:'14px', lineHeight:1, padding:'2px' }}>✕</button>}
              </div>
              {historyYears.map(y => (
                <button key={y} className={`filter-btn ${historyYear === String(y) ? 'active' : ''}`} onClick={() => setHistoryYear(String(y))}>{y}</button>
              ))}
            </div>
            <div className="table-wrapper">
              <table className="contract-table">
                <thead><tr><th>Vendor ID</th><th>Vendor Name</th><th>Value</th><th>End Date</th><th>Status</th></tr></thead>
                <tbody>
                  {historicalContracts.map((c) => (
                    <tr key={c.id} onClick={() => setSelectedContract(c)}>
                      <td style={{ fontWeight:'700', color:'var(--accent)', fontSize:'13px' }}>{c.vendor_external_id || '—————'}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' }}>
                          <span style={{ fontSize:'9px', fontWeight:'700', textTransform:'uppercase', color:c.category==='Purchase'?'#004c71':'#008244', background:c.category==='Purchase'?'rgba(0,76,113,0.1)':'rgba(0,130,68,0.1)', padding:'2px 5px', borderRadius:'3px' }}>
                            {c.category === 'Purchase' ? '📦 Purchase' : '📄 Contract'}
                          </span>
                        </div>
                        <div className="vendor-name">{c.vendor_name}</div>
                        <div className="vendor-desc">{c.title}</div>
                      </td>
                      <td style={{ fontWeight:500 }}>{c.contract_value !== null && c.contract_value !== undefined ? `${c.currency || 'NGN'} ${Number(c.contract_value).toLocaleString()}` : <span style={{fontSize:'13px', fontWeight:'700', color:'var(--muted)'}}>Subject to Contract</span>}</td>
                      <td>{new Date(c.end_date).toLocaleDateString('en-GB')}</td>
                      <td><StatusPill status={c.status} /></td>
                    </tr>
                  ))}
                  {historicalContracts.length === 0 && <tr><td colSpan="5" className="empty-state">No historical records found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {!loading && !error && activeTab === 'vendors' && (
          <div className="section active">
            <div className="section-header"><div className="section-title">CCJ Vendors List</div></div>
            
            <div className="filter-bar">
              <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                <input type="text" className="search-input" placeholder="Search by name or Vendor ID..." value={vendorSearch} onChange={(e) => setVendorSearch(e.target.value)} style={{ paddingRight: vendorSearch ? '28px' : undefined }} />
                {vendorSearch && <button onClick={() => setVendorSearch('')} style={{ position:'absolute', right:'12px', background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:'16px', lineHeight:1, padding:'2px' }}>✕</button>}
              </div>
              {['All', 'IT Contracts', 'General Services', 'Miscellaneous', 'Uncategorized'].map((cat) => (
                <button 
                  key={cat} 
                  className={`filter-btn ${filterVendorCategory === cat ? 'active' : ''}`} 
                  onClick={() => setFilterVendorCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="table-wrapper">
              <table className="contract-table">
                <thead><tr><th>Vendor ID</th><th>Vendor Name</th><th>Commitment Status</th></tr></thead>
                <tbody>
                  {filteredVendors.map((v) => (
                    <tr key={v.id} style={{ cursor:'default' }}>
                      <td style={{ fontWeight:'700', color:'var(--accent)', width:'150px' }}>{v.external_id || '—'}</td>
                      <td style={{ fontWeight:'700', fontSize:'15px' }}>{v.name}</td>
                      <td>
                        <span style={{ 
                          background: v.contract_count > 0 ? 'rgba(0,130,68,0.1)' : 'rgba(107,114,128,0.1)',
                          color: v.contract_count > 0 ? '#008244' : '#6b7280',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {getContractLabel(v.contract_count)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredVendors.length === 0 && <tr><td colSpan="3" className="empty-state">No vendors found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {selectedContract && <ContractModal contract={selectedContract} onClose={() => setSelectedContract(null)} />}
    </div>
  );
}

export default App;
