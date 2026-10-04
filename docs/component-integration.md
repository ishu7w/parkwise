# Supplied component integration

The attached SaaS template is adapted in `src/components/ui/parkwise-landing.tsx`. Its centered hero, compact navigation, primary/ghost button variants, soft illumination and product-preview composition are retained as design cues. Its generic marketing text, fake sign-in actions and remote analytics images are replaced with working Parkwise content and a live DOM parking preview.

- React + Vite remain the application framework.
- Tailwind v4 is already configured through `@tailwindcss/vite`.
- TypeScript is configured for the new TSX component; existing JS simulations remain unchanged. Run `npm run typecheck`.
- `components.json` supplies shadcn-compatible paths and theme configuration.
- `@/` resolves to `src/` in both Vite and TypeScript.
- `src/components/ui` holds reusable UI components. Keeping this convention makes generated shadcn components and supplied component imports resolve consistently.
- `src/lib/utils.ts` exposes the conventional `cn()` helper using clsx and tailwind-merge.
- Global base CSS: `src/styles.css`; current product styling and theme: `src/premium.css`.

No additional setup steps are required. The supplied inline Button pattern is retained as a typed forwardRef component. It does not require adding unused shadcn primitives. Lucide supplies the icons.

## Props

`navigate` opens an existing OS page; `scrollTo` delegates section links to Lenis; `state` supplies real process/bay data; `algorithm` and `setAlgorithm` share the allocation policy with the dashboard. No backend or authentication provider is required.

## Original supplied template

The unmodified supplied component is now saved as `src/components/ui/saa-s-template.tsx`, with the supplied `demo.tsx` wrapper beside it. Open `/#Template` or the landing footer’s “View original template” link. The original preview retains the supplied remote assets, Poppins import, generic text and presentation-only buttons. The existing Parkwise landing and OS pages remain functional and separate. No authentication functionality is claimed by the template preview.

## Scrolling grid shader

`src/components/ui/grid-shader.tsx` exports `ScrollingGridShader`. The supplied vertex/fragment shader formula is retained, with strict TypeScript types, container resize observation, refresh-rate-independent timing, a 1.5 pixel-ratio cap, reduced-motion pause, hidden-tab pause, context-loss fallback and resource cleanup.

Open `/#GridShader` or the landing footer’s “Grid shader demo” link. `grid-shader-demo.tsx` supplies the requested demo wrapper under a distinct name so the existing template’s `demo.tsx` is preserved. Three.js and its TypeScript declarations are installed. The shader is lazy loaded on Home as a decorative hero background and on the standalone demo. The OS modules remain DOM/SVG; navigating away disposes the shader.

Components use `src/components/ui`, exposed by `@/components/ui`. Base styles are in `src/styles.css`; product styles in `src/premium.css`. Tailwind, TypeScript and shadcn-compatible configuration are already present, so no manual setup is needed.
