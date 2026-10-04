import {useEffect,useRef,useCallback} from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import 'lenis/dist/lenis.css';
gsap.registerPlugin(ScrollTrigger);
export default function useSmoothScroll(page){
 const instance=useRef(null);
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)');let tick;
  function setup(){if(tick)gsap.ticker.remove(tick);instance.current?.destroy();instance.current=null;if(media.matches)return;
   const lenis=new Lenis({duration:1.15,smoothWheel:true,syncTouch:false,prevent:node=>!!node.closest('[data-lenis-prevent],.table-scroll,.logs')});instance.current=lenis;lenis.on('scroll',ScrollTrigger.update);tick=time=>lenis.raf(time*1000);gsap.ticker.add(tick);gsap.ticker.lagSmoothing(0);
  }
  setup();media.addEventListener('change',setup);return()=>{media.removeEventListener('change',setup);if(tick)gsap.ticker.remove(tick);instance.current?.destroy();instance.current=null};
 },[]);
 useEffect(()=>{const frame=requestAnimationFrame(()=>{if(instance.current){instance.current.resize();instance.current.scrollTo(0,{immediate:true,force:true})}else window.scrollTo(0,0);ScrollTrigger.refresh()});return()=>cancelAnimationFrame(frame)},[page]);
 return useCallback(target=>{if(instance.current)instance.current.scrollTo(target,{offset:-95});else{const element=typeof target==='string'?document.querySelector(target):null;element?.scrollIntoView({behavior:'instant'})}},[]);
}
