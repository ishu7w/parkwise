"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export function ScrollingGridShader({decorative = false}: {decorative?: boolean} = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setUnavailable(true);
      return;
    }
    setUnavailable(false);
    const vertexShader = `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `;
    const fragmentShader = `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;
      #define FC gl_FragCoord.xy
      #define R resolution
      #define T time
      #define MN min(R.x,R.y)
      void main(void) {
        vec2 uv = (FC - 0.5 * R) / MN;
        uv.x += T * 0.1;
        vec3 col = vec3(0.0);
        float s = 12.0, e = 9e-4;
        col += e / (sin(uv.x * s) * cos(uv.y * s));
        gl_FragColor = vec4(col, 1.0);
      }
    `;
    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    camera.position.z = 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(renderer.domElement);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const uniforms = { time: { value: 1.0 }, resolution: { value: new THREE.Vector2() } };
    const material = new THREE.ShaderMaterial({uniforms, vertexShader, fragmentShader});
    scene.add(new THREE.Mesh(geometry, material));

    let animationId = 0;
    let previousTime = 0;
    let contextLost = false;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    function render() { if (!contextLost) renderer.render(scene, camera); }
    function resize() {
      renderer.setSize(Math.max(1, container!.clientWidth), Math.max(1, container!.clientHeight));
      renderer.getDrawingBufferSize(uniforms.resolution.value);
      render();
    }
    function animate(now: number) {
      if (previousTime) uniforms.time.value += Math.min((now - previousTime) / 1000, .1) * .6;
      previousTime = now;
      render();
      animationId = requestAnimationFrame(animate);
    }
    function updatePlayback() {
      cancelAnimationFrame(animationId);
      previousTime = 0;
      if (!contextLost && !document.hidden && !motion.matches) animationId = requestAnimationFrame(animate);
      else render();
    }
    function lost(event: Event) {
      event.preventDefault();
      contextLost = true;
      cancelAnimationFrame(animationId);
      setUnavailable(true);
    }
    function restored() { contextLost = false; setUnavailable(false); resize(); updatePlayback(); }
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    renderer.domElement.addEventListener('webglcontextlost', lost);
    renderer.domElement.addEventListener('webglcontextrestored', restored);
    motion.addEventListener('change', updatePlayback);
    document.addEventListener('visibilitychange', updatePlayback);
    resize();
    updatePlayback();
    return () => {
      cancelAnimationFrame(animationId);
      observer.disconnect();
      motion.removeEventListener('change', updatePlayback);
      document.removeEventListener('visibilitychange', updatePlayback);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      renderer.domElement.removeEventListener('webglcontextrestored', restored);
      renderer.domElement.remove();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full" role={decorative ? undefined : "img"} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : "Animated scrolling grid shader"} style={{background:'#000',overflow:'hidden',height:'100svh',position:'relative'}}>
    {unavailable && !decorative && <p role="status" style={{position:'absolute',inset:0,display:'grid',placeItems:'center',color:'#bbb',background:'#000',padding:24,textAlign:'center'}}>WebGL is unavailable. Return to Parkwise to continue.</p>}
  </div>;
}
export default ScrollingGridShader;
