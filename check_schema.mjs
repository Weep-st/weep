import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jskxfescamdjesdrcnkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkSchema() {
  const { data, error } = await supabase.from('locales').select('*').limit(1);
  if (error) {
    console.error('Error fetching locales:', error);
    return;
  }
  if (data && data.length > 0) {
    console.log('Columns of locales:', Object.keys(data[0]));
  } else {
    console.log('No data in locales table.');
  }

  // Check admin_tasks table
  const { data: tasks, error: tasksError } = await supabase.from('admin_tasks').select('*').limit(1);
  if (tasksError) {
    console.log('admin_tasks table might not exist.');
  } else {
    console.log('admin_tasks table exists. Columns:', Object.keys(tasks[0] || {}));
  }
}

checkSchema();
