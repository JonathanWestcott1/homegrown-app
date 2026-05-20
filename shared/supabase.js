// shared/supabase.js — single Supabase client instance used by all pages
// Load this first (after the Supabase CDN script), before any other shared or feature files.

const _sb = window.supabase.createClient(
  'https://mccrpgqtqtrxfifxvwbd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jY3JwZ3F0cXRyeGZpZnh2d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NTAwMDIsImV4cCI6MjA5NDEyNjAwMn0.iB3u2M7H0-D2Z2SbRQN0vHtOB62sASsGeF09FICzcc4'
);
