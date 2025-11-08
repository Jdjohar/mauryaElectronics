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
const Counter = require('../models/Counter');
const { body, validationResult } = require('express-validator');
const authRoutes = require('../middleware/auth');
const { verifyToken, requireRole } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
// Multer setup for handling multipart/form-data
const upload = multer();

// --------- Utilities ----------
router.use('/auth', authRoutes);
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_now';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// Basic login rate limiter
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 6,              // allow 6 requests per minute per IP
  message: { error: 'Too many login attempts, please wait a moment.' },
});

// helper: create token payload
function createAccessToken(user) {
  const payload = {
    sub: user._id.toString(),
    role: user.role,
    name: user.name,
    email: user.email,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

router.post('/signup-admin', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: "name, email, phone, password are required" });
    }

    // check if admin already exists
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      return res.status(403).json({
        error: "Admin already exists. Remove this route from your server."
      });
    }

    const newUser = new User({
      name,
      email: email.toLowerCase(),
      phone,
      password,
      role: "admin",
      is_active: true
    });

    await newUser.save();

    return res.status(201).json({
      success: true,
      message: "Admin account created successfully",
      user: newUser.toJSON()
    });

  } catch (err) {
    console.error("signup-admin error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { identifier, email, phone, password } = req.body;
    if (!password || (!identifier && !email && !phone)) {
      return res.status(400).json({ error: 'identifier (email/phone) and password are required' });
    }

    let user = null;
    if (identifier) {
      // try email first then phone
      if (identifier.includes('@')) user = await User.findOne({ email: identifier.toLowerCase() });
      else user = await User.findOne({ phone: identifier });
    } else if (email) {
      user = await User.findOne({ email: email.toLowerCase() });
    } else if (phone) {
      user = await User.findOne({ phone });
    }

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.is_active) return res.status(403).json({ error: 'User is disabled' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = createAccessToken(user);

    // You can decide to return refresh token here as well (not implemented by default)
    return res.json({
      success: true,
      token,
      expiresIn: JWT_EXPIRES_IN,
      user: user.toJSON(), // toJSON removes password per your model
    });
  } catch (err) {
    console.error('auth:login', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


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
async function createUserForEmployee({ email, phone, name, password, role = 'employee' }) {
  // validation already done outside
  const payload = {
    name: name || (email ? email.split('@')[0] : 'Employee'),
    email: email ? String(email).toLowerCase() : '',
    phone: phone || '',
    password: password || Math.random().toString(36).slice(-8), // fallback random pwd (prefer explicit)
    role,
    is_active: true,
  };

  // don't allow duplicate email
  if (payload.email) {
    const exists = await User.findOne({ email: payload.email });
    if (exists) throw new Error('User with this email already exists');
  }

  const user = new User(payload);
  await user.save();

  const safe = user.toObject();
  delete safe.password;
  return safe;
}

/**
 * POST /employees
 * Admin-only: create employee record. Optionally create a User and link (pass createUser=true).
 *
 * Body example:
 * {
 *   "name":"Ramesh",
 *   "phone":"9876543210",
 *   "email":"ramesh@example.com",
 *   "address":"xyz",
 *   "createUser": true,
 *   "userPassword": "secret123" // optional but recommended if createUser true
 * }
 */
router.post(
  '/employees',
  verifyToken,
  requireRole(['admin']),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').optional().isEmail().withMessage('Email invalid'),
    body('phone').optional().isString(),
    body('createUser').optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { name, phone, email, address, createUser, userPassword, meta } = req.body;

      let userRef = null;
      if (createUser) {
        // create linked user (role = employee)
        try {
          const createdUser = await createUserForEmployee({
            email,
            phone,
            name,
            password: userPassword,
            role: 'employee',
          });
          userRef = createdUser._id;
        } catch (err) {
          return res.status(400).json({ error: err.message });
        }
      }

      const emp = new Employee({
        name,
        phone: phone || '',
        email: email ? String(email).toLowerCase() : '',
        address: address || '',
        user_ref: userRef,
        meta: meta || {},
      });

      await emp.save();
      // return populated user_ref if present
      const out = await Employee.findById(emp._id).populate('user_ref', '-password').lean();
      res.json({ success: true, employee: out });
    } catch (err) {
      console.error('employees:create', err);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * GET /employees
 * Admin: list all employees
 * Employee: return only their own employee record (if linked), otherwise empty
 */
router.get('/employees', verifyToken, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const list = await Employee.find().sort({ createdAt: -1 }).populate('user_ref', '-password').lean();
      return res.json(list);
    }

    // For employees, return only the employee record linked to their user account
    if (req.user.role === 'employee') {
      const emp = await Employee.findOne({ user_ref: req.user._id }).populate('user_ref', '-password').lean();
      return res.json(emp ? [emp] : []);
    }

    // other roles (customer etc.) not allowed
    return res.status(403).json({ error: 'Forbidden' });
  } catch (err) {
    console.error('employees:list', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /employees/me
 * return the employee record linked to current logged-in user
 */
router.get('/employees/me', verifyToken, async (req, res) => {
  try {
    // only useful for employees who have user_ref. Admins may not have employee record.
    const emp = await Employee.findOne({ user_ref: req.user._id }).populate('user_ref', '-password').lean();
    if (!emp) return res.status(404).json({ error: 'Employee record not found for this user' });
    res.json(emp);
  } catch (err) {
    console.error('employees:me', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /employees/:id
 * Admin: can fetch any
 * Employee: can fetch only their own record
 */
router.get('/employees/:id', verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const emp = await Employee.findById(id).populate('user_ref', '-password').lean();
    if (!emp) return res.json({}); // keep current behaviour

    if (req.user.role === 'admin') return res.json(emp);

    if (req.user.role === 'employee') {
      // allow only if this employee is linked to current user
      if (String(emp.user_ref?._id) === String(req.user._id)) return res.json(emp);
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.status(403).json({ error: 'Forbidden' });
  } catch (err) {
    console.error('employees:get', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /employees/:id
 * Admin: update any
 * Employee: update their own record (but not user role/password via this endpoint)
 *
 * If admin wants to update linked user fields (email/phone), they should use User routes.
 */
router.put(
  '/employees/:id',
  verifyToken,
  [
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('phone').optional().isString(),
    body('name').optional().notEmpty(),
  ],
  async (req, res) => {
    try {
      const id = req.params.id;
      const emp = await Employee.findById(id);
      if (!emp) return res.status(404).json({ error: 'Employee not found' });

      if (req.user.role === 'admin') {
        // admin may update all fields
      } else if (req.user.role === 'employee') {
        // only allow if this employee linked to current user
        if (String(emp.user_ref ?? '') !== String(req.user._id)) {
          return res.status(403).json({ error: 'Forbidden' });
        }
        // restrict fields employees may update: name, phone, address, meta, is_active? (no)
        const allowed = ['name', 'phone', 'address', 'meta'];
        const payload = {};
        for (const k of allowed) if (req.body[k] !== undefined) payload[k] = req.body[k];
        Object.assign(emp, payload);
        await emp.save();
        const out = await Employee.findById(emp._id).populate('user_ref', '-password').lean();
        return res.json(out);
      } else {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // admin update path
      const updateBody = { ...req.body };
      // protect user_ref updates from accidental overwrite unless admin intended
      if (updateBody.user_ref === undefined) delete updateBody.user_ref;
      const updated = await Employee.findByIdAndUpdate(id, updateBody, { new: true }).populate('user_ref', '-password').lean();
      res.json(updated);
    } catch (err) {
      console.error('employees:update', err);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * DELETE /employees/:id
 * Admin only
 */
router.delete('/employees/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    await Employee.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('employees:delete', err);
    res.status(500).json({ error: err.message });
  }
});





// -----------------------------
// EMPLOYEES
// -----------------------------
// router.post('/employees', async (req, res) => {
//   try {
//     const emp = new Employee(req.body);
//     await emp.save();
//     res.json({ success: true, employee: emp });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// router.get('/employees', async (req, res) => {
//   try {
//     const list = await Employee.find().sort({ createdAt: -1 });
//     res.json(list);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// router.get('/employees/:id', async (req, res) => {
//   try {
//     const e = await Employee.findById(req.params.id);
//     res.json(e || {});
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// router.put('/employees/:id', async (req, res) => {
//   try {
//     const upd = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true });
//     res.json(upd);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// router.delete('/employees/:id', async (req, res) => {
//   try {
//     await Employee.findByIdAndDelete(req.params.id);
//     res.json({ success: true });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

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
// pad helper
function pad(n, len = 2) { return String(n).padStart(len, '0'); }

// format date base YYYYMMDD
function makeDateBase(date = new Date()) {
  const YYYY = date.getFullYear();
  const MM = pad(date.getMonth() + 1, 2);
  const DD = pad(date.getDate(), 2);
  return `${YYYY}${MM}${DD}`;
}

/**
 * Atomically allocate a single sequence for the day and return complaint_no
 * Example: MK-20251107-0001 (padLength default 4)
 */
async function generateComplaintNoPerDay({ date = new Date(), prefix = 'MK', padLength = 4 } = {}) {
  const base = makeDateBase(date);
  const key = `complaint_seq_${base}`;

  const updated = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean().exec();

  const seq = (updated && updated.seq) ? updated.seq : 1;
  const seqStr = padLength > 0 ? String(seq).padStart(padLength, '0') : String(seq);
  return `${prefix}-${base}-${seqStr}`;
}

/**
 * Atomically allocate a contiguous block of sequences for the day.
 * Returns an array of complaint numbers in ascending order.
 * Example output: ['MK-20251107-0001','MK-20251107-0002',...]
 */
async function allocateComplaintNumbersPerDay(count, { date = new Date(), prefix = 'MK', padLength = 4 } = {}) {
  if (!Number.isInteger(count) || count <= 0) throw new Error('count must be positive integer');

  const base = makeDateBase(date);
  const key = `complaint_seq_${base}`;

  const updated = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: count } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean().exec();

  const endSeq = (updated && updated.seq) ? updated.seq : count;
  const startSeq = endSeq - count + 1;

  // debug log (helps trace allocation)
  console.log(`Allocated counter key=${key} start=${startSeq} end=${endSeq}`);

  const arr = [];
  for (let s = startSeq; s <= endSeq; s++) {
    const seqStr = padLength > 0 ? String(s).padStart(padLength, '0') : String(s);
    arr.push(`${prefix}-${base}-${seqStr}`);
  }
  return arr;
}

/**
 * Retry helper for duplicate key errors (E11000)
 */
async function retryOnDuplicateKey(fn, { retries = 3, delayMs = 50 } = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (err && err.code === 11000 && attempt < retries) {
        attempt++;
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
}

// Coerce various shapes of media objects into a single media doc
function normalizeMediaDocs(complaintId, complaint_media = []) {
  if (!Array.isArray(complaint_media)) return [];
  return complaint_media.map((m) => {
    if (!m) return null;
    let mediaUrl = '';
    if (typeof m.media_url === 'string') mediaUrl = m.media_url;
    else if (m.provider_response && (m.provider_response.secure_url || m.provider_response.url)) {
      mediaUrl = m.provider_response.secure_url || m.provider_response.url;
    } else if (m.result && (m.result.secure_url || m.result.url)) {
      mediaUrl = m.result.secure_url || m.result.url;
    } else if (m.secure_url) mediaUrl = m.secure_url;
    else if (m.url) mediaUrl = m.url;
    if (!mediaUrl) return null;
    const guessedType = m.media_type || (String(mediaUrl).toLowerCase().includes('.mp4') ? 'video' : 'image');
    return {
      complaint: complaintId,
      media_type: guessedType,
      media_url: mediaUrl,
      provider_response: m.provider_response || null,
    };
  }).filter(Boolean);
}

// Normalize missing parts list
function normalizePartsDocs(complaintId, missing_parts = []) {
  if (!Array.isArray(missing_parts)) return [];
  return missing_parts.map((p) => ({
    complaint: complaintId,
    brand: p.brand || '',
    model: p.model || '',
    part_name: p.part_name || '',
    qty: p.qty || 1,
  })).filter(x => x.part_name);
}

// ---------- Routes ----------

/**
 * POST /complaints - create single complaint
 */
router.post('/complaints', verifyToken, requireRole(['admin','employee']), async (req, res) => {
  try {
    const {
      complaint_no,
      customer_name,
      phone,
      phone2,
      pin_code,
      address,
      service_id,
      service,
      complaint_type,
      problem_description,
      technician_id,
      technician,
      remarks,
      status,
      complaint_media,
      missing_parts,
    } = req.body;

    const theServiceId = service_id || service || null;
    const theTechnicianId = technician_id || technician || null;

    if (!theServiceId) return res.status(400).json({ error: 'service_id (or service) is required' });
    if (!theTechnicianId) return res.status(400).json({ error: 'technician_id (or technician) is required' });
    if (!customer_name) return res.status(400).json({ error: 'customer_name is required' });
    if (!phone) return res.status(400).json({ error: 'phone is required' });
    if (!address) return res.status(400).json({ error: 'address is required' });

    // generate complaint number if not provided
    const complaintNo = complaint_no || await generateComplaintNoPerDay({ prefix: 'MK', padLength: 4 });

    const complaintDoc = new Complaint({
      complaint_no: complaintNo,
      customer_name,
      phone,
      phone2: phone2 || '',
      pin_code: pin_code || '',
      address,
      service_id: theServiceId,
      complaint_type: complaint_type,
      problem_description: problem_description || '',
      technician_id: theTechnicianId,
      remarks: remarks || '',
      status: status || 'open',
      created_by: req.user ? req.user._id : null,
      created_at: new Date(),
    });

    // save with retry on duplicate key (safe guard)
    const saved = await retryOnDuplicateKey(() => complaintDoc.save());
    // insert media and parts (parallel is fine here because complaint exists)
    let savedMedia = [];
    let savedParts = [];

    const mediaDocs = normalizeMediaDocs(saved._id, complaint_media);
    if (mediaDocs.length) savedMedia = await ComplaintMedia.insertMany(mediaDocs);

    const partDocs = normalizePartsDocs(saved._id, missing_parts);
    if (partDocs.length) savedParts = await MissingPart.insertMany(partDocs);

    const populated = await Complaint.findById(saved._id).lean();
    return res.status(201).json({ complaint: populated || saved, media: savedMedia, missingParts: savedParts });
  } catch (err) {
    console.error('complaints:create', err);
    if (err && err.code === 11000 && err.keyPattern && err.keyPattern.complaint_no) {
      return res.status(409).json({ error: 'Duplicate complaint_no (retry)' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: 'ValidationError', details: err.errors });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});


router.post('/complaints/batch', async (req, res) => {
  try {
    const { complaints = [] } = req.body;
    if (!Array.isArray(complaints) || complaints.length === 0) {
      return res.status(400).json({ error: 'No complaints provided' });
    }

    // Validate items but keep original order. We build an array of { valid, payload | error }
    const items = complaints.map(p => {
      const theServiceId = p.service_id || p.service || null;
      const theTechnicianId = p.technician_id || p.technician || null;
      if (!theServiceId || !theTechnicianId || !p.customer_name || !p.phone || !p.address) {
        return { valid: false, error: 'validation_failed', payload: p };
      }
      return { valid: true, payload: { ...p, service_id: theServiceId, technician_id: theTechnicianId } };
    });

    const validCount = items.filter(i => i.valid).length;
    if (validCount === 0) {
      return res.status(400).json({ error: 'No valid complaints to create', details: items });
    }

    // Atomically allocate a block of numbers for valid items
    const padLength = 4; // zero-pad to 4: 0001, 0002...
    const numbers = await allocateComplaintNumbersPerDay(validCount, { prefix: 'MK', padLength });

    // Save sequentially so assigned numbers and created_at have the same order
    const created = [];
    let seqIndex = 0;

    for (const item of items) {
      if (!item.valid) {
        created.push({ error: item.error, payload: item.payload });
        continue;
      }

      const p = item.payload;
      const complaint_no = p.complaint_no || numbers[seqIndex++];

      const payload = {
        complaint_no,
        customer_name: p.customer_name,
        phone: p.phone,
        phone2: p.phone2 || '',
        pin_code: p.pin_code || '',
        address: p.address,
        service_id: p.service_id,
        problem_description: p.problem_description || '',
        technician_id: p.technician_id,
        remarks: p.remarks || '',
        status: p.status || 'open',
        opened_at: p.opened_at || new Date(),
        created_by: p.created_by || (req.user ? req.user._id : null),
        created_at: new Date(),
        meta: p.meta || {},
      };

      const c = new Complaint(payload);

      // Save sequentially and retry on duplicate key (defensive)
      const savedComplaint = await retryOnDuplicateKey(() => c.save());
      created.push({ success: true, complaint: savedComplaint });

      // Insert missing parts (await to ensure related docs are saved)
      if (p.missingParts && Array.isArray(p.missingParts) && p.missingParts.length > 0) {
        const parts = p.missingParts
          .filter(x => x.part_name)
          .map(x => ({ complaint: savedComplaint._id, brand: x.brand || '', model: x.model || '', part_name: x.part_name, qty: x.qty || 1 }));
        if (parts.length) {
          try { await MissingPart.insertMany(parts); } catch (errParts) { console.error('missing parts insert failed', errParts); }
        }
      }

      // Insert media
      if (p.complaint_media && Array.isArray(p.complaint_media) && p.complaint_media.length > 0) {
        const mediaDocs = normalizeMediaDocs(savedComplaint._id, p.complaint_media);
        if (mediaDocs.length) {
          try { await ComplaintMedia.insertMany(mediaDocs); } catch (errMedia) { console.error('media insert failed', errMedia); }
        }
      }
    }

    return res.status(201).json({ success: true, created });
  } catch (err) {
    console.error('complaints:batch', err);
    if (err && err.code === 11000 && err.keyPattern && err.keyPattern.complaint_no) {
      return res.status(409).json({ error: 'Duplicate complaint_no (retry)' });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
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
      'service_id', 'problem_description', 'technician_id','complaint_type', 'remarks',
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
