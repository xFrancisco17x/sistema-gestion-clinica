# 🏥 Sistema de Gestión de Clínica - Vida Salud

Sistema completo de gestión hospitalaria (HIS - Hospital Information System) para la administración integral de una clínica médica.

## 📋 Descripción

Sistema web de gestión que incluye módulos de:
- Gestión de pacientes y expedientes médicos
- Agenda y citas médicas
- Atención médica y diagnósticos
- Facturación y pagos
- Gestión de seguros médicos
- Control de acceso basado en roles
- Auditoría del sistema

## 🛠️ Tecnologías

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **ORM**: Prisma
- **Base de datos**: SQLite
- **Autenticación**: JWT + bcrypt
- **Seguridad**: Helmet, CORS, Rate Limiting

### Frontend
- **Framework**: React 18
- **Build tool**: Vite
- **Routing**: React Router DOM v6
- **Gráficos**: Recharts

## 📦 Prerrequisitos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js** (versión 16 o superior)
  - Descarga desde: https://nodejs.org/
  - Verifica la instalación: `node --version`
- **npm** (incluido con Node.js)
  - Verifica la instalación: `npm --version`

## 🚀 Instalación y Ejecución Local

### Paso 1: Clonar el repositorio (si aún no lo has hecho)

```bash
git clone <url-del-repositorio>
cd sistema-gestion-clinica
```

### Paso 2: Configurar el Backend

```bash
# Navegar a la carpeta del backend
cd backend

# Instalar dependencias
npm install

# Generar el cliente de Prisma
npx prisma generate

# Ejecutar migraciones de la base de datos
npx prisma migrate dev

# Poblar la base de datos con datos de ejemplo
npm run seed
```

**Nota**: El script `seed` creará usuarios de demostración con diferentes roles. Al finalizar verás las credenciales en la consola.

### Paso 3: Iniciar el servidor Backend

```bash
# En la carpeta backend/
npm run dev
```

El backend estará disponible en: **http://localhost:3000** (o el puerto configurado)

El servidor se recargará automáticamente cuando hagas cambios en el código (gracias a nodemon).

### Paso 4: Configurar el Frontend

Abre una **nueva terminal** (mantén el backend corriendo) y ejecuta:

```bash
# Desde la raíz del proyecto
cd frontend

# Instalar dependencias
npm install
```

### Paso 5: Iniciar el servidor Frontend

```bash
# En la carpeta frontend/
npm run dev
```

El frontend estará disponible en: **http://localhost:5173** (puerto por defecto de Vite)

## 👥 Usuarios de Demostración

Después de ejecutar el seed, tendrás estos usuarios disponibles:

| Usuario | Contraseña | Rol | Permisos |
|---------|-----------|-----|----------|
| `admin` | `Admin123!` | Administrador | Acceso completo al sistema |
| `dra.martinez` | `Medico123!` | Médico | Medicina General |
| `dr.lopez` | `Medico123!` | Médico | Cardiología |
| `dra.ramirez` | `Medico123!` | Médico | Pediatría |
| `recepcion` | `Recep123!` | Recepción | Pacientes y citas |
| `caja` | `Caja123!` | Facturación | Facturación y cobros |
| `gerencia` | `Geren123!` | Gerencia | Reportes y auditoría |

## 📊 Estructura del Proyecto

```
sistema-gestion-clinica/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # Esquema de la base de datos
│   │   ├── seed.js            # Datos iniciales
│   │   └── dev.db             # Base de datos SQLite (generada)
│   ├── src/
│   │   └── index.js           # Punto de entrada del servidor
│   └── package.json
├── frontend/
│   ├── src/
│   │   └── ...                # Componentes React
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## 🔧 Scripts Disponibles

### Backend

```bash
npm run dev      # Inicia el servidor en modo desarrollo (con nodemon)
npm start        # Inicia el servidor en modo producción
npm run seed     # Puebla la base de datos con datos de ejemplo
npm run migrate  # Ejecuta las migraciones de Prisma
npm run studio   # Abre Prisma Studio (interfaz visual de BD)
npm test         # Ejecuta las pruebas
```

### Frontend

```bash
npm run dev      # Inicia el servidor de desarrollo de Vite
npm run build    # Construye la aplicación para producción
npm run preview  # Vista previa de la build de producción
```

## 🗄️ Base de Datos

El proyecto utiliza **SQLite** como base de datos, lo cual es perfecto para desarrollo local ya que:
- No requiere instalación adicional
- El archivo de base de datos (`dev.db`) se crea automáticamente
- Es fácil de resetear: basta con eliminar el archivo y volver a ejecutar las migraciones

### Explorar la Base de Datos

Puedes visualizar y editar los datos usando **Prisma Studio**:

```bash
cd backend
npx prisma studio
```

Esto abrirá una interfaz web en **http://localhost:5555**

### Resetear la Base de Datos

Si necesitas empezar desde cero:

```bash
cd backend

# Eliminar la base de datos
rm prisma/dev.db

# Recrear y poblar
npx prisma migrate dev
npm run seed
```

## 🔐 Seguridad

- Las contraseñas se almacenan hasheadas con bcrypt
- Autenticación mediante JWT
- Protección contra ataques comunes (Helmet)
- Rate limiting para prevenir abusos
- CORS configurado

## 🐛 Solución de Problemas

### Error: "Cannot find module '@prisma/client'"

```bash
cd backend
npx prisma generate
```

### Error: "Port already in use"

Si el puerto 3000 o 5173 ya está en uso:

**Backend**: Cambia el puerto en `backend/src/index.js`
**Frontend**: Vite te ofrecerá un puerto alternativo automáticamente

### Error: "Database connection failed"

```bash
cd backend
npx prisma migrate dev
```

### Los cambios en el frontend no se reflejan

Asegúrate de que el servidor de Vite esté corriendo. Si persiste:

```bash
# Detén el servidor (Ctrl+C) y reinicia
npm run dev
```

## 📝 Próximos Pasos

1. ✅ **Iniciar ambos servidores** (backend y frontend)
2. 🌐 **Abrir el navegador** en http://localhost:5173
3. 🔑 **Iniciar sesión** con uno de los usuarios de demostración
4. 🎯 **Explorar** las funcionalidades del sistema
5. 🛠️ **Desarrollar** nuevas características según sea necesario

## 📞 Soporte

Si encuentras algún problema durante la instalación o ejecución, verifica:

1. ✅ Versión de Node.js (debe ser 16+)
2. ✅ Que ambos servidores estén corriendo
3. ✅ Que la base de datos esté correctamente inicializada
4. ✅ Consola del navegador y terminal para errores específicos

---

**¡Listo para usar!** 🎉 El sistema está configurado y funcionando localmente.
