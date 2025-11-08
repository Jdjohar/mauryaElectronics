// const express = require('express')
// const cors = require('cors')
// const app = express()
// const port = 3001
// const mongoDB = require("./db")
// const nodemailer = require('nodemailer');
// const bodyParser = require('body-parser');
// var path = require('path');
// const { job } = require('./cron');
// mongoDB();

// // Set maximum payload size limit
// app.use(bodyParser.json({ limit: '10mb' }));
// app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
// // app.use(cors())

// job.start(); 

// const corsOptions = {
//   origin: [
//     "http://localhost:5173",
//     "https://maurya-electronics-mk.vercel.app",
//   ],
//   methods: "GET, POST, OPTIONS, PUT, DELETE",
//   allowedHeaders: "Content-Type, Authorization, Origin, X-Requested-With, Accept"
// };

// app.use(cors(corsOptions));

// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// app.get('/', (req, res) => {
//   res.send('Hello World!')
// })

// app.use(express.json())
// app.use('/api', require("./Routes/api"));

// app.listen(port, () => {
//   console.log(`Example app listening on port ${port}`)
// })

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// --- Safe imports (won’t crash function) ---
let mongoDB, job;
try {
  mongoDB = require('./db');
} catch (err) {
  console.error("⚠️ db.js not found or failed to load:", err.message);
}

try {
  job = require('./cron')?.job;
} catch (err) {
  console.error("⚠️ cron.js not found or failed to load:", err.message);
}

let apiRoutes;
try {
  apiRoutes = require('./Routes/api');
} catch (err) {
  console.error("⚠️ Routes/api.js not found or failed to load:", err.message);
}

// --- Middleware setup ---
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://maurya-electronics-mk.vercel.app",
    ],
    methods: "GET,POST,OPTIONS,PUT,DELETE",
    allowedHeaders: "Content-Type,Authorization,Origin,X-Requested-With,Accept",
  })
);

// --- Connect MongoDB safely ---
if (mongoDB) {
  mongoDB()
    .then(() => console.log("✅ MongoDB connected"))
    .catch(err => console.error("❌ MongoDB connection error:", err.message));
}

// --- Start cron safely (optional) ---
if (job && typeof job.start === 'function') {
  try {
    job.start();
    console.log("✅ Cron job started");
  } catch (err) {
    console.error("⚠️ Cron job error:", err.message);
  }
}

// --- Static files ---
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- Routes ---
app.get('/', (req, res) => {
  res.send('✅ Express API is running on Vercel!');
});

if (apiRoutes) {
  app.use('/api', apiRoutes);
} else {
  app.get('/api', (req, res) => res.status(500).send('⚠️ API routes failed to load.'));
}

// --- Export app (no app.listen) ---
module.exports = app;
