// Dashboard.jsx (fixed: robust date handling + statsMode applied to technician open requests + daily chart)
import { useEffect, useState } from 'react';
import { FileText, Users, Wrench, Clock, CheckCircle, XCircle, Package } from 'lucide-react';

const BASE = 'https://mauryaelectronics.onrender.com/api';
const ENDPOINTS = {
  complaints: `${BASE}/complaints`,
  employees: `${BASE}/employees`,
  technicians: `${BASE}/technicians`,
};

function normalizeId(item) {
  if (!item) return item;
  const id = item._id ? String(item._id) : item.id ? String(item.id) : null;
  return { ...item, id };
}

// Return date-only (YYYY-MM-DD) in Asia/Kolkata for any complaint object or ISO string
function safeDateOnlyKolkataFromAny(objOrIso) {
  if (!objOrIso) return '';
  // objOrIso could be a complaint object or a date string
  let dVal = null;
  if (typeof objOrIso === 'string' || objOrIso instanceof String) {
    dVal = objOrIso;
  } else if (typeof objOrIso === 'object') {
    // check typical fields
    dVal = objOrIso.created_at ?? objOrIso.createdAt ?? objOrIso.opened_at ?? objOrIso.openedAt ?? objOrIso.updatedAt ?? null;
  }
  if (!dVal) return '';
  try {
    return new Date(dVal).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  } catch {
    return '';
  }
}

function formatDateIsoLocal(d) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleString();
  } catch {
    return '-';
  }
}

export default function Dashboard({
  complaints: complaintsProp = [],
  employees: employeesProp = [],
  technicians: techniciansProp = [],
}) 
{
  const [statsMode, setStatsMode] = useState('all'); // 'all' | 'today'
  const [statsAll, setStatsAll] = useState({
    open: 0,
    closed: 0,
    cancelled: 0,
    pending_parts: 0,
    total_employees: 0,
    total_technicians: 0,
  });
  const [statsToday, setStatsToday] = useState({
    open: 0,
    closed: 0,
    cancelled: 0,
    pending_parts: 0,
    total_employees: 0,
    total_technicians: 0,
  });

  const [technicianStats, setTechnicianStats] = useState([]); // used for display (depends on statsMode)
  const [dailyStats, setDailyStats] = useState([]); // last 7 days counts (always by calendar day IST)

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // seedable local copies
  const [complaints, setComplaints] = useState(Array.isArray(complaintsProp) ? complaintsProp.map(normalizeId) : []);
  const [employees, setEmployees] = useState(Array.isArray(employeesProp) ? employeesProp.map(normalizeId) : []);
  const [technicians, setTechnicians] = useState(Array.isArray(techniciansProp) ? techniciansProp.map(normalizeId) : []);
  const [previewStatusFilter, setPreviewStatusFilter] = useState('all');


  useEffect(() => {
    // seed from props if present
    if (Array.isArray(complaintsProp) && complaintsProp.length > 0) setComplaints(complaintsProp.map(normalizeId));
    if (Array.isArray(employeesProp) && employeesProp.length > 0) setEmployees(employeesProp.map(normalizeId));
    if (Array.isArray(techniciansProp) && techniciansProp.length > 0) setTechnicians(techniciansProp.map(normalizeId));

    // fetch live data
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // recompute stats when data or mode changes
  useEffect(() => {
    computeStatsFromData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complaints, employees, technicians, statsMode]);

  // helper: get complaint creation date value (best-effort)
  function complaintCreatedDateVal(c) {
    if (!c) return null;
    return c.created_at ?? c.createdAt ?? c.opened_at ?? c.openedAt ?? c.insertedAt ?? c.created ?? null;
  }

  // return YYYY-MM-DD IST label for last 7 days (array length 7)
  function last7DaysISOList() {
    // produce array from 6 days ago -> today
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      // get YYYY-MM-DD in IST
      arr.push(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
    }
    return arr;
  }

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      const [cRes, eRes, tRes] = await Promise.all([fetch(ENDPOINTS.complaints), fetch(ENDPOINTS.employees), fetch(ENDPOINTS.technicians)]);
      if (!cRes.ok) throw new Error(`Failed to fetch complaints (${cRes.status})`);
      if (!eRes.ok) throw new Error(`Failed to fetch employees (${eRes.status})`);
      if (!tRes.ok) throw new Error(`Failed to fetch technicians (${tRes.status})`);

      const [cJson, eJson, tJson] = await Promise.all([cRes.json(), eRes.json(), tRes.json()]);

      const normalizedComplaints = (Array.isArray(cJson) ? cJson : []).map((c) => {
        const nc = normalizeId(c);
        // normalize stored technician reference
        nc.technician_id = nc.technician_id ?? nc.technician ?? (nc.technician && (nc.technician._id || nc.technician.id)) ?? null;
        return nc;
      });
      const normalizedEmployees = (Array.isArray(eJson) ? eJson : []).map(normalizeId);
      const normalizedTechnicians = (Array.isArray(tJson) ? tJson : []).map((t) => {
        const nt = normalizeId(t);
        nt.is_active = typeof nt.is_active === 'boolean' ? nt.is_active : nt.active ?? true;
        return nt;
      });

      setComplaints(normalizedComplaints);
      setEmployees(normalizedEmployees);
      setTechnicians(normalizedTechnicians);
    } catch (err) {
      console.error('Dashboard fetchAll error', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function computeStatsFromData() {
    const cs = Array.isArray(complaints) ? complaints : [];
    const es = Array.isArray(employees) ? employees : [];
    const ts = Array.isArray(technicians) ? technicians : [];

    // --- ALL-TIME ---
    const allCounts = {
      open: cs.filter((c) => (c?.status || '').toLowerCase() === 'open').length,
      closed: cs.filter((c) => (c?.status || '').toLowerCase() === 'closed').length,
      cancelled: cs.filter((c) => (c?.status || '').toLowerCase() === 'cancelled').length,
      pending_parts: cs.filter((c) => (c?.status || '').toLowerCase() === 'pending_parts').length,
      total_employees: es.length,
      total_technicians: ts.length,
    };

    // --- TODAY (IST) ---
    const todayISO = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const todayCounts = {
      open: cs.filter((c) => safeDateOnlyKolkataFromAny(complaintCreatedDateVal(c)) === todayISO && (c?.status || '').toLowerCase() === 'open').length,
      closed: cs.filter((c) => safeDateOnlyKolkataFromAny(complaintCreatedDateVal(c)) === todayISO && (c?.status || '').toLowerCase() === 'closed').length,
      cancelled: cs.filter((c) => safeDateOnlyKolkataFromAny(complaintCreatedDateVal(c)) === todayISO && (c?.status || '').toLowerCase() === 'cancelled').length,
      pending_parts: cs.filter((c) => safeDateOnlyKolkataFromAny(complaintCreatedDateVal(c)) === todayISO && (c?.status || '').toLowerCase() === 'pending_parts').length,
      total_employees: es.length,
      total_technicians: ts.length,
    };

    setStatsAll(allCounts);
    setStatsToday(todayCounts);

    // --- Technician Open Requests (mode-aware) ---
    // If statsMode === 'today' we only count complaints created today (IST) with status 'open'
    const techStats = ts.map((tech) => {
      const techId = tech.id || tech._id;
      const open_requests = cs.filter((c) => {
        const cTech = String(c?.technician_id ?? c?.technician ?? '') === String(techId);
        if (!cTech) return false;
        const isOpen = (c?.status || '').toLowerCase() === 'open';
        if (!isOpen) return false;
        if (statsMode === 'today') {
          return safeDateOnlyKolkataFromAny(complaintCreatedDateVal(c)) === todayISO;
        }
        return true; // all-time
      }).length;
      return { technician_name: tech.name || 'Unknown', open_requests };
    });
    setTechnicianStats(techStats.filter((t) => t.open_requests > 0));

    // --- Daily last 7 days (IST) ---
    const last7 = last7DaysISOList(); // array of YYYY-MM-DD strings in IST for last 7 days
    const daily = last7.map((isoDate) => {
      const count = cs.filter((c) => {
        const createdISO = safeDateOnlyKolkataFromAny(complaintCreatedDateVal(c));
        return createdISO === isoDate;
      }).length;
      return { date: (() => {
        // readable short label: "Mon 4 Aug" or "Aug 4"
        try {
          const d = new Date(isoDate + 'T00:00:00');
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch {
          return isoDate;
        }
      })(), count };
    });
    setDailyStats(daily);
  }
  const statusKeys = ['open', 'closed', 'cancelled', 'pending_parts'];

  // UI helpers
  const statCardsConfig = [
    { key: 'open', label: 'Open Complaints', icon: Clock, color: 'bg-blue-500' },
    { key: 'closed', label: 'Closed', icon: CheckCircle, color: 'bg-green-500' },
    { key: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'bg-red-500' },
    { key: 'pending_parts', label: 'Pending Parts', icon: Package, color: 'bg-yellow-500' },
    { key: 'total_employees', label: 'Total Employees', icon: Users, color: 'bg-purple-500' },
    { key: 'total_technicians', label: 'Total Technicians', icon: Wrench, color: 'bg-teal-500' },
  ];

  const displayedStats = statsMode === 'today' ? statsToday : statsAll;
  const maxDaily = Math.max(...(dailyStats.map((d) => d.count) || []), 1);
  const maxTechOpen = Math.max(...(technicianStats.map((t) => t.open_requests) || []), 1);
 const previewComplaints = (previewStatusFilter === 'all'
    ? complaints
    : complaints.filter((c) => (String(c?.status || '').toLowerCase() === previewStatusFilter))
  ).slice(0, 6); // top 6 preview rows

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Overview of your repair service operations</p>

        <div className="mt-3 flex items-center gap-3">
          <button onClick={fetchAll} className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm">
            Refresh
          </button>

          <div className="ml-4 flex items-center gap-2">
            <span className="text-sm text-gray-600">Show stats:</span>
            <div className="flex rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setStatsMode('all')}
                className={`px-3 py-1 rounded text-sm ${statsMode === 'all' ? 'bg-white shadow font-medium' : 'text-gray-600'}`}
              >
                All time
              </button>
              <button
                onClick={() => setStatsMode('today')}
                className={`px-3 py-1 rounded text-sm ${statsMode === 'today' ? 'bg-white shadow font-medium' : 'text-gray-600'}`}
              >
                Today
              </button>
            </div>
            <div className="text-xs text-gray-500 ml-3">(Daily chart uses Asia/Kolkata calendar days)</div>
          </div>

          {loading && <span className="text-sm text-gray-500 ml-4">Loading...</span>}
          {error && <span className="text-sm text-red-500 ml-4">Error: {error}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {statCardsConfig.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.key} className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{displayedStats[stat.key]}</p>
                </div>
                <div className={`${stat.color} p-4 rounded-xl`}>
                  <Icon className="text-white" size={28} />
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-3">{statsMode === 'today' ? 'Counts for today (IST)' : 'All-time counts'}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            <FileText className="inline mr-2" size={24} />
            Technician Open Requests ({statsMode === 'today' ? 'Today (IST)' : 'All time'})
          </h2>

          {technicianStats.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No open requests{statsMode === 'today' ? ' for today' : ''}</p>
          ) : (
            <div className="space-y-4">
              {technicianStats.map((tech, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-gray-700 font-medium">{tech.technician_name}</span>
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 h-3 rounded-full w-32">
                      <div
                        className="bg-blue-600 h-3 rounded-full transition-all"
                        style={{ width: `${(tech.open_requests / maxTechOpen) * 100}%` }}
                      />
                    </div>
                    <span className="text-blue-600 font-bold w-8 text-right">{tech.open_requests}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            <BarChart3 className="inline mr-2" size={24} />
            Daily Requests (Last 7 Days)
          </h2>

          {dailyStats.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No data for the last 7 days</p>
          ) : (
            <div className="flex items-end justify-between h-64 gap-2">
              {dailyStats.map((day, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex items-end justify-center h-48">
                    <div
                      className="bg-gradient-to-t from-blue-600 to-blue-400 w-full rounded-t-lg transition-all hover:from-blue-700 hover:to-blue-500"
                      style={{ height: `${(day.count / maxDaily) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-2 font-medium">{day.date}</p>
                  <p className="text-sm font-bold text-gray-900">{day.count}</p>
                </div>
              ))}
            </div>
          )}

          <div className="text-xs text-gray-500 mt-3">Counts grouped by calendar day in Asia/Kolkata (IST)</div>
        </div>
      </div>

       <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Complaints Preview</h2>
          <div className="flex items-center gap-2">
            {['all', ...statusKeys].map((s) => (
              <button
                key={s}
                onClick={() => setPreviewStatusFilter(s)}
                className={`px-3 py-1 rounded text-sm ${
                  previewStatusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {s === 'all' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </button>
            ))}
            <button
              onClick={() => navigate('/complaints')}
              className="px-3 py-1 rounded text-sm bg-gray-100 hover:bg-gray-200"
              title="Open full complaints page"
            >
              View all
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2 pr-4 w-36">Complaint #</th>
                <th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4 w-28">Phone</th>
                <th className="py-2 pr-4 w-28">Status</th>
                <th className="py-2 pr-4 w-36">Created (IST)</th>
                <th className="py-2 pr-4 w-28">Action</th>
              </tr>
            </thead>
            <tbody>
              {previewComplaints.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-gray-500">No complaints for this filter</td>
                </tr>
              )}
              {previewComplaints.map((c) => (
                <tr key={c.id || c.complaint_no} className="border-b hover:bg-gray-50">
                  <td className="py-3 pr-4 font-medium">{c.complaint_no ?? c.id ?? '-'}</td>
                  <td className="py-3 pr-4">{c.customer_name ?? '-'}</td>
                  <td className="py-3 pr-4">{c.phone ?? '-'}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        (c.status || '').toLowerCase() === 'open' ? 'bg-blue-100 text-blue-800'
                          : (c.status || '').toLowerCase() === 'closed' ? 'bg-green-100 text-green-800'
                          : (c.status || '').toLowerCase() === 'cancelled' ? 'bg-red-100 text-red-800'
                          : (c.status || '').toLowerCase() === 'pending_parts' ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {(c.status || '').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 pr-4">{safeDateOnlyKolkataFromAny(complaintCreatedDateVal(c))}</td>
                  <td className="py-3 pr-4">
                    <button
                      onClick={() => navigate(`/complaints?status=${encodeURIComponent((c.status || '').toLowerCase())}&id=${encodeURIComponent(c.id ?? c.complaint_no ?? '')}`)}
                      className="text-sm px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Preview shows up to 6 entries. Click "View all" or the status cards to open the full complaints list filtered by status.
        </div>
      </div>

    </div>
    
  );
}

/* Local small SVG icon used in the header */
function BarChart3(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}
