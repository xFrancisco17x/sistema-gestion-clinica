# 🚀 Guía de Inicio Rápido

Esta guía te ayudará a ejecutar el proyecto en **menos de 5 minutos**.

## ⚡ Pasos Rápidos

### 1️⃣ Backend (Terminal 1)

```bash
# Navega a la carpeta backend
cd backend

# Instala dependencias
npm install

# Genera el cliente de Prisma
npx prisma generate

# Crea y puebla la base de datos
npx prisma migrate dev

# Inicia el servidor
npm run dev
```

✅ **Backend corriendo en:** http://localhost:3000

---

### 2️⃣ Frontend (Terminal 2 - Nueva terminal)

```bash
# Navega a la carpeta frontend
cd frontend

# Instala dependencias
npm install

# Inicia el servidor
npm run dev
```

✅ **Frontend corriendo en:** http://localhost:5173

---

## 🔑 Credenciales de Acceso

Abre tu navegador en **http://localhost:5173** y usa:

**Usuario Administrador:**
```
Usuario: admin
Contraseña: Admin123!
```

**Otros usuarios disponibles:**
- `dra.martinez` / `Medico123!` (Médico - Medicina General)
- `recepcion` / `Recep123!` (Recepcionista)
- `caja` / `Caja123!` (Facturación)

---

## 🆘 ¿Problemas?

### El backend no inicia
```bash
cd backend
npx prisma generate
npx prisma migrate dev
```

### El frontend no muestra datos
1. Verifica que el backend esté corriendo (Terminal 1)
2. Revisa la consola del navegador para errores

### Error de puerto ocupado
- El backend usará otro puerto automáticamente
- El frontend te ofrecerá un puerto alternativo

---

## 📚 Documentación Completa

Para más detalles, revisa el [README.md](./README.md) completo.

---

**¡Listo!** 🎉 Ya puedes empezar a trabajar con el sistema.
