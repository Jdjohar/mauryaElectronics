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
//     "https://invoice-al.vercel.app",
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

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

// Safe import of local modules
let mongoDB, job;
try {
  mongoDB = require("../db");
  job = require("../cron").job;
} catch (err) {
  console.error("Local module error:", err.message);
}

const app = express();

// Only connect to MongoDB once (important for serverless)
if (mongoDB) {
  mongoDB().catch(err => console.error("MongoDB connection failed:", err));
}

// Run cron safely (Vercel may freeze functions, so this might not persist)
if (job && !job.running) {
  try {
    job.start();
  } catch (err) {
    console.error("Cron job error:", err.message);
  }
}

// Middleware
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

// CORS setup
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://maurya-electronics-mk.vercel.app",
    ],
    methods: "GET,POST,PUT,DELETE,OPTIONS",
    allowedHeaders: "Content-Type,Authorization,Origin,X-Requested-With,Accept",
  })
);

// Serve static files (if any)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Health check
app.get("/", (req, res) => {
  res.status(200).send("✅ Express API is running on Vercel!");
});

// Import routes safely
try {
  const apiRoutes = require("../Routes/api");
  app.use("/api", apiRoutes);
} catch (err) {
  console.error("Error loading routes:", err.message);
  app.get("/api", (req, res) =>
    res.status(500).send("API routes not loaded.")
  );
}

// ✅ Must export the app for Vercel — no app.listen()
module.exports = app;
