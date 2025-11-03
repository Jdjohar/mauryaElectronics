// Complaints.jsx (complete) — shows loading overlay when uploading media
import { useEffect, useState, useRef, useMemo } from 'react';
import { Plus, Edit2, Search, Download, MessageCircle } from 'lucide-react';
import Modal from '../components/Modal';

const BASE = 'https://maurya-electronics.vercel.app';

function normalize(item) {
  if (!item) return item;
  const id = item._id ? String(item._id) : item.id ? String(item.id) : null;
  return { ...item, id };
}

function formatCurrency(v) {
  if (v == null || v === '') return '-';
  const num = Number(v);
  if (Number.isNaN(num)) return '-';
  return num.toLocaleString(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
}

// simple CSS spinner component (inline SVG)
function Spinner({ size = 36 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 50 50"
      className="animate-spin"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="6" />
      <path
        d="M45 25a20 20 0 0 1-20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        style={{ strokeLinecap: 'round' }}
      />
    </svg>
  );
}

export default function Complaints({
  complaints: complaintsProp = [],
  services: servicesProp = [],
  technicians: techniciansProp = [],
  onCreateComplaint,
  onUpdateComplaint,
}) {
  // data stores
  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [services, setServices] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  // UI / modal state
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [editingComplaint, setEditingComplaint] = useState(null);
  const [submittedComplaint, setSubmittedComplaint] = useState(null);
  const [multiServiceMode, setMultiServiceMode] = useState(false);
  const [serviceQueue, setServiceQueue] = useState([]);

  // price override state
  const [technicianPriceOverride, setTechnicianPriceOverride] = useState('');
  const [applyPriceToService, setApplyPriceToService] = useState(false);

  // form & media state
  const [formData, setFormData] = useState({
    customer_name: '',
    phone: '',
    phone2: '',
    pin_code: '',
    address: '',
    service_id: '',
    problem_description: '',
    technician_id: '',
    remarks: '',
    status: 'open',
  });

  // This holds final uploaded urls (persisted attachments)
  const [mediaUrls, setMediaUrls] = useState({
    images: ['', '', ''],
    video: '',
  });

  // Previews for local selections and existing remote URLs (images/video)
  const [mediaPreviews, setMediaPreviews] = useState({
    images: ['', '', ''],
    video: '',
  });

  // Local files selected but not uploaded yet (File objects)
  const [filesToUpload, setFilesToUpload] = useState([]); // array of File

  // other
  const [missingParts, setMissingParts] = useState([{ brand: '', model: '', part_name: '' }]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false); // <-- key state for overlay
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  // Utilities
  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const genComplaintNo = () => 'CMP-' + new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);

  // --- Initialization: load from props first, then fetch from API ---
  useEffect(() => {
    if (Array.isArray(servicesProp) && servicesProp.length > 0 && services.length === 0) {
      setServices(servicesProp.map(normalize));
    }
  }, [servicesProp]);

  useEffect(() => {
    if (Array.isArray(techniciansProp) && techniciansProp.length > 0 && technicians.length === 0) {
      setTechnicians(techniciansProp.map(normalize).filter((t) => t.is_active !== false));
    }
  }, [techniciansProp]);

  useEffect(() => {
    // seed with prop complaints if provided
    if (Array.isArray(complaintsProp) && complaintsProp.length > 0 && complaints.length === 0) {
      setComplaints(complaintsProp.map(normalize).sort(sortByCreatedAtDesc));
    }
    // fetch live
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const filtered = complaints.filter(
      (comp) =>
        (comp.complaint_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (comp.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (comp.phone || '').includes(searchTerm)
    );
    setFilteredComplaints(filtered);
  }, [searchTerm, complaints]);

  function sortByCreatedAtDesc(a, b) {
    const ta = a.created_at ? new Date(a.created_at).getTime() : a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  }

  // --- API helpers ---
  async function fetchInitialData() {
    setLoading(true);
    try {
      const [cRes, sRes, tRes] = await Promise.all([
        fetch(`${BASE}/complaints`),
        fetch(`${BASE}/services`),
        fetch(`${BASE}/technicians`),
      ]);
      if (!cRes.ok) throw new Error(`Failed to fetch complaints (${cRes.status})`);
      const [cJson, sJson, tJson] = await Promise.all([cRes.json(), sRes.json(), tRes.json()]);
      const normalizedComplaints = Array.isArray(cJson) ? cJson.map(normalize).sort(sortByCreatedAtDesc) : [];
      setComplaints(normalizedComplaints);
      if (Array.isArray(sJson)) setServices(sJson.map(normalize));
      if (Array.isArray(tJson)) setTechnicians(tJson.map(normalize).filter((t) => t.is_active !== false));
    } catch (err) {
      console.error('fetchInitialData', err);
    } finally {
      setLoading(false);
    }
  }

  async function createComplaintRemote(payload) {
    const res = await fetch(`${BASE}/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Create failed (${res.status}) ${txt}`);
    }
    const json = await res.json();
    if (json && json.complaint) return normalize(json.complaint);
    return normalize(json);
  }

  async function updateComplaintRemote(id, payload) {
    const res = await fetch(`${BASE}/complaints/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Update failed (${res.status}) ${txt}`);
    }
    const json = await res.json();
    if (json && json.complaint) return normalize(json.complaint);
    return normalize(json);
  }

  // Upload single file to backend /api/upload and attach to a complaint
  async function uploadFileToServer(file, complaintId) {
    const form = new FormData();
    form.append('file', file);
    if (complaintId) form.append('complaint', complaintId);
    form.append('folder', 'complaint_media');

    const res = await fetch(`${BASE}/upload`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Upload failed (${res.status}) ${txt}`);
    }
    const json = await res.json();
    const url = json?.result?.secure_url || json?.result?.url || json?.saved?.media_url || json?.url || json?.secure_url;
    return { url, raw: json };
  }

  // Upload multiple files for a complaint id
  async function uploadFilesForComplaint(complaintId, files = []) {
    if (!complaintId || !files || files.length === 0) return [];
    const uploaded = [];
    for (const f of files) {
      try {
        const r = await uploadFileToServer(f, complaintId);
        if (r.url) {
          uploaded.push({ media_url: r.url, media_type: f.type.startsWith('video/') ? 'video' : 'image', provider_response: r.raw?.result || r.raw });
        }
      } catch (err) {
        console.error('uploadFilesForComplaint error', err);
      }
    }
    return uploaded;
  }

  // Fetch complaint full details (incl media and missingParts)
  async function fetchComplaintFull(id) {
    const res = await fetch(`${BASE}/complaints/${id}`);
    if (!res.ok) throw new Error(`Fetch complaint failed (${res.status})`);
    const json = await res.json();
    return json;
  }

  // --- UI helpers to access selected service/technician prices ---
  const selectedService = useMemo(() => services.find((s) => String(s.id) === String(formData.service_id)), [services, formData.service_id]);
  const selectedTechnician = useMemo(() => technicians.find((t) => String(t.id) === String(formData.technician_id)), [technicians, formData.technician_id]);

  // When the selected service changes, if override is empty or equals old service price, update it to new service price
  useEffect(() => {
    const svc = services.find((s) => String(s.id) === String(formData.service_id));
    if (!svc) return;
    const svcTechPrice = svc.technician_price;
    if (!technicianPriceOverride || Number(technicianPriceOverride) === Number(svcTechPrice)) {
      setTechnicianPriceOverride(svcTechPrice != null ? String(svcTechPrice) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.service_id]);

  // --- UI handlers ---
  const loadComplaintsFromProps = () => {
    if (Array.isArray(complaintsProp) && complaintsProp.length > 0) {
      setComplaints(complaintsProp.map(normalize).sort(sortByCreatedAtDesc));
    }
  };

  const toggleServiceInQueue = (serviceId) => {
    setServiceQueue((prev) => (prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]));
  };

  const handleStep1Submit = () => {
    if (formData.customer_name && formData.phone && formData.address) {
      setCurrentStep(2);
    } else {
      alert('Please fill customer name, phone and address.');
    }
  };

  const handleStep2Submit = async () => {
    if (!formData.technician_id || (!formData.service_id && !multiServiceMode)) {
      alert('Please select service and technician.');
      return;
    }
    if (multiServiceMode && serviceQueue.length === 0) {
      alert('Please select at least one service');
      return;
    }

    const servicesToProcess = multiServiceMode ? serviceQueue : [formData.service_id];
    setLoading(true);

    try {
      const createdLocal = [];

      for (let i = 0; i < servicesToProcess.length; i++) {
        const tmpId = genId();
        const complaintData = {
          id: tmpId,
          complaint_no: genComplaintNo(),
          customer_name: formData.customer_name,
          phone: formData.phone,
          phone2: formData.phone2 || '',
          pin_code: formData.pin_code || '',
          address: formData.address,
          service_id: servicesToProcess[i],
          problem_description: formData.problem_description || '',
          technician_id: formData.technician_id,
          remarks: formData.remarks || '',
          status: formData.status || 'open',
          created_at: new Date().toISOString(),
          complaint_media: [],
          missing_parts: missingParts.filter((p) => p.brand || p.model || p.part_name),
        };

        setComplaints((prev) => [complaintData, ...prev]);
        createdLocal.push(complaintData);

        const payload = {
          complaint_no: complaintData.complaint_no,
          customer_name: complaintData.customer_name,
          phone: complaintData.phone,
          phone2: complaintData.phone2,
          pin_code: complaintData.pin_code,
          address: complaintData.address,
          service_id: complaintData.service_id,
          problem_description: complaintData.problem_description,
          technician_id: complaintData.technician_id,
          remarks: complaintData.remarks,
          status: complaintData.status,
          missing_parts: complaintData.missing_parts,
        };

        try {
          const created = await createComplaintRemote(payload);
          const toUpload = filesToUpload.slice();
          let uploadedMedia = [];
          if (toUpload.length) {
            // show uploading UI while creating complaint's media
            setUploading(true);
            uploadedMedia = await uploadFilesForComplaint(created.id || created._id || created.id, toUpload);
            setUploading(false);
          }

          let fresh = created;
          try {
            const full = await fetchComplaintFull(created.id || created._id || created.id);
            if (full && full.complaint) {
              fresh = normalize(full.complaint);
              fresh.complaint_media = Array.isArray(full.media) ? full.media.map((m) => ({ media_type: m.media_type, media_url: m.media_url })) : [];
              fresh.missing_parts = Array.isArray(full.missingParts) ? full.missingParts : [];
            }
          } catch (err) {
            if (uploadedMedia.length) {
              fresh.complaint_media = uploadedMedia.map((m) => ({ media_type: m.media_type, media_url: m.media_url }));
            }
          }

          setComplaints((prev) => prev.map((c) => (c.id === tmpId ? fresh : c)));
          onCreateComplaint?.(fresh);
        } catch (err) {
          console.error('Failed to create complaint on server:', err);
        }
      }

      if (createdLocal.length > 0) {
        const first = createdLocal[0];
        setSubmittedComplaint({
          ...first,
          service_name: services.find((s) => String(s.id) === String(first.service_id))?.name || '',
        });
      }

      setIsModalOpen(false);
      setFilesToUpload([]);
      setMediaPreviews({ images: ['', '', ''], video: '' });
      setMediaUrls({ images: ['', '', ''], video: '' });
      resetFormMinimal();
      alert(`${servicesToProcess.length} complaint(s) registered successfully!`);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  // When editing: fetch full complaint details (media + missingParts) and populate form + previews
  const handleEdit = async (complaint) => {
    setIsEditMode(true);
    setCurrentStep(1);
    setFilesToUpload([]);
    setUploadError(null);

    // populate basic form state quickly from passed object
    setFormData({
      customer_name: complaint.customer_name || '',
      phone: complaint.phone || '',
      phone2: complaint.phone2 || '',
      pin_code: complaint.pin_code || complaint.pinCode || '',
      address: complaint.address || '',
      service_id: complaint.service_id || complaint.service || '',
      problem_description: complaint.problem_description || complaint.problem || '',
      technician_id: complaint.technician_id || complaint.technician || '',
      remarks: complaint.remarks || '',
      status: complaint.status || 'open',
    });

    setIsModalOpen(true);
    setEditingComplaint(complaint);

    try {
      setLoading(true);
      const full = await fetchComplaintFull(complaint.id || complaint._id || complaint.id);
      if (full) {
        const c = normalize(full.complaint || full);
        const parts = Array.isArray(full.missingParts) ? full.missingParts : [];
        setMissingParts(
          parts.length > 0 ? parts.map((p) => ({ brand: p.brand || '', model: p.model || '', part_name: p.part_name || '' })) : [{ brand: '', model: '', part_name: '' }]
        );

        const mediaArr = Array.isArray(full.media) ? full.media : [];
        const images = mediaArr.filter((m) => m.media_type === 'image').map((m) => m.media_url).slice(0, 3);
        const video = mediaArr.find((m) => m.media_type === 'video')?.media_url || '';

        setMediaUrls({
          images: [...images, '', '', ''].slice(0, 3),
          video: video || '',
        });
        setMediaPreviews({
          images: [...images, '', '', ''].slice(0, 3),
          video: video || '',
        });

        setEditingComplaint(c);
        setFormData((prev) => ({ ...prev, service_id: c.service_id || prev.service_id, technician_id: c.technician_id || prev.technician_id }));

        // initialize technicianPriceOverride:
        const svc = services.find((s) => String(s.id) === String(c.service_id));
        const initial = c.technician_price_charged != null ? String(c.technician_price_charged) : (svc?.technician_price ?? '');
        setTechnicianPriceOverride(initial != null ? String(initial) : '');
        setApplyPriceToService(false);
      }
    } catch (err) {
      console.error('handleEdit fetch failed', err);
    } finally {
      setLoading(false);
    }
  };

  // Update complaint (edit flow)
  const handleUpdateComplaint = async () => {
    if (!editingComplaint) return;
    setLoading(true);
    try {
      const id = editingComplaint.id || editingComplaint._id || editingComplaint.id;

      // first, upload newly selected files
      let uploaded = [];
      if (filesToUpload.length > 0) {
        setUploading(true); // show overlay
        uploaded = await uploadFilesForComplaint(id, filesToUpload);
        setUploading(false);
      }

      // Build complaint_media payload:
      const existingImages = (mediaUrls.images || []).filter(Boolean).map((u) => ({ media_type: 'image', media_url: u }));
      const uploadedImages = uploaded.filter((m) => m.media_type === 'image').map((m) => ({ media_type: 'image', media_url: m.media_url }));
      const allImages = [...existingImages, ...uploadedImages].slice(0, 3);

      const existingVideo = mediaUrls.video ? [{ media_type: 'video', media_url: mediaUrls.video }] : [];
      const uploadedVideo = uploaded.filter((m) => m.media_type === 'video').map((m) => ({ media_type: 'video', media_url: m.media_url }));
      const chosenVideo = (existingVideo.length ? existingVideo : uploadedVideo).slice(0, 1);

      const complaint_media = [...allImages, ...chosenVideo];

      // payload
      const payload = {
        ...formData,
        service_id: formData.service_id,
        technician_id: formData.technician_id,
        missing_parts: missingParts.filter((p) => p.brand || p.model || p.part_name),
        complaint_media,
      };

      // include technician price override
      const techPriceNum = technicianPriceOverride !== '' ? Number(technicianPriceOverride) : null;
      if (techPriceNum != null && !Number.isNaN(techPriceNum)) {
        payload.technician_price_charged = techPriceNum;
      }

      if (applyPriceToService) payload.apply_to_service = true;

      // send update
      const updated = await updateComplaintRemote(id, payload);

      // update local complaints
      setComplaints((prev) => prev.map((c) => (String(c.id) === String(id) ? { ...(updated || {}), complaint_media } : c)));

      onUpdateComplaint?.(id, updated);
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error('Failed to update complaint on server:', err);
      alert('Failed to update complaint. See console for details.');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  // Remove image at index (from both previews & urls)
  const removeImageAt = (idx) => {
    setMediaPreviews((prev) => {
      const imgs = prev.images.slice();
      imgs[idx] = '';
      return { ...prev, images: imgs };
    });
    setMediaUrls((prev) => {
      const imgs = prev.images.slice();
      imgs[idx] = '';
      return { ...prev, images: imgs };
    });
    setFilesToUpload((prev) => prev.filter((f, i) => i !== idx));
  };

  const removeVideo = () => {
    setMediaPreviews((prev) => ({ ...prev, video: '' }));
    setMediaUrls((prev) => ({ ...prev, video: '' }));
    setFilesToUpload((prev) => prev.filter((f) => !f.type.startsWith('video/')));
  };

  // files selected locally
  const handleFilesSelectedLocal = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newFiles = files.slice();
    const newPreviews = { ...mediaPreviews };
    const newUrls = { ...mediaUrls };

    const imgs = newPreviews.images.slice();
    const existingFiles = filesToUpload.slice();

    for (const file of newFiles) {
      if (file.type.startsWith('image/')) {
        const firstEmpty = imgs.findIndex((i) => !i);
        const previewUrl = URL.createObjectURL(file);
        if (firstEmpty === -1) {
          imgs[2] = previewUrl;
        } else {
          imgs[firstEmpty] = previewUrl;
        }
        existingFiles.push(file);
      } else if (file.type.startsWith('video/')) {
        const vPreview = URL.createObjectURL(file);
        newPreviews.video = vPreview;
        newUrls.video = '';
        existingFiles.push(file);
      } else {
        const firstEmpty = imgs.findIndex((i) => !i);
        const previewUrl = URL.createObjectURL(file);
        if (firstEmpty === -1) imgs[2] = previewUrl;
        else imgs[firstEmpty] = previewUrl;
        existingFiles.push(file);
      }
    }

    setMediaPreviews((prev) => ({ ...prev, images: imgs, video: newPreviews.video || prev.video }));
    setFilesToUpload(existingFiles);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // WhatsApp
  const sendWhatsAppMessage = (complaint, manualText = '') => {
    const svcName = services.find((s) => String(s.id) === String(complaint.service_id))?.name || '';
    const statusText = complaint.status || '';
    const message = `${manualText || 'Complaint Update'}\nComplaint No: ${complaint.complaint_no}\nCustomer: ${complaint.customer_name}\nService: ${svcName}\nStatus: ${statusText}`;
    const phone = String(complaint.phone).replace(/\D/g, '');
    if (!phone) {
      alert('No phone number available for this complaint.');
      return;
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Reset form (after create/update)
  const resetForm = () => {
    setFormData({
      customer_name: '',
      phone: '',
      phone2: '',
      pin_code: '',
      address: '',
      service_id: '',
      problem_description: '',
      technician_id: '',
      remarks: '',
      status: 'open',
    });
    setMediaUrls({ images: ['', '', ''], video: '' });
    setMediaPreviews({ images: ['', '', ''], video: '' });
    setFilesToUpload([]);
    setMissingParts([{ brand: '', model: '', part_name: '' }]);
    setCurrentStep(1);
    setIsModalOpen(false);
    setIsEditMode(false);
    setEditingComplaint(null);
    setSubmittedComplaint(null);
    setMultiServiceMode(false);
    setServiceQueue([]);
    setUploadError(null);
    setTechnicianPriceOverride('');
    setApplyPriceToService(false);
  };

  const resetFormMinimal = () => {
    setFormData({
      customer_name: '',
      phone: '',
      phone2: '',
      pin_code: '',
      address: '',
      service_id: '',
      problem_description: '',
      technician_id: '',
      remarks: '',
      status: 'open',
    });
    setMissingParts([{ brand: '', model: '', part_name: '' }]);
    setCurrentStep(1);
    setIsEditMode(false);
    setEditingComplaint(null);
    setTechnicianPriceOverride('');
    setApplyPriceToService(false);
  };

  // Export CSV
  const exportToExcel = () => {
    const headers = ['Complaint No', 'Customer', 'Phone', 'Service', 'Technician', 'Status', 'Date'];
    const rows = filteredComplaints.map((c) => [
      c.complaint_no || '',
      c.customer_name || '',
      c.phone || '',
      services.find((s) => String(s.id) === String(c.service_id))?.name || '',
      technicians.find((t) => String(t.id) === String(c.technician_id))?.name || '',
      c.status || '',
      c.created_at ? new Date(c.created_at).toLocaleDateString() : c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '',
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach((row) => {
      csv += row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'complaints.csv';
    a.click();
  };

  // Change complaint status
  const changeComplaintStatus = async (id, newStatus) => {
    try {
      const res = await fetch(`${BASE}/complaints/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Status change failed');
      // update UI
      setComplaints((prev) => prev.map((c) => (String(c.id) === String(id) ? { ...c, status: newStatus } : c)));
    } catch (err) {
      console.error('changeComplaintStatus', err);
      alert('Failed to change status');
    }
  };

  // --- Render ---
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Complaints Management</h1>
          <p className="text-gray-600 mt-2">Register and manage customer complaints</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsEditMode(false); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
        >
          <Plus size={20} />
          Register Complaint
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by complaint no, customer name, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button onClick={exportToExcel} className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors">
            <Download size={20} />
            Export Excel
          </button>
        </div>
        {loading && <p className="text-sm text-gray-500 mt-2">Loading...</p>}
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Comp No.</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Customer</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Phone</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Service</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Technician</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Date</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredComplaints.map((complaint) => (
              <tr key={complaint.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{complaint.complaint_no}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{complaint.customer_name}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{complaint.phone}</td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {services.find((s) => String(s.id) === String(complaint.service_id))?.name || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {technicians.find((t) => String(t.id) === String(complaint.technician_id))?.name || '-'}
                </td>
                <td className="px-6 py-4">
                  <select
                    value={complaint.status || 'open'}
                    onChange={(e) => changeComplaintStatus(complaint.id || complaint._id || complaint.id, e.target.value)}
                    className="px-2 py-1 border rounded"
                  >
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="pending_parts">Pending Parts</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {complaint.created_at ? new Date(complaint.created_at).toLocaleDateString() : complaint.createdAt ? new Date(complaint.createdAt).toLocaleDateString() : '-'}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEdit(complaint)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => sendWhatsAppMessage(complaint)} title="Send WhatsApp message" className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                      <MessageCircle size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredComplaints.length === 0 && <div className="text-center py-12 text-gray-500">No complaints found</div>}
      </div>

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={resetForm} title={isEditMode ? 'Edit Complaint' : 'Register New Complaint'} size="xl">
        {/* Overlay shown only when uploading */}
        {uploading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.8)',
              zIndex: 60,
              borderRadius: 8,
            }}
          >
            <div className="flex flex-col items-center gap-3">
              <Spinner size={48} />
              <div className="text-lg font-medium text-gray-800">Uploading media...</div>
              <div className="text-sm text-gray-600">This may take a few seconds depending on file size and connection.</div>
            </div>
          </div>
        )}

        {!isEditMode ? (
          // Create flow (2 steps) — identical to your existing UI
          <div>
            <div className="flex mb-6 border-b">
              <button className={`flex-1 pb-3 ${currentStep === 1 ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
                Step 1: Customer Info
              </button>
              <button className={`flex-1 pb-3 ${currentStep === 2 ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
                Step 2: Complaint Details
              </button>
            </div>

            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone 2</label>
                    <input
                      type="tel"
                      value={formData.phone2}
                      onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pin Code</label>
                  <input
                    type="text"
                    value={formData.pin_code}
                    onChange={(e) => setFormData({ ...formData, pin_code: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address *</label>
                  <textarea
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <button onClick={handleStep1Submit} className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  Next Step
                </button>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="multiServiceMode"
                    checked={multiServiceMode}
                    onChange={(e) => setMultiServiceMode(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="multiServiceMode" className="text-sm font-medium text-gray-700">
                    Multi-Service Booking (Register multiple services one by one)
                  </label>
                </div>

                {!multiServiceMode ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Service *</label>
                    <select
                      required
                      value={formData.service_id}
                      onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a service</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Services *</label>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-4 border border-gray-300 rounded-lg">
                      {services.map((service) => (
                        <label key={service.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={serviceQueue.includes(service.id)}
                            onChange={() => toggleServiceInQueue(service.id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{service.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Problem Description</label>
                  <textarea
                    value={formData.problem_description}
                    onChange={(e) => setFormData({ ...formData, problem_description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assign Technician *</label>
                  <select
                    required
                    value={formData.technician_id}
                    onChange={(e) => setFormData({ ...formData, technician_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a technician</option>
                    {technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                  <textarea
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button onClick={() => setCurrentStep(1)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium">
                    Back
                  </button>
                  <button onClick={handleStep2Submit} disabled={uploading} className={`flex-1 ${uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white py-3 rounded-lg transition-colors font-medium`}>
                    {uploading ? 'Uploading...' : 'Submit Complaint'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Edit flow (4 steps)
          <div className="relative">
            <div className="flex mb-6 border-b">
              <button className={`flex-1 pb-3 text-sm ${currentStep === 1 ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`} onClick={() => setCurrentStep(1)}>
                Basic Info
              </button>
              <button className={`flex-1 pb-3 text-sm ${currentStep === 2 ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`} onClick={() => setCurrentStep(2)}>
                Complaint Details
              </button>
              <button className={`flex-1 pb-3 text-sm ${currentStep === 3 ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`} onClick={() => setCurrentStep(3)}>
                Media Upload
              </button>
              <button className={`flex-1 pb-3 text-sm ${currentStep === 4 ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`} onClick={() => setCurrentStep(4)}>
                Missing Parts
              </button>
            </div>

            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name *</label>
                  <input type="text" required value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                    <input type="tel" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone 2</label>
                    <input type="tel" value={formData.phone2} onChange={(e) => setFormData({ ...formData, phone2: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pin Code</label>
                  <input type="text" value={formData.pin_code} onChange={(e) => setFormData({ ...formData, pin_code: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address *</label>
                  <textarea required value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <button onClick={() => setCurrentStep(2)} className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">Next</button>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Service *</label>
                  <select required value={formData.service_id} onChange={(e) => setFormData({ ...formData, service_id: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="">Select a service</option>
                    {services.map((service) => (<option key={service.id} value={service.id}>{service.name}</option>))}
                  </select>

                  <div className="mt-2 text-sm text-gray-600 flex gap-4">
                    <div>
                      <span className="block text-xs text-gray-500">Base Price</span>
                      <div className="font-medium">{formatCurrency(selectedService?.base_price)}</div>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500">Technician Price</span>
                      <div className="font-medium">{formatCurrency(selectedService?.technician_price)}</div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Problem Description</label>
                  <textarea value={formData.problem_description} onChange={(e) => setFormData({ ...formData, problem_description: e.target.value })} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assign Technician *</label>
                  <select required value={formData.technician_id} onChange={(e) => setFormData({ ...formData, technician_id: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="">Select a technician</option>
                    {technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.name}</option>)}
                  </select>

                  {/* Technician price input + apply checkbox */}
                  <div className="mt-3 grid gap-3">
                    <div>
                      <label className="block text-xs text-gray-500">Technician price (service default)</label>
                      <div className="font-medium">{formatCurrency(selectedService?.technician_price)}</div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500">Technician price (override)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={technicianPriceOverride}
                        onChange={(e) => setTechnicianPriceOverride(e.target.value)}
                        className="mt-1 w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="text-xs text-gray-500 mt-1">Enter price you want to charge this technician for this complaint.</div>
                    </div>

                    
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                  <textarea value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} rows={2} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="pending_parts">Pending Parts</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setCurrentStep(1)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium">Back</button>
                  <button onClick={() => setCurrentStep(3)} className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">Next</button>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload Images / Video</label>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleFilesSelectedLocal}
                    className="mb-3"
                  />
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-sm text-gray-600">Tip: upload images first (max 3). You may also upload one video. Files are uploaded when you submit the form (Create/Update).</div>
                    {uploading && <div className="text-sm text-gray-500">Uploading...</div>}
                    {uploadError && <div className="text-sm text-red-500">{uploadError}</div>}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {mediaPreviews.images.map((img, idx) =>
                      img ? (
                        <div key={idx} className="relative">
                          <img src={img} alt={`img-${idx}`} className="w-full h-24 object-cover rounded" />
                          <button type="button" onClick={() => removeImageAt(idx)} className="absolute top-1 right-1 bg-white p-1 rounded-full shadow">
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div key={idx} className="w-full h-24 bg-gray-50 rounded border flex items-center justify-center text-xs text-gray-400">Empty</div>
                      )
                    )}
                  </div>

                  {mediaPreviews.video && (
                    <div className="mb-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Uploaded Video</label>
                      <div className="relative">
                        <video src={mediaPreviews.video} controls className="w-full h-48 rounded" />
                        <button type="button" onClick={removeVideo} className="absolute top-1 right-1 bg-white p-1 rounded-full shadow">✕</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setCurrentStep(2)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium">
                    Back
                  </button>
                  <button onClick={() => setCurrentStep(4)} className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                    Next
                  </button>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Missing Parts</label>
                  {missingParts.map((part, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Brand"
                        value={part.brand}
                        onChange={(e) => {
                          const newParts = [...missingParts];
                          newParts[idx].brand = e.target.value;
                          setMissingParts(newParts);
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        placeholder="Model"
                        value={part.model}
                        onChange={(e) => {
                          const newParts = [...missingParts];
                          newParts[idx].model = e.target.value;
                          setMissingParts(newParts);
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        placeholder="Part Name"
                        value={part.part_name}
                        onChange={(e) => {
                          const newParts = [...missingParts];
                          newParts[idx].part_name = e.target.value;
                          setMissingParts(newParts);
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  ))}
                  <button onClick={() => setMissingParts([...missingParts, { brand: '', model: '', part_name: '' }])} className="text-blue-600 text-sm hover:underline">+ Add More Parts</button>
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setCurrentStep(3)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium">Back</button>
                  <button onClick={handleUpdateComplaint} disabled={uploading} className={`flex-1 ${uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white py-3 rounded-lg transition-colors font-medium`}>
                    {uploading ? 'Uploading...' : 'Update Complaint'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {submittedComplaint && (
        <Modal isOpen={!!submittedComplaint} onClose={() => setSubmittedComplaint(null)} title="Complaint Registered Successfully">
          <div className="space-y-3">
            <p><strong>Complaint No:</strong> {submittedComplaint.complaint_no}</p>
            <p><strong>Customer:</strong> {submittedComplaint.customer_name}</p>
            <p><strong>Service:</strong> {submittedComplaint.service_name}</p>
            <p><strong>Status:</strong> {submittedComplaint.status}</p>
            <button onClick={() => sendWhatsAppMessage(submittedComplaint)} className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors">
              <MessageCircle size={20} />
              Send WhatsApp Confirmation
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
