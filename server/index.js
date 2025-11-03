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

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const nodemailer = require('nodemailer');
const { job } = require('../cron');
const mongoDB = require('../db');

mongoDB();

const app = express();

// Increase payload limit
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Start cron job
job.start();

// Configure CORS
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://maurya-electronics-mk.vercel.app",
  ],
  methods: "GET, POST, OPTIONS, PUT, DELETE",
  allowedHeaders: "Content-Type, Authorization, Origin, X-Requested-With, Accept",
};
app.use(cors(corsOptions));

// Serve static files (optional, works for uploaded files if needed)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Test route
app.get('/', (req, res) => {
  res.send('Hello from Vercel Express!');
});

// Main routes
app.use('/api', require('../Routes/api'));

// Export the app — Vercel will handle listening
module.exports = app;
