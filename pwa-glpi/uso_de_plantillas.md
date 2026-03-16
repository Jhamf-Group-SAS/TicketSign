# Antigravity DevSecOps — Guía Rápida

## Objetivo
Este proyecto utiliza Antigravity con un pipeline DevSecOps para garantizar que todos los cambios en el código sean seguros, consistentes y sigan buenas prácticas.

---

# Flujo de trabajo

Todo cambio en el sistema debe seguir este proceso:

Idea de cambio  
↓  
Seleccionar plantilla  
↓  
Completar plantilla  
↓  
Enviar a Antigravity  
↓  
Pipeline de validación  
↓  
Implementación segura  
↓  
Actualizar `PROJECT_MEMORY.md`

---

# Plantillas disponibles

Ubicación:

/ai-templates

Plantillas:

| Cambio | Plantilla |
|------|------|
Nueva funcionalidad | feature_request.md |
Corrección de bug | bugfix_request.md |
Refactorización | refactor_request.md |
Cambio grande | rfc_change_request.md |
Revisión del sistema | validation_review.md |

---

# Pipeline de validación

Cada cambio pasa por las siguientes revisiones automáticas:

1. **SECURITY_GUARDIAN**  
   Seguridad y vulnerabilidades.

2. **THREAT_MODEL_ANALYZER**  
   Análisis de vectores de ataque.

3. **SENIOR_ENGINEER**  
   Arquitectura y principios SOLID.

4. **BEST_PRACTICES_ENFORCER**  
   Clean Code y estándares.

5. **DEPENDENCY_AUDITOR**  
   Seguridad de dependencias.

6. **PERFORMANCE_ANALYZER**  
   Impacto en rendimiento.

---

# Cómo usar una plantilla

1. Abrir una plantilla de `/ai-templates`
2. Completar la descripción del cambio
3. Copiar el contenido
4. Enviarlo a Antigravity

Ejemplo:

Feature Request

Nueva funcionalidad:
Agregar endpoint para descargar actas firmadas.

Objetivo:
Permitir descargar el documento firmado desde el sistema.

---

# Después de implementar

Actualizar:

PROJECT_MEMORY.md

Registrar:

- decisión técnica
- cambio implementado
- riesgos mitigados

---

# Buenas prácticas

Siempre:

- usar plantillas antes de modificar código
- revisar impacto en seguridad
- documentar cambios importantes

Nunca:

- modificar código directamente sin validación
- agregar dependencias sin revisión
- cambiar autenticación sin análisis de seguridad

---

Este flujo permite mantener el proyecto bajo un modelo de desarrollo seguro y controlado.