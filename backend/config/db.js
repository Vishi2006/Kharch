const mongoose = require('mongoose');

let cachedConnection = null;

const connectDB = async () => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  try {
    const connUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/test';
    console.log(`Connecting to MongoDB at: ${connUri.replace(/:\/\/.*@/, '://***:***@')}`);
    const conn = await mongoose.connect(connUri, {
      dbName: process.env.MONGODB_DB_NAME || 'test',
      bufferCommands: false,
      maxPoolSize: 10,
      autoIndex: true,
    });
    cachedConnection = conn;
    console.log(`MongoDB Connected: ${conn.connection.host} [Database: ${conn.connection.name}]`);
    return conn;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
      process.exit(1);
    }
    throw error;
  }
};

module.exports = connectDB;
