import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Settings as SettingsIcon, Package, MapPin } from 'lucide-react';
import Modal from '../components/Modal';

const BASE_URL = 'https://mauryaelectronics.onrender.com/api';

function normalizeId(obj) {
    if (!obj) return obj;
    return { ...obj, _id: obj._id || obj.id || obj._id };
}

export default function Services({
    services: servicesProp = [],
    categories: categoriesProp = [],
    products: productsProp = [],
    pinCodes: pinCodesProp = [],
    onCreate,
    onUpdate,
    onDelete,
}) {
    const [activeTab, setActiveTab] = useState('services'); // 'services' | 'categories' | 'products' | 'pincodes'
    const [services, setServices] = useState(() =>
        Array.isArray(servicesProp) ? servicesProp.map(normalizeId) : []
    );
    const [categories, setCategories] = useState(() =>
        Array.isArray(categoriesProp) ? categoriesProp.map(normalizeId) : []
    );
    const [products, setProducts] = useState(() =>
        Array.isArray(productsProp) ? productsProp.map(normalizeId) : []
    );
    const [pinCodes, setPinCodes] = useState(() =>
        Array.isArray(pinCodesProp) ? pinCodesProp.map(normalizeId) : []
    );
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [loading, setLoading] = useState(false);

    const [serviceForm, setServiceForm] = useState({
        name: '',
        description: '',
        base_price: 0,
        technician_price: 0,
        category_id: '',
    });

    const [categoryForm, setCategoryForm] = useState({ name: '' });
    const [productForm, setProductForm] = useState({ brand_name: '', model: '', category_id: '' });
    const [pinCodeForm, setPinCodeForm] = useState({ name: '', pin_code: '' });

    // seed local from props (only once)
    useEffect(() => {
        if (Array.isArray(servicesProp) && servicesProp.length) {
            setServices(servicesProp.map(normalizeId));
        }
        if (Array.isArray(categoriesProp) && categoriesProp.length) {
            setCategories(categoriesProp.map(normalizeId));
        }
        if (Array.isArray(productsProp) && productsProp.length) {
            setProducts(productsProp.map(normalizeId));
        }
        if (Array.isArray(pinCodesProp) && pinCodesProp.length) {
            setPinCodes(pinCodesProp.map(normalizeId));
        }

        // fetch real data from server
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    

    const fetchAll = async () => {
        try {
            // show loading only if we have no local data yet to avoid flashing
            if (!services.length && !categories.length && !products.length && !pinCodes.length) setLoading(true);

            const [sRes, cRes, pRes, pcRes] = await Promise.all([
                fetch(`${BASE_URL}/services`),
                fetch(`${BASE_URL}/categories`),
                fetch(`${BASE_URL}/products`),
                fetch(`${BASE_URL}/pincodes`),
            ]);

            if (!sRes.ok || !cRes.ok || !pRes.ok || !pcRes.ok) {
                throw new Error('Failed to fetch one or more resources');
            }

            const [sData, cData, pData, pcData] = await Promise.all([sRes.json(), cRes.json(), pRes.json(), pcRes.json()]);

            setServices(Array.isArray(sData) ? sData.map(normalizeId) : []);
            setCategories(Array.isArray(cData) ? cData.map(normalizeId) : []);
            setProducts(Array.isArray(pData) ? pData.map(normalizeId) : []);
            setPinCodes(Array.isArray(pcData) ? pcData.map(normalizeId) : []);
        } catch (err) {
            console.error('fetchAll error', err);
            alert('Could not load services data. Check console for details.');
        } finally {
            setLoading(false);
        }
    };

    // Helpers
    const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    // ---- SERVICE CRUD ----
    const handleServiceSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            ...serviceForm,
            base_price: Number(serviceForm.base_price) || 0,
            technician_price: Number(serviceForm.technician_price) || 0,
            category_id: serviceForm.category_id || null,
        };

        try {
            setLoading(true);
            if (editingItem && (editingItem._id || editingItem.id)) {
                const id = editingItem._id || editingItem.id;
                const res = await fetch(`${BASE_URL}/services/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error('Update service failed');
                const updated = normalizeId(await res.json());
                setServices((prev) => prev.map((s) => (String(s._id || s.id) === String(updated._id) ? updated : s)));
                onUpdate?.('service', updated._id || updated.id, updated);
            } else {
                const res = await fetch(`${BASE_URL}/services`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error('Create service failed');
                const created = normalizeId(await res.json());
                if (created && created._id) {
                    setServices((prev) => [created, ...prev.filter((p) => !(p.name === created.name && p.base_price === created.base_price))]);
                    onCreate?.('service', created);
                } else {
                    // fallback: refresh list
                    await fetchAll();
                    onCreate?.('service', null);
                }
            }
            resetForms();
        } catch (err) {
            console.error('handleServiceSubmit', err);
            alert('Service operation failed. Check console.');
        } finally {
            setLoading(false);
        }
    };

    // ---- CATEGORY CRUD ----
    const handleCategorySubmit = async (e) => {
        e.preventDefault();
        const payload = { ...categoryForm };
        try {
            setLoading(true);
            if (editingItem && (editingItem._id || editingItem.id)) {
                const id = editingItem._id || editingItem.id;
                const res = await fetch(`${BASE_URL}/categories/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error('Update category failed');
                const updated = normalizeId(await res.json());
                setCategories((prev) => prev.map((c) => (String(c._id || c.id) === String(updated._id) ? updated : c)));
                onUpdate?.('category', updated._id || updated.id, updated);
            } else {
                const res = await fetch(`${BASE_URL}/categories`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error('Create category failed');
                const created = normalizeId(await res.json());
                if (created && created._id) {
                    setCategories((prev) => [created, ...prev]);
                    onCreate?.('category', created);
                } else {
                    await fetchAll();
                    onCreate?.('category', null);
                }
            }
            resetForms();
        } catch (err) {
            console.error('handleCategorySubmit', err);
            alert('Category operation failed. Check console.');
        } finally {
            setLoading(false);
        }
    };

    // ---- PRODUCT CRUD ----
    const handleProductSubmit = async (e) => {
        e.preventDefault();
        const payload = { ...productForm, category_id: productForm.category_id || null };
        try {
            setLoading(true);
            if (editingItem && (editingItem._id || editingItem.id)) {
                const id = editingItem._id || editingItem.id;
                const res = await fetch(`${BASE_URL}/products/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error('Update product failed');
                const updated = normalizeId(await res.json());
                setProducts((prev) => prev.map((p) => (String(p._id || p.id) === String(updated._id) ? updated : p)));
                onUpdate?.('product', updated._id || updated.id, updated);
            } else {
                const res = await fetch(`${BASE_URL}/products`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error('Create product failed');
                const created = normalizeId(await res.json());
                if (created && created._id) {
                    setProducts((prev) => [created, ...prev]);
                    onCreate?.('product', created);
                } else {
                    await fetchAll();
                    onCreate?.('product', null);
                }
            }
            resetForms();
        } catch (err) {
            console.error('handleProductSubmit', err);
            alert('Product operation failed. Check console.');
        } finally {
            setLoading(false);
        }
    };

    // ---- PINCODES CRUD ----
    const handlePinCodeSubmit = async (e) => {
        e.preventDefault();
        const payload = { ...pinCodeForm };
        try {
            setLoading(true);
            if (editingItem && (editingItem._id || editingItem.id)) {
                const id = editingItem._id || editingItem.id;
                const res = await fetch(`${BASE_URL}/pincodes/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error('Update pincode failed');
                const updated = normalizeId(await res.json());
                setPinCodes((prev) => prev.map((p) => (String(p._id || p.id) === String(updated._id) ? updated : p)));
                onUpdate?.('pincode', updated._id || updated.id, updated);
            } else {
                const res = await fetch(`${BASE_URL}/pincodes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error('Create pincode failed');
                const created = normalizeId(await res.json());
                if (created && created._id) {
                    setPinCodes((prev) => [created, ...prev]);
                    onCreate?.('pincode', created);
                } else {
                    await fetchAll();
                    onCreate?.('pincode', null);
                }
            }
            resetForms();
        } catch (err) {
            console.error('handlePinCodeSubmit', err);
            alert('Pin code operation failed. Check console.');
        } finally {
            setLoading(false);
        }
    };

    // ---- Edit + Delete handlers ----
    const handleEdit = (type, item) => {
        const normalized = normalizeId(item);
        setEditingItem(normalized || null);
        if (!item) return;
        if (type === 'service') {
            setServiceForm({
                name: item.name || '',
                description: item.description || '',
                base_price: item.base_price ?? 0,
                technician_price: item.technician_price ?? 0,
                category_id: item.category_id || '',
            });
            setActiveTab('services');
        } else if (type === 'category') {
            setCategoryForm({ name: item.name || '' });
            setActiveTab('categories');
        } else if (type === 'product') {
            setProductForm({
                brand_name: item.brand_name || '',
                model: item.model || '',
                category_id: item.category_id || '',
            });
            setActiveTab('products');
        } else if (type === 'pincode') {
            setPinCodeForm({ name: item.name || '', pin_code: item.pin_code || '' });
            setActiveTab('pincodes');
        }
        setIsModalOpen(true);
    };

    const handleDelete = async (type, id) => {
        if (!confirm('Are you sure you want to delete this item?')) return;

        try {
            setLoading(true);
            let endpoint = '';
            if (type === 'service') endpoint = 'services';
            else if (type === 'category') endpoint = 'categories';
            else if (type === 'product') endpoint = 'products';
            else endpoint = 'pincodes';

            // try server delete first
            const res = await fetch(`${BASE_URL}/${endpoint}/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                // still remove locally but inform user
                console.warn(`${endpoint} delete returned ${res.status}`);
            }

            // update local state
            if (type === 'service') {
                setServices((prev) => prev.filter((s) => String(s._id || s.id || s.id) !== String(id)));
            } else if (type === 'category') {
                setCategories((prev) => prev.filter((c) => String(c._id || c.id) !== String(id)));
                setServices((prev) => prev.map((s) => (String(s.category_id) === String(id) ? { ...s, category_id: null } : s)));
                setProducts((prev) => prev.map((p) => (String(p.category_id) === String(id) ? { ...p, category_id: null } : p)));
            } else if (type === 'product') {
                setProducts((prev) => prev.filter((p) => String(p._id || p.id) !== String(id)));
            } else {
                setPinCodes((prev) => prev.filter((p) => String(p._id || p.id) !== String(id)));
            }

            onDelete?.(type, id);
        } catch (err) {
            console.error('handleDelete error', err);
            alert('Delete failed. See console.');
        } finally {
            setLoading(false);
        }
    };

    const resetForms = () => {
        setServiceForm({ name: '', description: '', base_price: 0, technician_price: 0, category_id: '' });
        setCategoryForm({ name: '' });
        setProductForm({ brand_name: '', model: '', category_id: '' });
        setPinCodeForm({ name: '', pin_code: '' });
        setEditingItem(null);
        setIsModalOpen(false);
    };

    // Render
    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Services Management</h1>
                <p className="text-gray-600 mt-2">Manage services, categories, products, and pin codes</p>
            </div>

            <div className="bg-white rounded-xl shadow-md mb-6">
                <div className="flex border-b">
                    <button
                        onClick={() => setActiveTab('services')}
                        className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${activeTab === 'services' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <SettingsIcon size={20} />
                        Services
                    </button>
                    <button
                        onClick={() => setActiveTab('categories')}
                        className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${activeTab === 'categories' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <Package size={20} />
                        Categories
                    </button>
                    <button
                        onClick={() => setActiveTab('products')}
                        className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${activeTab === 'products' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <Package size={20} />
                        Products
                    </button>
                    <button
                        onClick={() => setActiveTab('pincodes')}
                        className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${activeTab === 'pincodes' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <MapPin size={20} />
                        Pin Codes
                    </button>
                </div>
            </div>

            {activeTab === 'services' && (
                <div>
                    <div className="flex justify-end mb-6">
                        <button
                            onClick={() => {
                                setActiveTab('services');
                                setEditingItem(null);
                                setServiceForm({ name: '', description: '', base_price: 0, technician_price: 0, category_id: '' });
                                setIsModalOpen(true);
                            }}
                            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
                        >
                            <Plus size={20} />
                            Add Service
                        </button>
                    </div>

                    <div className="bg-white rounded-xl shadow-md overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Service Name</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Category</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Base Price</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Tech Price</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Description</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {loading && services.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-gray-500">Loading...</td>
                                    </tr>
                                ) : services.length > 0 ? (
                                    services.map((service) => {
                                        const id = service._id || service.id;
                                        return (
                                            <tr key={id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{service.name}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    {categories.find((c) => (c._id || c.id) === service.category_id)?.name || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">₹{service.base_price}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">₹{service.technician_price}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{service.description || 'N/A'}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleEdit('service', service)}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete('service', id)}
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
                                        <td colSpan={6} className="text-center py-12 text-gray-500">No services found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'categories' && (
                <div>
                    <div className="flex justify-end mb-6">
                        <button
                            onClick={() => {
                                setActiveTab('categories');
                                setEditingItem(null);
                                setCategoryForm({ name: '' });
                                setIsModalOpen(true);
                            }}
                            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
                        >
                            <Plus size={20} />
                            Add Category
                        </button>
                    </div>

                    <div className="bg-white rounded-xl shadow-md overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Category Name</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {loading && categories.length === 0 ? (
                                    <tr>
                                        <td colSpan={2} className="text-center py-8 text-gray-500">Loading...</td>
                                    </tr>
                                ) : categories.length > 0 ? (
                                    categories.map((category) => {
                                        const id = category._id || category.id;
                                        return (
                                            <tr key={id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{category.name}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleEdit('category', category)}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete('category', id)}
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
                                        <td colSpan={2} className="text-center py-12 text-gray-500">No categories found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'products' && (
                <div>
                    <div className="flex justify-end mb-6">
                        <button
                            onClick={() => {
                                setActiveTab('products');
                                setEditingItem(null);
                                setProductForm({ brand_name: '', model: '', category_id: '' });
                                setIsModalOpen(true);
                            }}
                            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
                        >
                            <Plus size={20} />
                            Add Product
                        </button>
                    </div>

                    <div className="bg-white rounded-xl shadow-md overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Brand Name</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Model</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Category</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {loading && products.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-gray-500">Loading...</td>
                                    </tr>
                                ) : products.length > 0 ? (
                                    products.map((product) => {
                                        const id = product._id || product.id;
                                        return (
                                            <tr key={id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{product.brand_name}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{product.model}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    {categories.find((c) => (c._id || c.id) === product.category_id)?.name || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleEdit('product', product)}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete('product', id)}
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
                                        <td colSpan={4} className="text-center py-12 text-gray-500">No products found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'pincodes' && (
                <div>
                    <div className="flex justify-end mb-6">
                        <button
                            onClick={() => {
                                setActiveTab('pincodes');
                                setEditingItem(null);
                                setPinCodeForm({ name: '', pin_code: '' });
                                setIsModalOpen(true);
                            }}
                            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
                        >
                            <Plus size={20} />
                            Add Pin Code
                        </button>
                    </div>

                    <div className="bg-white rounded-xl shadow-md overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Area Name</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Pin Code</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {loading && pinCodes.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="text-center py-8 text-gray-500">Loading...</td>
                                    </tr>
                                ) : pinCodes.length > 0 ? (
                                    pinCodes.map((pinCode) => {
                                        const id = pinCode._id || pinCode.id;
                                        return (
                                            <tr key={id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{pinCode.name}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{pinCode.pin_code}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleEdit('pincode', pinCode)}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete('pincode', id)}
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
                                        <td colSpan={3} className="text-center py-12 text-gray-500">No pin codes found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={resetForms}
                title={
                    activeTab === 'services'
                        ? editingItem
                            ? 'Edit Service'
                            : 'Add New Service'
                        : activeTab === 'categories'
                            ? editingItem
                                ? 'Edit Category'
                                : 'Add New Category'
                            : activeTab === 'products'
                                ? editingItem
                                    ? 'Edit Product'
                                    : 'Add New Product'
                                : editingItem
                                    ? 'Edit Pin Code'
                                    : 'Add New Pin Code'
                }
            >
                {activeTab === 'services' && (
                    <form onSubmit={handleServiceSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Service Name *</label>
                            <input
                                type="text"
                                required
                                value={serviceForm.name}
                                onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                            <textarea
                                value={serviceForm.description}
                                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Base Price</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={serviceForm.base_price}
                                    onChange={(e) =>
                                        setServiceForm({ ...serviceForm, base_price: e.target.value === '' ? 0 : Number(e.target.value) })
                                    }
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Technician Price</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={serviceForm.technician_price}
                                    onChange={(e) =>
                                        setServiceForm({ ...serviceForm, technician_price: e.target.value === '' ? 0 : Number(e.target.value) })
                                    }
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                            <select
                                value={serviceForm.category_id}
                                onChange={(e) => setServiceForm({ ...serviceForm, category_id: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Select a category</option>
                                {categories.map((cat) => (
                                    <option key={cat._id || cat.id} value={cat._id || cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <button
                                type="submit"
                                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                            >
                                {editingItem ? 'Update Service' : 'Add Service'}
                            </button>
                            <button
                                type="button"
                                onClick={resetForms}
                                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}

                {activeTab === 'categories' && (
                    <form onSubmit={handleCategorySubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Category Name *</label>
                            <input
                                type="text"
                                required
                                value={categoryForm.name}
                                onChange={(e) => setCategoryForm({ name: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="flex gap-3 pt-4">
                            <button
                                type="submit"
                                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                            >
                                {editingItem ? 'Update Category' : 'Add Category'}
                            </button>
                            <button
                                type="button"
                                onClick={resetForms}
                                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}

                {activeTab === 'products' && (
                    <form onSubmit={handleProductSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Brand Name *</label>
                            <input
                                type="text"
                                required
                                value={productForm.brand_name}
                                onChange={(e) => setProductForm({ ...productForm, brand_name: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Model *</label>
                            <input
                                type="text"
                                required
                                value={productForm.model}
                                onChange={(e) => setProductForm({ ...productForm, model: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                            <select
                                value={productForm.category_id}
                                onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Select a category</option>
                                {categories.map((cat) => (
                                    <option key={cat._id || cat.id} value={cat._id || cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <button
                                type="submit"
                                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                            >
                                {editingItem ? 'Update Product' : 'Add Product'}
                            </button>
                            <button
                                type="button"
                                onClick={resetForms}
                                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}

                {activeTab === 'pincodes' && (
                    <form onSubmit={handlePinCodeSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Area Name *</label>
                            <input
                                type="text"
                                required
                                value={pinCodeForm.name}
                                onChange={(e) => setPinCodeForm({ ...pinCodeForm, name: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Pin Code *</label>
                            <input
                                type="text"
                                required
                                value={pinCodeForm.pin_code}
                                onChange={(e) => setPinCodeForm({ ...pinCodeForm, pin_code: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="flex gap-3 pt-4">
                            <button
                                type="submit"
                                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                            >
                                {editingItem ? 'Update Pin Code' : 'Add Pin Code'}
                            </button>
                            <button
                                type="button"
                                onClick={resetForms}
                                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
}
