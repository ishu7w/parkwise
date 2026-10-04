# Parkwise — premium product interface

The user's latest request replaces the 3D concept with the supplied centered SaaS component direction. Near-black surfaces, soft lavender accents, locally hosted Manrope, oversized centered hero, a subtle aura, and a real interactive product preview form the visual system. Labs use horizontal navigation and consistent dark panels.

The landing is implemented in `src/components/ui/parkwise-landing.tsx`, adapted to Parkwise content and state. No stock analytics image, sign-in or fake sign-up flow is included. Preview metrics and bays reflect the current parking state. The policy control shares the real FCFS/Priority setting with the dashboard and animates reordered READY requests with Flip.

Lenis runs through one GSAP ticker; ScrollTrigger listens to Lenis scroll updates. GSAP SplitText reveals headlines, DrawSVG reveals the process path, and Flip animates the preview queue. Scroll-triggered entrances, restrained hover motion, tab-content animation and page entrances complete the motion system. All contexts, listeners and ticker callbacks are cleaned up. Native touch scrolling and reduced-motion preferences are supported.

Three.js, React Three Fiber, Drei, the canvas scene, wheel-driven chapter navigation and WebGL fallback controls have been removed. The current UI is entirely DOM/SVG.
