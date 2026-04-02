import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// VULNERABILITY: helmet() middleware is intentionally omitted — for DAST demo.
// Without helmet, responses lack security headers:
//   X-Frame-Options, X-Content-Type-Options, Content-Security-Policy, etc.
// DAST scanners (ZAP) will flag these as missing-security-headers findings.
// import helmet from 'helmet';

import { connectDB } from './config/database';
import authRoutes from './routes/auth';
import entriesRoutes from './routes/entries';
import searchRoutes from './routes/search';

dotenv.config();

const app = express();

// CORS configuration: Allow specific origins (for preview envs) or all origins (local dev)
const corsOriginsList = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(origin => {
      origin = origin.trim();
      // If origin is just a host (no protocol), prepend https://
      return origin.startsWith('http') ? origin : `https://${origin}`;
    })
  : ['*']; // Allow all origins if not specified (local dev)

console.log('CORS allowed origins:', corsOriginsList);

// VULNERABILITY: Open CORS — no origin allowlist for demo simplicity.
app.use(cors({
  origin: (origin, callback) => {
    console.log('CORS check for origin:', origin);

    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    // If corsOriginsList is *, allow all
    if (corsOriginsList.includes('*')) return callback(null, true);

    // Check if origin is in allowed list (exact match)
    if (corsOriginsList.includes(origin)) return callback(null, true);

    // Check for wildcard patterns (e.g., *.onrender.com)
    const isAllowed = corsOriginsList.some(allowed => {
      if (allowed.includes('*')) {
        const pattern = allowed.replace(/\*/g, '.*').replace(/\./g, '\\.');
        return new RegExp(`^${pattern}$`).test(origin);
      }
      return false;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(null, true); // Temporarily allow all for debugging
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use(express.json());

// If helmet were enabled it would go here:
// app.use(helmet());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/entries', entriesRoutes);
app.use('/api/search', searchRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: 'SecureFlow Vault' });
});

// Bootstrap DB
connectDB().catch((err) => {
  console.error('DB connection failed:', err);
  process.exit(1);
});

export default app;
