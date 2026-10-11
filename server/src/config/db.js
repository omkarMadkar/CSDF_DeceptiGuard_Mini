const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/deceptiguard';
  try {
    await mongoose.connect(uri);
    console.log(`[Database] MongoDB Connected successfully to ${uri}`);
  } catch (err) {
    console.error(`[Database Error] Connection failed: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
