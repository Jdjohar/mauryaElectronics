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
const nodemailer = require('nodemailer');
const mongoDB = require('../db');
const { job } = require('../cron');

// Create Express app
const app = express();

// Connect to MongoDB (only once)
mongoDB()
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err.message));

// Set maximum payload size limit
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Start cron job (Note: may not persist on Vercel)
try {
  job.start();
  console.log("✅ Cron job started");
} catch (err) {
  console.error("❌ Cron job error:", err.message);
}

// CORS configuration
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://maurya-electronics-mk.vercel.app",
  ],
  methods: "GET, POST, OPTIONS, PUT, DELETE",
  allowedHeaders: "Content-Type, Authorization, Origin, X-Requested-With, Accept"
};
app.use(cors(corsOptions));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Basic test route
app.get('/', (req, res) => {
  res.send('✅ Express API is running on Vercel!');
});

// Main API routes
app.use('/api', require('../Routes/api'));

// ❗ DO NOT use app.listen() — Vercel handles the server
module.exports = app;
