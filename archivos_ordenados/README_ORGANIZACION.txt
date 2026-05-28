Organizacion de archivos JL Chess

01_app_util
- Carpeta principal para seguir corrigiendo la app.
- Incluye package.json de la raiz, .gitignore, logo, licencias y la carpeta codigos.
- La copia de codigos excluye node_modules porque las dependencias se regeneran con npm install.
- Incluye codigos/vendor con las librerias frontend necesarias para que la app no dependa de CDNs externos.
- Conserva codigos/libros porque el servidor carga la biblioteca desde ahi.
- Conserva codigos/database.json porque ahi esta la informacion actual de usuarios/torneos.

02_respaldos_y_ejecutable
- Copia de los respaldos .rar.
- Copia del ejecutable empaquetado JL Chess Escolar-win32-x64.rar.
- No se copio la carpeta exe/JL Chess Escolar-win32-x64 completa para evitar duplicar demasiado peso.

03_no_necesarios_para_editar
- Archivos que no hacen falta para corregir el codigo de la app.
- Incluye PDFs sueltos y la carpeta libros de la raiz, que duplican libros que ya estan en codigos/libros.
- Incluye la captura de pantalla suelta.

Notas
- No se borro ni se movio nada del proyecto original.
- Para trabajar en la app, usar 01_app_util como referencia limpia.
- Si luego quieres dejar el proyecto realmente limpio, podemos mover o eliminar duplicados despues de confirmar que todo abre bien.
