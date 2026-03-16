# CHANGE REQUEST

Descripción del cambio:
[Explicar qué se quiere modificar]

Motivo del cambio:
[Bug, mejora, refactorización, seguridad]

Componentes afectados:
- backend
- frontend
- base de datos
- API
- infraestructura

------------------------------------------------

Antes de implementar el cambio debes ejecutar el pipeline definido en AI_REVIEW_PIPELINE.md.

Pipeline obligatorio:

1. SECURITY_GUARDIAN
   - validar OWASP Top 10
   - validar sanitización
   - validar autenticación/autorización

2. THREAT_MODEL_ANALYZER
   - evaluar si el cambio introduce nuevos vectores de ataque
   - validar XSS, SSRF, IDOR, abuso de API

3. SENIOR_ENGINEER
   - validar arquitectura
   - mantener principios SOLID

4. BEST_PRACTICES_ENFORCER
   - validar Clean Code
   - validar naming conventions
   - validar manejo de errores

5. DEPENDENCY_AUDITOR
   - revisar dependencias nuevas
   - verificar CVEs

6. PERFORMANCE_ANALYZER
   - evaluar impacto en queries
   - evaluar consumo de recursos

------------------------------------------------

Si alguna etapa detecta un problema:

- detener la implementación
- explicar el riesgo
- proponer una solución segura