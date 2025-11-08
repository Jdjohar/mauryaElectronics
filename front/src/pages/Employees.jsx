// src/pages/Employees.jsx
import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import Modal from '../components/Modal';

const BASE_URL = 'https://mauryaelectronics.onrender.com/api';

export default function Employees({ employees: employeesProp = [], onCreate, onUpdate, onDelete }) {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    hire_date: new Date().toISOString().split('T')[0],
    is_active: true,
  });

  // Mount: fetch employees once. If employeesProp is provided as seed, we merge it but don't repeatedly override state.
  useEffect(() => {
    if (Array.isArray(employeesProp) && employeesProp.length) {
      // Normalize incoming prop ids to _id if necessary
      const seeded = employeesProp.map((e) => ({ ...e, _id: e._id || e.id || e._id }));
      setEmployees(seeded);
    }
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const filtered = employees.filter(
      (emp) =>
        (emp.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.phone || '').includes(searchTerm) ||
        (emp.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredEmployees(filtered);
  }, [searchTerm, employees]);

  // Fetch from backend (single source of truth)
  const fetchEmployees = async () => {
    try {
      // only show global loading when we have no items yet — prevents blink
      if (employees.length === 0) setLoading(true);
      const res = await fetch(`${BASE_URL}/employees`);
      if (!res.ok) throw new Error(`Failed to fetch employees: ${res.statusText}`);
      const data = await res.json();
      // Normalize to _id
      const normalized = Array.isArray(data)
        ? data.map((d) => ({ ...d, _id: d._id || d.id }))
        : [];
      setEmployees(normalized);
    } catch (err) {
      console.error('fetchEmployees error', err);
      alert('Could not load employees. See console for details.');
    } finally {
      setLoading(false);
    }
  };

  // CREATE or UPDATE
  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      hire_date: formData.hire_date,
      is_active: !!formData.is_active,
    };

    try {
      setLoading(true);

      if (editingEmployee && editingEmployee._id) {
        // Update
        const res = await fetch(`${BASE_URL}/employees/${editingEmployee._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Update failed: ${res.statusText}`);
        const updated = await res.json();
        const normalized = { ...updated, _id: updated._id || updated.id };
        setEmployees((prev) => prev.map((emp) => (String(emp._id) === String(normalized._id) ? normalized : emp)));
        onUpdate?.(normalized._id, normalized);
      } else {
        // Create (wait for server response then update local state)
        const res = await fetch(`${BASE_URL}/employees`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Create failed: ${errText}`);
        }
        const body = await res.json();
        // try common response shapes: { employee: {...} } or the created doc directly
        const created = body.employee || body;
        if (!created) {
          // fallback: refetch list
          await fetchEmployees();
          onCreate?.(null);
        } else {
          const normalized = { ...created, _id: created._id || created.id };
          // avoid duplicates: remove any temporary/local item with same unique fields (phone + name) if exists
          setEmployees((prev) => {
            const filtered = prev.filter(
              (p) => !(p._id === normalized._id || (p.phone === normalized.phone && p.name === normalized.name))
            );
            return [normalized, ...filtered];
          });
          onCreate?.(normalized);
        }
      }

      resetForm();
    } catch (err) {
      console.error('handleSubmit error', err);
      alert('Operation failed. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  // open modal with form filled for edit
  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name || '',
      phone: employee.phone || '',
      email: employee.email || '',
      address: employee.address || '',
      hire_date: employee.hire_date ? new Date(employee.hire_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      is_active: typeof employee.is_active === 'boolean' ? employee.is_active : true,
    });
    setIsModalOpen(true);
  };

  // DELETE
  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    try {
      setLoading(true);
      const res = await fetch(`${BASE_URL}/employees/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`Delete failed: ${errText}`);
      }
      // remove from local list
      setEmployees((prev) => prev.filter((emp) => String(emp._id || emp.id) !== String(id)));
      onDelete?.(id);
    } catch (err) {
      console.error('handleDelete error', err);
      alert('Delete failed. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      hire_date: new Date().toISOString().split('T')[0],
      is_active: true,
    });
    setEditingEmployee(null);
    setIsModalOpen(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Employees</h1>
          <p className="text-gray-600 mt-2">Add, edit, and manage your employees</p>
        </div>
        <button
          onClick={() => {
            setEditingEmployee(null);
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
        >
          <Plus size={20} />
          Add Employee
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search employees by name, phone, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Name</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Phone</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Email</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Hire Date</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading && employees.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">Loading...</td>
              </tr>
            ) : filteredEmployees.length > 0 ? (
              filteredEmployees.map((employee) => {
                const id = employee._id || employee.id;
                return (
                  <tr key={id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{employee.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{employee.phone}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{employee.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                          employee.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {employee.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(employee)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-500">No employees found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={resetForm} title={editingEmployee ? 'Edit Employee' : 'Add New Employee'}>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Hire Date</label>
            <input
              type="date"
              value={formData.hire_date}
              onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
              Active Status
            </label>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">
              {editingEmployee ? 'Update Employee' : 'Add Employee'}
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
