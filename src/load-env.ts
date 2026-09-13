import dotenv from 'dotenv';

/**
 * Load `.env` for local/dev. Railway (and similar hosts) inject process.env
 * before boot — dotenv does not override existing keys by default, so hosted
 * secrets always win.
 */
dotenv.config();
