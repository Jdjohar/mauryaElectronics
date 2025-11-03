const express = require('express');
const router = express.Router();
const momentTimezone = require('moment-timezone');
const moment = require('moment');
const User = require('../models/User');
const Restaurant = require('../models/Restaurent')
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const jwrsecret = "MYNameisJashandeepSInghjoharmukts"
const bcrypt = require("bcryptjs");
const Category = require('../models/Category')
const Subcategory = require('../models/Subcategory')
const Itemlist = require('../models/Itemlist')
const Menu = require('../models/Menu')
const WeeklyOffers = require('../models/WeeklyOffers')
const Offers = require('../models/Offers');
const UserPreference = require('../models/UserPreference');
const Timeschema = require('../models/Timeschema');
const Team = require('../models/Team');
const Customerlist = require('../models/Customerlist');
const Invoice = require('../models/Invoice');
const Estimate = require('../models/Estimate');
const Transactions = require('../models/Transactions');
const Deposit = require('../models/Deposit');
const Signature = require('../models/Signature')
const Ownwesignature = require('../models/Ownwesignature')
const CustomerSignatureSchema = require('../models/CustomerSignature')
const Vendor = require('../models/Vendor')
const ExpenseType = require('../models/ExpenseType')
const Expense = require('../models/Expense')
const crypto = require('crypto');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const archiver = require('archiver');
const fs = require('fs');


const dbName = 'grithomes';



const getCurrencySign = (currencyType) => {
    switch (currencyType) {
        case 'AUD':
            return '$';
        case 'CAD':
            return 'C$';
        case 'INR':
        default:
            return '₹';
    }
};

router.get('/backup', (req, res) => {
    console.log("StartBackup");
    
    const dumpDir = path.join(__dirname, 'dump');
    const archivePath = path.join(__dirname, `${dbName}-backup.zip`);

    // Step 1: Run mongodump
    exec(`mongodump --db=${dbName} --out=${dumpDir}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Backup error: ${stderr}`);
            return res.status(500).send('Error creating backup');
        }

        // Step 2: Zip the dump folder
        const output = fs.createWriteStream(archivePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            // Step 3: Send the ZIP file
            res.download(archivePath, err => {
                if (err) console.error(err);

                // Optional cleanup
                fs.rmSync(dumpDir, { recursive: true, force: true });
                fs.unlinkSync(archivePath);
            });
        });

        archive.on('error', err => {
            throw err;
        });

        archive.pipe(output);
        archive.directory(dumpDir, false);
        archive.finalize();
    });
});


router.get('/check-signature/:ownerId', (req, res) => {
    const ownerId = req.params.ownerId;

    Ownwesignature.findOne({ ownerId })
        .then(signature => {
            if (signature) {
                res.json({ hasSignature: true, signatureData: signature.data });
            } else {
                res.json({ hasSignature: false });
            }
        })
        .catch(err => res.json({ hasSignature: false }));
});


router.get('/getallesigncustomerdata', async (req, res) => {
    try {
        // Fetch all customer data
        let userid = req.params.userid;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        const allCustomerData = await CustomerSignatureSchema.find();

        if (allCustomerData.length === 0) {
            return res.status(404).json({ message: 'No customer data found' });
        }

        res.json(allCustomerData);
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.get('/searchinvoices/:userid', async (req, res) => {
    try {
      const userid = req.params.userid;
      const authtoken = req.headers.authorization;
      const search = req.query.search || '';
      const status = req.query.status;
  
      // Verify JWT token
      const decodedToken = jwt.verify(authtoken, jwrsecret);
  
      let query = {
        userid,
        $or: [
          { customername: { $regex: search, $options: 'i' } },
          { job: { $regex: search, $options: 'i' } }
        ]
      };
  
      if (status && status !== 'All') {
        query.status = status;
      }
  
      const invoices = await Invoice.find(query).sort({ createdAt: -1 });
  
      res.json({ invoices });
    } catch (error) {
      console.error('Search error:', error);
      if (error.name === 'JsonWebTokenErrord') {
        return res.status(401).json({ message: 'Unauthorized: Invalid token' });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

// Get all invoices grouped by financial year for a user
router.get('/all-invoices-by-financial-year', async (req, res) => {
    try {
        let authtoken = req.headers.authorization;
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        
        const { userid } = req.query;
        
        if (!userid) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        // Aggregation pipeline to group all invoices by financial year
        const invoicesByYear = await Invoice.aggregate([
            {
                $match: { userid: userid }  // Filter by user
            },
            {
                $addFields: {
                    financialYear: {
                        $cond: {
                            if: { $gte: [{ $month: "$date" }, 4] },  // Assuming FY starts April 1st
                            then: { 
                                $concat: [
                                    { $toString: { $year: "$date" } },
                                    "-",
                                    { $toString: { $add: [{ $year: "$date" }, 3] } }
                                ]
                            },
                            else: { 
                                $concat: [
                                    { $toString: { $subtract: [{ $year: "$date" }, 3] } },
                                    "-",
                                    { $toString: { $year: "$date" } }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: "$financialYear",
                    invoices: { 
                        $push: {
                            _id: "$_id",
                            invoice_id: "$invoice_id",
                            InvoiceNumber: "$InvoiceNumber",
                            customername: "$customername",
                            job: "$job",
                            customeremail: "$customeremail",
                            emailsent: "$emailsent",
                            date: "$date",
                            duedate: "$duedate",
                            items: "$items",
                            subtotal: "$subtotal",
                            total: "$total",
                            amountdue: "$amountdue",
                            discountTotal: "$discountTotal",
                            information: "$information",
                            tax: "$tax",
                            taxpercentage: "$taxpercentage",
                            status: "$status",
                            isAddSignature: "$isAddSignature",
                            isCustomerSign: "$isCustomerSign",
                            createdAt: "$createdAt"
                        }
                    },
                    totalAmount: { $sum: "$total" },
                    invoiceCount: { $sum: 1 },
                    totalDue: { $sum: "$amountdue" },
                    totalTax: { $sum: { $toDouble: "$tax" } }
                }
            },
            {
                $sort: { "_id": -1 }  // Sort by financial year descending
            },
            {
                $project: {
                    financialYear: "$_id",
                    invoices: 1,
                    totalAmount: 1,
                    invoiceCount: 1,
                    totalDue: 1,
                    totalTax: 1
                }
            }
        ]);

        // If no invoices found, return empty array
        if (!invoicesByYear.length) {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'No invoices found for this user'
            });
        }

        res.status(200).json({
            success: true,
            data: invoicesByYear,
            message: 'All invoices retrieved successfully'
        });

    } catch (error) {
        console.error(error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false,
                message: 'Unauthorized: Invalid token' 
            });
        }
        res.status(500).json({ 
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});
router.get('/getesigncustomerdata/:userid', async (req, res) => {
    try {
        const { userid } = req.params;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        const customeremailData = await CustomerSignatureSchema.find({ "userid": userid }); // Assuming you have an `Owner` model

        if (!customeremailData) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        res.status(200).json(customeremailData);
    } catch (error) {
        console.error(error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/checkcustomersignature/:estimateIds', (req, res) => {
    const { estimateIds } = req.params;
    CustomerSignatureSchema.findOne({ estimateId: estimateIds })
        .then(signature => {
            if (signature) {
                res.status(200).json({ hasSignature: true, signatureData: signature });
            } else {
                res.status(200).json({ hasSignature: false });
            }
        })
        .catch(err => res.status(200).json({ hasSignature: false }));
});

router.get('/checkcustomersignatureusinginvoice/:invoiceIds', (req, res) => {
    const { invoiceIds } = req.params;
    CustomerSignatureSchema.findOne({ invoiceId: invoiceIds })
        .then(signature => {
            if (signature) {
                res.status(200).json({ hasSignature: true, signatureData: signature });
            } else {
                res.status(200).json({ hasSignature: false });
            }
        })
        .catch(err => res.status(200).json({ hasSignature: false }));
});


router.put('/updatecustomersigninv/:invoiceId', async (req, res) => {
    const { invoiceId } = req.params;
    const { customersign, customerName, documentNumber, status, lastupdated, completeButtonVisible } = req.body;

    try {
        const customerSignature = await CustomerSignatureSchema.findOneAndUpdate(
            { invoiceId: invoiceId },
            {
                customersign,
                invoiceId,
                customerName,
                documentNumber,
                status,
                lastupdated,
                completeButtonVisible
            },
            { new: true }
        );

        if (customerSignature) {
            res.status(200).json({ message: 'Customer signature updated successfully', customerSignature });
        } else {
            res.status(404).json({ message: 'Customer signature not found' });
        }
    } catch (error) {
        console.error('Error updating customer signature:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/ownersignature', (req, res) => {
    const { signature, ownerId, email, companyname } = req.body;

    const newSignature = new Ownwesignature({
        ownerId,
        email,
        companyname,
        data: signature,
    });

    newSignature.save()
        .then(signature => res.json({ message: 'Signature saved successfully', id: signature._id }))
        .catch(err => res.status(500).send('Error saving signature'));
});

// Route for updating an existing signature
router.put('/update-ownersignature', async (req, res) => {
    const { signature, ownerId, email, companyname } = req.body;

    // console.log('Update Request Data:', { signature, ownerId, email, companyname });

    try {
        const updatedSignature = await Ownwesignature.findOneAndUpdate(
            { ownerId },
            { data: signature, email, companyname },
            { new: true }
        );

        // console.log('Updated Signature:', updatedSignature);

        if (updatedSignature) {
            res.json({ message: 'Signature updated successfully', signature: updatedSignature });
        } else {
            res.status(404).json({ message: 'Signature not found for this ownerId' });
        }
    } catch (err) {
        console.error('Error updating signature:', err);
        res.status(500).send('Error updating signature');
    }
});

router.post('/customersignature', (req, res) => {
    const { customersign, invoiceId, estimateId, userid, customerName, customerEmail, documentNumber, lastupdated, completeButtonVisible } = req.body;

    if (!estimateId && !invoiceId) {
        return res.status(400).json({ message: 'Either Estimate ID or Invoice ID must be provided' });
    }

    const newSignature = new CustomerSignatureSchema({
        invoiceId,
        estimateId,
        customerName,
        customerEmail,
        userid,
        customersign,
        documentNumber,
        lastupdated,
        completeButtonVisible
    });

    newSignature.save()
        .then(signature => res.json({ message: 'Signature saved successfully', id: signature._id }))
        .catch(err => res.status(500).send('Error saving signature'));
});

// Add this route to update customer signature
router.put('/updatecustomersignature/:estimateId', async (req, res) => {
    const { estimateId } = req.params;
    const { customersign, customerName, documentNumber, status, lastupdated, completeButtonVisible } = req.body;

    try {
        const customerSignature = await CustomerSignatureSchema.findOneAndUpdate(
            { estimateId: estimateId },
            {
                customersign,
                estimateId,
                customerName,
                documentNumber,
                status,
                lastupdated,
                completeButtonVisible
            },
            { new: true }
        );

        if (customerSignature) {
            res.status(200).json({ message: 'Customer signature updated successfully', customerSignature });
        } else {
            res.status(404).json({ message: 'Customer signature not found' });
        }
    } catch (error) {
        console.error('Error updating customer signature:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.delete('/customersignature/:email', async (req, res) => {
    const { email } = req.params;

    try {
        const customerSignature = await CustomerSignatureSchema.findOneAndDelete({ customerEmail: email });

        if (customerSignature) {
            res.status(200).json({ message: 'Customer signature deleted successfully', customerSignature });
        } else {
            res.status(404).json({ message: 'Customer signature not found' });
        }
    } catch (error) {
        console.error('Error deleting customer signature:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// Backend route to fetch owner data by ownerId
router.get('/getownerdata/:ownerId', async (req, res) => {
    try {
        const ownerId = req.params.ownerId;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        // Fetch owner data from the database
        const ownerData = await Ownwesignature.find({ "ownerId": ownerId }); // Assuming you have an `Owner` model

        if (!ownerData) {
            return res.status(404).json({ message: 'Owner not found' });
        }

        res.json(ownerData);
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/getemailownerdata/:ownerId', async (req, res) => {
    try {
        const ownerId = req.params.ownerId;
        // let authtoken = req.headers.authorization;

        // Verify JWT token
        // const decodedToken = jwt.verify(authtoken, jwrsecret);
        // console.log(decodedToken);

        // Fetch owner data from the database
        const ownerData = await Ownwesignature.find({ "ownerId": ownerId }); // Assuming you have an `Owner` model

        if (!ownerData) {
            return res.status(404).json({ message: 'Owner not found' });
        }

        res.json(ownerData);
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        // if (error.name === 'JsonWebTokenError') {
        //     return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        // }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get signature route
router.get('/ownersignature/:id', (req, res) => {
    Ownwesignature.findById(req.params.id)
        .then(signature => {
            if (signature) {
                res.json({ data: signature.data });
            } else {
                res.status(404).send('Signature not found');
            }
        })
        .catch(err => res.status(500).send('Error retrieving signature'));
});

router.get('/getemailestimatedata/:estimateid', async (req, res) => {
    try {
        const estimateid = req.params.estimateid;
        const estimatedetail = await Estimate.findById(estimateid);

        res.json(estimatedetail);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/getemailinvoicedata/:invoiceid', async (req, res) => {
    try {
        const invoiceid = req.params.invoiceid;
        const invoicedetail = await Invoice.findById(invoiceid);

        res.json(invoicedetail);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/getemailsignupdata/:userid', async (req, res) => {
    try {
        const userid = req.params.userid;
        const signupdetail = await User.findById(userid);
        res.json(signupdetail);
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Transactions API
router.get('/allTransactions', async (req, res) => {
    try {
        // Fetch all transactions from the Transactions collection
        const allTransactions = await Transactions.find();

        // Check if any transactions are found
        if (allTransactions && allTransactions.length > 0) {
            // Respond with JSON containing all transactions
            res.json({ transactions: allTransactions });
        } else {
            // If no transactions found, respond with 404 status and a message
            res.status(404).json({ message: 'No transactions found' });
        }
    } catch (error) {
        // If an error occurs during the database operation, log it and respond with a 500 status
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/deltransaction/:transactionid', async (req, res) => {
    try {
        const transactionid = req.params.transactionid;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        const result = await Transactions.findByIdAndDelete(transactionid);

        if (result) {
            res.json({
                Success: true,
                message: "teammember deleted successfully"
            });
        } else {
            res.status(404).json({
                Success: false,
                message: "teammember not found"
            });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});


router.get('/currentMonthReceivedAmount/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const startOfMonth = moment().startOf('month');
        const endOfMonth = moment().endOf('month');

        // Parse and format the dates using moment
        const formattedStartDate = moment(startOfMonth).format('YYYY-MM-DD');
        const formattedEndDate = moment(endOfMonth).format('YYYY-MM-DD');

        // Aggregate total amount from Invoices for the current month
        const invoiceResult = await Invoice.aggregate([
            {
                $match: {
                    userid: userId,
                    date: {
                        $gte: new Date(formattedStartDate),
                        $lte: new Date(formattedEndDate)
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    curMonTotalAmount: { $sum: "$total" }
                }
            }
        ]);

        const allTransactions = await Transactions.find({
            userid: userId,
            paiddate: {
                $gte: formattedStartDate,
                $lte: formattedEndDate
            }
        });

        // Calculate the total paid amount
        const totalPaidAmount = allTransactions.reduce(
            (total, transaction) => total + parseFloat(transaction.paidamount),
            0
        );

        // Calculate the unpaid amount
        const curMonTotalAmount = invoiceResult.length > 0 ? invoiceResult[0].curMonTotalAmount : 0;
        const curMonUnpaidAmount = curMonTotalAmount - totalPaidAmount;

        res.json({
            curMonTotalAmount,
            curMonPaidAmount: totalPaidAmount,
            curMonUnpaidAmount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/totalPaymentReceived/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        // Fetch transactions for the user
        const transactions = await Transactions.find({ userid: userId });

        // Fetch invoices for the user
        const invoices = await Invoice.find({ userid: userId });

        // Calculate total payment received from transactions
        const totalPaymentReceivedFromTransactions = transactions.reduce(
            (total, transaction) => total + parseFloat(transaction.paidamount),
            0
        );

        // Calculate total invoice amount
        const totalInvoiceAmount = invoices.reduce(
            (total, invoice) => total + parseFloat(invoice.total),
            0
        );

        // Calculate unpaid amount
        const totalUnpaidAmount = totalInvoiceAmount - totalPaymentReceivedFromTransactions;

        res.json({
            totalPaymentReceived: totalPaymentReceivedFromTransactions,
            totalInvoiceAmount,
            totalUnpaidAmount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/overdueInvoices/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const currentDate = new Date();

        const overdueInvoices = await Invoice.find({
            userid: userId,
            duedate: { $lt: currentDate },
            status: 'Saved'
        });

        const overdueCount = overdueInvoices.length;

        res.json({ overdueCount, overdueInvoices });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/currentMonthReceivedAmount2/:userid', async (req, res) => {
    try {
        const userid = req.params.userid;
        const { startOfMonth, endOfMonth } = req.query;

        const formattedStartDate = moment(startOfMonth).format('YYYY-MM-DD');
        const formattedEndDate = moment(endOfMonth).format('YYYY-MM-DD');

        const result = await Transactions.aggregate([
            {
                $match: {
                    userid: userid,
                    paiddate: {
                        $gte: formattedStartDate,
                        $lte: formattedEndDate
                    }
                }
            },
            {
                $group: {
                    _id: "$paiddate",
                    totalReceivedAmount: { $sum: "$paidamount" }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/send-invoice-email', async (req, res) => {
    const {
        to,
        bcc,
        content,
        companyName,
        pdfAttachment,
        customdate,
        duedate,
        InvoiceNumber,
        invoiceId,
        ownerId,
        amountdue,
        currencyType,
        amountdue1
    } = req.body;
    // const transporter = nodemailer.createTransport({
    //     host: 'smtp.hostinger.com', // Replace with your hosting provider's SMTP server
    //     port: 465, // Replace with the appropriate port
    //     secure: true, // true for 465, false for other ports
    //     auth: {
    //       user: 'jdwebservices1@gmail.com',
    //       pass: 'oznjagccfrqngoah'
    //     }
    //   });
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: "jdwebservices1@gmail.com",
            pass: "oznjagccfrqngoah"
        },
    });

    const currencySign = getCurrencySign(currencyType);

    const mailOptions = {
        from: 'jdwebservices1@gmail.com',
        to: to.join(', '),
        bcc: bcc.join(', '),
        subject: `Invoice from ${companyName}`,
        attachments: [
            {
                filename: `Invoice #${InvoiceNumber}.pdf`,
                content: pdfAttachment.split(';base64,')[1], // Extract base64 content
                encoding: 'base64',
            }
        ],
        html: `<html>
        <body style="background-color:#c5c1c187; margin-top: 40px; padding:20px 0px;">
             <section style="font-family:sans-serif; width: 50%; margin: auto; background-color:#fff; padding: 15px 30px; margin-top: 40px;">
                <div style="padding: 10px 0px;  text-align: center; font-weight: 500; color: #999999">
                    <p style="margin-bottom:0px">${customdate}</p>
                    <p style="margin-top: 0px;">Invoice #${InvoiceNumber}</p>
                </div>
                <div>
                    <h1 style="margin-bottom:0px; font-size: 35px; color:#222">Invoice from ${companyName}</h1>
                    <h1 style="margin: 0px; font-size: 35px; color:#222">${currencySign}${amountdue1}</h1>
                    <p style="margin-top: 0px; color:#222">Due: ${duedate}</p>
                </div>
                <div style="background-color:#f5f4f4; padding: 1px 20px; margin: 30px 0px 10px;">
                    <p style="color:#222">${content}</p>
                </div>
                <div style="margin: 20px 0px 10px;">
                    <p style="color:#222">This email contains a unique link just for you. Please do not share this email or link or others will have access to your document.</p>
<<<<<<< HEAD
                    <a href="https://grithomes.vercel.app/customersigninvoice?invoiceId=${invoiceId}" style="display:inline-block;padding:10px 20px;background-color:#4CAF50;color:#fff;text-decoration:none;border-radius:5px;">View this Invoice</a>
=======
                    <a href="https://invoice-al.vercel.app/customersigninvoice?invoiceId=${invoiceId}" style="display:inline-block;padding:10px 20px;background-color:#4CAF50;color:#fff;text-decoration:none;border-radius:5px;">View this Invoice</a>
>>>>>>> 80a3ad1ca9faea9ab1880adfab1e8d246bd82cf6
                </div>
            </section>
            <section style="font-family:sans-serif; width: 50%; margin: auto; background-color:#f5f4f4; padding: 35px 30px; margin-bottom: 40px;">
                <div>
                    <p style="font-size: 15px; color:#222">Make your invoice</p>
                    <h1 style="font-size: 35px; margin-bottom: 0; margin-top: 0; color:#222">INVOICE</h1>
                </div>
                <div>
                    <ul style="text-align: center;display: inline-flex;list-style:none;padding-left:0px">
                        <li>
                            <a href="">
                                <img src="https://static.xx.fbcdn.net/rsrc.php/yb/r/hLRJ1GG_y0J.ico" alt="facebook icon" style="margin: 0px 5px;">
                            </a>
                        </li>
                        <li>
                            <a href="">
                                <img src="https://static.cdninstagram.com/rsrc.php/y4/r/QaBlI0OZiks.ico" alt="instagram icon" style="margin: 0px 5px;">
                            </a>
                        </li>
                    </ul>
                </div>
            </section>
        </body>
            </html>`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully!');
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ success: false, error: 'Failed to send email.' });
    }
});


module.exports = router;
router.post('/send-deposit-email', async (req, res) => {
    const {
        to,
        bcc,
        content,
        companyName,
        pdfAttachment,
        customdate,
        duedate,
        depositamount,
        InvoiceNumber,
        currencyType,
    } = req.body;
    console.log(duedate, "");

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: "jdwebservices1@gmail.com",
            pass: "oznjagccfrqngoah"
        },
    });

    // const transporter = nodemailer.createTransport({
    //     host: 'smtp.hostinger.com', // Replace with your hosting provider's SMTP server
    //     port: 465, // Replace with the appropriate port
    //     secure: true, // true for 465, false for other ports
    //     auth: {
    //       user: 'jdwebservices1@gmail.com',
    //       pass: 'oznjagccfrqngoah'
    //     }
    //   });

    const currencySign = getCurrencySign(currencyType);

    const mailOptions = {
        from: 'jdwebservices1@gmail.com',
        to: to.join(', '),
        bcc: bcc.join(', '),
        subject: `Deposit Request from ${companyName}`,
        attachments: [
            {
                filename: `Invoice #${InvoiceNumber}.pdf`,
                content: pdfAttachment.split(';base64,')[1], // Extract base64 content
                encoding: 'base64',
            }
        ],
        html: `<html>
        <body style="background-color:#c5c1c187; margin-top: 40px; padding:20px 0px;">
             <section style="font-family:sans-serif; width: 50%; margin: auto; background-color:#fff; padding: 15px 30px; margin-top: 40px;">
                <div style="padding: 10px 0px;  text-align: center; font-weight: 500; color: #999999">
                    <p style="margin-bottom:0px">${customdate}</p>
                    <p style="margin-top: 0px;">Invoice #${InvoiceNumber}</p>
                </div>
                <div>
                    <h1 style="margin-bottom:0px; font-size: 35px; color:#222">Deposit Request from ${companyName}</h1>
                    <h1 style="margin: 0px; font-size: 35px; color:#222">${currencySign}${depositamount}</h1>
                    <p style="margin-top: 0px; color:#222">Due: ${duedate}</p>
                </div>
                <div style="background-color:#f5f4f4; padding: 1px 20px; margin: 30px 0px 10px;">
                    <p style="color:#222">${content}</p>
                </div>
                <div style="margin: 20px 0px 10px;">
                    <p style="color:#222">This email contains a unique link just for you. Please do not share this email or link or others will have access to your document.</p>
                </div>
            </section>
            <section style="font-family:sans-serif; width: 50%; margin: auto; background-color:#f5f4f4; padding: 35px 30px; margin-bottom: 40px;">
                <div>
                    <p style="font-size: 15px; color:#222">Make your invoice</p>
                    <h1 style="font-size: 35px; margin-bottom: 0; margin-top: 0; color:#222">INVOICE</h1>
                </div>
                <div>
                    <ul style="text-align: center;display: inline-flex;list-style:none;padding-left:0px">
                        <li>
                            <a href="">
                                <img src="https://static.xx.fbcdn.net/rsrc.php/yb/r/hLRJ1GG_y0J.ico" alt="facebook icon" style="margin: 0px 5px;">
                            </a>
                        </li>
                        <li>
                            <a href="">
                                <img src="https://static.cdninstagram.com/rsrc.php/y4/r/QaBlI0OZiks.ico" alt="instagram icon" style="margin: 0px 5px;">
                            </a>
                        </li>
                    </ul>
                </div>
            </section>
        </body>
            </html>`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully!');
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ success: false, error: 'Failed to send email.' });
    }
});

router.post('/send-estimate-email', async (req, res) => {
    const {
        to,
        bcc,
        content,
        companyName,
        pdfAttachment,
        customdate,
        EstimateNumber,
        amountdue,
        currencyType,
        estimateId,
        ownerId,
        amountdue1
    } = req.body;

    // const transporter = nodemailer.createTransport({
    //     service: 'gmail',
    //     auth: {
    //         user: "jdwebservices1@gmail.com",
    //         pass: "cwoxnbrrxvsjfbmr"
    //     },
    // });

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: "jdwebservices1@gmail.com",
            pass: "oznjagccfrqngoah"
        },
    });

    // const transporter = nodemailer.createTransport({
    //     host: 'smtp.hostinger.com', // Replace with your hosting provider's SMTP server
    //     port: 465, // Replace with the appropriate port
    //     secure: true, // true for 465, false for other ports
    //     auth: {
    //       user: 'jdwebservices1@gmail.com',
    //       pass: 'oznjagccfrqngoah'
    //     }
    //   });

    const currencySign = getCurrencySign(currencyType);

    const mailOptions = {
        from: 'jdwebservices1@gmail.com',
        to: to.join(', '),
        bcc: bcc.join(', '),
        subject: `Estimate from ${companyName}`,
        attachments: [
            {
                filename: `Estimate #${EstimateNumber}.pdf`,
                content: pdfAttachment.split(';base64,')[1], // Extract base64 content
                encoding: 'base64',
            }
        ],
        html: `<html>
        <body style="background-color:#c5c1c187; margin-top: 40px; padding:20px 0px;">
             <section style="font-family:sans-serif; width: 50%; margin: auto; background-color:#fff; padding: 15px 30px; margin-top: 40px;">
                <div style="padding: 10px 0px;  text-align: center; font-weight: 500; color: #999999">
                    <p style="margin-bottom:0px">${customdate}</p>
                    <p style="margin-top: 0px;">Estimate #${EstimateNumber}</p>
                </div>
                <div>
                    <h1 style="margin-bottom:0px; font-size: 35px; color:#222">Estimate from ${companyName}</h1>
                    <h1 style="margin: 0px; font-size: 35px; color:#222">${currencySign}${amountdue1}</h1>
                </div>
                <div style="background-color:#f5f4f4; padding: 1px 20px; margin: 30px 0px 10px;">
                    <p style="color:#222">${content}</p>
                </div>
                <div style="margin: 20px 0px 10px;">
                    <p style="color:#222">This email contains a unique link just for you. Please do not share this email or link or others will have access to your document.</p>
                    <a href="https://grithomes.vercel.app/customersign?estimateId=${estimateId}" style="display:inline-block;padding:10px 20px;background-color:#4CAF50;color:#fff;text-decoration:none;border-radius:5px;">View this Estimate</a>
                </div>
            </section>
            <section style="font-family:sans-serif; width: 50%; margin: auto; background-color:#f5f4f4; padding: 35px 30px; margin-bottom: 40px;">
                <div>
                    <p style="font-size: 15px; color:#222">Make your Estimate</p>
                    <h1 style="font-size: 35px; margin-bottom: 0; margin-top: 0; color:#222">ESTIMATE</h1>
                </div>
                <div>
                    <ul style="text-align: center;display: inline-flex;list-style:none;padding-left:0px">
                        <li>
                            <a href="">
                                <img src="https://static.xx.fbcdn.net/rsrc.php/yb/r/hLRJ1GG_y0J.ico" alt="facebook icon" style="margin: 0px 5px;">
                            </a>
                        </li>
                        <li>
                            <a href="">
                                <img src="https://static.cdninstagram.com/rsrc.php/y4/r/QaBlI0OZiks.ico" alt="instagram icon" style="margin: 0px 5px;">
                            </a>
                        </li>
                    </ul>
                </div>
            </section>
        </body>
            </html>`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully!');
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ success: false, error: 'Failed to send email.' });
    }
});

router.post('/send-estimate-signed-email', async (req, res) => {
    const {
        to,
        estimateId,
        ownerId,
        documentNumber,
        customerName
    } = req.body;

    // const transporter = nodemailer.createTransport({
    //     service: 'gmail',
    //     auth: {
    //         user: "jdwebservices1@gmail.com",
    //         pass: "cwoxnbrrxvsjfbmr"
    //     },
    // });

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: "jdwebservices1@gmail.com",
            pass: "oznjagccfrqngoah"
        },
    });

    const mailOptions = {
        from: "jdwebservices1@gmail.com",
        to: to,
        subject: 'Your document has been signed',
        html: `<html>
        <body style="background-color:#c5c1c187; margin-top: 40px; padding:20px 0px;">
             <section style="font-family:sans-serif; width: 50%; margin: auto; background-color:#fff; padding: 15px 30px; margin-top: 40px;">
                <div style="padding: 10px 0px;  text-align: center; font-weight: 500; color: #999999">
                </div>
                <div>
                    <h1 style="margin-bottom:0px; font-size: 32px; color:#222">${customerName} has signed your document</h1>
                </div>
                <div>
                    <p style="margin-bottom:10px; font-size: 18px; color:#222; padding-bottom:25px;">Document signed: <span style="font-weight:bold"> ${documentNumber} has been signed by ${customerName}.</span></p>
                </div><hr/>
                <div>
                    <p style="margin-bottom:0px; padding-top:10px; padding-bottom:15px; font-size: 14px; color:#222"><span style="font-weight:bold">DO NOT </span>share this email</p>
                </div>
                <div style="padding: 1px 5px; margin: 0px 0px 10px;">
                    <p style="color:#222">This email contains a unique link just for you. 
                        Please do not share this email or link or others will have access to your document.
                    </p>
                </div>
            </section>
            <section style="font-family:sans-serif; width: 50%; margin: auto; background-color:#f5f4f4; padding: 35px 30px; margin-bottom: 40px;">
                <div>
                    <h1 style="font-size: 35px; margin-bottom: 0; margin-top: 0; color:#222">ESTIMATE</h1>
                </div>
                <div>
                    <ul style="text-align: center;display: inline-flex;list-style:none;padding-left:0px">
                        <li>
                            <a href="">
                                <img src="https://static.xx.fbcdn.net/rsrc.php/yb/r/hLRJ1GG_y0J.ico" alt="facebook icon" style="margin: 0px 5px;">
                            </a>
                        </li>
                        <li>
                            <a href="">
                                <img src="https://static.cdninstagram.com/rsrc.php/y4/r/QaBlI0OZiks.ico" alt="instagram icon" style="margin: 0px 5px;">
                            </a>
                        </li>
                    </ul>
                </div>
            </section>
        </body>
            </html>`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully!');
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ success: false, error: 'Failed to send email.' });
    }
});

router.post('/send-Invoice-signed-email', async (req, res) => {
    const {
        to,
        invoiceId,
        ownerId,
        documentNumber,
        customerName
    } = req.body;

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: "jdwebservices1@gmail.com",
            pass: "oznjagccfrqngoah"
        },
    });

    const mailOptions = {
        from: 'jdwebservices1@gmail.com',
        to: to,
        subject: 'Your document has been signed',
        html: `<html>
        <body style="background-color:#c5c1c187; margin-top: 40px; padding:20px 0px;">
             <section style="font-family:sans-serif; width: 50%; margin: auto; background-color:#fff; padding: 15px 30px; margin-top: 40px;">
                <div style="padding: 10px 0px;  text-align: center; font-weight: 500; color: #999999">
                </div>
                <div>
                    <h1 style="margin-bottom:0px; font-size: 32px; color:#222">${customerName} has signed your document</h1>
                </div>
                <div>
                    <p style="margin-bottom:10px; font-size: 18px; color:#222; padding-bottom:25px;">Document signed: <span style="font-weight:bold"> ${documentNumber} has been signed by ${customerName}.</span></p>
                </div><hr/>
                <div>
                    <p style="margin-bottom:0px; padding-top:10px; padding-bottom:15px; font-size: 14px; color:#222"><span style="font-weight:bold">DO NOT </span>share this email</p>
                </div>
                <div style="padding: 1px 5px; margin: 0px 0px 10px;">
                    <p style="color:#222">This email contains a unique link just for you. 
                        Please do not share this email or link or others will have access to your document.
                    </p>
                </div>
            </section>
            <section style="font-family:sans-serif; width: 50%; margin: auto; background-color:#f5f4f4; padding: 35px 30px; margin-bottom: 40px;">
                <div>
                    <h1 style="font-size: 35px; margin-bottom: 0; margin-top: 0; color:#222">ESTIMATE</h1>
                </div>
                <div>
                    <ul style="text-align: center;display: inline-flex;list-style:none;padding-left:0px">
                        <li>
                            <a href="">
                                <img src="https://static.xx.fbcdn.net/rsrc.php/yb/r/hLRJ1GG_y0J.ico" alt="facebook icon" style="margin: 0px 5px;">
                            </a>
                        </li>
                        <li>
                            <a href="">
                                <img src="https://static.cdninstagram.com/rsrc.php/y4/r/QaBlI0OZiks.ico" alt="instagram icon" style="margin: 0px 5px;">
                            </a>
                        </li>
                    </ul>
                </div>
            </section>
        </body>
            </html>`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully!');
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ success: false, error: 'Failed to send email.' });
    }
});


router.get('/dashboard/:userid', async (req, res) => {
    try {
        let userid = req.params.userid;
        const restaurantCount = await Restaurant.countDocuments({ userid: userid });
        const categoryCount = await Category.countDocuments({ userid: userid });
        const itemCount = await Items.countDocuments({ userid: userid });

        res.json({ restaurantCount, categoryCount, itemCount });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ message: 'Error fetching dashboard data' });
    }
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/') // Save files to the 'uploads' directory
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
    }
});
const upload = multer({ storage: storage });

router.post('/upload-image', upload.single('companyImage'), (req, res) => {
    try {
        const companyImageUrl = req.file.path;
        res.json({ Success: true, companyImageUrl });
    } catch (error) {
        console.error('Error uploading company image:', error);
        res.status(500).json({ Success: false, error: 'Failed to upload company image' });
    }
});

router.post("/createuser", [
    body('email').isEmail(),
    body('companyname').isLength(),
    body('Businesstype').isLength(),
    body('CurrencyType').isLength(),
    body('FirstName').isLength({ min: 3 }),
    body('LastName').isLength({ min: 3 }),
    body('password').isLength({ min: 5 }),
    body('address').isLength(),
    body("gstNumber").isLength(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const email = req.body.email;
        const existingUser = await User.findOne({ email });
        const existingTeamMember = await Team.findOne({ email });

        if (existingUser || existingTeamMember) {
            return res.status(400).json({
                success: false,
                message: "User with this email already exists."
            });
        }
        // if (existingUser) {
        //     console.log('Email already registered:', email);
        //     return res.status(400).json({
        //         success: false,
        //         message: "This Email ID is already registered!"
        //     });
        // } 
        else {
            const salt = await bcrypt.genSalt(10);
            const secPassword = await bcrypt.hash(req.body.password, salt);

            await User.create({
                companyname: req.body.companyname,
                Businesstype: req.body.Businesstype,
                CurrencyType: req.body.CurrencyType,
                FirstName: req.body.FirstName,
                LastName: req.body.LastName,
                password: secPassword,
                email: req.body.email,
                address: req.body.address,
                companyImageUrl: req.body.companyImageUrl,
                gstNumber: req.body.gstNumber,
            });

            sendWelcomeEmail(req.body.email, req.body.FirstName, true);

            return res.json({
                success: true,
                message: "Congratulations! Your account successfully created!"
            });
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});


// router.post("/createuser",
// [
//     body('email').isEmail(),
//     body('companyname').isLength(),
//     body('Businesstype').isLength(),
//     body('CurrencyType').isLength(),
//     body('FirstName').isLength({min:3}),
//     body('LastName').isLength({min:3}),
//     body('password').isLength({ min: 5 }),
// ]
// , async (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//         return res.status(400).json({ errors: errors.array() });
//     }
//     const salt = await bcrypt.genSalt(10);
//     let secPassword= await bcrypt.hash(req.body.password, salt)

//     try {
//         let emaild = req.body.email;
//             let userdata = await User.findOne({ emaild });
//     if (!userdata) {
//         User.create({
//             companyname: req.body.companyname,
//             Businesstype: req.body.Businesstype,
//             CurrencyType: req.body.CurrencyType,
//             FirstName: req.body.FirstName,
//             LastName: req.body.LastName,
//             password: secPassword,
//             email: req.body.email,
//         })
//         res.json({ 
//             Success: true,
//             message: "Congratulations! Your account Succefully created! "
//         })
//     }else{

//         res.json({ 
//             Success: false,
//             message: "This Email id already Registered! "
//         })
//     }
//     }
//     catch (error) {
//         console.log(error);
//         res.json({ Success: false })
//     }
// });



// Create a new user document
// const newUser = new User({
//     name: 'John Doe',
//     location: 'New York',
//     email: 'abc@gmail.com',
//     password: '123456',
// });

// // Save the user document to the database
// newUser.save()
//     .then((user) => {
//         console.log('User saved to the database:', user);
//     })
//     .catch((error) => {
//         console.error('Error saving user:', error);
//     });

// router.post("/createuser", async (req, res) => {
//     const { name, email, password, location, signupMethod } = req.body;

//     // Validate input based on the signup method (e.g., for email signup)
//     if (signupMethod === "email") {
//         // Perform email signup validation here
//         // Example: Check if email is valid and password meets the criteria
//         if (!isValidEmail(email) || !isValidPassword(password)) {
//             return res.status(400).json({ message: "Invalid email or password." });
//         }
//     } 
//         else if (signupMethod === "google") {
//         // Handle Google signup
//         // You can add custom validation for Google signup here
//         let userdata = await User.findOne({ email });
//         if (!userdata) {
//             try {
//                 User.create({
//                     name,
//                     password: secPassword,
//                     email,
//                     location,
//                     signupMethod,
//                 });
//                 let userdata = await User.findOne({ email });
//                 const data = {
//                     user:{
//                         id:userdata.id
//                     }
//                 }
//                 const authToken = jwt.sign(data, jwrsecret)
//                 return res.json({ Success: true,authToken:authToken,userid: userdata.id})

//             } catch (error) {
//                 console.log(error);
//                 res.json({ Success: false });
//             }
//         }else{
//         if (userdata.signupMethod == signupMethod) {


//         const data = {
//             user:{
//                 id:userdata.id
//             }
//         }

//         const authToken = jwt.sign(data, jwrsecret)
//         return res.json({ Success: true,authToken:authToken,userid: userdata.id})
//     }
//     }
//     } else if (signupMethod === "facebook") {

//         // Handle Google signup
//         // You can add custom validation for Google signup here
//         let userdata = await User.findOne({ email });
//         if (!userdata) {
//             try {
//                 User.create({
//                     name,
//                     password: secPassword,
//                     email,
//                     location,
//                     signupMethod,
//                 });
//                 let userdata = await User.findOne({ email });
//                 const data = {
//                     user:{
//                         id:userdata.id
//                     }
//                 }
//                 const authToken = jwt.sign(data, jwrsecret)
//                 return res.json({ Success: true,authToken:authToken,userid: userdata.id})

//             } catch (error) {
//                 console.log(error);
//                 res.json({ Success: false });
//             }
//         }else{
//         if (userdata.signupMethod == signupMethod) {


//         const data = {
//             user:{
//                 id:userdata.id
//             }
//         }

//         const authToken = jwt.sign(data, jwrsecret)
//         return res.json({ Success: true,authToken:authToken,userid: userdata.id})
//     }
//     }
// }

//     // Continue with user creation based on the signup method
//     const salt = await bcrypt.genSalt(10);
//     let secPassword = await bcrypt.hash(password, salt);

//     try {
//         User.create({
//             name,
//             password: secPassword,
//             email,
//             location,
//             signupMethod,
//         });

//         res.json({
//             Success: true,
//             message: "Congratulations! Your account successfully created!",
//         });
//     } catch (error) {
//         console.log(error);
//         res.json({ Success: false });
//     }
// });



// router.post("/login", [
//     body('email').isEmail(),
//     body('password').isLength({ min: 5 }),
// ], async (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//         return res.status(400).json({ errors: errors.array() });
//     }
//     let signupMethod = req.body.signupMethod;
//     let email = req.body.email;
//     try {
//         let userdata = await User.findOne({ email });
//         if (!userdata) {
//             return res.status(400).json({ errors: "Login with correct details " });
//         }

//         const pwdCompare = await bcrypt.compare(req.body.password, userdata.password)
//         if (!pwdCompare) {
//             return res.status(400).json({ errors: "Login with correct details" });
//         }

//         if (userdata.signupMethod != signupMethod) {
//             return res.status(400).json({ errors: "You can try with social login" });
//         }


//         const data = {
//             user:{
//                 id:userdata.id
//             }
//         }

//         const authToken = jwt.sign(data, jwrsecret)
//         res.json({ Success: true,authToken:authToken,userid: userdata.id})
//     }
//     catch (error) {
//         console.log(error);
//         res.json({ Success: false })
//     }
// });

// User and Team Member login route

// Login API
// Define the login route
router.post('/login', [
    body('email').isEmail(),
    body('password').isLength({ min: 4 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const email = req.body.email;
    const password = req.body.password;

    try {
        // Check if it's a user
        const user = await User.findOne({ email });

        if (user) {
            const pwdCompare = await bcrypt.compare(password, user.password);
            if (pwdCompare) {
                const data = {
                    user: {
                        id: user._id,
                    },
                };
                const mostRecentClockEntry = await Timeschema.findOne({ endTime: null, userid: user._id }).sort({ startTime: -1 });
                const mostRecentClockEntrystartTime = mostRecentClockEntry != null ? mostRecentClockEntry.startTime : "";
                const authToken = jwt.sign(data, jwrsecret);
                return res.json(
                    {
                        Success: true,
                        authToken, userid: user._id,
                        username: user.FirstName,
                        CurrencyType: user.CurrencyType,
                        startTime: mostRecentClockEntrystartTime,
                        isTeamMember: false,
                        taxPercentage: user.taxPercentage,
                        TaxName: user.TaxName,
                    });
            }
        }

        // Check if it's a team member
        const teamMember = await Team.findOne({ email });

        if (teamMember) {
            const pwdCompare1 = await bcrypt.compare(password, teamMember.password);
            if (pwdCompare1) {
                const data1 = {
                    users: {
                        id: teamMember._id,
                    },
                };
                const mostRecentClockEntry = await Timeschema.findOne({ endTime: null, userid: teamMember._id }).sort({ startTime: -1 });
                const mostRecentClockEntrystartTime = mostRecentClockEntry != null ? mostRecentClockEntry.startTime : "";
                const authToken = jwt.sign(data1, jwrsecret);
                return res.json({ Success: true, authToken, userid: teamMember._id, username: teamMember.name, startTime: mostRecentClockEntrystartTime, isTeamMember: true });
            }
        }

        console.log('Login failed for email:', email);
        return res.status(400).json({ errors: 'Login with correct details' });
    } catch (error) {
        console.log(error);
        res.json({ Success: false });
    }
});


// Function to send a welcome email
function sendWelcomeEmail(userEmail, name, isFirstTimeLogin) {
    if (!isFirstTimeLogin) {
        console.log('Not sending welcome email as it is not the first time login.');
        return; // Do not send email if it's not the first time login
    }

    const subject = 'Welcome to Our Platform!';
    const message = `<html xmlns:v="urn:schemas-microsoft-com:vml">
        <head></head>
        <body style="background-color:#c5c1c187; margin-top: 40px;">
            <section style="font-family:sans-serif; width: 60%; margin: auto;">
                <header style="background-color: #fff; padding: 20px; border: 1px solid #faf8f8;">
                    <div style="width: 100%; margin: auto; display: flex; align-items: center;">
                        <div style="width: 40%;">
                            <img src="welcome.jpg" alt="welcome image">
                        </div>
                        <div style="width: 60%;">
                            <h2>INVOICE</h2>
                        </div>
                        <div style="clear:both ;"></div>
                    </div>

                    <div>
                        <h2>🌟 Welcome</h2>
                        <p>Hi ${name},</p>
                        <p>Thank you for choosing Invoice! We're thrilled to have you on board. Get ready to embark on a delightful journey of culinary exploration with us.</p>
                        <p>Savor the experience,</p>
                        <p>The Invoice Team</p>
                    </div>
                </header>
                <footer style="background-color:#f5f5f587; border: 1px solid #f5f5f587; padding: 20px; color: #888; text-align: center;">
                    <div>
                        <p>&copy; 2024 Invoice. All rights reserved.</p>
                        <p>Contact us: info@invoice.com | Phone: (555) 123-4567</p>
                        <h4>Available On</h4>
                        <div>
                            <ul style="text-align: center;display: inline-flex;list-style:none;padding-left:0px">
                                <li>
                                    <a href="">
                                        <img src="https://static.xx.fbcdn.net/rsrc.php/yb/r/hLRJ1GG_y0J.ico" alt="facebook icon" style="margin: 0px 5px;">
                                    </a>
                                </li>
                                <li>
                                    <a href="">
                                        <img src="https://static.cdninstagram.com/rsrc.php/y4/r/QaBlI0OZiks.ico" alt="instagram icon" style="margin: 0px 5px;">
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>
                </footer>
            </section>
        </body>
    </html>`;

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: "jdwebservices1@gmail.com",
            pass: "oznjagccfrqngoah"
        },
    });
    // const transporter = nodemailer.createTransport({
    //     host: 'smtp.hostinger.com', // Replace with your hosting provider's SMTP server
    //     port: 465, // Replace with the appropriate port
    //     secure: true, // true for 465, false for other ports
    //     auth: {
    //       user: 'jdwebservices1@gmail.com',
    //       pass: 'oznjagccfrqngoah'
    //     }
    //   });

    const mailOptions = {
        from: 'your-email@gmail.com',
        to: userEmail,
        subject: subject,
        html: message,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Error sending email:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
}


// POST route for handling forgot password
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    console.log('Received email:', email);
    try {
        const user = await User.findOne({ email });
        console.log('Retrieved user:', user);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const resetToken = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // Token expiry time (e.g., 1 hour)
        await user.save();

        // Nodemailer setup
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: "jdwebservices1@gmail.com",
                pass: "oznjagccfrqngoah"
            },
        });
        // const transporter = nodemailer.createTransport({
        //     host: 'smtp.hostinger.com', // Replace with your hosting provider's SMTP server
        //     port: 465, // Replace with the appropriate port
        //     secure: true, // true for 465, false for other ports
        //     auth: {
        //       user: 'jdwebservices1@gmail.com',
        //       pass: 'oznjagccfrqngoah'
        //     }
        //   });

        const mailOptions = {
            from: 'your_email@example.com',
            to: user.email,
            subject: 'Reset your password',
            text: `You are receiving this because you (or someone else) have requested to reset your password.\n\n
              Please click on the following link, or paste this into your browser to complete the process:\n\n
              ${req.headers.origin}/reset-password/${resetToken}\n\n
              If you did not request this, please ignore this email and your password will remain unchanged.\n`
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).json({ message: 'Reset password email sent' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error sending email' });
    }
});

router.post('/reset-password', async (req, res) => {
    const { resetPasswordToken, newPassword } = req.body;

    try {
        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpires: { $gt: Date.now() } // Check if the token is still valid
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user's password and clear reset token fields
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        return res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error resetting password' });
    }
});


// router.post('/clockin', async (req, res) => {

//     let Data = new Date();
//     const options = { timeZone: 'Asia/Kolkata', timeZoneName: 'short' };
//     console.log(Data.toLocaleString('en-US', options), "Time Zone");
//     const formattedTime = Data.toLocaleString('en-US', options);
//     const newClock = new Timeschema({
//         startTime: formattedTime, 
//     });

//     await newClock.save();

//     res.json({ message: 'Clock-in successful', startTime: formattedTime });
// });

// router.post('/clockout', async (req, res) => {
//     let Data = new Date();
//     const options = { timeZone: 'Asia/Kolkata', timeZoneName: 'short' };
//     console.log(Data.toLocaleString('en-US', options), "Time Zone");
//     const formattedTime = Data.toLocaleString('en-US', options);

//     // Assuming you have a Mongoose model named 'Timeschema' for clock-out times
//     const newClock = new Timeschema({
//         endTime: formattedTime, 
//     });

//     await newClock.save();

//     res.json({ message: 'Clock-out successful', endTime: formattedTime });
// });

router.post('/clockin', async (req, res) => {
    try {
        const { userid, username, userEmail, isTeamMember } = req.body;

        const startTime = new Date();
        const options = { timeZone: 'Asia/Kolkata', timeZoneName: 'short' };
        const formattedStartTime = startTime.toLocaleString('en-US', options);
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        const newClockEntry = new Timeschema({
            startTime: formattedStartTime,
            userid: userid,
            username: username,
            isteamMember: isTeamMember,
        });

        try {
            await newClockEntry.save();
            res.json({ message: 'Clock-in successful', startTime: formattedStartTime });
        } catch (error) {
            res.status(500).json({ message: 'Failed to store clock entry' });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/clockout', async (req, res) => {
    try {
        const { userid, username, userEmail, isTeamMember } = req.body;
        const endTime = new Date();
        const options = { timeZone: 'Asia/Kolkata', timeZoneName: 'short' };
        const formattedEndTime = endTime.toLocaleString('en-US', options);
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        // Find the most recent clock-in entry and update it with the end time
        const mostRecentClockEntry = await Timeschema.findOne({ endTime: null, userid: userid }).sort({ startTime: -1 });

        if (mostRecentClockEntry) {
            mostRecentClockEntry.endTime = formattedEndTime;
            const startTime = new Date(mostRecentClockEntry.startTime);
            const endTime = new Date(mostRecentClockEntry.endTime);
            const totalTimeWorked = (endTime - startTime);
            const timeInSeconds = Math.floor(totalTimeWorked / 1000);

            // Update the timeInSeconds field
            mostRecentClockEntry.timeInSeconds = timeInSeconds;

            // Convert the time difference to hours, minutes, and seconds
            const hours = Math.floor(totalTimeWorked / 3600000); // 1 hour = 3600000 milliseconds
            const minutes = Math.floor((totalTimeWorked % 3600000) / 60000); // 1 minute = 60000 milliseconds
            const seconds = Math.floor((totalTimeWorked % 60000) / 1000); // 1 second = 1000 milliseconds

            mostRecentClockEntry.totalTime = `${hours} hours ${minutes} minutes ${seconds} seconds`;
            await mostRecentClockEntry.save();

            res.json({ message: 'Clock-out successful', endTime: formattedEndTime, totalTimeWorked: mostRecentClockEntry.totalTime });
        } else {
            res.json({ message: 'No matching clock-in entry found for clock-out' });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/userEntries/:userid', async (req, res) => {
    try {
        const { userid } = req.params;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        const userEntries = await Timeschema.find({ userid }).sort({ startTime: 1 });

        if (userEntries) {
            res.json({ userEntries });
        } else {
            res.status(404).json({ message: 'No entries found for this user' });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/allEntries', async (req, res) => {
    try {
        const allEntries = await Timeschema.find().sort({ startTime: 1 });

        if (allEntries && allEntries.length > 0) {
            res.json({ allEntries });
        } else {
            res.status(404).json({ message: 'No entries found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});


router.post("/addcustomer", [
    body('emails').isArray().withMessage('Emails must be an array'),
body('emails.*').isEmail().withMessage('Each email must be valid'),
    body('name').isLength({ min: 3 }),
    body('information').isLength(),
    body('number').isLength(), 
    body('city').isLength(),
    body('state').isLength(),
    body('country').isLength(),
    body('post').isLength(),
], async (req, res) => {
    const errors = validationResult(req);
    let authtoken = req.headers.authorization;

    try {
        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const email = req.body.email;
       const existingCustomer = await Customerlist.findOne({ 
    userid: req.body.userid, // restrict search to the current user's customers
    emails: { $in: req.body.emails } 
});

if (existingCustomer) {
    return res.status(400).json({
        success: false,
        message: "This Customer Email already exists for your account!"
    });
} else {
            // Create new customer record
            const newCustomer = await Customerlist.create({
                userid: req.body.userid,
                name: req.body.name,
                information: req.body.information,
                  emails: req.body.emails,
                number: req.body.number,
                country: req.body.country,
                countryid: req.body.countryid,
                city: req.body.city,
                cityid: req.body.cityid,
                state: req.body.state,
                stateid: req.body.stateid,
                countrydata: req.body.countrydata,
                statedata: req.body.statedata,
                citydata: req.body.citydata,
                zip: req.body.zip,
                address1: req.body.address1,
                address2: req.body.address2,
                post: req.body.post,
            });

            res.json({
                success: true,
                message: "Congratulations! Your Customer has been successfully added!",
                data: newCustomer
            });
        }
    } catch (error) {
        console.error(error);

        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }

        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});


// Create a new invoice
router.post('/savecreateinvoice', async (req, res) => {
    const invoiceSchemaDefinition = Invoice.schema.obj;
    console.log('Invoice Schema:', invoiceSchemaDefinition);
    try {
        const { userid, invoiceData } = req.body; // Extracting invoiceData from the request body
        console.log('Received userid:', userid);
        console.log('Received invoiceData:', invoiceData); // Add this line to log the entire invoiceData

        let authtoken = req.headers.authorization;
        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        // Check if the invoice number already exists for the given user ID
        const existingInvoice = await Invoice.findOne({
            userid: userid,
            InvoiceNumber: invoiceData.InvoiceNumber
        });

        if (existingInvoice) {
            return res.status(400).json({
                success: false,
                message: 'Invoice number already exists.',
                error: 'Invoice number already exists.'
            });
        }


        // Create a new instance of the Invoice model using the extracted data
        const newInvoice = new Invoice({
            ...invoiceData,
            userid: userid,
            createdAt: new Date(), // Adding the current date as createdAt
        });

        // Save the new invoice to the database
        const savedInvoice = await newInvoice.save();
        console.log('Received savedInvoice:', savedInvoice); // Add this line to log the entire invoiceData
        res.status(201).json({
            success: true,
            message: 'Invoice saved successfully!',
            invoice: savedInvoice,
        });
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});


// Create a new estimate
router.post('/savecreateestimate', async (req, res) => {
    try {
        const { userid, estimateData } = req.body; // Extracting estimateData from the request body
        console.log('Received userid:', userid);
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        // Check if the invoice number already exists for the given user ID
        const existingEstimate = await Estimate.findOne({
            userid: userid,
            EstimateNumber: estimateData.EstimateNumber
        });

        if (existingEstimate) {
            return res.status(400).json({
                success: false,
                message: 'Estimate number already exists.',
                error: 'Estimate number already exists.'
            });
        }

        // Create a new instance of the Estimate model using the extracted data
        const newEstimate = new Estimate({
            ...estimateData,
            userid: userid,
            createdAt: new Date(), // Adding the current date as createdAt
        });

        // Save the new Estimate to the database
        const savedEstimate = await newEstimate.save();

        res.status(201).json({
            success: true,
            message: 'Estimate saved successfully!',
            estimate: savedEstimate,
        });
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.get('/invoicedata/:userid', async (req, res) => {
  try {
    const userid = req.params.userid;
    const rawToken = req.headers.authorization;
    const page = (parseInt(req.query.page) || 1) - 1; // fix here
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;

    if (!rawToken) return res.status(401).json({ message: 'Unauthorized: No token provided' });

    const token = rawToken.startsWith("Bearer ") ? rawToken.slice(7) : rawToken;
    const decodedToken = jwt.verify(token, jwrsecret);

    const query = { userid };
    if (status && status !== 'All') query.status = status;

    const totalInvoices = await Invoice.countDocuments(query);

    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .skip(page * limit)
      .limit(limit);

    res.json({
      invoices,
      totalPages: Math.ceil(totalInvoices / limit),
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    if (error.name === 'JsonWebTokenError') return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    res.status(500).json({ message: 'Internal server error' });
  }
});


router.get('/customerwisedata/:customeremail', async (req, res) => {
    try {
        let customeremail = req.params.customeremail;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        // Find invoice data for the specified customer email sorted by creation date in descending order
        const invoicedata = await Invoice.find({ customeremail: customeremail }).sort({ createdAt: -1 });

        res.json(invoicedata);
    } catch (error) {
        console.error('Error fetching customer-wise data:', error);

        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }

        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/converttoinvoice/:estimateid', async (req, res) => {
    try {
        const { estimateid } = req.params;
        // Find the estimate by ID
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        const estimate = await Estimate.findById(estimateid);

        if (!estimate) {
            return res.status(404).json({ message: 'Estimate not found' });
        }

        // Check if the estimate is already converted
        if (estimate.convertedToInvoice) {
            return res.status(400).json({ message: 'Estimate already converted to invoice' });
        } else {
            estimate.convertedToInvoice = true;
            const result = await Estimate.findByIdAndUpdate(estimateid, estimate, { new: true });

            // Get the last used invoice_id
            const lastInvoice = await Invoice.findOne().sort({ invoice_id: -1 });
            const lastId = lastInvoice ? lastInvoice.invoice_id : 0;
            const nextId = lastId + 1;

            // Create a new Invoice based on the estimate details
            const newInvoice = new Invoice({
                invoice_id: nextId,
                InvoiceNumber: `Invoice-${nextId}`,
                customername: estimate.customername,
                customeremail: estimate.customeremail,
                date: estimate.date,
                duedate: estimate.date,
                description: estimate.description,
                items: estimate.items,
                discountTotal: estimate.discountTotal,
                subtotal: estimate.subtotal,
                job: estimate.job,
                total: estimate.total,
                userid: estimate.userid,
                information: estimate.information,
                tax: estimate.tax,
                taxpercentage: estimate.taxpercentage,
            });

            // Save the new invoice to the database
            await newInvoice.save();

            // Mark the estimate as converted
            // estimate.convertedToInvoice = true;
            // await estimate.save();

            res.status(200).json({ message: 'Estimate converted to invoice successfully', newInvoice });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});


router.get('/geteditinvoicedata/:invoiceid', async (req, res) => {
    try {
        const invoiceid = req.params.invoiceid;
        console.log(invoiceid);
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        const result = await Invoice.findById(invoiceid);

        if (result) {
            res.json({
                Success: true,
                message: "invoicedata retrieved successfully",
                invoices: result
            });
        } else {
            res.status(404).json({
                Success: false,
                message: "invoicedata not found"
            });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/geteditestimateData/:estimateid', async (req, res) => {
    try {
        const estimateid = req.params.estimateid;
        console.log(estimateid);
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        const result = await Estimate.findById(estimateid);

        if (result) {
            res.json({
                Success: true,
                message: "estimatedata retrieved successfully",
                estimates: result
            });
        } else {
            res.status(404).json({
                Success: false,
                message: "estimatedata not found"
            });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/updateinvoicedata/:invoiceid', async (req, res) => {
    try {
        const invoiceid = req.params.invoiceid;
        const { subtotal, total, items, emailsent, discountTotal, ...updatedData } = req.body; // Ensure this matches your MongoDB schema

        // Add the updated subtotal and total to the incoming data
        updatedData.subtotal = subtotal;
        updatedData.total = total;
        updatedData.discountTotal = discountTotal;

        // Update or replace the 'items' field
        updatedData.items = items;

        if (emailsent !== undefined) {
            updatedData.emailsent = emailsent;
        }
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        // Perform the update operation in your database here
        const result = await Invoice.findByIdAndUpdate(invoiceid, updatedData, { new: true });

        if (result) {
            res.json({
                Success: true,
                message: "Invoice data updated successfully",
                invoice: result
            });
        } else {
            res.status(404).json({
                Success: false,
                message: "Invoice data not found"
            });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/updateestimateData/:estimateid', async (req, res) => {
    try {
        const estimateid = req.params.estimateid;
        const { subtotal, total, items, emailsent, discountTotal, ...updatedestimateData } = req.body; // Ensure this matches your MongoDB schema

        // Add the updated subtotal and total to the incoming data
        updatedestimateData.subtotal = subtotal;
        updatedestimateData.total = total;
        updatedestimateData.discountTotal = discountTotal;

        // Update or replace the 'items' field
        updatedestimateData.items = items;
        if (emailsent !== undefined) {
            updatedestimateData.emailsent = emailsent;
        }

        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        // Perform the update operation in your database here
        const result = await Estimate.findByIdAndUpdate(estimateid, updatedestimateData, { new: true });

        if (result) {
            res.json({
                Success: true,
                message: "estimate data updated successfully",
                estimate: result
            });
        } else {
            res.status(404).json({
                Success: false,
                message: "estimate data not found"
            });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

// DELETE route to remove data
// router.get('/removeData/:invoiceid', async (req, res) => {
//     const { invoiceid } = req.params;

//     try {
//       // Remove data associated with the provided invoiceid
//       await Invoice.findByIdAndDelete(invoiceid);

//       res.status(200).json({ message: 'Data removed successfully' });
//     } catch (error) {
//       console.error('Error removing data:', error);
//       res.status(500).json({ error: 'Error removing data' });
//     }
//   });

router.get('/deldata/:invoiceid', async (req, res) => {
    try {
        const invoiceid = req.params.invoiceid;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        const invoice = await Invoice.findById(invoiceid);

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }

        const transactions = await Transactions.find({ invoiceid: invoiceid });

        if (transactions.length > 0) {
            transactions.forEach(async (transaction) => {
                await Transactions.findByIdAndDelete(transaction._id);
            });
        }

        const result = await Invoice.findByIdAndDelete(invoiceid);

        if (result) {
            return res.json({
                success: true,
                message: 'Invoice and associated transactions deleted successfully'
            });
        } else {
            return res.status(404).json({
                success: false,
                message: 'Failed to delete Invoice'
            });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/delestimatedata/:estimateid', async (req, res) => {
    try {
        const estimateid = req.params.estimateid;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        const result = await Estimate.findByIdAndDelete(estimateid);

        if (result) {
            return res.json({
                success: true,
                message: 'Estimate deleted successfully'
            });
        } else {
            return res.status(404).json({
                success: false,
                message: 'Failed to delete Estimate'
            });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

// DELETE route to remove invoice and associated transactions by invoice ID
router.get('/removeInvoiceAndTransactions/:invoiceid', async (req, res) => {
    try {
        const invoiceId = req.params.invoiceid;

        // Deleting the transaction associated with the invoiceId
        const deletedTransaction = await Transactions.find({ invoiceId });

        if (!deletedTransaction) {
            return res.status(404).json({ success: false, error: 'Transaction not found for the invoice.' });
        }

        // Deleting the invoice by ID
        const deletedInvoice = await Invoice.findByIdAndDelete(invoiceId);

        if (deletedInvoice) {
            res.status(200).json({ success: true, message: 'Invoice and associated transaction deleted successfully.' });
        } else {
            res.status(404).json({ success: false, error: 'Invoice not found.' });
        }
    } catch (error) {
        console.error('Error deleting invoice and transactions:', error);
        res.status(500).json({ success: false, error: 'Failed to delete invoice and transactions.' });
    }
});


router.get('/delinvoiceitem/:invoiceid/:itemId', async (req, res) => {
    try {
        const invoiceid = req.params.invoiceid;
        const itemId = req.params.itemId;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        const result = await Invoice.findById(invoiceid);
        console.log(result);
        const updateditems = [];
        result.items.forEach(element => {
            if (element.itemId != itemId) {
                updateditems.push(element);
            }
        });
        result.items = updateditems;
        const deletedItem = await Invoice.findByIdAndUpdate(invoiceid, result, { new: true });

        if (deletedItem) {
            res.json({
                Success: true,
                message: 'Item deleted successfully'
            });
        } else {
            res.status(404).json({
                Success: false,
                message: 'Item not found'
            });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/delestimateitem/:estimateid/:itemId', async (req, res) => {
    try {
        const estimateid = req.params.estimateid;
        const itemId = req.params.itemId;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        const result = await Estimate.findById(estimateid);
        console.log(result);
        const updateditems = [];
        result.items.forEach(element => {
            if (element.itemId != itemId) {
                updateditems.push(element);
            }
        });
        result.items = updateditems;
        const deletedItem = await Estimate.findByIdAndUpdate(estimateid, result, { new: true });

        if (deletedItem) {
            res.json({
                Success: true,
                message: 'Item deleted successfully'
            });
        } else {
            res.status(404).json({
                Success: false,
                message: 'Item not found'
            });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Fetch invoicedetail from a invoice
router.get('/getinvoicedata/:invoiceid', async (req, res) => {
    try {
        const invoiceid = req.params.invoiceid;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        const invoicedetail = await Invoice.findById(invoiceid);

        res.json(invoicedetail);
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Fetch estimatedetail from a estimate
router.get('/getestimatedata/:estimateid', async (req, res) => {
    try {
        const estimateid = req.params.estimateid;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        const estimatedetail = await Estimate.findById(estimateid);

        res.json(estimatedetail);
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/lastinvoicenumber/:userid', async (req, res) => {
    try {
        const userid = req.params.userid;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        const lastInvoice = await Invoice.findOne({ userid: userid }).sort({ invoice_id: -1 });

        if (lastInvoice) {
            if (lastInvoice.invoice_id == " " || lastInvoice.invoice_id == null || lastInvoice.invoice_id == undefined || lastInvoice.invoice_id == "") {
                res.json({ lastInvoiceNumber: "Invoice-1", lastInvoiceId: 0 }); // Default value if no invoices found
            } else {
                res.json({ lastInvoiceId: lastInvoice.invoice_id, lastInvoiceNumber: lastInvoice.InvoiceNumber });
            }
        } else {
            res.json({ lastInvoiceNumber: "Invoice-1", lastInvoiceId: 0 }); // Default value if no invoices found
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/lastEstimateNumber/:userid', async (req, res) => {
    try {
        const userid = req.params.userid;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        const lastEstimate = await Estimate.findOne({ userid: userid }).sort({ estimate_id: -1 });

        if (lastEstimate) {
            if (lastEstimate.estimate_id == " " || lastEstimate.estimate_id == null || lastEstimate.estimate_id == undefined || lastEstimate.estimate_id == "") {
                res.json({ lastEstimateNumber: "Estimate-1", lastEstimate: 0 }); // Default value if no estimate found
            } else {
                res.json({ lastEstimateId: lastEstimate.estimate_id, lastEstimateNumber: lastEstimate.EstimateNumber });
            }
        } else {
            res.json({ lastEstimateNumber: "Estimate-1", lastEstimateId: 0 }); // Default value if no estimate found
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});


// Fetch invoicedetail from a invoice
router.get('/gettransactiondata/:invoiceid', async (req, res) => {
    try {
        const invoiceid = req.params.invoiceid;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        const transactiondata = (await Transactions.find({ invoiceid: invoiceid }));
        res.json(transactiondata);
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/getemailtransactiondata/:invoiceid', async (req, res) => {
    try {
        const invoiceid = req.params.invoiceid;
        // let authtoken = req.headers.authorization;

        // Verify JWT token
        // const decodedToken = jwt.verify(authtoken, jwrsecret);
        // console.log(decodedToken);
        const transactiondata = await Transactions.find({ invoiceid: invoiceid }).sort({ paiddate: 1 });
        // const transactiondata = (await Transactions.find({ invoiceid: invoiceid }));
        res.json(transactiondata);
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        // if (error.name === 'JsonWebTokenError') {
        //     return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        // }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Fetch invoicedetail from a userid
// router.get('/invoicedata/:userid', async (req, res) => {
//     try {
//         let userid = req.params.userid;
//         const invoices = (await Invoice.find({ userid: userid }));
//         res.json(invoices);
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: 'Internal server error' });
//     }
// });

// Fetch invoicedetail from a userid
router.get('/estimatedata/:userid', async (req, res) => {
    try {
        let userid = req.params.userid;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        const estimates = await Estimate.find({ userid: userid }).sort({ createdAt: -1 });;
        res.json(estimates);
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route to add payment for an invoice - old code without tds 
// router.post('/addpayment', async (req, res) => {
//     try {
//         const { paidamount, paiddate, method, note, userid, invoiceid, depositid } = req.body;
//         let authtoken = req.headers.authorization;

//         // Verify JWT token
//         const decodedToken = jwt.verify(authtoken, jwrsecret);
//         console.log(decodedToken);

//         // Create a new transaction
//         const newTransaction = new Transactions({
//             paidamount,
//             paiddate,
//             method,
//             note,
//             userid,
//             invoiceid,
//         });

//         // Save the transaction to the database
//         const savedTransaction = await newTransaction.save();
//         if (depositid != null || depositid != undefined) {

//             // Find the deposit by id
//             const depositToUpdate = await Deposit.findByIdAndDelete(depositid);

//         }

//         res.status(201).json({
//             success: true,
//             message: 'Payment added successfully!',
//             transaction: savedTransaction,
//         });
//     } catch (error) {
//         console.error(error);
//         // Handle token verification errors
//         if (error.name === 'JsonWebTokenError') {
//             return res.status(401).json({ message: 'Unauthorized: Invalid token' });
//         }
//         // Handle other errors
//         res.status(500).json({ message: 'Internal server error' });
//     }
// });


// with tds code
router.post('/addpayment', async (req, res) => {
    try {
        const { paidamount, deductedamount = 0, paiddate, method, note, userid, invoiceid, depositid } = req.body;
        let authtoken = req.headers.authorization;

        const decodedToken = jwt.verify(authtoken, jwrsecret);

        const newTransaction = new Transactions({
            paidamount,
            deductedamount,
            paiddate,
            method,
            note,
            userid,
            invoiceid,
        });

        const savedTransaction = await newTransaction.save();

        if (depositid != null || depositid != undefined) {
            await Deposit.findByIdAndDelete(depositid);
        }

        res.status(201).json({
            success: true,
            message: 'Payment added successfully!',
            transaction: savedTransaction,
        });
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        res.status(500).json({ message: 'Internal server error' });
    }
});


router.post('/deposit', async (req, res) => {
    try {
        const { depositamount, duedepositdate, depositpercentage, method, userid, invoiceid } = req.body;

        // Create a new transaction
        const newDeposit = new Deposit({
            depositamount,
            duedepositdate,
            depositpercentage,
            method,
            userid,
            invoiceid,
        });

        // Save the transaction to the database
        const savedDeposit = await newDeposit.save();

        res.status(201).json({
            success: true,
            message: 'Deposit added successfully!',
            deposit: savedDeposit,
        });
    } catch (error) {
        console.error('Error adding payment:', error);
        res.status(500).json({ success: false, message: 'Failed to add payment.' });
    }
});

router.post('/updatedeposit/:id', async (req, res) => {
    try {
        const depositId = req.params.id;
        const { depositamount, duedepositdate, depositpercentage } = req.body;
        const updatedepositdata = {
            depositamount,
            duedepositdate,
            depositpercentage,
        }
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        // Find the deposit by id
        const depositToUpdate = await Deposit.findByIdAndUpdate(depositId, updatedepositdata, { new: true });

        if (depositToUpdate) {
            res.json({
                Success: true,
                message: "Depositdata updated successfully",
                deposit: depositToUpdate.length > 0 ? depositToUpdate[depositToUpdate.length - 1] : depositToUpdate,
            });
        } else {
            res.status(404).json({
                Success: false,
                message: "Depositdata not found"
            });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});


router.get('/deposit/:id', async (req, res) => {
    try {
        const depositId = req.params.id;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        // Find the deposit by its unique ID
        const deposit = await Deposit.findById(depositId);

        if (!deposit) {
            // If the deposit is not found, send a 404 response
            res.status(404).json({ success: false, message: 'Deposit not found.' });
        } else {
            // If the deposit is found, send success response with the deposit data
            res.status(200).json({ success: true, deposit });
        }
    } catch (error) {
        console.error('Error retrieving deposit:', error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Failed to retrieve deposit.' });
    }
});

router.get('/getdepositdata/:userid/:invoiceid', async (req, res) => {
    try {
        const userid = req.params.userid;
        const invoiceid = req.params.invoiceid;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        const depositdetail = await Deposit.find({ userid: userid, invoiceid: invoiceid });
        res.json(depositdetail.length > 0 ? depositdetail[depositdetail.length - 1] : depositdetail);
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});


// Fetch signupdata from a signup
router.get('/getsignupdata/:userid', async (req, res) => {
    try {
        const userid = req.params.userid;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        const signupdetail = await User.findById(userid);
        res.json(signupdetail);
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/customers/:userid', async (req, res) => {
    try {
        let userid = req.params.userid;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        const customers = (await Customerlist.find({ userid: userid }));
        res.json(customers);
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/getcustomers/:customerId', async (req, res) => {
    try {
        const customerId = req.params.customerId;
        console.log(customerId);
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        const result = await Customerlist.findById(customerId);

        if (result) {
            res.json({
                Success: true,
                message: "Customerdata retrieved successfully",
                customer: result
            });
        } else {
            res.status(404).json({
                Success: false,
                message: "Customerdata not found"
            });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});


// Update a restaurant using POST
router.post('/updatecostomerdata/:customerId', async (req, res) => {
    try {
        const customerId = req.params.customerId; // Fix here
        const updatedcustomerdata = req.body;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        const result = await Customerlist.findByIdAndUpdate(customerId, updatedcustomerdata, { new: true });

        if (result) {
            res.json({
                Success: true,
                message: "Customerdata updated successfully",
                customer: result
            });
        } else {
            res.status(404).json({
                Success: false,
                message: "Customerdata not found"
            });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/updatesignupdatadata/:userid', upload.single('companyImageUrl'), async (req, res) => {
    try {
        const userid = req.params.userid; // Fix here
        const updatedsignupdata = req.body;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        if (req.file) {
            updatedsignupdata.companyImageUrl = req.file.path;
        }

        const result = await User.findByIdAndUpdate(userid, updatedsignupdata, { new: true });

        if (result) {
            res.json({
                Success: true,
                message: "Signupdata updated successfully",
                signupdata: result
            });
        } else {
            res.status(404).json({
                Success: false,
                message: "Signupdata not found"
            });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/updatesignupdata/:userid', async (req, res) => {
    try {
        const userid = req.params.userid; // Fix here
        const updatedsignupdata = req.body;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        const result = await User.findByIdAndUpdate(userid, updatedsignupdata, { new: true });

        if (result) {
            res.json({
                Success: true,
                message: "Signupdata updated successfully",
                signupdata: result
            });
        } else {
            res.status(404).json({
                Success: false,
                message: "Signupdata not found"
            });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/delcustomers/:customerId', async (req, res) => {
    try {
        const customerId = req.params.customerId;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        const result = await Customerlist.findByIdAndDelete(customerId);

        if (result) {
            res.json({
                Success: true,
                message: "Customer deleted successfully"
            });
        } else {
            res.status(404).json({
                Success: false,
                message: "Customer not found"
            });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.post("/additem",
    [
        body('itemname').isLength({ min: 3 }),
        body('description').isLength({ min: 1 }),
        body('unit').isLength({ min: 1 }),
        body('price').isNumeric(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        let authtoken = req.headers.authorization;

        try {
            // Verify JWT token
            const decodedToken = jwt.verify(authtoken, jwrsecret);

            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            // ✅ Check if item with same name already exists for this user
            const existingItem = await Itemlist.findOne({
                userid: req.body.userid,
                itemname: req.body.itemname
            });

            if (existingItem) {
                return res.status(400).json({
                    Success: false,
                    message: "Item name already exists for this user."
                });
            }

            // ✅ Create new item
            const newItem = await Itemlist.create({
                userid: req.body.userid,
                itemname: req.body.itemname,
                description: req.body.description,
                price: req.body.price,
                unit: req.body.unit,
            });

            res.json({
                Success: true,
                Itemdata1: newItem,
                message: "Congratulations! Your Item has been successfully added!"
            });
        }

        catch (error) {
            console.error(error);

            if (error.code === 11000) {
                // MongoDB duplicate key error
                return res.status(400).json({ message: "Item name must be unique per user." });
            }

            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ message: 'Unauthorized: Invalid token' });
            }

            res.status(500).json({ message: 'Internal server error' });
        }
    });

router.get('/itemdata/:userid', async (req, res) => {
    try {
        let userid = req.params.userid;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        const itemdata = (await Itemlist.find({ userid: userid }));
        res.json(itemdata);
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/delitem/:itemId', async (req, res) => {
    try {
        const itemId = req.params.itemId;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        const result = await Itemlist.findByIdAndDelete(itemId);

        if (result) {
            res.json({
                Success: true,
                message: "Item deleted successfully"
            });
        } else {
            res.status(404).json({
                Success: false,
                message: "Item not found"
            });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/getitems/:itemId', async (req, res) => {
    try {
        const itemId = req.params.itemId;
        console.log(itemId);
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        const result = await Itemlist.findById(itemId);

        if (result) {
            res.json({
                Success: true,
                message: "Itemdata retrieved successfully",
                item: result
            });
        } else {
            res.status(404).json({
                Success: false,
                message: "Itemdata not found"
            });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});


// Update a restaurant using POST
router.post('/updateitemdata/:itemId', async (req, res) => {
    try {
        const itemId = req.params.itemId; // Fix here
        const updateditemdata = req.body;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        const result = await Itemlist.findByIdAndUpdate(itemId, updateditemdata, { new: true });

        if (result) {
            res.json({
                Success: true,
                message: "Itemdata updated successfully",
                item: result
            });
        } else {
            res.status(404).json({
                Success: false,
                message: "Itemdata not found"
            });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

// router.post("/addteammember",
//     [
//         body('email').isEmail(),
//         body('name').isLength({ min: 3 }),
//         body('number').isNumeric(),
//         body('password').isLength({ min: 4 }),

//         // body('address').isLength(),
//     ]
//     , async (req, res) => {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//             return res.status(400).json({ errors: errors.array() });
//         }
//         const salt = await bcrypt.genSalt(10);
//         let sectmemberPassword= await bcrypt.hash(req.body.password, salt)

//         try {
//             Team.create({
//                 userid: req.body.userid,
//                 name: req.body.name,
//                 password: sectmemberPassword,
//                 email: req.body.email,
//                 number: req.body.number,
//             })
//             res.json({ 
//                 Success: true,
//                 message: "Congratulations! Your Team member has been successfully added! "
//             })
//         }
//         catch (error) {
//             console.log(error);
//             res.json({ Success: false })
//         }
//     });

router.post("/addteammember", [
    body('email').isEmail(),
    body('name').isLength({ min: 3 }),
    body('number').isNumeric(),
    body('password').isLength({ min: 4 }),
], async (req, res) => {

    const errors = validationResult(req);
    let authtoken = req.headers.authorization;
    try {
        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const email = req.body.email;
        const existingTeamMember = await Team.findOne({ email });
        const existingUser = await User.findOne({ email: email });

        if (existingUser || existingTeamMember) {
            console.log('Email already registered:', email);
            return res.status(400).json({
                success: false,
                message: "This Email ID is already registered!"
            });
        } else {
            const salt = await bcrypt.genSalt(10);
            const sectmemberPassword = await bcrypt.hash(req.body.password, salt);

            await Team.create({
                userid: req.body.userid,
                name: req.body.name,
                password: sectmemberPassword,
                email: req.body.email,
                number: req.body.number,
            });
            const companyName = await getCompanyName(req.body.userid);
            sendTeamWelcomeEmail(req.body.email, req.body.name, true, companyName);

            return res.json({
                success: true,
                message: "Congratulations! Your Team member has been successfully added!"
            });
        }
    }
    catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

async function getCompanyName(userId) {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        return user.companyname;
    } catch (error) {
        console.log(error);
        return "Company"; // Default company name if fetching fails
    }
}

// Function to send a welcome email
function sendTeamWelcomeEmail(userEmail, name, isFirstTimeLogin, companyName) {
    if (!isFirstTimeLogin) {
        console.log('Not sending welcome email as it is not the first time login.');
        return; // Do not send email if it's not the first time login
    }

    const subject = `Welcome to ${companyName} Team!!`;
    const message = `<html xmlns:v="urn:schemas-microsoft-com:vml">
        <head></head>
        <body style="background-color:#c5c1c187; margin-top: 40px;">
            <section style="font-family:sans-serif; width: 60%; margin: auto;">
                <header style="background-color: #fff; padding: 20px; border: 1px solid #faf8f8;">
                    <div style="width: 100%; margin: auto; display: flex; align-items: center;">
                        <div style="width: 40%;">
                            <img src="welcome.jpg" alt="welcome image">
                        </div>
                        <div style="width: 60%;">
                            <h2>INVOICE</h2>
                        </div>
                        <div style="clear:both ;"></div>
                    </div>

                    <div>
                        <p>Dear ${name},</p>
                        <p>I am delighted to extend a warm welcome to you as the newest member of the ${companyName} family! We are thrilled to have you on board and look forward to the positive contributions you will make to our team.</p>
                        <p>We are excited to work alongside you and support your professional growth and development.</p>
                    </div>
                </header>
                <footer style="background-color:#f5f5f587; border: 1px solid #f5f5f587; padding: 20px; color: #888; text-align: center;">
                    <div>
                        <p>&copy; 2024 Invoice. All rights reserved.</p>
                        <p>Contact us: info@invoice.com | Phone: (555) 123-4567</p>
                        <h4>Available On</h4>
                        <div>
                            <ul style="text-align: center;display: inline-flex;list-style:none;padding-left:0px">
                                <li>
                                    <a href="">
                                        <img src="https://static.xx.fbcdn.net/rsrc.php/yb/r/hLRJ1GG_y0J.ico" alt="facebook icon" style="margin: 0px 5px;">
                                    </a>
                                </li>
                                <li>
                                    <a href="">
                                        <img src="https://static.cdninstagram.com/rsrc.php/y4/r/QaBlI0OZiks.ico" alt="instagram icon" style="margin: 0px 5px;">
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>
                </footer>
            </section>
        </body>
    </html>`;

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: "jdwebservices1@gmail.com",
            pass: "oznjagccfrqngoah"
        },
    });
    // const transporter = nodemailer.createTransport({
    //     host: 'smtp.hostinger.com', // Replace with your hosting provider's SMTP server
    //     port: 465, // Replace with the appropriate port
    //     secure: true, // true for 465, false for other ports
    //     auth: {
    //       user: 'jdwebservices1@gmail.com',
    //       pass: 'oznjagccfrqngoah'
    //     }
    //   });

    const mailOptions = {
        from: 'jdwebservices1@gmail.com',
        to: userEmail,
        subject: subject,
        html: message,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Error sending email:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
}

router.get('/teammemberdata/:userid', async (req, res) => {
    try {
        let userid = req.params.userid;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        const teammemberdata = (await Team.find({ userid: userid }));
        res.json(teammemberdata);
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/getteamdata/:teamid', async (req, res) => {
    try {
        const teamid = req.params.teamid;
        console.log(teamid);
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        const result = await Team.findById(teamid);

        if (result) {
            res.json({
                Success: true,
                message: "teamdata retrieved successfully",
                team: result
            });
        } else {
            res.status(404).json({
                Success: false,
                message: "teamdata not found"
            });
        }
    }
    catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});


// Update a restaurant using POST
router.post('/updateteamdata/:teamid', async (req, res) => {
    try {
        const teamid = req.params.teamid; // Fix here
        const updatedteamdata = req.body;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        const result = await Team.findByIdAndUpdate(teamid, updatedteamdata, { new: true });

        if (result) {
            res.json({
                Success: true,
                message: "teamdata updated successfully",
                team: result
            });
        } else {
            res.status(404).json({
                Success: false,
                message: "teamdata not found"
            });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});


router.get('/delteammember/:teamid', async (req, res) => {
    try {
        const teamid = req.params.teamid;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);

        const result = await Team.findByIdAndDelete(teamid);

        if (result) {
            res.json({
                Success: true,
                message: "teammember deleted successfully"
            });
        } else {
            res.status(404).json({
                Success: false,
                message: "teammember not found"
            });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/timezones', (req, res) => {
    // Get a list of timezones using moment-timezone
    const timezones = momentTimezone.tz.names();

    // Send the list of timezones as a JSON response
    res.json(timezones);
});



// Fetch single category
router.get('/getcategories/:categoryId', async (req, res) => {
    try {
        const categoryId = req.params.categoryId;
        const categories = await Category.findById(categoryId);
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
// Fetch categories for a restaurant
router.get('/getrestaurantcategories/:restaurantId', async (req, res) => {
    try {
        const restaurantId = req.params.restaurantId;
        const categories = await Category.find({ restaurantId: restaurantId });
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Add a new category
router.post('/categories', async (req, res) => {
    try {
        const newCategory = req.body; // You should validate and sanitize this data
        const category = new Category(newCategory);
        await category.save();
        res.json({ success: true, message: 'Category added successfully' });
    } catch (error) {
        console.error('Error adding category:', error);
        res.status(500).json({ success: false, message: 'Failed to add category' });
    }
});

// Edit a category
router.put('/categories/:categoryId', async (req, res) => {
    try {
        const categoryId = req.params.categoryId;
        const updatedCategory = req.body; // You should validate and sanitize this data
        const result = await Category.findByIdAndUpdate(categoryId, updatedCategory, { new: true });
        if (result) {
            res.json({ success: true, message: 'Category updated successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Category not found' });
        }
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ success: false, message: 'Failed to update category' });
    }
});

// Delete a category
router.delete('/categories/:categoryId', async (req, res) => {
    try {
        const categoryId = req.params.categoryId;
        const result = await Category.findByIdAndDelete(categoryId);
        if (result) {
            res.json({ success: true, message: 'Category deleted successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Category not found' });
        }
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ success: false, message: 'Failed to delete category' });
    }
});

// Fetch single subcategory
router.get('/getsinglesubcategory/:subcategoryId', async (req, res) => {
    try {
        const subcategoryId = req.params.subcategoryId;
        const subcategories = await Subcategory.findById(subcategoryId);
        res.json(subcategories);
    } catch (error) {
        console.error('Error fetching subcategories:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
// Fetch subcategories for a category
router.get('/getsubcategories/:categoryId', async (req, res) => {
    try {
        const categoryId = req.params.categoryId;
        const subcategories = await Subcategory.find({ category: categoryId });
        res.json(subcategories);
    } catch (error) {
        console.error('Error fetching subcategories:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
// Fetch items for a subcategory
router.get('/getitems/:subcategoryId', async (req, res) => {
    try {
        const subcategoryId = req.params.subcategoryId;
        const items = await Items.find({ subcategoryId: subcategoryId });
        res.json(items);
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Add a new subcategory
router.post('/subcategories', async (req, res) => {
    try {
        const newSubCategory = req.body; // You should validate and sanitize this data
        const Subcategoryd = new Subcategory(newSubCategory);
        await Subcategoryd.save();
        res.json({ success: true, message: 'Subcategory added successfully' });
    } catch (error) {
        console.error('Error adding Subcategory:', error);
        res.status(500).json({ success: false, message: 'Failed to add Subcategory' });
    }
});

// Delete a subcategory
router.delete('/subcategories/:subcategoryId', async (req, res) => {
    try {
        const subcategoryId = req.params.subcategoryId;
        const result = await Subcategory.findByIdAndDelete(subcategoryId);
        if (result) {
            res.json({ success: true, message: 'Subcategory deleted successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Subcategory not found' });
        }
    } catch (error) {
        console.error('Error deleting Subcategory:', error);
        res.status(500).json({ success: false, message: 'Failed to delete Subcategory' });
    }
});

// Edit a subcategory
router.put('/subcategoriesupdate/:subcategoryId', async (req, res) => {
    try {
        const subcategoryId = req.params.subcategoryId;
        const updatedsubCategory = req.body; // You should validate and sanitize this data
        const result = await Subcategory.findByIdAndUpdate(subcategoryId, updatedsubCategory, { new: true });
        if (result) {
            res.json({ success: true, message: 'subCategory updated successfully' });
        } else {
            res.status(404).json({ success: false, message: 'subCategory not found' });
        }
    } catch (error) {
        console.error('Error updating subCategory:', error);
        res.status(500).json({ success: false, message: 'Failed to update subCategory' });
    }
});

// get all item
router.get('/itemsall', async (req, res) => {
    try {
        const result = await Items.find();
        if (result) {
            res.json({ success: true, items: result, message: 'Items get successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Items not found' });
        }
    } catch (error) {
        console.error('Error adding item:', error);
        res.status(500).json({ success: false, message: 'Failed to add item' });
    }
});

// add offers
router.post('/offers', async (req, res) => {
    try {
        const formData = req.body;
        const newOffer = new Offers(formData);
        await newOffer.save();
        res.json({ success: true, message: 'Offer added successfully' });
    } catch (error) {
        console.error('Error adding offer:', error);
        res.status(500).json({ success: false, message: 'Failed to add offer' });
    }
});

router.post('/WeeklyOffers', async (req, res) => {
    try {
        // const { searchResults, startTime, endTime, selectedDays } = req.body;

        const newWeeklyOffer = new WeeklyOffers(req.body);

        await newWeeklyOffer.save();
        res.json({ success: true, message: 'WeeklyOffer added successfully' });
    } catch (error) {
        console.error('Error adding WeeklyOffer:', error);
        res.status(500).json({ success: false, message: 'Failed to add WeeklyOffer' });
    }
});

//  get all Offers Items
router.get('/offeritemsall', async (req, res) => {
    try {
        const result = await Offers.find();
        if (result) {
            res.json({ success: true, offers: result, message: 'Offers Items get successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Offers Items not found' });
        }
    } catch (error) {
        console.error('Error adding Offers Items:', error);
        res.status(500).json({ success: false, message: 'Failed to add Offers Items' });
    }
});

router.get('/weeklyofferitemsall', async (req, res) => {
    try {
        // Fetch all offers from the database
        const offers = await WeeklyOffers.find();

        // Send the offers as a JSON response to the frontend
        res.json({ success: true, offers });
    } catch (error) {
        console.error('Error fetching offers:', error);
        // Send an error response to the frontend
        res.status(500).json({ success: false, message: 'Failed to fetch offers' });
    }
});

// Add a new item
router.post('/items', async (req, res) => {
    try {
        const newItem = req.body; // You should validate and sanitize this data
        const addedItem = new Items(newItem);
        await addedItem.save();
        res.json({ success: true, message: 'Item added successfully' });
    } catch (error) {
        console.error('Error adding item:', error);
        res.status(500).json({ success: false, message: 'Failed to add item' });
    }
});

// Fetch items for a restaurant
router.get('/getrestaurantitems/:restaurantId', async (req, res) => {
    try {
        const restaurantId = req.params.restaurantId;
        const items1 = await Items.find({ restaurantId: restaurantId });
        res.json(items1);
    } catch (error) {
        console.error('Error fetching Items:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Delete a item
router.delete('/delitems/:itemId', async (req, res) => {
    try {
        const itemId = req.params.itemId;
        const results = await Items.findByIdAndDelete(itemId);
        if (results) {
            res.json({ success: true, message: 'Items deleted successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Items not found' });
        }
    } catch (error) {
        console.error('Error deleting Subcategory:', error);
        res.status(500).json({ success: false, message: 'Failed to delete Subcategory' });
    }
});


// Fetch single subcategory
router.get('/getsingleitem/:itemId', async (req, res) => {
    try {
        const itemId = req.params.itemId;
        const item = await Items.findById(itemId);
        res.json(item);
    } catch (error) {
        console.error('Error fetching single item:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Edit a Items
router.put('/itemsupdate/:itemId', async (req, res) => {
    try {
        const itemId = req.params.itemId;
        const updateditem = req.body; // You should validate and sanitize this data
        const result1 = await Items.findByIdAndUpdate(itemId, updateditem, { new: true });
        if (result1) {
            res.json({ success: true, message: 'Items updated successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Items not found' });
        }
    } catch (error) {
        console.error('Error updating Items:', error);
        res.status(500).json({ success: false, message: 'Failed to update Items' });
    }
});

router.post('/menu', async (req, res) => {
    try {
        const { itemId, sectionName, restaurantId } = req.body;

        const newMenu = new Menu({
            items: itemId,
            name: sectionName,
            restaurantId: restaurantId
        });

        await newMenu.save();
        res.json({ Success: true, message: 'Menu created successfully' });
    } catch (error) {
        console.error("Error creating Menu:", error);
        res.status(500).json({ Success: false, message: 'Failed to create Menu', error: error.message });
    }
});



router.get('/menu/:restaurantId', async (req, res) => {
    try {
        const restaurantId = req.params.restaurantId;
        const menuItems = await Menu.find({ restaurantId });
        res.json(menuItems);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/getmenu/:menuItemId', async (req, res) => {
    try {
        const menuItemId = req.params.menuItemId;
        const result = await Menu.findById(menuItemId);

        if (result) {
            res.json({
                Success: true,
                message: "Menu retrieved successfully",
                menu: result
            });
        } else {
            res.status(404).json({
                Success: false,
                message: "Menu not found"
            });
        }
    } catch (error) {
        console.error("Error fetching Menu:", error);
        res.status(500).json({
            Success: false,
            message: "Failed to fetch Menu"
        });
    }
});


router.post('/menu/:menuItemId', async (req, res) => {
    try {
        const menuItemId = req.params.menuItemId;
        const updatedmenu = req.body;

        const result = await Menu.findByIdAndUpdate(menuItemId, updatedmenu, { new: true });

        if (result) {
            res.json({
                Success: true,
                message: "Menu updated successfully",
                menu: result
            });
        } else {
            res.status(404).json({
                Success: false,
                message: "Menu not found"
            });
        }
    } catch (error) {
        console.error("Error updating Menu:", error);
        res.status(500).json({
            Success: false,
            message: "Failed to update Menu"
        });
    }
});

router.delete('/menu/:id', async (req, res) => {
    try {
        const deletedMenu = await Menu.findByIdAndDelete(req.params.id);

        if (deletedMenu) {
            res.json({ Success: true, message: 'Menu deleted successfully' });
        } else {
            res.json({ Success: false, message: 'Menu not found' });
        }
    } catch (error) {
        res.json({ Success: false, message: 'Failed to delete Menu' });
    }
});

router.get('/menu/:restaurantId', async (req, res) => {
    try {
        const restaurantId = req.params.restaurantId;
        const menuItems = await Menu.find({ restaurantId: restaurantId });
        res.json(menuItems);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/foodData', (req, res) => {
    try {
        res.send([global.food_items, global.foodCategory])
    }
    catch (error) {
        console.error(error.message);
        res.send("Server Error")
    }
})


// API endpoint to save user preferences
router.post('/saveColorPreferences', async (req, res) => {
    try {
        const { userid, restaurantId, userPreference } = req.body;

        // Create a new user preference document
        const newPreference = new UserPreference({
            userId: userid,
            restaurantId: restaurantId,
            backgroundColor: userPreference.backgroundColor,
            textColor: userPreference.textColor,
            headingTextColor: userPreference.headingTextColor,
            categoryColor: userPreference.categoryColor,
            font: userPreference.font,
            fontlink: userPreference.fontlink,
            // Add other preferences here
        });

        // Save the user preference to the database
        const savedPreference = await newPreference.save();

        res.json(savedPreference);
    } catch (error) {
        console.error('Error saving user preferences:', error);
        res.status(500).json({ error: 'Failed to save user preferences' });
    }
});


// In your backend API (e.g., Express.js)
router.get('/getUserPreferences/:userid', async (req, res) => {
    try {
        const userid = req.params.userid;
        // Retrieve user preferences from the database based on the user ID
        const userPreferences = await UserPreference.find({ userId: userid });
        res.json(userPreferences);
    } catch (error) {
        console.error('Error retrieving user preferences:', error);
        res.status(500).json({ error: 'Failed to retrieve user preferences' });
    }
});



// Create a new expense
router.post('/expense', async (req, res) => {
    try {
        const { invoiceId, vendor, expenseType,expenseDate ,transactionType,paymentStatus, amount, description, receiptUrl } = req.body;

        // Check if the invoice exists
        // const invoice = await Invoice.findById(invoiceId);
        // if (!invoice) {
        //     return res.status(404).json({ error: 'Invoice not found' });
        // }

        // Create and save the expense
        const expense = new Expense({
            invoiceId,
            vendor,
            expenseType,
            expenseDate ,
            amount,
            transactionType,
            description,
            paymentStatus,
            receiptUrl
        });
        await expense.save();

        res.status(201).json(expense);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all expenses for a specific invoice
router.get('/expense/:invoiceId', async (req, res) => {
    try {
        const { invoiceId } = req.params;

        const expenses = await Expense.find({ invoiceId });
        res.status(200).json(expenses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/expense/', async (req, res) => {
    try {
        const { invoiceId } = req.params;

        const expenses = await Expense.find();
        res.status(200).json(expenses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get a specific expense by ID
router.get('/expense/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const expense = await Expense.findById(id);
        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        res.status(200).json(expense);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update an expense
router.put('/expense/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { vendorName, expenseType, amount, description, receiptUrl, paymentStatus } = req.body;

        const expense = await Expense.findByIdAndUpdate(
            id,
            { vendorName, expenseType, amount, description, receiptUrl, paymentStatus },
            { new: true, runValidators: true }
        );

        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        res.status(200).json(expense);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete an expense
router.delete('/expense/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const expense = await Expense.findByIdAndDelete(id);
        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        res.status(200).json({ message: 'Expense deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// Create a new expense type
router.post('/expensetype', async (req, res) => {
    try {
        const { name, description } = req.body;

        // Check if an expense type with the same name already exists
        const existingExpenseType = await ExpenseType.findOne({ name });
        if (existingExpenseType) {
            return res.status(400).json({ error: 'Expense type already exists' });
        }

        // Create and save the new expense type
        const expenseType = new ExpenseType({ name, description });
        await expenseType.save();

        res.status(201).json(expenseType);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all expense types
router.get('/expensetype', async (req, res) => {
    try {
        const expenseTypes = await ExpenseType.find();
        res.status(200).json(expenseTypes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get a specific expense type by ID
router.get('/expensetype/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const expenseType = await ExpenseType.findById(id);
        if (!expenseType) {
            return res.status(404).json({ error: 'Expense type not found' });
        }
        res.status(200).json(expenseType);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update an expense type
router.put('/expensetype/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        const expenseType = await ExpenseType.findByIdAndUpdate(
            id,
            { name, description },
            { new: true, runValidators: true }
        );

        if (!expenseType) {
            return res.status(404).json({ error: 'Expense type not found' });
        }

        res.status(200).json(expenseType);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete an expense type
router.delete('/expensetype/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const expenseType = await ExpenseType.findByIdAndDelete(id);
        if (!expenseType) {
            return res.status(404).json({ error: 'Expense type not found' });
        }

        res.status(200).json({ message: 'Expense type deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a new vendor
router.post('/vendor', async (req, res) => {
    try {
        const { name, contactPerson, email, phone, address, notes } = req.body;

        // Check if a vendor with the same name or email already exists
        const existingVendor = await Vendor.findOne({ $or: [{ name }, { email }] });
        if (existingVendor) {
            return res.status(400).json({ error: 'Vendor with the same name or email already exists' });
        }

        // Create and save the new vendor
        const vendor = new Vendor({ name, contactPerson, email, phone, address, notes });
        await vendor.save();

        res.status(201).json(vendor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all vendors
router.get('/vendor', async (req, res) => {
    try {
        const vendors = await Vendor.find();
        res.status(200).json(vendors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get a specific vendor by ID
router.get('/vendor/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const vendor = await Vendor.findById(id);
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }
        res.status(200).json(vendor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update a vendor
router.put('/vendor/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, contactPerson, email, phone, address, notes } = req.body;

        const vendor = await Vendor.findByIdAndUpdate(
            id,
            { name, contactPerson, email, phone, address, notes },
            { new: true, runValidators: true }
        );

        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        res.status(200).json(vendor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a vendor
router.delete('/vendor/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const vendor = await Vendor.findByIdAndDelete(id);
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        res.status(200).json({ message: 'Vendor deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


//Team Entry edit

router.get('/userEntries/:userid', async (req, res) => {
    try {
        const { userid } = req.params;
        let authtoken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authtoken, jwrsecret);
        console.log(decodedToken);
        const userEntries = await Timeschema.find({ userid }).sort({ startTime: 1 });

        if (userEntries) {
            res.json({ userEntries });
        } else {
            res.status(404).json({ message: 'No entries found for this user' });
        }
    } catch (error) {
        console.error(error);
        // Handle token verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        // Handle other errors
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Update time entry
router.put('/userEntries/:entryId', async (req, res) => {
    try {
        const { entryId } = req.params;
        const { startTime, endTime } = req.body;
        const authToken = req.headers.authorization;

        // Verify JWT token
        const decodedToken = jwt.verify(authToken, jwrsecret);

        if (!decodedToken) {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }

        // Update the entry in the database
        const updatedEntry = await Timeschema.findByIdAndUpdate(
            entryId,
            { startTime, endTime },
            { new: true } // Return the updated document
        );

        if (!updatedEntry) {
            return res.status(404).json({ message: 'Entry not found' });
        }

        // Recalculate totalTime and timeInSeconds
        const start = new Date(startTime).getTime();
        const end = new Date(endTime).getTime();
        const timeInSeconds = Math.floor((end - start) / 1000);

        updatedEntry.timeInSeconds = timeInSeconds;

        const hours = Math.floor(timeInSeconds / 3600);
        const minutes = Math.floor((timeInSeconds % 3600) / 60);
        const seconds = timeInSeconds % 60;

        updatedEntry.totalTime = `${hours} hours ${minutes} minutes ${seconds} seconds`;

        await updatedEntry.save();

        res.json({ message: 'Time updated successfully', updatedEntry });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// Update an entry
router.put('/userEntriesUpdate/:entryId', async (req, res) => {
    try {
        const entryId = req.params.entryId; // Extract entry ID from the URL
        const updatedData = req.body; // The updated fields from the frontend

        // Update the entry in the database
        const updatedEntry = await Timeschema.findByIdAndUpdate(
            entryId,
            updatedData,
            { new: true } // Return the updated document
        );

        if (updatedEntry) {
            res.json({ success: true, message: 'Entry updated successfully', updatedEntry });
        } else {
            res.status(404).json({ success: false, message: 'Entry not found' });
        }
    } catch (error) {
        console.error('Error updating entry:', error);
        res.status(500).json({ success: false, message: 'Failed to update entry' });
    }
});


// Delete a category
router.delete('/userEntries/:entryId', async (req, res) => {
    try {
        const entryId = req.params.entryId;
        const result = await Timeschema.findByIdAndDelete(entryId);
        if (result) {
            res.json({ success: true, message: 'Entry deleted successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Entry not found' });
        }
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ success: false, message: 'Failed to delete category' });
    }
});


router.get('/allEntries', async (req, res) => {
    try {
        const allEntries = await Timeschema.find().sort({ startTime: 1 });

        if (allEntries && allEntries.length > 0) {
            res.json({ allEntries });
        } else {
            res.status(404).json({ message: 'No entries found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});


module.exports = router;
