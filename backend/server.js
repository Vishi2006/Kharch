const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from multiple search paths
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

const connectDB = require('./config/db');

// Pre-register all Mongoose models before any route handler runs
require('./models/User');
require('./models/Space');
require('./models/ExpenseTitle');
require('./models/Transaction');
require('./models/MonthlySummary');
require('./models/PaymentAttempt');
require('./models/NotificationEvent');
require('./models/Consent');
require('./models/DeviceToken');

// Connect DB (non-blocking for serverless warm up)
connectDB().catch((err) => console.error('Initial DB connection attempt:', err.message));

const app = express();

// Trust first proxy (required for rate limiting on Vercel/Render)
app.set('trust proxy', 1);

// Ensure DB connected on each request (crucial for serverless lambda lifecycle)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://kharch2026.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean).map(url => url.trim().replace(/\/$/, ''));

const isLocalOrLanOrigin = (origin) => {
  return /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin);
};

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.trim().replace(/\/$/, '');
    const isAllowed = allowedOrigins.includes(normalizedOrigin) || isLocalOrLanOrigin(normalizedOrigin);
    if (!isAllowed) {
      return callback(null, true); // Allow mobile requests / custom origins gracefully
    }
    return callback(null, true);
  },
  credentials: true,
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Cookie parser
app.use(cookieParser());

// Request Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP, please try again after 15 minutes.' }
});
app.use('/api/', apiLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverless: true, time: new Date() });
});
app.get('/health', (req, res) => {
  res.json({ status: 'ok', serverless: true, time: new Date() });
});

// Register Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/spaces', require('./routes/spaces'));
app.use('/api/titles', require('./routes/titles'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/summaries', require('./routes/summaries'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/payment-attempts', require('./routes/paymentAttempts'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/companion', require('./routes/companion'));
app.use('/api/inbox', require('./routes/inbox'));
app.use('/api/consent', require('./routes/consent'));
app.use('/consent', require('./routes/consent'));
app.use('/my-data', (req, res, next) => {
  req.url = '/my-data';
  require('./routes/consent')(req, res, next);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({
    message: err.message || 'Server error',
    error: process.env.NODE_ENV === 'production' ? {} : err
  });
});

// Only bind to port if executed directly
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
}

module.exports = app;
