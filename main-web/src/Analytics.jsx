import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const AnalyticsTab = ({ contracts, isActive }) => {
  const currentYear = new Date().getFullYear();
  const [filterYear, setFilterYear] = React.useState(String(currentYear));

  const availableYears = useMemo(() => {
    const years = [...new Set(contracts.map(c => new Date(c.start_date || c.end_date).getFullYear()).filter(y => !isNaN(y)))];
    [currentYear, 2025].forEach(y => {
      if (!years.includes(y)) years.push(y);
    });
    return years.sort((a, b) => b - a);
  }, [contracts, currentYear]);

  const data = useMemo(() => {
    const yearFilteredContracts = filterYear === 'All' 
      ? contracts 
      : contracts.filter(c => new Date(c.start_date || c.end_date).getFullYear() === Number(filterYear));

    let totalValue = 0;
    let activeValue = 0;
    let pastValue = 0;
    let valueByCategory = {};
    let contractsByMonth = {};
    let totalDuration = 0;
    let durationCount = 0;

    const highestContracts = [...yearFilteredContracts]
      .filter(c => c.contract_value)
      .sort((a, b) => Number(b.contract_value) - Number(a.contract_value))
      .slice(0, 5);

    yearFilteredContracts.forEach(c => {
      const val = Number(c.contract_value) || 0;
      totalValue += val;

      if (c.status === 'Active' || c.status === 'In Progress' || c.status === 'Expiring Soon') {
        activeValue += val;
      } else if (c.status === 'Completed' || c.status === 'Expired') {
        pastValue += val;
      }

      const cat = c.category || 'Uncategorized';
      valueByCategory[cat] = (valueByCategory[cat] || 0) + val;

      if (c.start_date) {
        const d = new Date(c.start_date);
        const monthYear = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!contractsByMonth[monthYear]) {
          contractsByMonth[monthYear] = { month: monthYear, count: 0, value: 0 };
        }
        contractsByMonth[monthYear].count += 1;
        contractsByMonth[monthYear].value += val;
      }

      if (c.start_date && c.end_date) {
        const start = new Date(c.start_date);
        const end = new Date(c.end_date);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        totalDuration += diffDays;
        durationCount += 1;
      }
    });

    const categoryData = Object.keys(valueByCategory).map(key => ({
      name: key,
      value: valueByCategory[key]
    })).filter(item => item.value > 0);

    const timelineData = Object.values(contractsByMonth).sort((a, b) => a.month.localeCompare(b.month));

    const averageValue = yearFilteredContracts.length > 0 ? totalValue / yearFilteredContracts.length : 0;
    const averageDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;

    return {
      totalValue,
      activeValue,
      pastValue,
      averageValue,
      highestContracts,
      categoryData,
      timelineData,
      averageDuration
    };
  }, [contracts, filterYear]);

  const formatCurrency = (val) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(val);

  if (!isActive) return null;

  return (
    <div className="section active">
      <div className="section-header" style={{ marginBottom: '24px' }}>
        <div className="section-title">Contract Analytics</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Filter by Year:</span>
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', outline: 'none', background: 'var(--surface)' }}>
            <option value="All">All Years</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: '24px', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card c-blue">
          <div className="stat-label">Total Value</div>
          <div className="stat-value">{formatCurrency(data.totalValue)}</div>
          <div className="stat-sub">All Contracts</div>
        </div>
        <div className="stat-card c-green">
          <div className="stat-label">Active Value</div>
          <div className="stat-value">{formatCurrency(data.activeValue)}</div>
          <div className="stat-sub">Ongoing</div>
        </div>
        <div className="stat-card c-yellow">
          <div className="stat-label">Average Value</div>
          <div className="stat-value">{formatCurrency(data.averageValue)}</div>
          <div className="stat-sub">Per Contract</div>
        </div>
        <div className="stat-card c-red">
          <div className="stat-label">Avg Duration</div>
          <div className="stat-value">{data.averageDuration} days</div>
          <div className="stat-sub">Per Contract</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Value by Category</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.categoryData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} outerRadius={100} fill="#8884d8" dataKey="value">
                  {data.categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ background: 'var(--bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Contracts Timeline</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.timelineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{fontSize: 12}} />
                <YAxis yAxisId="left" tick={{fontSize: 12}} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12}} tickFormatter={(val) => `₦${(val/1000000).toFixed(1)}M`} />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="count" stroke="#8884d8" name="Contracts Created" />
                <Line yAxisId="right" type="monotone" dataKey="value" stroke="#82ca9d" name="Total Value" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Top 5 Highest-Value Contracts</h3>
        <div className="table-wrapper">
          <table className="contract-table">
            <thead>
              <tr><th style={{textAlign: 'left'}}>Vendor</th><th style={{textAlign: 'left'}}>Contract Title</th><th style={{textAlign: 'left'}}>Status</th><th style={{textAlign: 'left'}}>Value</th></tr>
            </thead>
            <tbody>
              {data.highestContracts.map((c, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: '600', textAlign: 'left' }}>{c.vendor_name}</td>
                  <td style={{textAlign: 'left'}}>{c.title}</td>
                  <td style={{textAlign: 'left'}}>{c.status}</td>
                  <td style={{ fontWeight: '600', color: 'var(--accent)', textAlign: 'left' }}>{formatCurrency(c.contract_value)}</td>
                </tr>
              ))}
              {data.highestContracts.length === 0 && <tr><td colSpan="4">No data available</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsTab;
