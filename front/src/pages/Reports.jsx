// Reports.jsx (fixed table layout + service name resolution)
import { useEffect, useState, useMemo } from 'react';
import { Search, Calendar, Download, ChevronDown, ChevronRight } from 'lucide-react';

const BASE = 'https://maurya-electronics.vercel.app';
const ENDPOINTS = {
  complaints: `${BASE}/complaints`,
  technicians: `${BASE}/technicians`,
  services: `${BASE}/services`,
};

function normalizeId(item) {
  if (!item) return item;
  const id = item._id ? String(item._id) : item.id ? String(item.id) : null;
  return { ...item, id };
}

function formatCurrency(v) {
  if (v == null || v === '') return '-';
  const n = Number(v);
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
}

function formatDateIso(d) {
  if (!d) return '-';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '-';
    return dt.toLocaleString();
  } catch {
    return '-';
  }
}

export default function Reports() {
  const [technicians, setTechnicians] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [services, setServices] = useState([]);
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadingTechs, setLoadingTechs] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(''); // YYYY-MM-DD
  const [endDate, setEndDate] = useState('');
  const [minCharge, setMinCharge] = useState('');
  const [maxCharge, setMaxCharge] = useState('');

  const [expandedTechs, setExpandedTechs] = useState({});

  // initial load
  useEffect(() => {
    fetchServices();
    fetchTechnicians();
    fetchComplaints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // rebuild when reports or filters change
    applyClientFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, searchTerm, minCharge, maxCharge]);

  // fetch services for name lookup
  async function fetchServices() {
    setLoadingServices(true);
    try {
      const res = await fetch(ENDPOINTS.services);
      if (!res.ok) throw new Error(`Failed to fetch services (${res.status})`);
      const json = await res.json();
      const normalized = Array.isArray(json) ? json.map(normalizeId) : [];
      setServices(normalized);
    } catch (err) {
      console.error('fetchServices', err);
      // Non-blocking: continue without services (we'll fallback to job.service_name or id)
    } finally {
      setLoadingServices(false);
    }
  }

  async function fetchTechnicians() {
    setLoadingTechs(true);
    setError(null);
    try {
      const res = await fetch(ENDPOINTS.technicians);
      if (!res.ok) throw new Error(`Failed to fetch technicians (${res.status})`);
      const json = await res.json();
      const normalized = Array.isArray(json) ? json.map(normalizeId) : [];
      setTechnicians(normalized);
      buildReports(normalized, complaints);
    } catch (err) {
      console.error('fetchTechnicians', err);
      setError(err.message || 'Failed to fetch technicians');
    } finally {
      setLoadingTechs(false);
    }
  }

  async function fetchComplaints(opts = {}) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (opts.start) params.set('start', opts.start);
      if (opts.end) params.set('end', opts.end);
      const url = params.toString() ? `${ENDPOINTS.complaints}?${params.toString()}` : ENDPOINTS.complaints;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch complaints (${res.status})`);
      const json = await res.json();
      const normalized = Array.isArray(json) ? json.map((c) => c) : [];
      setComplaints(normalized);
      buildReports(technicians, normalized);
    } catch (err) {
      console.error('fetchComplaints', err);
      setError(err.message || 'Failed to fetch complaints');
      buildReports(technicians, complaints);
    } finally {
      setLoading(false);
    }
  }

  // Build summary reports per technician. Attach closed_jobs (with normalized fields)
  const buildReports = (techs = [], comps = []) => {
    const techList = Array.isArray(techs) ? techs : [];
    const compList = Array.isArray(comps) ? comps : [];

    const normalizedComplaints = compList.map((c) => {
      const techId =
        c?.technician_id ||
        (c?.technician && (c.technician._id || c.technician.id)) ||
        c?.technicianId ||
        c?.technician ||
        null;
      const charge =
        c?.technician_price_charged ??
        c?.technician_price ??
        c?.meta?.technician_price_charged ??
        c?.meta?.technician_price ??
        null;
      const completedAt = c?.closed_at || c?.closedAt || c?.completed_at || null;

      return {
        ...c,
        _techId: techId != null ? String(techId) : null,
        _charge: charge != null ? Number(charge) : null,
        _completedAt: completedAt,
      };
    });

    const reportsData = techList.map((tech) => {
      const techId = tech.id || (tech._id && String(tech._id));
      const techComplaints = normalizedComplaints.filter((c) => String(c._techId) === String(techId));

      const closedJobs = techComplaints
        .filter((c) => String((c.status || '').toLowerCase()) === 'closed')
        .sort((a, b) => {
          const ta = a._completedAt ? new Date(a._completedAt).getTime() : 0;
          const tb = b._completedAt ? new Date(b._completedAt).getTime() : 0;
          return tb - ta;
        });

      return {
        technician_id: techId,
        technician_name: tech.name || `${tech.firstName || ''} ${tech.lastName || ''}`.trim() || 'Unknown',
        total_complaints: techComplaints.length,
        open_complaints: techComplaints.filter((c) => (c.status || '').toLowerCase() === 'open').length,
        closed_complaints: closedJobs.length,
        cancelled_complaints: techComplaints.filter((c) => (c.status || '').toLowerCase() === 'cancelled').length,
        pending_parts: techComplaints.filter((c) => (c.status || '').toLowerCase() === 'pending_parts').length,
        closed_jobs: closedJobs,
      };
    });

    setReports(reportsData);
    setFilteredReports(reportsData.filter((r) => (r.technician_name || '').toLowerCase().includes(searchTerm.toLowerCase())));
  };

  const handleDateFilter = () => {
    if (startDate && endDate && startDate > endDate) {
      alert('Start date must be before or equal to end date.');
      return;
    }
    fetchComplaints({ start: startDate || undefined, end: endDate || undefined });
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
    fetchComplaints();
  };

  // client-side filters (name & charge)
  const applyClientFilters = () => {
    const min = minCharge ? Number(minCharge) : null;
    const max = maxCharge ? Number(maxCharge) : null;

    const filtered = reports
      .map((r) => {
        const jobs = Array.isArray(r.closed_jobs)
          ? r.closed_jobs.filter((j) => {
              const charge = j._charge;
              if (min != null && (charge == null || charge < min)) return false;
              if (max != null && (charge == null || charge > max)) return false;
              return true;
            })
          : [];
        return { ...r, closed_jobs_filtered: jobs, closed_count_filtered: jobs.length };
      })
      .filter((r) => (r.technician_name || '').toLowerCase().includes(searchTerm.toLowerCase()));

    setFilteredReports(filtered);
  };

  const toggleExpand = (techId) => {
    setExpandedTechs((prev) => ({ ...prev, [techId]: !prev[techId] }));
  };

  // Service name resolution: prefer job.service_name, then lookup services list by id, then job.meta
  const RgetServiceName = (job) => {
    if (!job) return '-';
    if (job.service_name) return job.service_name;
    if (job.service && typeof job.service === 'string') {
      // job.service might be id
      const svc = services.find((s) => String(s.id) === String(job.service) || String(s._id) === String(job.service));
      if (svc) return svc.name || svc.title || String(job.service);
      // maybe service_id
      const svc2 = services.find((s) => String(s.id) === String(job.service_id) || String(s._id) === String(job.service_id));
      if (svc2) return svc2.name || svc2.title || String(job.service_id);
      return String(job.service);
    }
    if (job.service_id) {
      const svc = services.find((s) => String(s.id) === String(job.service_id) || String(s._id) === String(job.service_id));
      if (svc) return svc.name || svc.title || String(job.service_id);
      return String(job.service_id);
    }
    if (job.meta && (job.meta.service_name || job.meta.service)) return job.meta.service_name || job.meta.service;
    return '-';
  };

  // CSV export (uses filteredReports and filtered closed jobs)
  const exportCSV = () => {
    const rows = [];
    filteredReports.forEach((r) => {
      const jobs = (r.closed_jobs_filtered || r.closed_jobs || []);
      jobs.forEach((j) => {
        const charge = j._charge != null ? j._charge : (j.technician_price_charged ?? j.technician_price ?? j.meta?.technician_price_charged ?? '');
        rows.push({
          technician_id: r.technician_id,
          technician_name: r.technician_name,
          complaint_no: j.complaint_no || j.id || j._id || '',
          customer_name: j.customer_name || j.customer || j.meta?.customer_name || '',
          completed_at: j._completedAt || j.closed_at || j.closedAt || '',
          charged_amount: charge,
          service: getServiceName(j),
          remarks: j.remarks || j.meta?.remarks || '',
        });
      });
    });

    const headers = ['Technician ID', 'Technician Name', 'Complaint No', 'Customer', 'Completed At', 'Charged Amount', 'Service', 'Remarks'];
    let csv = headers.join(',') + '\n';
    rows.forEach((r) => {
      const row = [
        r.technician_id || '',
        r.technician_name || '',
        r.complaint_no || '',
        r.customer_name || '',
        r.completed_at ? new Date(r.completed_at).toLocaleString() : '',
        r.charged_amount != null ? Number(r.charged_amount).toFixed(2) : '',
        r.service || '',
        (r.remarks || '').replace(/\n/g, ' '),
      ];
      csv += row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filenameParts = ['technician_reports', startDate || 'all', endDate || 'all'];
    a.download = `${filenameParts.join('-')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // totals calc
  const totals = useMemo(() => {
    return filteredReports.reduce(
      (acc, r) => {
        acc.total += r.total_complaints || 0;
        acc.open += r.open_complaints || 0;
        acc.closed += (r.closed_jobs_filtered ? r.closed_jobs_filtered.length : (r.closed_complaints || 0));
        acc.cancelled += r.cancelled_complaints || 0;
        acc.pending += r.pending_parts || 0;
        return acc;
      },
      { total: 0, open: 0, closed: 0, cancelled: 0, pending: 0 }
    );
  }, [filteredReports]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Technician Reports</h1>
        <p className="text-gray-600 mt-2">Track completed jobs and charges per technician</p>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by technician name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <input
              type="number"
              step="0.01"
              min="0"
              value={minCharge}
              onChange={(e) => setMinCharge(e.target.value)}
              placeholder="Min charge"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <input
              type="number"
              step="0.01"
              min="0"
              value={maxCharge}
              onChange={(e) => setMaxCharge(e.target.value)}
              placeholder="Max charge"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-4 items-center">
          <button onClick={handleDateFilter} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium" disabled={loading}>
            Apply Filter
          </button>
          <button onClick={clearDateFilter} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors font-medium" disabled={loading}>
            Clear Date Filter
          </button>

          <div className="ml-auto flex items-center gap-3">
            <button onClick={exportCSV} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
              <Download size={16} />
              Export CSV
            </button>

            <div className="text-sm text-gray-500">
              {loadingTechs ? 'Loading technicians...' : `${technicians.length} technicians`} · {loading ? 'Loading complaints...' : `${complaints.length} complaints`} {loadingServices ? '· Loading services...' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md overflow-auto">
        <table className="min-w-full divide-y divide-gray-200 table-auto">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 w-12"></th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Technician</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Total</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Open</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Closed (filtered)</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Cancelled</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Pending Parts</th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {filteredReports.map((report) => (
              <>
                <tr key={report.technician_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 align-middle">
                    <button onClick={() => toggleExpand(report.technician_id)} className="p-1 rounded hover:bg-gray-100">
                      {expandedTechs[report.technician_id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </td>
                  <td className="px-6 py-4 align-middle text-sm font-medium text-gray-900">{report.technician_name}</td>
                  <td className="px-6 py-4 align-middle text-sm text-gray-600">{report.total_complaints}</td>
                  <td className="px-6 py-4 align-middle text-sm text-gray-600">{report.open_complaints}</td>
                  <td className="px-6 py-4 align-middle text-sm text-gray-600">
                    {report.closed_jobs_filtered ? report.closed_jobs_filtered.length : report.closed_complaints}
                  </td>
                  <td className="px-6 py-4 align-middle text-sm text-gray-600">{report.cancelled_complaints}</td>
                  <td className="px-6 py-4 align-middle text-sm text-gray-600">{report.pending_parts}</td>
                </tr>

                {expandedTechs[report.technician_id] && (
                  <tr>
                    <td colSpan={7} className="bg-gray-50 px-6 py-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-800 mb-2">
                          Completed jobs for {report.technician_name}
                        </h3>

                        <div className="overflow-auto">
                          <table className="min-w-full text-sm table-auto">
                            <thead>
                              <tr className="text-left text-xs text-gray-600 border-b">
                                <th className="py-2 px-2">Complaint No</th>
                                <th className="py-2 px-2">Customer</th>
                                <th className="py-2 px-2">Service</th>
                                <th className="py-2 px-2">Completed At</th>
                                <th className="py-2 px-2">Charged</th>
                                <th className="py-2 px-2">Remarks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(report.closed_jobs_filtered ?? []).map((job) => {
                                const charge =
                                  job._charge != null
                                    ? job._charge
                                    : job.technician_price_charged ??
                                      job.technician_price ??
                                      job.meta?.technician_price_charged ??
                                      '';
                                return (
                                  <tr key={job._id || job.id || job.complaint_no} className="border-b last:border-b-0">
                                    <td className="py-3 px-2 whitespace-nowrap">{job.complaint_no || job.id || '-'}</td>
                                    <td className="py-3 px-2">{job.customer_name || job.customer || '-'}</td>
                                    <td className="py-3 px-2">{getServiceName(job)}</td>
                                    <td className="py-3 px-2 whitespace-nowrap">{formatDateIso(job._completedAt)}</td>
                                    <td className="py-3 px-2 whitespace-nowrap">
                                      {charge != null ? formatCurrency(charge) : '-'}
                                    </td>
                                    <td className="py-3 px-2">
                                      {(job.remarks || job.meta?.remarks || '').slice(0, 120)}
                                    </td>
                                  </tr>
                                );
                              })}

                              {(!report.closed_jobs_filtered || report.closed_jobs_filtered.length === 0) && (
                                <tr>
                                  <td colSpan={6} className="py-4 text-center text-gray-500">
                                    No completed jobs (matching filters)
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {filteredReports.length === 0 && (
          <div className="text-center py-12 text-gray-500">No reports found</div>
        )}
      </div>

      {/* Summary Section */}
      <div className="mt-8 bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Summary Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600 font-medium">Total Complaints</p>
            <p className="text-3xl font-bold text-blue-900 mt-2">{totals.total}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-sm text-yellow-600 font-medium">Open</p>
            <p className="text-3xl font-bold text-yellow-900 mt-2">{totals.open}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600 font-medium">Closed (filtered)</p>
            <p className="text-3xl font-bold text-green-900 mt-2">{totals.closed}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-red-600 font-medium">Cancelled</p>
            <p className="text-3xl font-bold text-red-900 mt-2">{totals.cancelled}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-orange-600 font-medium">Pending Parts</p>
            <p className="text-3xl font-bold text-orange-900 mt-2">{totals.pending}</p>
          </div>
        </div>
      </div>

      {error && <div className="mt-4 text-sm text-red-600">Error: {error}</div>}
    </div>
  );


  // totals computed here to avoid forward ref issues
  function Rtotals() {
    return filteredReports.reduce(
      (acc, r) => {
        acc.total += r.total_complaints || 0;
        acc.open += r.open_complaints || 0;
        acc.closed += (r.closed_jobs_filtered ? r.closed_jobs_filtered.length : (r.closed_complaints || 0));
        acc.cancelled += r.cancelled_complaints || 0;
        acc.pending += r.pending_parts || 0;
        return acc;
      },
      { total: 0, open: 0, closed: 0, cancelled: 0, pending: 0 }
    );
  }

  // local helper used above in JSX
  function getServiceName(job) {
    if (!job) return '-';
    if (job.service_name) return job.service_name;
    if (job.service && typeof job.service === 'string') {
      const svc = services.find((s) => String(s.id) === String(job.service) || String(s._id) === String(job.service));
      if (svc) return svc.name || svc.title || String(job.service);
      const svc2 = services.find((s) => String(s.id) === String(job.service_id) || String(s._id) === String(job.service_id));
      if (svc2) return svc2.name || svc2.title || String(job.service_id);
      return String(job.service);
    }
    if (job.service_id) {
      const svc = services.find((s) => String(s.id) === String(job.service_id) || String(s._id) === String(job.service_id));
      if (svc) return svc.name || svc.title || String(job.service_id);
      return String(job.service_id);
    }
    if (job.meta && (job.meta.service_name || job.meta.service)) return job.meta.service_name || job.meta.service;
    return '-';
  }
}
