# Dra. Patricia Romero Pfaff — Armonización Orofacial

Sitio oficial de la Dra. Patricia Romero Pfaff para presentación profesional y simulación orientativa de armonización orofacial.

## Simulador facial

El simulador permite cargar una fotografía frontal y generar una comparación Antes / Después orientativa.

Flujo actual:

1. Carga de selfie frontal.
2. Análisis facial local con MediaPipe Face Landmarker.
3. Evaluación de proporciones y simetría facial.
4. Lógica de planificación basada en los principios de:
   - Foundation
   - Contour
   - Refinement
5. Generación visual del resultado con Cloudflare Workers AI / FLUX.
6. Control de intensidad en vivo sin volver a generar la imagen.

## Principios de la simulación

La simulación busca:

- preservar la identidad del paciente;
- mantener la misma expresión, ángulo, iluminación y fondo;
- evitar filtros de belleza;
- evitar maquillaje virtual;
- evitar sobrellenado;
- no crear arrugas nuevas;
- priorizar armonía global antes que correcciones aisladas;
- utilizar la mínima intervención visual necesaria.

## Procedimientos considerados

El simulador puede representar de forma orientativa efectos asociados a:

- fillers de ácido hialurónico;
- soporte estructural;
- toxina botulínica;
- hilos tensores, cuando corresponda.

No simula cirugía ni procedimientos quirúrgicos.

## Nota clínica

La simulación tiene fines educativos y orientativos.

No reemplaza una evaluación clínica presencial y no constituye una prescripción médica.

Las decisiones sobre:

- producto;
- dosis;
- unidades;
- técnica;
- profundidad;
- puntos de aplicación;
- indicación definitiva;

deben ser realizadas por la profesional tratante luego de una evaluación clínica.

## Tecnología

- HTML / CSS / JavaScript
- Cloudflare Pages
- Cloudflare Workers AI
- FLUX
- MediaPipe Face Landmarker

## Sitio

Proyecto desarrollado para la presencia digital y herramienta de simulación de la Dra. Patricia Romero Pfaff.
