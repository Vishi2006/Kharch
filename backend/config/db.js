const mongoose = require('mongoose');

let cachedConnection = null;

const connectDB = async () => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  try {
    let connUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/test';
    
    // Explicitly enforce 'test' database: replace any /kharch or unspecified database path
    if (connUri.includes('/kharch')) {
      connUri = connUri.replace(/\/kharch(\?|$)/, '/test$1');
    }
    // If the MongoDB Atlas URI ends with '.mongodb.net/' or '.mongodb.net/?' without a DB name
    if (/mongodb\.net\/(\?|$)/.test(connUri)) {
      connUri = connUri.replace('mongodb.net/', 'mongodb.net/test');
    }

    const dbName = process.env.MONGODB_DB_NAME || 'test';
    console.log(`Connecting to MongoDB [target db: ${dbName}] at: ${connUri.replace(/:\/\/.*@/, '://***:***@')}`);

    const conn = await mongoose.connect(connUri, {
      dbName: dbName,
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
