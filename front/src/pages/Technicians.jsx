// Technicians.jsx (fixed: prevents update-depth loops & fixes service selection)
import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import Modal from '../components/Modal';

const BASE = 'https://maurya-electronics.vercel.app';

// Helper: normalize item -> ensure `id` exists (string)
function normalize(item) {
  if (!item) return item;
  const id = item._id ? String(item._id) : item.id ? String(item.id) : null;
  return { ...item, id };
}

export default function Technicians({
  technicians: techniciansProp = [],
  services: servicesProp = [],
  onCreateTechnician,
  onUpdateTechnician,
  onDeleteTechnician,
}) {
  const [technicians, setTechnicians] = useState([]);
  const [filteredTechnicians, setFilteredTechnicians] = useState([]);
  const [services, setServices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    is_active: true,
    selectedServices: [],
  });

  // On mount, fetch server data. This is the single source of truth for server-backed UI.
  useEffect(() => {
    fetchInitialData();
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep local arrays updated when props change **only if** no server data was fetched (fallback).
  // If server returns data we'll overwrite anyway so this won't create a loop.
  useEffect(() => {
    // If we have no server-loaded data yet, use props as fallback
    if (!loading && technicians.length === 0 && Array.isArray(techniciansProp) && techniciansProp.length > 0) {
      setTechnicians(techniciansProp.map(normalize));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [techniciansProp]);

  useEffect(() => {
    if (!loading && services.length === 0 && Array.isArray(servicesProp) && servicesProp.length > 0) {
      setServices(servicesProp.map(normalize));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicesProp]);

  // filter list when search or technicians change
  useEffect(() => {
    const filtered = technicians.filter((tech) =>
      (tech.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tech.phone || '').includes(searchTerm) ||
      (tech.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredTechnicians(filtered);
  }, [searchTerm, technicians]);

  // --- API helpers ---
  async function fetchInitialData() {
    setLoading(true);
    setError(null);
    try {
      const [techRes, servRes] = await Promise.all([
        fetch(`${BASE}/technicians`),
        fetch(`${BASE}/services`),
      ]);

      if (!techRes.ok) throw new Error(`Failed to fetch technicians (${techRes.status})`);
      if (!servRes.ok) throw new Error(`Failed to fetch services (${servRes.status})`);

      const techJson = await techRes.json();
      const servJson = await servRes.json();

      // normalize IDs to `.id` and ensure services[] on technician is array of ids
      const normalizedServices = Array.isArray(servJson)
        ? servJson.map((s) => normalize(s))
        : [];

      const normalizedTechs = Array.isArray(techJson)
        ? techJson.map((t) => {
            const nt = normalize(t);
            // ensure services is array of id strings (normalize as necessary)
            const svcArr = Array.isArray(nt.services)
              ? nt.services.map((sid) => String(sid))
              : [];
            return { ...nt, services: svcArr };
          })
        : [];

      setServices(normalizedServices);
      // sort newest first if created_at present
      setTechnicians(normalizedTechs.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      }));
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load data');
      // fallback to props if available
      if (Array.isArray(servicesProp) && servicesProp.length) {
        setServices(servicesProp.map(normalize));
      }
      if (Array.isArray(techniciansProp) && techniciansProp.length) {
        setTechnicians(techniciansProp.map(normalize));
      }
    } finally {
      setLoading(false);
    }
  }

  async function createTechnicianRemote(payload) {
    const res = await fetch(`${BASE}/technicians`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Create failed (${res.status})`);
    const data = await res.json();
    return normalize(data);
  }

  async function updateTechnicianRemote(id, payload) {
    const res = await fetch(`${BASE}/technicians/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Update failed (${res.status})`);
    const data = await res.json();
    return normalize(data);
  }

  async function deleteTechnicianRemote(id) {
    const res = await fetch(`${BASE}/technicians/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Delete failed (${res.status})`);
    return true;
  }

  // --- handlers ---
  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      is_active: !!formData.is_active,
      // ensure it's array of strings of service ids (we store service.id earlier)
      services: Array.isArray(formData.selectedServices) ? formData.selectedServices.map(String) : [],
    };

    if (editingTechnician) {
      // optimistic local update
      const id = editingTechnician.id;
      const updatedLocal = { ...editingTechnician, ...payload };
      setTechnicians((prev) => prev.map((t) => (t.id === id ? updatedLocal : t)));
      onUpdateTechnician?.(id, updatedLocal);

      try {
        await updateTechnicianRemote(id, payload);
        // refresh from server to get canonical data
        await fetchInitialData();
      } catch (err) {
        console.error(err);
        await fetchInitialData(); // rollback/refetch
        alert('Failed to update technician on server.');
      }
    } else {
      // create locally first
      const temp = { id: genId(), ...payload, created_at: new Date().toISOString() };
      setTechnicians((prev) => [temp, ...prev]);
      onCreateTechnician?.(temp);

      try {
        const created = await createTechnicianRemote(payload);
        // replace temp by server-provided doc (match by temp id)
        setTechnicians((prev) => prev.map((t) => (t.id === temp.id ? created : t)));
        onCreateTechnician?.(created);
      } catch (err) {
        console.error(err);
        alert('Failed to create on server — saved locally.');
      }
    }

    resetForm();
  };

  const handleEdit = (technician) => {
    setEditingTechnician(technician);
    setFormData({
      name: technician.name || '',
      phone: technician.phone || '',
      email: technician.email || '',
      address: technician.address || '',
      is_active: typeof technician.is_active === 'boolean' ? technician.is_active : true,
      // ensure selectedServices is array of service.id strings
      selectedServices: Array.isArray(technician.services) ? technician.services.map(String) : [],
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this technician?')) return;

    const prev = technicians.slice();
    setTechnicians((prevList) => prevList.filter((t) => t.id !== id));
    onDeleteTechnician?.(id);

    try {
      await deleteTechnicianRemote(id);
    } catch (err) {
      console.error(err);
      setTechnicians(prev); // rollback
      alert('Failed to delete on server.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      is_active: true,
      selectedServices: [],
    });
    setEditingTechnician(null);
    setIsModalOpen(false);
  };

  // toggles a service id (string). We use service.id consistently.
  const toggleService = (serviceId) => {
    setFormData((prev) => {
      const asStrings = prev.selectedServices.map(String);
      if (asStrings.includes(String(serviceId))) {
        return { ...prev, selectedServices: asStrings.filter((id) => id !== String(serviceId)) };
      } else {
        return { ...prev, selectedServices: [...asStrings, String(serviceId)] };
      }
    });
  };

  // Render
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Technicians</h1>
          <p className="text-gray-600 mt-2">Add, edit, and manage your technicians</p>
        </div>
        <button
          onClick={() => {
            setEditingTechnician(null);
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
        >
          <Plus size={20} />
          Add Technician
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search technicians by name, phone, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {loading && <p className="text-sm text-gray-500 mt-2">Loading...</p>}
        {error && <p className="text-sm text-red-500 mt-2">Error: {error}</p>}
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Name</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Phone</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Email</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Services</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredTechnicians.map((technician) => (
              <tr key={technician.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{technician.name}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{technician.phone}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{technician.email}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {(technician.services || []).map((serviceId) => {
                      // find service by normalized .id
                      const srv = services.find((s) => String(s.id) === String(serviceId));
                      return srv ? (
                        <span
                          key={serviceId}
                          className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded"
                        >
                          {srv.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                      technician.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {technician.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(technician)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(technician.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredTechnicians.length === 0 && (
          <div className="text-center py-12 text-gray-500">No technicians found</div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={resetForm}
        title={editingTechnician ? 'Edit Technician' : 'Add New Technician'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Services</label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-4 border border-gray-300 rounded-lg">
              {services.map((service) => (
                <label key={service.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.selectedServices.map(String).includes(String(service.id))}
                    onChange={() => toggleService(service.id)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{service.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active_tech"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_active_tech" className="text-sm font-medium text-gray-700">Active Status</label>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">
              {editingTechnician ? 'Update Technician' : 'Add Technician'}
            </button>
            <button type="button" onClick={resetForm} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium">
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
