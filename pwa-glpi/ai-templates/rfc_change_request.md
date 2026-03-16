# RFC — Request For Change

Project: TicketSign
Fecha:
Autor:
Tipo de cambio:
[ ] Nueva funcionalidad
[ ] Bug fix
[ ] Refactorización
[ ] Mejora de seguridad
[ ] Mejora de performance
[ ] Cambio de arquitectura

---

# 1. CONTEXTO

Describe el contexto del cambio.

• Qué problema existe actualmente  
• Qué limitación del sistema se quiere resolver  
• Qué componente está afectado

---

# 2. OBJETIVO DEL CAMBIO

Explica claramente:

• Qué se quiere lograr
• Qué comportamiento nuevo tendrá el sistema
• Qué resultado espera el usuario

---

# 3. ALCANCE

Componentes afectados:

Backend:
Frontend:
Base de datos:
API:
Infraestructura:
Integraciones externas:

Archivos potencialmente afectados:
(listar si se conocen)

---

# 4. IMPACTO TÉCNICO

Analizar impacto en:

Seguridad
Performance
Arquitectura
Base de datos
Escalabilidad
Experiencia de usuario

---

# 5. RIESGOS POTENCIALES

Identificar posibles riesgos:

• vulnerabilidades de seguridad
• regresiones funcionales
• problemas de performance
• inconsistencias de datos
• exposición de endpoints

---

# 6. PROPUESTA DE IMPLEMENTACIÓN

Describir cómo se implementará el cambio:

• lógica de negocio
• endpoints nuevos o modificados
• cambios en modelos de datos
• cambios en frontend

---

# 7. VALIDACIÓN DEVSECOPS OBLIGATORIA

Antes de implementar el cambio debes ejecutar el pipeline definido en:

AI_REVIEW_PIPELINE.md

El cambio debe pasar por las siguientes etapas:

---------------------------------------

ETAPA 1 — SECURITY_GUARDIAN

Validar:

OWASP Top 10  
XSS  
NoSQL Injection  
SSRF  
Path Traversal  
Exposición de secretos  
Headers de seguridad  
CORS  
Rate limiting  

Si detecta vulnerabilidad → DETENER CAMBIO

---------------------------------------

ETAPA 2 — THREAT_MODEL_ANALYZER

Evaluar vectores de ataque:

STRIDE

Spoofing  
Tampering  
Repudiation  
Information disclosure  
Denial of service  
Elevation of privilege  

Validar:

IDOR  
Abuso de API  
Escalación de privilegios

Si el cambio introduce un vector nuevo → documentar mitigación.

---------------------------------------

ETAPA 3 — SENIOR_ENGINEER

Validar:

Arquitectura limpia  
Principios SOLID  
Separación:

route → service → model

Evitar:

alta complejidad  
acoplamiento fuerte  
duplicación de lógica

---------------------------------------

ETAPA 4 — BEST_PRACTICES_ENFORCER

Validar:

Clean Code  
Naming conventions  
Logging estructurado  
Manejo correcto de errores  
Validación de inputs  

---------------------------------------

ETAPA 5 — DEPENDENCY_AUDITOR

Validar:

nuevas dependencias  
CVEs conocidas  
librerías abandonadas  
impacto de bundle size  

---------------------------------------

ETAPA 6 — PERFORMANCE_ANALYZER

Evaluar:

queries a MongoDB  
uso de memoria  
bloqueo de event loop  
operaciones costosas  
índices necesarios  

---------------------------------------

# 8. CRITERIOS DE ACEPTACIÓN

El cambio solo puede aprobarse si:

✔ no introduce vulnerabilidades  
✔ mantiene arquitectura limpia  
✔ pasa todas las validaciones del pipeline  
✔ se documenta en PROJECT_MEMORY.md  

---

# 9. PLAN DE PRUEBAS

Definir:

Pruebas funcionales  
Pruebas de seguridad  
Pruebas de carga (si aplica)

---

# 10. PLAN DE ROLLBACK

En caso de fallo:

• cómo revertir el cambio  
• qué archivos restaurar  
• cómo evitar impacto en producción

---

# 11. ACTUALIZACIÓN DE MEMORIA DEL PROYECTO

Después de implementar el cambio debes actualizar:

PROJECT_MEMORY.md

Registrar:

• decisión técnica
• riesgos mitigados
• cambios de arquitectura