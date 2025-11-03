const mongoose = require('mongoose');
const Customerlist = require('./models/Customerlist'); // adjust the path as needed

const MONGO_URI = 'mongodb+srv://eshajdwebservices:jdweb123@cluster0.evzfn2i.mongodb.net/invoicemanagement?retryWrites=true&w=majority'; // Replace with your Mongo URI

const migrateEmails = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB.');

    // Find customers with legacy `email` field (string)
    const outdatedCustomers = await Customerlist.find({
      email: { $exists: true, $type: 'string' },
    });

    console.log(`Found ${outdatedCustomers.length} customers to update.`);

    for (const customer of outdatedCustomers) {
      const email = customer.email;

      // Skip empty or invalid email
      if (!email || typeof email !== 'string') continue;

      customer.emails = [email.toLowerCase()];
      customer.email = undefined; // remove old email field

      await customer.save();
      console.log(`✅ Migrated customer: ${customer._id}`);
    }

    console.log('✅ Migration completed.');
    process.exit();
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

migrateEmails();
