const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
  try {
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const rankings = await db.collection('membershiprankings').find({ isActive: true }).toArray();
    console.log('Rankings:', rankings);
    
    const users = await db.collection('users').find({}).toArray();
    console.log('Users loyalty points:', users.map(u => ({ email: u.email, points: u.loyaltyPoint })));
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
check();
