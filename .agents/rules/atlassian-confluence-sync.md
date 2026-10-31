# Regla de Autenticación y Sincronización: Atlassian Confluence (SpotlightUS)

## Trigger / Disparador
Esta regla se activa de forma prioritaria cuando el usuario solicite:
- "Documentar en Confluence"
- "Subir a Confluence"
- "Sincronizar con Atlassian"
- Ante cualquier error de autenticación (401, 404, "site doesn't have Confluence") al invocar herramientas del MCP `jira`.

---

## 1. Parámetros Absolutos de la Organización
- **Sitio Oficial de Atlassian:** `https://spotlightus.atlassian.net` (¡NUNCA usar `leojaimesestevez.atlassian.net`!).
- **Cloud ID de SpotlightUS:** `91527653-3484-4685-be32-f0b208b96d22`
- **Espacio Predeterminado para Negocio / Arquitectura:** `Spotlight Business` (Key: `SB`, ID: `2752528`).
- **Endpoint del Servidor MCP Remoto:** `https://mcp.atlassian.com/v2/mcp`

---

## 2. Protocolo Ante Pérdida de Sesión o Login Inválido (401 / 404)
Si una llamada a Confluence falla porque el token expiró o se conectó al sitio equivocado:

1. **NO adivinar ni crear herramientas mock.**
2. **Limpiar el token obsoleto:**
   ```powershell
   Remove-Item "C:\Users\User\.mcp-auth\mcp-remote-v1\8a0eb89d34b538e3f06598b9fe28dc4d_tokens.json" -Force -ErrorAction SilentlyContinue
   ```
3. **Levantar el proxy OAuth con el comando oficial:**
   ```bash
   npx -y mcp-remote https://mcp.atlassian.com/v2/mcp
   ```
4. **Instruir al usuario:**
   - Indicarle que en la pantalla de autorización de Atlassian debe seleccionar obligatoriamente **`spotlightus`** (o `spotlightus.atlassian.net`) en el selector de sitios.
5. **Respaldo Local Inmediato:**  
   Siempre guardar una copia en Markdown del documento en `docs/confluence/<nombre>.md` dentro del repositorio para garantizar que no se pierda nada de trabajo.

---

## 3. Ejemplo de Publicación en Confluence (Llamada al MCP)
```typescript
call_mcp_tool({
  ServerName: 'jira',
  ToolName: 'createConfluenceContent',
  Arguments: {
    cloudId: '91527653-3484-4685-be32-f0b208b96d22', // SpotlightUS Cloud ID
    contentType: 'page',
    parent: { spaceId: '2752528' }, // Spotlight Business (SB)
    title: 'Título del Documento',
    body: {
      format: 'markdown',
      value: '# Contenido del Documento...'
    }
  }
});
```

