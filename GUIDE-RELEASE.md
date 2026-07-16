# 🚀 Guía de Releases y Auto-Actualización

## 📋 Índice

1. [Corregir el release v1.0.1 actual](#1-corregir-el-release-actual)
2. [Flujo normal: crear un release nuevo](#2-flujo-normal-crear-un-release-nuevo)
3. [Cómo funciona la auto-actualización](#3-cómo-funciona-la-auto-actualización)
4. [Solución de problemas](#4-solución-de-problemas)

---

## 1. Corregir el release actual

El release `v1.0.1` quedó como **Draft** (borrador) porque el CI falló en su momento. Para arreglarlo:

### Opción A: Publicar el draft (si tiene archivos)

1. Ve a: https://github.com/SePuLvEdA22/software_gym/releases
2. Busca el release **v1.0.1** (debería decir "Draft")
3. Haz clic en **✏️ Edit** (lápiz)
4. Revisa si tiene archivos adjuntos (`.exe` y `latest.yml`)
5. Si **SÍ tiene archivos** → Haz clic en **"Publish release"** ✅
6. La app ya podrá detectar la actualización

### Opción B: Borrar y crear uno nuevo (si no tiene archivos)

Si el draft no tiene archivos, es mejor eliminarlo y crear uno nuevo:

```bash
# 1. Borrar tag local
git tag -d v1.0.1

# 2. Borrar tag remoto
git push origin --delete v1.0.1
```

Luego sigue el [flujo normal](#2-flujo-normal-crear-un-release-nuevo) con `v1.0.2`.

---

## 2. Flujo normal: crear un release nuevo

Cada vez que quieras lanzar una actualización para los usuarios:

### Paso 1: Prepara el código

```bash
# Asegúrate de estar en la rama correcta
git checkout Helger
git pull origin Helger
```

### Paso 2: Actualiza el número de versión

Edita el archivo **`package.json`** y cambia la línea:

```json
"version": "1.0.1"
```

a la nueva versión, por ejemplo:

```json
"version": "1.0.2"
```

### Paso 3: Commit y push

```bash
git add package.json
git commit -m "chore: bump version to 1.0.2"
git push origin Helger
```

✅ **Esto dispara el CI** (lint, typecheck, test, build).  
Ve a **GitHub → Actions** y verifica que pase correctamente.

### Paso 4: Crear y subir el tag

```bash
# Crear el tag con el número de versión
git tag v1.0.2

# Subir el tag a GitHub
git push origin v1.0.2
```

✅ **Esto dispara el workflow "Build and Release"** que:

1. ✅ Valida el código (lint, typecheck, test, build)
2. ✅ Compila el instalador de Windows
3. ✅ Sube `latest.yml` + `BodyFitGym Setup 1.0.2.exe` a GitHub Releases
4. ✅ **Publica el release automáticamente** (no queda como draft)

### Paso 5: Verifica

1. Ve a **GitHub → Actions** y confirma que el workflow "Build and Release" se completó ✅
2. Ve a **GitHub → Releases** y confirma que `v1.0.2` aparece como publicado ✅

---

## 3. Cómo funciona la auto-actualización

Una vez que el release está publicado, los usuarios existentes pueden actualizar así:

1. Abren **BodyFitGym**
2. Van a **Configuración → Actualizaciones**
3. Hacen clic en **"Buscar actualizaciones"**
4. La app detecta la nueva versión automáticamente
5. Hacen clic en **"Descargar actualización"**
6. Ven la barra de progreso de descarga
7. Cuando termina, hacen clic en **"Reiniciar e instalar"**
8. La app se cierra, se instala la nueva versión y se abre de nuevo ✅

### Diagrama del flujo completo

```
Tú (desarrollador)                     Usuarios
       │                                    │
       ▼                                    │
  git tag v1.0.2                            │
  git push origin v1.0.2                    │
       │                                    │
       ▼                                    │
  GitHub Actions                            │
  ┌─────────────────────┐                   │
  │ Validate (lint,tsc,  │                   │
  │ test,build)          │──✅──┐            │
  └─────────────────────┘      │            │
                               ▼            │
  ┌──────────────────────┐                   │
  │ Release (Windows)    │                   │
  │ electron-builder     │───► GitHub Releases
  │ --publish always     │     (latest.yml   │
  └──────────────────────┘      + .exe)      │
                                             ▼
                                   App existente
                                   "Buscar actualizaciones"
                                         │
                                         ▼
                                   Descarga e instala
                                   automáticamente ✅
```

---

## 4. Solución de problemas

### "Error: Unable to find latest version on GitHub"

**Causa:** El release es un Draft o no tiene archivos.

**Solución:** Publica el draft manualmente en GitHub Releases.

---

### "Error: HttpError 406"

**Causa:** GitHub no encuentra un release publicado. Es el mismo problema de arriba.

**Solución:** Publica el release o crea uno nuevo.

---

### El workflow "Build and Release" falla

1. Ve a **GitHub → Actions** y haz clic en el workflow fallido
2. Revisa los logs para ver qué paso exacto falló
3. Los errores más comunes:
   - **Lint** → errores de ESLint
   - **Typecheck** → errores de TypeScript
   - **Build (Windows)** → problemas de dependencias nativas

---

### Los usuarios no ven la actualización disponible

1. Confirma que el release esté **Publicado** (no Draft)
2. Confirma que tenga el archivo **`latest.yml`** entre sus assets
3. Confirma que la versión del release sea **mayor** que la versión instalada
4. Prueba cerrar y abrir la app, luego busca actualizaciones

---

### Quiero cancelar un release

Si subiste un tag por error:

```bash
# Borrar tag local
git tag -d v1.0.2

# Borrar tag remoto (esto también borra el release asociado)
git push origin --delete v1.0.2
```

---

## 🎯 Resumen (atajo rápido)

Para lanzar una nueva versión, solo necesitas 4 comandos:

```bash
# 1. Editar package.json (cambiar version)
# 2. Commit
git add package.json && git commit -m "chore: bump to 1.0.2"

# 3. Subir cambios
git push origin Helger

# 4. Crear y subir tag (esto dispara el release automático)
git tag v1.0.2 && git push origin v1.0.2
```

✅ ¡Y los usuarios reciben la actualización automáticamente!
