# PRP · Dra. Patricia Romero Pfaff — Cloudflare V3

Esta versión reemplaza Netlify y está preparada para Cloudflare Pages + Pages Functions + D1.

## Incluye

- Web completa en español
- Nombre del consultorio: PRP
- Dirección: Bernardo O'Higgins 5435, Córdoba, Argentina
- Atención únicamente con cita previa
- WhatsApp: +54 9 3512 64-1380
- Sin menciones al Yunque de Oro
- Sin branding "med"
- Fotos optimizadas WebP
- SEO/AEO local
- Open Graph para WhatsApp / redes
- FAQ
- Simulador que permite subir/tomar selfie en iPhone aunque MediaPipe falle
- Detección facial con MediaPipe cuando está disponible
- Propuesta visual conservadora
- Resultado bloqueado hasta completar nombre + email + teléfono + consentimiento
- API propia `/api/lead`
- Base D1 preparada para guardar leads
- API `/api/send-result` preparada para enviar el resultado por email mediante Resend
- JPG descargable por la paciente

## IMPORTANTE: para que Cloudflare guarde los leads

Cloudflare Pages Functions necesita una base D1.

### 1. Crear D1
En Cloudflare:
Workers & Pages → D1 SQL Database → Create database
Nombre sugerido: `prp-leads`

### 2. Crear la tabla
Abrí la consola de D1 y ejecutá el contenido de `schema.sql`.

### 3. Conectar D1 al proyecto
En tu proyecto de Pages:
Settings → Functions → D1 database bindings
Variable name: `DB`
Database: `prp-leads`

La función `/api/lead` la detecta automáticamente.

## Para enviar el resultado por email

Se usa Resend.

En Cloudflare → tu proyecto → Settings → Environment variables:
- `RESEND_API_KEY` = tu API key de Resend
- `RESEND_FROM` = `PRP <resultados@tudominio.com>`
- `LEAD_NOTIFICATION_EMAIL` = email donde PRP quiere recibir nuevos leads

Para enviar a pacientes, Resend requiere verificar un dominio propio.

## Publicación recomendada

Para Pages Functions no uses únicamente el modo de "drag-and-drop static assets" si tu cuenta no despliega Functions ahí.
La forma más segura es:
1. Crear un repositorio GitHub con esta carpeta.
2. En Cloudflare Pages: Create project → Connect to Git.
3. Framework preset: None
4. Build command: dejar vacío
5. Build output directory: `/`
6. Deploy.

Cloudflare detectará la carpeta `functions/`.

## Seguridad y privacidad

- El análisis visual se intenta ejecutar en el navegador.
- El formulario guarda únicamente los datos enviados por la paciente.
- La imagen NO se guarda en D1.
- La imagen solo se envía al endpoint de email si el envío por email está configurado.
- La simulación es orientativa y no constituye diagnóstico, prescripción ni garantía de resultado.
