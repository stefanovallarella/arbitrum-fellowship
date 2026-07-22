# Arbitrum Fellowship (CoBuilders) — proyecto personal

Fork de [CoBuilders-xyz/stylus-fellowship](https://github.com/CoBuilders-xyz/stylus-fellowship) donde resuelvo los ejercicios prácticos del fellowship (`hands-on/`, `projects/`).

Currículum de referencia: https://curriculum.cobuilders.xyz/ (SPA — el contenido vive embebido en el bundle JS, no en el HTML servido).

## Obsidian — Base de conocimiento

Este proyecto tiene su base de conocimiento en la bóveda de Obsidian.

**Carpeta:** `Fellowship Cobuilders`
**API:** `https://localhost:27124/`

### Cómo usar

- **Leer nota:** `curl -sk -H "Authorization: Bearer {OBSIDIAN_TOKEN}" https://localhost:27124/vault/Fellowship%20Cobuilders/{nota}.md`
- **Crear/actualizar nota:** `curl -sk -X PUT https://localhost:27124/vault/Fellowship%20Cobuilders/{nota}.md -H "Authorization: Bearer {OBSIDIAN_TOKEN}" -H "Content-Type: text/markdown" --data-binary @-`
- **Buscar:** `curl -sk -H "Authorization: Bearer {OBSIDIAN_TOKEN}" "https://localhost:27124/search/simple/?query={texto}"`
- **Listar archivos:** `curl -sk -H "Authorization: Bearer {OBSIDIAN_TOKEN}" https://localhost:27124/vault/Fellowship%20Cobuilders/`

Cada dev configura su propio `{OBSIDIAN_TOKEN}` (Ajustes de Obsidian > Local REST API). Nunca commitear el token real.

### Cuándo consultar Obsidian

- Al arrancar un módulo nuevo del currículum, revisar si ya hay notas previas relacionadas.
- Al terminar de estudiar un módulo, sintetizar y guardar la nota correspondiente.
- Antes de resolver un ejercicio hands-on, revisar la nota del módulo asociado.

## Notas de trabajo

- Nunca agregar "Co-Authored-By: Claude" ni ninguna atribución de coautoría en los commits de este repo. Claude nunca aparece como coautor de nada, en ningún commit, bajo ninguna circunstancia — no preguntar, directamente omitir esa línea siempre.
