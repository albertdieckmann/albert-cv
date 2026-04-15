import { sql } from '@vercel/postgres';
import { readFileSync } from 'fs';

// Load .env.local manually
const env = readFileSync('.env.local', 'utf-8');
env.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) {
    const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
    process.env[key.trim()] = val;
  }
});

await sql`
  CREATE TABLE IF NOT EXISTS contact_messages (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

console.log('✓ Tabel contact_messages oprettet');
process.exit(0);
