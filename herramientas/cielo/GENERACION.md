# Cielo de la portada · revisión 2 · 27/09/2026

- Archivo servido: `public/cielo-portada-v2.webp` (1536 × 1024, 805 940 bytes).
- Creado con la herramienta integrada `image_gen` de Codex. El modelo concreto no se expone.
- Referencia visual: https://saasly.demos.tailgrids.com/.
- Imagen original generada: `exec-8ca8a902-b39b-4a96-b7e0-7d6279b50137.png`.
- Conversión: Pillow, WebP sin pérdida, método 6; resolución y colores nativos conservados.
- Se solicitaron 3072 × 2048 en el prompt; la herramienta entregó 1536 × 1024. No se ha
  ampliado artificialmente ni se presenta como una imagen de mayor resolución.
- La plantilla se consultó como referencia; sus imágenes no se incluyen en el proyecto.

El cielo aparece en la entrada, detrás de la cabecera y del escaparate, y en el cierre,
donde el cliente pidió recuperarlo siguiendo su captura de SaaSly. Las secciones intermedias
alternan blanco y gris claro. En la entrada, el fondo sigue el alto del contenido y se funde
al blanco antes de la cinta de cifras. En el cierre se reutiliza la misma imagen con un
encuadre a 52 % y un fundido al blanco del pie, sin generar ni descargar otra imagen.

Esta revisión rehace las nubes y evita la compresión con pérdida de la primera exportación.
Solo se incluye el recurso final utilizado por la página.

## Prompt utilizado

Use case: style-transfer / image quality refinement. Asset type: premium photographic website hero background. Image 1 is the current background to improve; Image 2 is the desired visual composition and pale color reference only. Recreate Image 1 with visibly improved photographic quality, following Image 2's quieter, naturally shaped clouds and spacious luminous center. Produce a HIGH RESOLUTION 3072 x 2048 landscape image, with fine genuine cloud detail suitable for a wide desktop display, clean smooth tonal transitions and no compression artifacts. Preserve the light powder-blue palette, large nearly white light bloom behind the center upper heading, sparse clouds along the outer left and right lower halves, and gradual fade to pure white at the bottom. Replace the current clouds' shredded, scratchy, stringy edges and cotton-wool look with coherent, softly rounded natural cumulus forms, subtle volume, faint blue-grey undersides and restrained wisps. Maintain natural sharpness with fine vapor detail; no defocus, no blur, no oversharpening, no grain, no banding, no painterly or plastic rendering. Cloud coverage is modest: one partially cropped cumulus low left at y58%, one smaller elongated cloud at right near y59%, a tiny distant cloud low center, and only a faint trace near the upper edge. Keep the entire central upper half open for text. Blue at the top and perimeter should be a delicate #c7dffc, with a slightly richer #afcef5 lower side area; central glow smoothly approaches #f8fbff. The final 10 percent is a seamless pure white background. No visible sun, horizon, landscape, text, logos, UI, watermarks or extra objects. The result should feel like a carefully photographed and professionally graded clear sky, understated and premium, with readable cloud volume at full resolution.
