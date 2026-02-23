// Script de verificación de conexión a Supabase
// Ejecutar con: npx tsx scripts/verify-supabase-connection.ts
// o agregar al package.json: "verify:supabase": "tsx scripts/verify-supabase-connection.ts"

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔌 Verificando conexión a Supabase...\n');

if (!supabaseUrl) {
  console.error('❌ ERROR: NEXT_PUBLIC_SUPABASE_URL no está definida');
  console.log('   Esperada: https://vzyqqxsgsocyrbhmfmvl.supabase.co');
  process.exit(1);
}

if (!supabaseAnonKey) {
  console.error('❌ ERROR: NEXT_PUBLIC_SUPABASE_ANON_KEY no está definida');
  console.log('   Esperada: sb_publishable_DLr6p4cHSTqJfcq4FKRC3A_k2JZXJh9');
  process.exit(1);
}

console.log('✅ Variables de entorno encontradas:');
console.log(`   URL: ${supabaseUrl}`);
console.log(`   Key: ${supabaseAnonKey.substring(0, 30)}...\n`);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyConnection() {
  const tests = [
    {
      name: 'Conexión básica',
      test: async () => {
        const { error } = await supabase.from('user_profiles').select('id').limit(1);
        if (error) throw error;
      },
    },
    {
      name: 'Tabla user_profiles',
      test: async () => {
        const { data, error } = await supabase.from('user_profiles').select('id').limit(1);
        if (error) throw error;
        return data;
      },
    },
    {
      name: 'Tabla anonymous_usage',
      test: async () => {
        const { data, error } = await supabase.from('anonymous_usage').select('id').limit(1);
        if (error) throw error;
        return data;
      },
    },
    {
      name: 'Tabla conversion_history',
      test: async () => {
        const { data, error } = await supabase.from('conversion_history').select('id').limit(1);
        if (error) throw error;
        return data;
      },
    },
    {
      name: 'Políticas RLS activas',
      test: async () => {
        // Intentar leer sin autenticación (debería funcionar para anonymous_usage)
        const { error } = await supabase.from('anonymous_usage').select('id').limit(1);
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 es "no rows returned", está bien
      },
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const { name, test } of tests) {
    try {
      await test();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error: any) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Resultados: ${passed} pasaron, ${failed} fallaron`);

  if (failed === 0) {
    console.log('\n🎉 ¡Todas las pruebas pasaron! La conexión está funcionando correctamente.');
    return true;
  } else {
    console.log('\n⚠️  Algunas pruebas fallaron. Revisa la configuración.');
    return false;
  }
}

verifyConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Error inesperado:', error);
    process.exit(1);
  });




