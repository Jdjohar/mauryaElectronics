// server/Routes/api.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary');
require('dotenv').config()
const mongoose = require('mongoose');
// Models - adjust filenames if your models differ
const User = require('../models/User');
const Employee = require('../models/Employee');
const Technician = require('../models/Technician');
const Service = require('../models/Service');
const Category = require('../models/Category');
const Product = require('../models/Products');
const PinCode = require('../models/PinCode');
const Complaint = require('../models/Complaint');
const MissingPart = require('../models/MissingPart');
const ComplaintMedia = require('../models/ComplaintMedia');
const TechnicianService = require('../models/TechnicianService');

// Multer setup for handling multipart/form-data
const upload = multer();

// --------- Utilities ----------
function safeParseInt(v, fallback = 0) {
  const n = parseInt(v);
  return Number.isNaN(n) ? fallback : n;
}


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
function pickResourceType(mimetype, explicitType) {
  if (explicitType) return explicitType; // allow override from request
  if (!mimetype) return 'auto';
  if (mimetype.startsWith('video/')) return 'auto'; // upload videos as auto
  if (mimetype.startsWith('image/')) return 'image';
  return 'auto';
}

// helper: upload buffer to cloudinary (unchanged)
async function uploadBufferToCloudinary(buffer, folder = 'complaint_media', resource_type = 'auto') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream({ folder, resource_type }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}


// -----------------------------
// USERS (admin/general users)
// -----------------------------
router.post('/users', async (req, res) => {
  try {
    const payload = req.body;
    const user = new User(payload);
    await user.save();
    res.json({ success: true, user });
  } catch (err) {
    console.error('users:create', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    res.json(u || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// EMPLOYEES
// -----------------------------
router.post('/employees', async (req, res) => {
  try {
    const emp = new Employee(req.body);
    await emp.save();
    res.json({ success: true, employee: emp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/employees', async (req, res) => {
  try {
    const list = await Employee.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/employees/:id', async (req, res) => {
  try {
    const e = await Employee.findById(req.params.id);
    res.json(e || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/employees/:id', async (req, res) => {
  try {
    const upd = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(upd);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/employees/:id', async (req, res) => {
  try {
    await Employee.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// TECHNICIANS
// -----------------------------
router.post('/technicians', async (req, res) => {
  try {
    const tech = new Technician(req.body);
    await tech.save();
    // if provided selectedServices array, insert links
    if (req.body.selectedServices && Array.isArray(req.body.selectedServices) && tech._id) {
      const links = req.body.selectedServices.map((sid) => ({ technician_id: tech._id, service_id: sid }));
      await TechnicianService.insertMany(links);
    }
    res.json({ success: true, technician: tech });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/technicians', async (req, res) => {
  try {
    const techs = await Technician.find().sort({ createdAt: -1 });
    // Optionally populate services if you keep links in TechnicianService
    res.json(techs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/technicians/:id', async (req, res) => {
  try {
    const t = await Technician.findById(req.params.id);
    res.json(t || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/technicians/:id', async (req, res) => {
  try {
    const upd = await Technician.findByIdAndUpdate(req.params.id, req.body, { new: true });
    // update technician_services links if provided
    if (req.body.selectedServices) {
      await TechnicianService.deleteMany({ technician_id: req.params.id });
      const links = req.body.selectedServices.map((sid) => ({ technician_id: req.params.id, service_id: sid }));
      if (links.length) await TechnicianService.insertMany(links);
    }
    res.json(upd);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/technicians/:id', async (req, res) => {
  try {
    await Technician.findByIdAndDelete(req.params.id);
    await TechnicianService.deleteMany({ technician_id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// SERVICES / CATEGORIES / PRODUCTS / PINCODES
// -----------------------------
router.post('/services', async (req, res) => {
  try {
    const s = new Service(req.body);
    await s.save();
    res.json(s);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get('/services', async (req, res) => {
  try {
    const list = await Service.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.put('/services/:id', async (req, res) => {
  try {
    const u = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(u);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.delete('/services/:id', async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const c = new Category(req.body);
    await c.save();
    res.json(c);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get('/categories', async (req, res) => {
  try {
    const list = await Category.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.put('/categories/:id', async (req, res) => {
  try {
    const u = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(u);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.delete('/categories/:id', async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/products', async (req, res) => {
  try {
    const p = new Product(req.body);
    await p.save();
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get('/products', async (req, res) => {
  try {
    const list = await Product.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.put('/products/:id', async (req, res) => {
  try {
    const u = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(u);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.delete('/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/pincodes', async (req, res) => {
  try {
    const p = new PinCode(req.body);
    await p.save();
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get('/pincodes', async (req, res) => {
  try {
    const list = await PinCode.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.put('/pincodes/:id', async (req, res) => {
  try {
    const u = await PinCode.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(u);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.delete('/pincodes/:id', async (req, res) => {
  try {
    await PinCode.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// COMPLAINTS
// - Tracks opened_at, closed_at, time_to_close (ms), and events array
// - Supports multi service registration (queued in frontend), missingParts & media
// -----------------------------
/**
 Complaint doc expected basic structure (adapt to your model):
 {
   complaint_no: String,
   customer_name: String,
   phone: String,
   phone2: String,
   pin_code: String,
   address: String,
   service_id: ObjectId,
   problem_description: String,
   technician_id: ObjectId,
   remarks: String,
   status: String, // open/closed/cancelled/pending_parts
   opened_at: Date,
   closed_at: Date,
   time_to_close: Number (ms),
   events: [{ status, changed_by (userId or name), at: Date, note }]
 }
**/

// Create complaint (single)
// router.post('/complaints', async (req, res) => {
//   try {
//     const payload = { ...req.body };
//     // If not provided, set status and opened_at
//     if (!payload.status) payload.status = 'open';
//     if (!payload.opened_at) payload.opened_at = new Date();

//     const complaint = new Complaint(payload);
//     await complaint.save();

//     // Save missing parts if provided
//     if (req.body.missingParts && Array.isArray(req.body.missingParts)) {
//       const parts = req.body.missingParts
//         .filter((p) => p.brand && p.model && p.part_name)
//         .map((p) => ({ complaint_id: complaint._id, ...p }));
//       if (parts.length) await MissingPart.insertMany(parts);
//     }

//     res.json({ success: true, complaint });
//   } catch (err) {
//     console.error('complaints:create', err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// });

// assume you already use express.json() so req.body is available
// router.post('/complaints', async (req, res) => {
//   try {
//     const payload = req.body;

//     // Map fields expected by your Complaint mongoose model - adapt names if different
//     // e.g. payload.service or payload.service_id depending on your schema
//     const complaintDoc = new Complaint({
//       complaint_no: payload.complaint_no,
//       customer_name: payload.customer_name,
//       phone: payload.phone,
//       phone2: payload.phone2,
//       pin_code: payload.pin_code,
//       address: payload.address,
//       // accept either `service` or `service_id`
//       service: payload.service || payload.service_id,
//       problem_description: payload.problem_description,
//       technician: payload.technician || payload.technician_id,
//       remarks: payload.remarks,
//       status: payload.status || 'open',
//       created_at: payload.created_at || new Date(),
//       // any other fields...
//     });

//     const saved = await complaintDoc.save();

//     // if client passed complaint_media as an array of { media_type, media_url }
//     if (Array.isArray(payload.complaint_media) && payload.complaint_media.length > 0) {
//       const toInsert = payload.complaint_media.map((m) => ({
//         complaint_id: saved._id,
//         media_type: m.media_type || (m.media_url && m.media_url.includes('.mp4') ? 'video' : 'image'),
//         media_url: m.media_url,
//         provider_response: m.provider_response || null,
//       }));
//       // Insert many at once
//       await ComplaintMedia.insertMany(toInsert);
//     }

//     // missing_parts array saved similarly (if you have model MissingPart)
//     if (Array.isArray(payload.missing_parts) && payload.missing_parts.length > 0) {
//       const partsInsert = payload.missing_parts.map((p) => ({
//         complaint_id: saved._id,
//         brand: p.brand || '',
//         model: p.model || '',
//         part_name: p.part_name || '',
//       }));
//       await MissingPart.insertMany(partsInsert);
//     }

//     // Optionally fetch and attach the saved media & parts to return
//     const savedMedia = await ComplaintMedia.find({ complaint_id: saved._id }).lean();
//     const savedParts = await MissingPart.find({ complaint_id: saved._id }).lean();

//     const responsePayload = {
//       ...saved.toObject(),
//       complaint_media: savedMedia,
//       missing_parts: savedParts,
//     };

//     res.status(201).json(responsePayload);
//   } catch (err) {
//     console.error('complaints:create', err);
//     res.status(500).json({ error: err.message || String(err) });
//   }
// });

// Replace existing /complaints POST handler with this (api.js)
// --- create complaint (improved, tolerant to service/service_id and technician/technician_id) ---
router.post('/complaints', async (req, res) => {
  try {
    // Accept both `service_id` or `service`, and both `technician_id` or `technician`
    const {
      complaint_no,
      customer_name,
      phone,
      phone2,
      pin_code,
      address,
      service_id,
      service,
      problem_description,
      technician_id,
      technician,
      remarks,
      status,
      complaint_media, // optional array: [{ media_type, media_url, provider_response }]
      missing_parts,   // optional array
    } = req.body;

    // Normalize
    const theServiceId = service_id || service || null;
    const theTechnicianId = technician_id || technician || null;

    // Validate required fields (adjust messages as you like)
    if (!theServiceId) return res.status(400).json({ error: 'service_id (or service) is required' });
    if (!theTechnicianId) return res.status(400).json({ error: 'technician_id (or technician) is required' });

    // Build complaint document
    const complaintDoc = new Complaint({
      complaint_no: complaint_no || `CMP-${Date.now()}`,
      customer_name,
      phone,
      phone2,
      pin_code,
      address,
      service_id: theServiceId,
      problem_description,
      technician_id: theTechnicianId,
      remarks,
      status: status || 'open',
      created_at: new Date(),
    });

    const saved = await complaintDoc.save();

    // ---- Save complaint_media as separate ComplaintMedia docs (if provided) ----
    // Ensure we save only strings into media_url (not whole objects)
    let savedMedia = [];
    if (Array.isArray(complaint_media) && complaint_media.length > 0) {
      const mediaDocs = complaint_media.map((m) => {
        // m.media_url could be an object (provider result) — coerce to secure_url if present
        let mediaUrl = '';
        if (!m) mediaUrl = '';
        else if (typeof m.media_url === 'string') mediaUrl = m.media_url;
        else if (m.provider_response && (m.provider_response.secure_url || m.provider_response.url)) {
          mediaUrl = m.provider_response.secure_url || m.provider_response.url;
        } else if (m.result && (m.result.secure_url || m.result.url)) {
          mediaUrl = m.result.secure_url || m.result.url;
        } else if (m.secure_url) {
          mediaUrl = m.secure_url;
        } else if (m.url) {
          mediaUrl = m.url;
        }

        return {
          complaint: saved._id, // IMPORTANT: use `complaint` field expected by schema
          media_type: m.media_type || (String(mediaUrl).toLowerCase().includes('.mp4') ? 'video' : 'image'),
          media_url: mediaUrl,
          provider_response: m.provider_response || null,
        };
      }).filter((d) => d.media_url); // only insert ones with a URL

      if (mediaDocs.length > 0) {
        // insertMany returns created docs
        savedMedia = await ComplaintMedia.insertMany(mediaDocs);
      }
    }

    // ---- Save missing parts into MissingPart collection (if provided) ----
    let savedParts = [];
    if (Array.isArray(missing_parts) && missing_parts.length > 0) {
      const partsDocs = missing_parts.map((p) => ({
        complaint: saved._id, // IMPORTANT: use `complaint` (not complaint_id) if your schema expects 'complaint'
        brand: p.brand || '',
        model: p.model || '',
        part_name: p.part_name || '',
      }));
      if (partsDocs.length > 0) {
        savedParts = await MissingPart.insertMany(partsDocs);
      }
    }

    // Return created complaint + related arrays (so frontend can show previews immediately)
    // Optionally populate service/technician if desired
    const populated = await Complaint.findById(saved._id).lean();

    // Return shape similar to your GET /complaints/:id (complaint + media + missingParts)
    const mediaForResponse = savedMedia.length > 0 ? savedMedia : [];
    const partsForResponse = savedParts.length > 0 ? savedParts : [];

    return res.status(201).json({
      complaint: populated || saved,
      media: mediaForResponse,
      missingParts: partsForResponse,
    });
  } catch (err) {
    console.error('complaints:create', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: 'ValidationError', details: err.errors });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});
// Create multiple complaints for multi-service mode
router.post('/complaints/batch', async (req, res) => {
  try {
    const { complaints = [] } = req.body; // array of complaint payloads
    if (!Array.isArray(complaints) || !complaints.length) {
      return res.status(400).json({ error: 'No complaints provided' });
    }
    const created = [];
    for (const p of complaints) {
      const payload = { ...p, opened_at: p.opened_at || new Date(), status: p.status || 'open' };
      const c = new Complaint(payload);
      await c.save();
      created.push(c);
      // missing parts per item
      if (p.missingParts && Array.isArray(p.missingParts)) {
        const parts = p.missingParts.filter((x) => x.brand && x.model && x.part_name).map((x) => ({ complaint_id: c._id, ...x }));
        if (parts.length) await MissingPart.insertMany(parts);
      }
    }
    res.json({ success: true, created });
  } catch (err) {
    console.error('complaints:batch', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/complaints', async (req, res) => {
  try {
    // Support optional query filters like status, technician_id, date range
    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.technician_id) query.technician_id = req.query.technician_id;
    if (req.query.start && req.query.end) {
      query.createdAt = { $gte: new Date(req.query.start), $lte: new Date(req.query.end) };
    }
    const list = await Complaint.find(query).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/complaints/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid complaint id' });
    }

    const c = await Complaint.findById(id).lean().exec();
    if (!c) return res.status(404).json({ error: 'Complaint not found' });

    const parts = await MissingPart.find({ complaint: id }).lean().exec();
    const media = await ComplaintMedia.find({ complaint: id }).lean().exec();

    res.json({ complaint: c, missingParts: parts, media });
  } catch (err) {
    console.error('GET /complaints/:id', err);
    res.status(500).json({ error: err.message });
  }
});

// Update complaint generic (patched)
// router.put('/complaints/:id', async (req, res) => {
//   try {
//     const id = req.params.id;
//     const {
//       service_id,
//       service,
//       technician_id,
//       technician,
//       complaint_media,
//       missing_parts,
//       ...rest
//     } = req.body;

//     const theServiceId = service_id || service;
//     const theTechnicianId = technician_id || technician;

//     const update = { ...rest };
//     if (theServiceId) update.service_id = theServiceId;
//     if (theTechnicianId) update.technician_id = theTechnicianId;

//     // update complaint document
//     const updated = await Complaint.findByIdAndUpdate(id, update, { new: true, runValidators: true });
//     if (!updated) {
//       return res.status(404).json({ error: 'Complaint not found' });
//     }

//     // --- Replace media if complaint_media array provided ---
//     if (Array.isArray(complaint_media)) {
//       // remove existing media for this complaint (use field 'complaint' expected by schema)
//       await ComplaintMedia.deleteMany({ complaint: id });

//       // prepare new media docs; ensure media_url is a string (secure_url or url if object provided)
//       const mediaDocs = complaint_media.map((m) => {
//         // m might be { media_url: '...', media_type: 'image' } OR cloudinary object etc.
//         let mediaUrl = null;
//         if (!m) mediaUrl = null;
//         else if (typeof m.media_url === 'string') mediaUrl = m.media_url;
//         else if (m.provider_response && (m.provider_response.secure_url || m.provider_response.url)) {
//           mediaUrl = m.provider_response.secure_url || m.provider_response.url;
//         } else if (m.result && (m.result.secure_url || m.result.url)) {
//           mediaUrl = m.result.secure_url || m.result.url;
//         } else if (m.secure_url) {
//           mediaUrl = m.secure_url;
//         } else if (m.url) {
//           mediaUrl = m.url;
//         }

//         if (!mediaUrl) return null;

//         return {
//           complaint: id, // IMPORTANT: use 'complaint' field name (match your schema)
//           media_type: m.media_type || (String(mediaUrl).toLowerCase().includes('.mp4') ? 'video' : 'image'),
//           media_url: String(mediaUrl),
//           provider_response: m.provider_response || m.result || null,
//         };
//       }).filter(Boolean);

//       if (mediaDocs.length) {
//         await ComplaintMedia.insertMany(mediaDocs);
//       }
//     }

//     // --- Replace missing parts if provided ---
//     if (Array.isArray(missing_parts)) {
//       await MissingPart.deleteMany({ complaint: id });

//       const partDocs = missing_parts.map((p) => ({
//         complaint: id, // IMPORTANT: use 'complaint' field name
//         brand: p.brand || '',
//         model: p.model || '',
//         part_name: p.part_name || '',
//       })).filter(Boolean);

//       if (partDocs.length) {
//         await MissingPart.insertMany(partDocs);
//       }
//     }

//     // Return updated complaint + related media & parts to keep frontend in sync
//     const [freshComplaint, media, parts] = await Promise.all([
//       Complaint.findById(id).lean(),
//       ComplaintMedia.find({ complaint: id }).lean(),
//       MissingPart.find({ complaint: id }).lean(),
//     ]);

//     return res.json({
//       complaint: freshComplaint,
//       media,
//       missingParts: parts,
//     });
//   } catch (err) {
//     console.error('complaints:update', err);
//     if (err.name === 'ValidationError') {
//       return res.status(400).json({ error: 'ValidationError', details: err.errors });
//     }
//     return res.status(500).json({ error: err.message || 'Internal server error' });
//   }
// });

router.put('/complaints/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid complaint id' });

    const payload = req.body || {};

    // fetch current complaint
    const existing = await Complaint.findById(id).exec();
    if (!existing) return res.status(404).json({ error: 'Complaint not found' });

    // If the client attempts to change technician_price_charged, ensure complaint is open
    if (payload.hasOwnProperty('technician_price_charged') && String(existing.status) !== 'open') {
      return res.status(400).json({ error: 'Cannot change technician price unless complaint is open' });
    }

    // Validate numeric price if provided
    if (payload.hasOwnProperty('technician_price_charged')) {
      const v = payload.technician_price_charged;
      if (v === null || v === '') {
        payload.technician_price_charged = null;
      } else if (isNaN(Number(v)) || Number(v) < 0) {
        return res.status(400).json({ error: 'technician_price_charged must be a non-negative number' });
      } else {
        payload.technician_price_charged = Number(v);
      }
    }

    if (payload.hasOwnProperty('service_base_price_charged')) {
      const v = payload.service_base_price_charged;
      if (v === null || v === '') payload.service_base_price_charged = null;
      else if (isNaN(Number(v)) || Number(v) < 0) return res.status(400).json({ error: 'service_base_price_charged must be non-negative number' });
      else payload.service_base_price_charged = Number(v);
    }

    // Build safe update object: whitelist fields that can be updated via PUT
    const allowedFields = new Set([
      'customer_name', 'phone', 'phone2', 'pin_code', 'address',
      'service_id', 'problem_description', 'technician_id', 'remarks',
      'status', 'missing_parts', 'complaint_media',
      'technician_price_charged', 'service_base_price_charged'
    ]);

    const $set = {};
    for (const k of Object.keys(payload)) {
      if (allowedFields.has(k)) $set[k] = payload[k];
    }

    // run update
    const updated = await Complaint.findByIdAndUpdate(id, { $set }, { new: true, runValidators: true, context: 'query' }).exec();

    if (!updated) return res.status(500).json({ error: 'Failed to update complaint' });

    // Optionally apply the technician_price_charged to the service default if requested
    const applyToService = !!payload.apply_to_service;
    if (applyToService && $set.technician_price_charged != null && $set.service_id) {
      // === AUTH CHECK REQUIRED ===
      // TODO: ensure only authorized users (admins) can update global service price
      // Example:
      // if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

      try {
        await Service.findByIdAndUpdate($set.service_id, { $set: { technician_price: Number($set.technician_price_charged) } }, { runValidators: true }).exec();
      } catch (err) {
        // log error but don't fail complaint update; notifying caller is OK
        console.error('Failed to apply price to service', err);
      }
    }

    
    // return updated complaint
    return res.json({ complaint: updated });
  } catch (err) {
    console.error('PUT /complaints/:id error', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// Change status endpoint - applies lifecycle logic (opened_at, closed_at, time_to_close, events)
router.patch('/complaints/:id/status', async (req, res) => {
  try {
    const { status, changed_by, note } = req.body;
    if (!status) return res.status(400).json({ error: 'status required' });

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    const now = new Date();
    // If setting to open and opened_at missing, set opened_at
    if (status === 'open' && !complaint.opened_at) {
      complaint.opened_at = now;
    }

    // If moving to closed -> set closed_at & compute time_to_close
    if (status === 'closed' && complaint.status !== 'closed') {
      complaint.closed_at = now;
      if (!complaint.opened_at) {
        complaint.opened_at = complaint.createdAt || now;
      }
      complaint.time_to_close = now - complaint.opened_at; // milliseconds
    }

    // If changing away from closed, clear closed_at/time_to_close if you prefer
    if (complaint.status === 'closed' && status !== 'closed') {
      complaint.closed_at = undefined;
      complaint.time_to_close = undefined;
    }

    // Update status and push event
    complaint.status = status;
    complaint.events = complaint.events || [];
    complaint.events.push({
      status,
      changed_by: changed_by || null,
      at: now,
      note: note || '',
    });

    await complaint.save();
    res.json({ success: true, complaint });
  } catch (err) {
    console.error('complaints:status', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete complaint
router.delete('/complaints/:id', async (req, res) => {
  try {
    await Complaint.findByIdAndDelete(req.params.id);
    await MissingPart.deleteMany({ complaint_id: req.params.id });
    await ComplaintMedia.deleteMany({ complaint_id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const folder = req.body.folder || 'complaint_media';
    const result = await uploadBufferToCloudinary(req.file.buffer, folder); // returns { secure_url, ... }

    let saved = null;
    const complaintId = req.body.complaint || req.body.complaint_id || null;

    if (complaintId && !mongoose.Types.ObjectId.isValid(complaintId)) {
      return res.status(400).json({ error: 'Invalid complaint id' });
    }

    if (complaintId) {
      const mediaDoc = new ComplaintMedia({
        complaint: complaintId,
        media_type: req.body.media_type || (req.file.mimetype && req.file.mimetype.startsWith('video/') ? 'video' : 'image'),
        media_url: result.secure_url || result.url,
        meta: { provider_response: result },
      });
      saved = await mediaDoc.save();
    } else {
      // Option A (recommended): reject saving without complaint id
      // return res.status(400).json({ error: 'complaint id required' });

      // Option B: if you truly want orphan media, save but mark meta.orphan = true
      // const mediaDoc = new ComplaintMedia({ complaint: null, media_type: ..., media_url: ..., meta: { orphan: true, provider_response: result }});
      // saved = await mediaDoc.save();
    }

    res.json({ success: true, result, saved });
  } catch (err) {
    console.error('upload', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /upload/base64
 * Expects JSON body: { data: 'data:<mime>;base64,<b64>', complaint or complaint_id, folder, media_type }
 */
router.post('/upload/base64', async (req, res) => {
  try {
    const { data, folder = 'complaint_media' } = req.body;
    if (!data) return res.status(400).json({ error: 'No data provided' });

    const matches = data.match(/^data:(.+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid data format' });

    const mime = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const resource_type = mime.startsWith('video/') ? 'video' : 'image';

    const result = await uploadBufferToCloudinary(buffer, folder, resource_type);
    const url = result.secure_url || result.url;

    let saved = null;
    const complaintId = req.body.complaint || req.body.complaint_id || null;

    if (complaintId && !mongoose.Types.ObjectId.isValid(complaintId)) {
      return res.status(400).json({ error: 'Invalid complaint id' });
    }

    if (complaintId) {
      const mediaDoc = new ComplaintMedia({
        complaint: complaintId,
        media_type: req.body.media_type || (resource_type === 'video' ? 'video' : 'image'),
        media_url: url,
        meta: { provider_response: result },
      });
      saved = await mediaDoc.save();
    } else {
      // same options as above about orphan policy
    }

    res.json({ success: true, url, result, saved });
  } catch (err) {
    console.error('upload:base64', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});
// -----------------------------
// REPORTS / SUMMARY
// Example: GET /api/reports/technicians?start=2023-01-01&end=2023-01-31
// -----------------------------
router.get('/reports/technicians', async (req, res) => {
  try {
    const { start, end, technician_id } = req.query;
    const technicians = await Technician.find().select('id name').lean();
    let complaintQuery = {};
    if (start && end) {
      complaintQuery.createdAt = { $gte: new Date(start), $lte: new Date(end + 'T23:59:59') };
    }
    if (technician_id) complaintQuery.technician_id = technician_id;
    const complaints = await Complaint.find(complaintQuery).lean();

    const reports = technicians.map((tech) => {
      const techComplaints = complaints.filter((c) => String(c.technician_id) === String(tech._id));
      return {
        technician_id: tech._id,
        technician_name: tech.name,
        total_complaints: techComplaints.length,
        open_complaints: techComplaints.filter((c) => c.status === 'open').length,
        closed_complaints: techComplaints.filter((c) => c.status === 'closed').length,
        cancelled_complaints: techComplaints.filter((c) => c.status === 'cancelled').length,
        pending_parts: techComplaints.filter((c) => c.status === 'pending_parts').length,
        avg_time_to_close_ms:
          techComplaints.filter((c) => c.time_to_close).reduce((s, c) => s + (c.time_to_close || 0), 0) /
            Math.max(1, techComplaints.filter((c) => c.time_to_close).length),
      };
    });

    res.json(reports);
  } catch (err) {
    console.error('reports:technicians', err);
    res.status(500).json({ error: err.message });
  }
});

// Export router
module.exports = router;
