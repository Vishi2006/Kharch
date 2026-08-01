const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const connUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kharch';
    console.log(`Connecting to MongoDB at: ${connUri}`);
    const conn = await mongoose.connect(connUri, {
      autoIndex: true, // Auto-build indexes in development; might disable in high-scale prod but fine for Altas Free tier
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
