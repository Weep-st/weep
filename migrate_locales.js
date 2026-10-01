import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateLocales() {
  console.log("Iniciando migración de Locales a Supabase Auth...");

  // 1. Obtener todos los locales
  const { data: locales, error: fetchError } = await supabase
    .from('locales')
    .select('*');

  if (fetchError) {
    console.error("Error al obtener locales:", fetchError);
    return;
  }

  console.log(`Se encontraron ${locales.length} locales. Migrando...`);
  let successCount = 0;
  let errorCount = 0;

  for (const loc of locales) {
    if (loc.auth_id) {
      console.log(`[SKIP] Local ${loc.email} ya tiene auth_id (${loc.auth_id}).`);
      continue;
    }

    if (!loc.email || !loc.password) {
      console.log(`[SKIP] Local ${loc.id} no tiene email o password.`);
      continue;
    }

    let pwd = loc.password;
    if (pwd.length < 6) {
        pwd = pwd.padEnd(6, '0');
    }

    try {
      // 1. Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: loc.email,
        password: pwd,
        email_confirm: true,
        user_metadata: { role: 'local', old_id: loc.id }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          console.log(`[EXISTS] El email ${loc.email} ya está registrado en Auth. Buscando su ID...`);
          const { data: existingUsers } = await supabase.auth.admin.listUsers();
          const existingUser = existingUsers.users.find(u => u.email === loc.email);
          if (existingUser) {
            await supabase.from('locales').update({ auth_id: existingUser.id, password: pwd }).eq('id', loc.id);
            console.log(`[VINCULADO] Local ${loc.email} vinculado al usuario existente.`);
            successCount++;
          }
        } else {
          console.error(`[ERROR] No se pudo crear a ${loc.email}:`, authError.message);
          errorCount++;
        }
        continue;
      }

      // 2. Actualizar el auth_id en la tabla locales
      const authId = authData.user.id;
      const { error: updateError } = await supabase
        .from('locales')
        .update({ auth_id: authId, password: pwd })
        .eq('id', loc.id);

      if (updateError) {
        console.error(`[ERROR] Creado en Auth pero falló actualizando tabla para ${loc.email}:`, updateError.message);
        errorCount++;
      } else {
        console.log(`[OK] Migrado exitosamente: ${loc.email}`);
        successCount++;
      }
    } catch (err) {
      console.error(`[EXCEPTION] Error con ${loc.email}:`, err.message);
      errorCount++;
    }
  }

  console.log("-----------------------------------------");
  console.log("Migración finalizada.");
  console.log(`Exitosos: ${successCount}`);
  console.log(`Errores: ${errorCount}`);
}

migrateLocales();
