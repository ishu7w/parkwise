# Architecture

```mermaid
flowchart TD
  App[React application] --> Home[Typed SaaS landing and live parking preview]
  App --> Labs[Dashboard and OS laboratories]
  App --> Scroll[Lenis / GSAP ticker]
  Scroll --> Reveal[ScrollTrigger / SplitText / DrawSVG]
  Home --> Flip[Flip queue transitions]
  Labs --> Parking[Checked parking state and PCB records]
  Labs --> Scheduling[Pure FCFS / Priority / Round Robin]
  Labs --> Simulations[Deterministic race / FIFO / deadlock models]
```

Everything executes locally in the browser. Parking state persists in versioned localStorage. Sandbox scheduling and simulations remain separate from parking state. Logs are bounded. Playback timers are cancelled on unmount.

The latest UI is entirely DOM/SVG: no Three.js, canvas or WebGL requirement. Lenis smooths wheel scrolling, uses native touch behavior, and leaves nested tables/logs alone. One GSAP ticker drives Lenis; it notifies ScrollTrigger. Route changes reset scroll immediately. Reduced-motion users get native scrolling without decorative GSAP animations. GSAP contexts, Flip timelines, Lenis instances, media listeners and ticker callbacks are cleaned up.

See `component-integration.md` for TSX/shadcn structure and `topic-use.md` for the unchanged academic model.
