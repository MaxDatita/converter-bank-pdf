# Sistema de Tracking Anónimo - Implementación

## 🎯 **Objetivo**
Implementar un sistema completo de tracking para usuarios anónimos que permita:
- Limitar el uso a **1 página por día** por IP address
- Registrar todas las conversiones en la base de datos
- Mantener estadísticas diarias y mensuales
- Proporcionar respaldo al sistema de cookies del frontend

## 📋 **Archivos Modificados/Creados**

### **1. API Route (`app/api/process-statement/route.ts`)**
- ✅ **Tracking completo** para usuarios anónimos
- ✅ **Registro en `anonymous_usage`** por IP address
- ✅ **Registro en `daily_usage`** con `user_id = NULL`
- ✅ **Registro en `monthly_usage`** con `user_id = NULL`
- ✅ **Detección automática de IP** del cliente

### **2. Scripts SQL Nuevos**
- ✅ **`006-create-anonymous-tracking.sql`** - Crea tabla `anonymous_usage`
- ✅ **`007-update-tables-for-anonymous.sql`** - Modifica tablas existentes
- ✅ **`008-test-anonymous-tracking.sql`** - Script de prueba y verificación

### **3. Frontend (`app/page.tsx`)**
- ✅ **Hook `useAnonymousUsage`** para tracking local
- ✅ **Verificación de límites** antes de subir archivos
- ✅ **Interfaz deshabilitada** cuando se alcanza el límite
- ✅ **Modal de registro** para usuarios anónimos

## 🚀 **Pasos de Implementación**

### **Paso 1: Ejecutar Scripts SQL en Supabase**

#### **1.1 Crear tabla anonymous_usage**
```sql
-- Copiar y ejecutar en Supabase SQL Editor
-- Contenido del archivo: scripts/006-create-anonymous-tracking.sql
```

#### **1.2 Modificar tablas existentes**
```sql
-- Copiar y ejecutar en Supabase SQL Editor
-- Contenido del archivo: scripts/007-update-tables-for-anonymous.sql
```

#### **1.3 Verificar implementación**
```sql
-- Copiar y ejecutar en Supabase SQL Editor
-- Contenido del archivo: scripts/008-test-anonymous-tracking.sql
```

### **Paso 2: Verificar API**
- ✅ El API ya está modificado para registrar usuarios anónimos
- ✅ Se registra en 3 tablas: `anonymous_usage`, `daily_usage`, `monthly_usage`
- ✅ Se detecta automáticamente la IP del cliente

### **Paso 3: Probar Funcionalidad**
1. **Subir PDF como usuario anónimo**
2. **Verificar en base de datos:**
   - `conversion_history` - Registro de conversión
   - `anonymous_usage` - Tracking por IP
   - `daily_usage` - Uso diario (user_id = NULL)
   - `monthly_usage` - Uso mensual (user_id = NULL)

## 📊 **Estructura de Base de Datos**

### **Tabla `anonymous_usage`**
```sql
CREATE TABLE anonymous_usage (
  id UUID PRIMARY KEY,
  ip_address INET NOT NULL,
  date DATE NOT NULL,
  pages_processed INTEGER DEFAULT 0,
  files_processed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(ip_address, date)
);
```

### **Tablas Modificadas**
- **`daily_usage`**: `user_id` ahora permite `NULL` para usuarios anónimos
- **`monthly_usage`**: `user_id` ahora permite `NULL` para usuarios anónimos
- **`conversion_history`**: `user_id` ahora permite `NULL` para usuarios anónimos

## 🔍 **Verificación de Implementación**

### **Consulta de Verificación**
```sql
-- Verificar que se registran usuarios anónimos
SELECT 
  'conversion_history' as table_name,
  COUNT(*) as total_records,
  COUNT(user_id) as authenticated_users,
  COUNT(*) - COUNT(user_id) as anonymous_users
FROM conversion_history
WHERE DATE(created_at) = CURRENT_DATE

UNION ALL

SELECT 
  'daily_usage' as table_name,
  COUNT(*) as total_records,
  COUNT(user_id) as authenticated_users,
  COUNT(*) - COUNT(user_id) as anonymous_users
FROM daily_usage
WHERE date = CURRENT_DATE

UNION ALL

SELECT 
  'monthly_usage' as table_name,
  COUNT(*) as total_records,
  COUNT(user_id) as authenticated_users,
  COUNT(*) - COUNT(user_id) as anonymous_users
FROM monthly_usage
WHERE year = EXTRACT(YEAR FROM CURRENT_DATE) 
  AND month = EXTRACT(MONTH FROM CURRENT_DATE);
```

## 🛡️ **Seguridad y Limitaciones**

### **Límites Implementados**
- ✅ **Frontend**: Cookies del navegador (inmediato)
- ✅ **Backend**: IP address + base de datos (persistente)
- ✅ **1 página por día** por IP address
- ✅ **Tracking automático** de todas las conversiones

### **Protecciones**
- ✅ **RLS habilitado** en `anonymous_usage`
- ✅ **Políticas de acceso** configuradas
- ✅ **Limpieza automática** de registros antiguos (30 días)
- ✅ **Fallback de IP** para casos edge

## 🔧 **Solución de Problemas**

### **Error: "No se registra en la base de datos"**
1. ✅ **Verificar scripts SQL** ejecutados correctamente
2. ✅ **Verificar permisos** de RLS en Supabase
3. ✅ **Verificar logs** del API en Supabase
4. ✅ **Probar script de verificación** (`008-test-anonymous-tracking.sql`)

### **Error: "Constraint violation"**
1. ✅ **Verificar que `user_id` permite `NULL`**
2. ✅ **Verificar índices únicos** modificados correctamente
3. ✅ **Verificar restricciones** de foreign key removidas

### **Error: "IP address invalid"**
1. ✅ **Verificar headers** `x-forwarded-for` y `x-real-ip`
2. ✅ **Verificar fallback** a `127.0.0.1`
3. ✅ **Verificar formato** de IP en la base de datos

## 📈 **Métricas y Analytics**

### **Datos Disponibles**
- ✅ **Conversiones totales** por IP address
- ✅ **Uso diario** por IP address
- ✅ **Uso mensual** por IP address
- ✅ **Tasa de conversión** anónima → registrada

### **Consultas Útiles**
```sql
-- Usuarios anónimos más activos
SELECT 
  ip_address,
  SUM(pages_processed) as total_pages,
  SUM(files_processed) as total_files,
  COUNT(DISTINCT date) as active_days
FROM anonymous_usage
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY ip_address
ORDER BY total_pages DESC
LIMIT 10;

-- Conversiones por día (usuarios anónimos)
SELECT 
  date,
  COUNT(DISTINCT ip_address) as unique_ips,
  SUM(pages_processed) as total_pages,
  SUM(files_processed) as total_files
FROM anonymous_usage
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY date
ORDER BY date DESC;
```

## 🎉 **Estado Actual**
- ✅ **Frontend**: Completamente implementado
- ✅ **API**: Completamente implementado
- ✅ **Base de datos**: Scripts listos para ejecutar
- ✅ **Testing**: Scripts de verificación listos

## 🚀 **Próximos Pasos**
1. **Ejecutar scripts SQL** en Supabase
2. **Probar funcionalidad** con usuario anónimo
3. **Verificar registros** en todas las tablas
4. **Monitorear métricas** de uso anónimo
5. **Implementar analytics** avanzados si es necesario

---

**Nota**: Todos los scripts SQL están listos para ejecutar en Supabase. Solo necesitas copiar y pegar el contenido de cada archivo en el SQL Editor de tu proyecto.
