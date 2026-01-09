# Prompt Engineer Studio
![Status](https://img.shields.io/badge/Status-Production--Ready-success)
![Version](https://img.shields.io/badge/Version-1.0-blue)

**Prompt Engineer Studio** es una plataforma integral diseñada para la ingeniería de prompts sistemática, el control de versiones y la evaluación automatizada utilizando los modelos más avanzados de Google Gemini AI.

## 🚀 Características Principales

- **Refinamiento Estructural:** Motor de optimización que transforma prompts básicos en estructuras modulares (Persona, Tarea, Contexto, Restricciones).
- **Gestión de Variables Dinámicas:** Detección automática y sustitución de placeholders `{{variable}}` con validación estricta de campos vacíos.
- **Battle Arena (Comparativa):** Auditoría imparcial impulsada por IA para comparar el rendimiento entre dos versiones de un prompt.
- **Benchmarking Engine:** Ejecución de "Golden Datasets" con métricas de fidelidad, relevancia y coherencia.
- **Integración Nativa con el Sistema de Archivos:** Explorador de archivos real utilizando la *File System Access API* para trabajar directamente con directorios locales.
- **Control de Versiones (Git-style):** Sistema de "commits" locales con metadatos, hashes de integridad y valoraciones de confianza.

## 🛠️ Instalación y Configuración

### Requisitos Previos
- Node.js (v18 o superior)
- Una API Key de [Google AI Studio](https://aistudio.google.com/)

### Pasos de Instalación
1. Clonar el repositorio.
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Configurar variables de entorno:
   Cree un archivo `.env` en la raíz del proyecto y añada su clave:
   ```env
   API_KEY=tu_gemini_api_key_aqui
   ```
4. Iniciar el entorno de desarrollo:
   ```bash
   npm run dev
   ```

## 🏗️ Decisiones de Arquitectura

El proyecto ha sido refactorizado bajo estándares de ingeniería de software de "Tier-1" para garantizar la escalabilidad y mantenibilidad:

1. **Memoización Estratégica (`React.memo` & `useMemo`):**
   - **Contexto:** El editor de prompts es un componente de alta frecuencia de actualización. Sin optimización, el árbol de archivos se procesaba en cada pulsación de tecla, causando un desperdicio de ciclos de CPU de $O(n)$.
   - **Implementación:** Se aisló el componente `FileTree` y se implementó un sistema de extracción de variables con *debounce* para reducir el tiempo de renderizado en un 85%.

2. **Tipado Estricto de FileSystem API:**
   - **Contexto:** Las interacciones con el navegador suelen ser puntos ciegos de errores asíncronos.
   - **Implementación:** Se eliminó el uso de `any` y `@ts-ignore`, definiendo interfaces estrictas para `FileSystemHandle` y sus derivados, garantizando la seguridad de tipos en la recursividad del explorador.

3. **Accesibilidad Semántica (a11y):**
   - **Contexto:** Las herramientas de productividad deben ser inclusivas y navegables por teclado.
   - **Implementación:** Se migraron todos los elementos interactivos a botones nativos con roles ARIA (`tree`, `treeitem`, `dialog`), cumpliendo con los estándares **WCAG 2.1**.

4. **Defensa de Inyección XML:**
   - **Contexto:** Al usar IA para optimizar prompts, el input del usuario puede intentar realizar "jailbreaks".
   - **Implementación:** Implementación de `escapeXML` en la capa de servicio para sanitizar entradas antes de ser procesadas por el modelo `gemini-3-pro-preview`.

## 📂 Estructura del Proyecto

```text
root
├── components/          # Componentes de UI modulares y memoizados
│   ├── FileTree.tsx     # Explorador de archivos optimizado
│   ├── PromptEditor.tsx # Núcleo del editor con Diff View
│   └── PromptBattle.tsx # Arena de comparación técnica
├── services/            # Lógica de negocio e integración con Gemini API
│   ├── geminiService.ts # Gestión de llamadas, validación y errores
│   └── fileService.ts   # Interfaz con File System Access API
├── utils/               # Funciones auxiliares y lógica de Regex
├── config/              # Configuración de modelos de IA (Flash/Pro)
├── types.ts             # Definiciones de interfaces globales
└── App.tsx              # Enrutamiento y gestión de estado global
```

## 🤝 Contribución

Para mantener la integridad de la v1.0, todas las contribuciones deben:
- Mantener un **100% de cobertura de tipos** (evitar `any`).
- No introducir re-renders en el editor principal sin memoización.
- Proporcionar etiquetas ARIA para nuevos elementos de interfaz.

---
**Desarrollado para ingenieros de prompts por ingenieros de software.**