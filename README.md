# Formulario móvil de siniestros – Soluasistencia

App web instalable (PWA) para diligenciar el formulario de declaración de siniestros de
Equidad Seguros y generar el PDF firmado. Publicada en
https://soluseguros.github.io/formatoequidad/

## Publicar una versión nueva

1. Haz los cambios (`index.html`, `plantilla.pdf`, etc.).
2. En `version.json` cambia `version` (por ejemplo `1.4.0` → `1.4.1`), la `fecha` y la
   lista de `cambios`. El primer cambio de la lista es el que ven los usuarios en el aviso.
3. Sube los cambios a `main`. GitHub Pages publica en uno o dos minutos.

**Si no cambias `version.json`, los celulares no se enteran del cambio**: la app se sirve
desde la copia guardada en cada dispositivo. La versión solo se escribe en ese archivo.

## Cómo se actualizan los usuarios

- La app compara su versión con `version.json` al abrirse, al volver a ella y cada 30
  minutos mientras está abierta. También al tocar la versión (`v1.4.0`) en el encabezado.
- Si hay otra versión, el celular la descarga completa en segundo plano.
- Si el formulario está vacío, se actualiza sola. Si tiene datos, aparece el aviso
  «Nueva versión lista» con el botón **Actualizar**. Lo diligenciado y la firma se conservan.
- Cada versión queda guardada completa y por separado en el dispositivo, así la app abre
  sin conexión y nunca mezcla archivos de dos versiones.
- Para volver a una versión anterior basta con publicar el código anterior con otro número
  en `version.json`: se compara si es distinto, no si es mayor.

## Instalar la app

- **Android (Chrome)**: botón **📲 Instalar app** en el encabezado, o menú ⋮ → *Instalar app*.
- **iPhone / iPad (Safari)**: Compartir → *Agregar a pantalla de inicio* (el botón del
  encabezado muestra estas instrucciones).

## Archivos

| Archivo | Qué es |
| --- | --- |
| `index.html` | Toda la app (formulario, vista previa, firma y generación del PDF). |
| `plantilla.pdf` | Formulario en blanco de Equidad sobre el que se escriben los datos. |
| `version.json` | Versión publicada y lista de cambios. |
| `sw.js` | Service worker: guarda cada versión en el dispositivo y maneja las actualizaciones. |
| `manifest.json`, `icons/` | Datos e íconos para instalar la app. |
