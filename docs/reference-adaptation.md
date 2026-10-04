> Historical design notes. This 3D adaptation was superseded by the current SaaS-style UI at the user’s request. See `component-integration.md` and `DESIGN.md` for the current implementation.

# Reference adaptation

Requested reference: https://activetheory.net/ and the supplied activetheory.net.zip.

The ZIP contains a captured HTML document, compiled JS, metadata icons and a tracking script. It references missing scene geometry (home/logo.json, room/floor.json, etc.), textures, fonts and a reel video. It is not a complete source repository and cannot be dropped into Vite as a working clone.

The implemented adaptation recreates the observable presentation in React/Three.js: fullscreen dark spatial scene, reflective center emblem, sparse pill navigation, small ambient particles, constrained perspective, six destinations and GSAP reveals. The central mark is a P for Parkwise, with parking bays as navigation. OS algorithm and simulation modules were not changed.

GSAP plugins used: SplitText, Observer and ScrollToPlugin. Plugins are registered once, observers killed, contexts reverted and transition tweens killed on unmount. Reduced-motion preferences bypass decorative animation. The home has an Explore menu, six chapter selectors, a full accessible destination directory and a 2D/WebGL-failure fallback.

The result is a Parkwise reconstruction of the reference's visual language, not a byte-for-byte clone of the incomplete captured bundle. No reference tracking scripts or external media dependencies are shipped.
