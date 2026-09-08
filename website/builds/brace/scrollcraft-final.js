(() => {
  'use strict';

  const nav = document.querySelector('[data-site-nav]');
  const opening = document.querySelector('[data-opening-film]');
  if (!nav || !opening) return;

  let running = true;

  const sync = () => {
    const openingTop = opening.getBoundingClientRect().top + window.scrollY;
    /* The primary scene runtime deliberately eases visual scroll. Navigation is
       interaction chrome, so it follows the real scroll position every frame
       instead. This prevents the nav from visually trailing a fast wheel/touch
       gesture when the opening film hands off to the page. */
    const revealPoint = openingTop + opening.offsetHeight - window.innerHeight * 0.20;
    const visible = window.scrollY >= revealPoint;
    nav.classList.toggle('nav-force-visible', visible);

    /* The opening runtime can briefly retain .opening-active while its eased
       position catches up. Inline important opacity/pointer state is used only
       during that handoff, then removed when the user re-enters the opening. */
    if (visible) {
      nav.style.setProperty('opacity', '1', 'important');
      nav.style.setProperty('pointer-events', 'auto', 'important');
    } else {
      nav.style.removeProperty('opacity');
      nav.style.removeProperty('pointer-events');
    }

    if (running) requestAnimationFrame(sync);
  };

  addEventListener('pagehide', () => { running = false; }, { once: true });
  requestAnimationFrame(sync);
})();
