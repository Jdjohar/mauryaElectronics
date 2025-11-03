const express = require('express')
const cors = require('cors')
const app = express()
const port = 3001
const mongoDB = require("./db")
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
var path = require('path');
const { job } = require('./cron');
mongoDB();

// Set maximum payload size limit
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
// app.use(cors())

job.start(); 

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://invoice-al.vercel.app",
  ],
  methods: "GET, POST, OPTIONS, PUT, DELETE",
  allowedHeaders: "Content-Type, Authorization, Origin, X-Requested-With, Accept"
};

app.use(cors(corsOptions));

// app.use((req, res, next) => {
//   const corsWhitelist = [
//     "http://localhost:5173",
//     "https://invoice-al.vercel.app",
// ];
// if (corsWhitelist.indexOf(req.headers.origin) !== -1) {
//     res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
//     res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
//     res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Origin, X-Requested-With, Accept");
// }
//   next();
// });


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.use(express.json())
app.use('/api', require("./Routes/api"));

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
