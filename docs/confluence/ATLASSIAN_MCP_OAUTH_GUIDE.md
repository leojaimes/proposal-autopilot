# Guía de Conexión y Autenticación: Atlassian MCP (Jira & Confluence)

> **Documentación de Infraestructura & Herramientas de Integración**  
> **Servidor MCP:** `jira` / Atlassian Remote MCP  
> **Endpoint Remoto:** `https://mcp.atlassian.com/v2/mcp`  
> **Proxy de Conexión:** `mcp-remote`  
> **Archivo de Configuración:** `C:\Users\User\.gemini\antigravity-ide\mcp_config.json`

---

## 1. El Comando de Autenticación y Conexión

Para iniciar o refrescar el flujo de autenticación OAuth interactivo en el navegador con Atlassian (Jira, Confluence, Loom, Teamwork Graph), se utiliza el siguiente comando oficial:

```bash
npx -y mcp-remote https://mcp.atlassian.com/v2/mcp
```

---

## 2. Configuración en `mcp_config.json`

En la configuración de servidores MCP de Antigravity (`mcp_config.json`), el servidor está registrado de la siguiente forma:

```json
{
  "mcpServers": {
    "jira": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.atlassian.com/v2/mcp"
      ]
    }
  }
}
```

---

## 3. ¿Cómo Funciona el Flujo de Autorización OAuth?

1. **Servidor Local Temporal de Callback:**  
   Al invocar `mcp-remote`, el proxy levanta un servidor HTTP local en el puerto `38677` (`http://127.0.0.1:38677/oauth/callback`) para recibir el código de autorización de Atlassian.
2. **Apertura Automática del Navegador:**  
   Abre de forma automática una pestaña en tu navegador predeterminado apuntando a `https://auth.atlassian.com/authorize?...`.
3. **Selección del Workspace / Sitio:**  
   En la pantalla de consentimiento de Atlassian aparece el selector **"Authorize for site"** (o *"Autorizar para el sitio"*).  
   * **Importante:** Asegúrate de seleccionar el sitio correspondiente (ej. **Spotlight**) para otorgar permisos a los productos activos de esa organización (Confluence, Jira, etc.).
4. **Almacenamiento Seguro de Credenciales:**  
   Una vez aceptados los permisos, los tokens (`refresh_token` y `access_token`) se guardan de forma local y cifrada en:
   ```
   C:\Users\User\.mcp-auth\mcp-remote-v1\8a0eb89d34b538e3f06598b9fe28dc4d_tokens.json
   ```

---

## 4. Resolución de Problemas y Re-Autenticación (Switch de Sitio / Reset)

Si necesitas cambiar de sitio (por ejemplo, cambiar de una cuenta personal a **Spotlight**) o si un token queda desactualizado:

1. **Limpiar Tokens Anteriores:**  
   Elimina o renombra el archivo de tokens existente:
   ```powershell
   Remove-Item "C:\Users\User\.mcp-auth\mcp-remote-v1\*tokens.json" -Force -ErrorAction SilentlyContinue
   ```
2. **Volver a Ejecutar:**
   ```bash
   npx -y mcp-remote https://mcp.atlassian.com/v2/mcp
   ```
3. Selecciona el nuevo sitio en el navegador y completa la autorización.

