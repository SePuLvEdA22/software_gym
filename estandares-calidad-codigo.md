# Estándares de Calidad de Código

Este documento define los requisitos que **todo código generado o modificado debe cumplir** antes de considerarse terminado. Su propósito es servir de guía obligatoria durante el desarrollo, refactorización y revisión de código.

> ⚠️ **Regla general:** ningún cambio se considera "completo" si no cumple con los puntos descritos a continuación. Si alguna verificación no puede ejecutarse (por falta de herramientas, configuración, etc.), el agente debe **indicarlo explícitamente** en vez de omitirlo en silencio.

---

## 1. Pruebas unitarias

- Todo módulo, función o clase con lógica no trivial debe tener pruebas unitarias correspondientes.
- Las pruebas deben cubrir:
  - Casos normales (happy path).
  - Casos límite (valores nulos, vacíos, extremos).
  - Casos de error (excepciones, entradas inválidas).
- Las pruebas deben ser independientes entre sí (no depender del orden de ejecución).
- Usar mocks/stubs para aislar dependencias externas (APIs, bases de datos, sistema de archivos).
- Nomenclatura clara: `debería_hacer_X_cuando_Y` o equivalente en el framework usado.

## 2. Procedimientos de control de calidad (QA)

- **Linting**: el código debe pasar el linter configurado del proyecto sin advertencias críticas (ESLint, Pylint, Checkstyle, etc.).
- **Formateo**: aplicar formateador automático (Prettier, Black, gofmt) antes de dar por terminado un cambio.
- **Análisis estático**: ejecutar herramientas de análisis estático (SonarQube, CodeQL, mypy/type-checking) para detectar code smells, vulnerabilidades y errores de tipo.
- **Revisión de código (code review)**: todo cambio relevante debe documentarse con una descripción clara del *qué* y el *por qué*, facilitando la revisión humana.
- **Integración continua (CI)**: los cambios deben pasar el pipeline de CI (build + tests + linters) antes de fusionarse.

## 3. Métricas de calidad

Medir y reportar, cuando sea posible:

| Métrica | Umbral sugerido |
|---|---|
| Complejidad ciclomática | ≤ 10 por función |
| Duplicación de código | < 3-5% |
| Deuda técnica (SonarQube u otro) | Sin issues "bloqueantes" o "críticos" |
| Longitud de función/método | ≤ 40-50 líneas (orientativo) |
| Acoplamiento entre módulos | Bajo/moderado |
| Cohesión de clases/módulos | Alta |

## 4. Pruebas de mutación (mutation testing)

- Ejecutar herramientas de mutation testing (Stryker, PIT, mutmut, según el lenguaje) para validar que las pruebas realmente detectan fallos, no solo que "pasan".
- Objetivo mínimo sugerido: **mutation score ≥ 70-80%**.
- Si el score es bajo, no basta con agregar más pruebas al azar: hay que revisar si las aserciones son suficientemente estrictas.

## 5. Cobertura de pruebas (test coverage)

- Medir cobertura de líneas, ramas (branches) y funciones.
- Umbral mínimo recomendado: **80% de cobertura de líneas y ramas** (ajustable según criticidad del módulo).
- La cobertura es una condición necesaria pero **no suficiente**: debe combinarse con pruebas de mutación para evitar "cobertura falsa" (tests que ejecutan código sin verificar comportamiento).
- Priorizar cobertura alta en lógica de negocio crítica antes que en código trivial (getters/setters, configuración).

## 6. Otros parámetros de calidad recomendados

- **Pruebas de integración**: validar que los módulos funcionan correctamente en conjunto (no solo de forma aislada).
- **Pruebas end-to-end (E2E)**: para flujos completos de usuario, cuando aplique (Cypress, Playwright, Selenium).
- **Pruebas de regresión**: asegurar que cambios nuevos no rompen funcionalidades existentes.
- **Análisis de seguridad (SAST/DAST)**: detectar vulnerabilidades conocidas (inyección SQL, XSS, dependencias vulnerables — `npm audit`, `pip-audit`, Snyk, Dependabot).
- **Gestión de dependencias**: mantener dependencias actualizadas y sin vulnerabilidades críticas conocidas.
- **Documentación del código**: comentarios claros donde la lógica no sea obvia, y documentación de funciones/API públicas (docstrings, JSDoc, etc.).
- **Manejo de errores y logging**: excepciones controladas, logs útiles y sin datos sensibles expuestos.
- **Pruebas de rendimiento (performance/load testing)**: cuando el código afecte rutas críticas o de alto tráfico.
- **Accesibilidad (a11y)**: en proyectos con interfaz de usuario, verificar cumplimiento de estándares básicos (WCAG).
- **Convenciones de commits**: mensajes claros y consistentes (por ejemplo, Conventional Commits) para mantener trazabilidad.
- **Revisión de contratos de API**: si se exponen endpoints, validar que los contratos (OpenAPI/Swagger, GraphQL schema) sean consistentes con la implementación.

---

## Checklist rápida antes de dar un cambio por terminado

- [ ] Pruebas unitarias escritas y pasando.
- [ ] Linter y formateador ejecutados sin errores.
- [ ] Análisis estático sin issues críticos/bloqueantes.
- [ ] Cobertura de pruebas ≥ umbral definido.
- [ ] Pruebas de mutación ejecutadas (cuando aplique) con score aceptable.
- [ ] Sin vulnerabilidades conocidas en dependencias.
- [ ] Documentación/comentarios actualizados.
- [ ] Pruebas de integración/E2E ejecutadas (si el cambio lo amerita).
- [ ] Mensaje de commit claro y descriptivo.

---

*Este documento debe ser tratado como una guía obligatoria de calidad para cualquier código generado o modificado por el agente de IA.*
