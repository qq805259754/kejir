/**
 * GSAP 动画工具 - 纯 JS 版本（避免客户端 TS 语法错误）
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

let initialized = false;

export function initGSAP() {
  if (initialized) return;
  if (typeof window === 'undefined') return;

  gsap.registerPlugin(ScrollTrigger);

  window.gsap = gsap;
  window.ScrollTrigger = ScrollTrigger;

  initialized = true;
}

export function initSidebarIndicator() {
  if (typeof document === 'undefined') return;

  const nav = document.querySelector('.sidebar-nav');
  if (!nav) return;

  const indicator = nav.querySelector('.active-indicator');
  const activeBtn = nav.querySelector('.nav-icon-btn.active');

  if (!indicator) return;

  const moveTo = (btn) => {
    if (!btn) {
      gsap.to(indicator, { opacity: 0, duration: 0.3 });
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const top = btnRect.top - navRect.top;
    gsap.to(indicator, {
      top,
      opacity: 1,
      duration: 0.45,
      ease: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      overwrite: 'auto',
    });
  };

  requestAnimationFrame(() => {
    gsap.set(indicator, { opacity: 0, top: 0 });
    moveTo(activeBtn);
  });

  nav.querySelectorAll('.nav-icon-btn').forEach((btn) => {
    btn.addEventListener('mouseenter', () => moveTo(btn));
    btn.addEventListener('focus', () => moveTo(btn));
    btn.addEventListener('click', () => {
      nav.querySelectorAll('.nav-icon-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      moveTo(btn);
    });
  });

  nav.addEventListener('mouseleave', () => {
    const current = nav.querySelector('.nav-icon-btn.active');
    moveTo(current);
  });
}

export function initStackCarousel() {
  if (typeof document === 'undefined') return;
  if (window.innerWidth < 768) return;

  const stack = document.querySelector('[data-stack]');
  if (!stack) return;

  const cards = Array.from(stack.querySelectorAll('.stack-card'));
  if (cards.length < 2) return;

  const dots = Array.from(stack.querySelectorAll('.stack-dot'));

  let isPaused = false;
  let timer = null;
  let animating = false;
  let currentIndex = 0;

  // 卡片层级/位置配置 — 扇形向右展开，后层只露边缘
  const positions = [
    { x: 0, y: 0, scale: 1, rotate: -1, z: 4, opacity: 1 },
    { x: 40, y: 5, scale: 0.97, rotate: 2, z: 3, opacity: 0.85 },
    { x: 70, y: 10, scale: 0.94, rotate: 4, z: 2, opacity: 0.6 },
    { x: 95, y: 15, scale: 0.91, rotate: 6, z: 1, opacity: 0.4 },
  ];

  function updateDots() {
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === currentIndex % cards.length);
    });
  }

  function applyPositions(animate) {
    if (animate === undefined) animate = true;
    cards.forEach((card, i) => {
      const pos = positions[i];
      if (!pos) {
        gsap.set(card, { opacity: 0, scale: 0.8, y: 80, x: 80, rotate: 6, zIndex: 0 });
        return;
      }
      const props = {
        y: pos.y,
        x: pos.x,
        xPercent: -50,
        yPercent: -50,
        scale: pos.scale,
        rotate: pos.rotate,
        zIndex: pos.z,
        opacity: pos.opacity,
        duration: animate ? 0.6 : 0,
        ease: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        overwrite: 'auto',
      };
      if (animate) gsap.to(card, props);
      else gsap.set(card, props);
    });
  }

  function next() {
    if (isPaused || animating) return;
    animating = true;

    const first = cards[0];

    gsap.to(first, {
      x: 400,
      y: 40,
      rotate: 15,
      scale: 0.7,
      opacity: 0,
      duration: 0.5,
      ease: 'power2.in',
      onComplete: () => {
        cards.push(cards.shift());
        currentIndex = (currentIndex + 1) % cards.length;
        gsap.set(first, {
          xPercent: -50,
          yPercent: -50,
          x: -120,
          y: 40,
          rotate: -8,
          scale: 0.85,
          opacity: 0,
        });
        applyPositions(true);
        updateDots();
        setTimeout(() => {
          animating = false;
        }, 650);
      },
    });
  }

  function prev() {
    if (isPaused || animating) return;
    animating = true;

    const last = cards.pop();
    cards.unshift(last);
    currentIndex = (currentIndex - 1 + cards.length) % cards.length;
    gsap.set(last, {
      xPercent: -50,
      yPercent: -50,
      x: -200,
      y: -20,
      rotate: -12,
      scale: 0.75,
      opacity: 0,
      zIndex: 5,
    });
    applyPositions(true);
    updateDots();
    setTimeout(() => {
      animating = false;
    }, 650);
  }

  function goTo(index) {
    if (isPaused || animating) return;
    const target = ((index % cards.length) + cards.length) % cards.length;
    if (target === currentIndex) return;
    const steps = (target - currentIndex + cards.length) % cards.length;
    isPaused = true;
    let step = 0;
    const runStep = () => {
      if (step >= steps) {
        isPaused = false;
        return;
      }
      step++;
      animating = false;
      next();
      setTimeout(runStep, 700);
    };
    runStep();
  }

  function startAutoPlay() {
    stopAutoPlay();
    timer = window.setInterval(next, 4000);
  }
  function stopAutoPlay() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  stack.addEventListener('mouseenter', () => {
    isPaused = true;
  });
  stack.addEventListener('mouseleave', () => {
    isPaused = false;
  });

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => goTo(i));
  });

  window.stackNext = next;
  window.stackPrev = prev;
  window.stackGoTo = goTo;

  gsap.set(cards, { xPercent: -50, yPercent: -50, left: '50%', top: '50%' });
  applyPositions(false);
  updateDots();
  startAutoPlay();
}

export function autoReveal() {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;

  const elements = document.querySelectorAll('[data-reveal]');
  if (!elements.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        io.unobserve(el);

        if (el.closest('[data-stack]')) return;

        const delay = parseFloat(el.dataset.revealDelay || '0');
        const distance = parseFloat(el.dataset.revealY || '30');

        gsap.fromTo(
          el,
          { opacity: 0, y: distance },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            delay,
            ease: 'power3.out',
            clearProps: 'transform',
          }
        );
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  elements.forEach((el) => io.observe(el));
}

export { gsap, ScrollTrigger };
