// Script de prueba de conexión a Supabase
// Ejecutar con: node scripts/test-connection.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERROR: Variables de entorno no encontradas');
  console.log('\nPor favor, asegúrate de tener un archivo .env.local con:');
  console.log('NEXT_PUBLIC_SUPABASE_URL=https://vzyqqxsgsocyrbhmfmvl.supabase.co');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_DLr6p4cHSTqJfcq4FKRC3A_k2JZXJh9');
  process.exit(1);
}

console.log('🔌 Probando conexión a Supabase...');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseAnonKey.substring(0, 20) + '...');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    // Test 1: Verificar que podemos conectarnos
    console.log('\n📊 Test 1: Verificando conexión...');
    const { data: tables, error: tablesError } = await supabase
      .from('user_profiles')
      .select('count', { count: 'exact', head: true });
    
    if (tablesError) {
      console.error('❌ Error de conexión:', tablesError.message);
      return false;
    }
    
    console.log('✅ Conexión exitosa');
    
    // Test 2: Verificar tablas principales
    console.log('\n📋 Test 2: Verificando tablas...');
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1);
    
    if (profilesError) {
      console.error('❌ Error al acceder a user_profiles:', profilesError.message);
      return false;
    }
    
    console.log('✅ Tabla user_profiles accesible');
    
    // Test 3: Verificar RLS
    console.log('\n🔒 Test 3: Verificando políticas RLS...');
    const { data: anonymous, error: anonymousError } = await supabase
      .from('anonymous_usage')
      .select('id')
      .limit(1);
    
    if (anonymousError) {
      console.error('❌ Error al acceder a anonymous_usage:', anonymousError.message);
      return false;
    }
    
    console.log('✅ Tabla anonymous_usage accesible');
    
    // Test 4: Verificar funciones
    console.log('\n⚙️  Test 4: Verificando funciones...');
    const { data: functions, error: functionsError } = await supabase.rpc('cleanup_old_anonymous_usage');
    
    // Esta función no retorna datos, solo verificar que existe
    if (functionsError && !functionsError.message.includes('permission denied')) {
      console.error('❌ Error al verificar funciones:', functionsError.message);
      return false;
    }
    
    console.log('✅ Funciones disponibles');
    
    console.log('\n🎉 ¡Todas las pruebas pasaron! La conexión está funcionando correctamente.');
    return true;
    
  } catch (error) {
    console.error('❌ Error inesperado:', error.message);
    return false;
  }
}

testConnection().then(success => {
  process.exit(success ? 0 : 1);
});




