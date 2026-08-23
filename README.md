# PRP V9 — Kimi + MediaPipe + Cloudflare

Este ZIP ya está listo para reemplazar los archivos viejos.

## Qué trae
- `app.js` → reemplaza el archivo de la raíz.
- `functions/api/harmonize.js` → reemplaza el endpoint viejo.
- `functions/api/analyze-face.js` → NUEVO endpoint para Kimi.

## Qué hace esta versión
1. Escanea la selfie con MediaPipe.
2. Envía la foto + métricas a Kimi.
3. Kimi devuelve un plan estructurado (prioridades, áreas, familias MD Codes, filler/botox/threads orientativos).
4. Ese plan guía a FLUX para generar un mejor “después”.
5. La intensidad sigue funcionando en vivo localmente, sin volver a llamar a la IA.

## Paso a paso
1. Abrí tu proyecto local o GitHub.
2. Eliminá o reemplazá el `app.js` viejo de la raíz.
3. Entrá a `functions/api/`.
4. Reemplazá `harmonize.js` por el nuevo.
5. Agregá `analyze-face.js` en esa misma carpeta.
6. En Cloudflare Pages → tu proyecto → **Settings** → **Variables and Secrets**.
7. Agregá este **Secret**:
   - `KIMI_API_KEY` = tu API key de Kimi.
8. Agregá estas variables opcionales si querés:
   - `KIMI_MODEL` = `kimi-k2.6`
   - `KIMI_BASE_URL` = `https://api.moonshot.ai/v1`
9. Guardá todo.
10. Volvé a desplegar el sitio.

## Cómo verificar que quedó bien
Probá estas rutas:
- `/api/analyze-face`
- `/api/harmonize`

Si `/api/analyze-face` responde JSON, está instalado.

## Si falla
### Error 501
Falta el secret `KIMI_API_KEY`.

### Error 401 / 404
La key o el endpoint de Kimi no coinciden.
Usá la key del Open Platform internacional y `https://api.moonshot.ai/v1`.

### La foto genera pero el plan no cambia
Revisá en Deployments / Functions logs si Kimi devolvió error o JSON inválido.

## Nota importante
Esta versión muestra **volumen orientativo no prescriptivo** y mantiene el disclaimer clínico. No define dosis finales ni reemplaza evaluación presencial.
