import fs from 'fs';
const SUPABASE_URL = 'https://jskxfescamdjesdrcnkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

(async () => {
  try {
    const res = await fetch(`https://jskxfescamdjesdrcnkf.supabase.co/rest/v1/`, {
      method: "GET",
      headers: {
        "Accept": "application/openapi+json",
        "apikey": SUPABASE_ANON_KEY
      }
    });
    const schema = await res.json();
    const tableInfo = schema.components?.schemas?.['pedidos_general'] || schema.definitions?.['pedidos_general'];
    if (tableInfo) {
      console.log("Columns of pedidos_items:", Object.keys(tableInfo.properties).join(', '));
    } else {
      console.log("pedidos_items not found in OpenAPI definition. Available components:", Object.keys(schema.components?.schemas || schema.definitions || {}).join(', '));
    }
  } catch (err) {
    console.error(err);
  }
})();
