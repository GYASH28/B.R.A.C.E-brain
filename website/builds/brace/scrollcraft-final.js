(() => {
  'use strict';

  const nav = document.querySelector('[data-site-nav]');
  const opening = document.querySelector('[data-opening-film]');
  if (!nav || !opening) return;

  let raf = 0;

  const sync = () => {
    raf = 0;
    const openingTop = opening.getBoundingClientRect().top + window.scrollY;
    /* Reveal a little before the pinned film mathematically ends. The primary
       motion runtime eases visual scroll on purpose; this raw-scroll guard keeps
       the navigation responsive to the user's actual wheel/touch position. */
    const revealPoint = openingTop + opening.offsetHeight - window.innerHeight * 0.20;
    nav.classList.toggle('nav-force-visible', window.scrollY >= revealPoint);
  };

  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(sync);
  };

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  addEventListener('pageshow', schedule, { passive: true });
  schedule();
})();
