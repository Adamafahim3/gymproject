// Connects to Supabase using the URL and secret key from .env.

require("./settings");

const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env.");
}

module.exports = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
});
