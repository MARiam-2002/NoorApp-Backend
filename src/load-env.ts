import dotenv from 'dotenv';

// Vercel injects env vars automatically — dotenv is for local dev only
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}
