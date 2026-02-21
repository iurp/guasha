/**
 * MERIDIAN — Main JavaScript
 * Handles: mobile nav, scroll effects, animations, smooth scroll, active nav
 */

'use strict';

/* =============================================================================
   Utility helpers
   ============================================================================= */

/**
 * Query a single element, returns null if not found (no throws).
 * @param {string} selector
 * @param {Element} [root=document]
 * @returns {Element|null}
 */
function qs(selector, root) {
  return (root || document).querySelector(selector);
}

/**
 * Query all elements as a real array.
 * @param {string} selector
 * @param {Element} [root=document]
 * @returns {Element[]}
 */
function qsa(selector, root) {
  return Array.from((root || document).querySelectorAll(selector));
}

/**
 * Check if reduced motion is preferred.
 * @returns {boolean}
 */
function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}


/* =============================================================================
   Navigation — Scroll behavior
   Adds .nav--scrolled when page scrolls past threshold.
   ============================================================================= */

function initNavScroll() {
  var nav = qs('.nav');
  if (!nav) return;

  var THRESHOLD = 60;

  function update() {
    if (window.scrollY > THRESHOLD) {
      nav.classList.add('nav--scrolled');
    } else {
      nav.classList.remove('nav--scrolled');
    }
  }

  window.addEventListener('scroll', update, { passive: true });
  update(); // run on load
}


/* =============================================================================
   Active Nav Link — based on scroll position
   Expects anchors: <a class="nav-links__item" data-section="hero">…</a>
   ============================================================================= */

function initActiveNavLinks() {
  var links = qsa('.nav-links__item[data-section]');
  if (links.length === 0) return;

  function update() {
    var scrollMid = window.scrollY + window.innerHeight * 0.45;
    var current   = null;

    links.forEach(function (link) {
      var id      = link.getAttribute('data-section');
      var section = qs('#' + id);
      if (!section) return;

      var top = section.getBoundingClientRect().top + window.scrollY;
      if (scrollMid >= top) {
        current = link;
      }
    });

    links.forEach(function (link) {
      link.classList.remove('active');
    });
    if (current) current.classList.add('active');
  }

  window.addEventListener('scroll', update, { passive: true });
  update();
}


/* =============================================================================
   Mobile Navigation — hamburger drawer
   ============================================================================= */

function initMobileNav() {
  var hamburger = qs('.nav-hamburger');
  var drawer    = qs('.nav-drawer');
  var backdrop  = qs('.nav-backdrop');
  var body      = document.body;

  if (!hamburger) return;

  function open() {
    hamburger.classList.add('active');
    hamburger.setAttribute('aria-expanded', 'true');
    hamburger.setAttribute('aria-label', 'Close navigation menu');
    if (drawer)   drawer.classList.add('active');
    if (backdrop) backdrop.classList.add('active');
    body.classList.add('nav-open');

    // Move focus into drawer
    var firstLink = drawer && qs('.nav-drawer__link', drawer);
    if (firstLink) {
      setTimeout(function () { firstLink.focus(); }, 60);
    }
  }

  function close() {
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-label', 'Open navigation menu');
    if (drawer)   drawer.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
    body.classList.remove('nav-open');
    hamburger.focus();
  }

  function toggle() {
    if (hamburger.classList.contains('active')) {
      close();
    } else {
      open();
    }
  }

  // ARIA setup
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.setAttribute('aria-label', 'Open navigation menu');
  if (drawer && !drawer.id) drawer.id = 'nav-drawer';
  hamburger.setAttribute('aria-controls', 'nav-drawer');

  hamburger.addEventListener('click', toggle);

  if (backdrop) {
    backdrop.addEventListener('click', close);
  }

  // Close on drawer link click
  if (drawer) {
    qsa('.nav-drawer__link', drawer).forEach(function (link) {
      link.addEventListener('click', close);
    });
  }

  // Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && hamburger.classList.contains('active')) {
      close();
    }
  });
}


/* =============================================================================
   Scroll-triggered Animations — IntersectionObserver
   Adds .visible to .reveal and .reveal-group elements.
   ============================================================================= */

function initRevealOnScroll() {
  var elements = qsa('.reveal, .reveal-group');
  if (elements.length === 0) return;

  // Respect reduced-motion: skip animations, show everything immediately
  if (prefersReducedMotion()) {
    elements.forEach(function (el) {
      el.classList.add('visible');
      el.style.transition = 'none';
    });
    return;
  }

  if (!('IntersectionObserver' in window)) {
    // Fallback: show all immediately
    elements.forEach(function (el) { el.classList.add('visible'); });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold:  0.1,
      rootMargin: '0px 0px -8% 0px',
    }
  );

  elements.forEach(function (el) { observer.observe(el); });
}


/* =============================================================================
   Smooth Scroll — in-page anchor links
   ============================================================================= */

function initSmoothScroll() {
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;

    var href = link.getAttribute('href');
    if (href === '#' || href === '#0') return;

    var target;
    try {
      target = document.querySelector(href);
    } catch (_) {
      return;
    }
    if (!target) return;

    e.preventDefault();

    var nav       = qs('.nav');
    var navHeight = nav ? nav.getBoundingClientRect().height : 0;
    var top       = target.getBoundingClientRect().top + window.scrollY - navHeight - 24;

    window.scrollTo({
      top:      top,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });

    if (target.id) {
      history.pushState(null, '', '#' + target.id);
    }
  });
}


/* =============================================================================
   Hero Parallax — subtle background drift
   ============================================================================= */

function initHeroParallax() {
  var hero = qs('.hero');
  var bg   = qs('.hero__bg-image');

  if (!hero || !bg || prefersReducedMotion()) return;

  var ticking = false;

  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(function () {
        var heroBottom = hero.getBoundingClientRect().bottom;
        if (heroBottom > 0) {
          bg.style.transform = 'translateY(' + (window.scrollY * 0.25) + 'px)';
        }
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}


/* =============================================================================
   Cart Count — reads from localStorage (set by cart.js)
   ============================================================================= */

function initCartBadge() {
  function update() {
    var cart  = [];
    try {
      cart = JSON.parse(localStorage.getItem('meridian_cart') || '[]');
    } catch (_) {}

    var total = cart.reduce(function (sum, item) {
      return sum + (item.qty || 1);
    }, 0);

    qsa('.nav-cart__count').forEach(function (el) {
      el.textContent = total > 99 ? '99+' : String(total);
      el.hidden      = total === 0;
    });
  }

  update();
  window.addEventListener('storage', update);
  document.addEventListener('cart:updated', update);
}


/* =============================================================================
   Product Cards — quick-add feedback + card navigation
   ============================================================================= */

function initProductCards() {
  // Quick-add button
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.product-card__quick-add');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    var originalText = btn.textContent;
    btn.textContent  = 'Added';
    btn.disabled     = true;

    var card = btn.closest('.product-card');
    if (card) {
      card.dispatchEvent(new CustomEvent('meridian:add-to-cart', {
        bubbles: true,
        detail:  { productName: qs('.product-card__name', card)?.textContent },
      }));
    }

    setTimeout(function () {
      btn.textContent = originalText;
      btn.disabled    = false;
    }, 1800);
  });

  // Card click — navigate
  document.addEventListener('click', function (e) {
    var card = e.target.closest('.product-card[data-href]');
    if (!card) return;
    if (e.target.closest('button, a')) return;
    window.location.href = card.getAttribute('data-href');
  });
}


/* =============================================================================
   Newsletter Form — basic submit UX
   ============================================================================= */

function initNewsletter() {
  qsa('.footer__newsletter-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var input = qs('input[type="email"]', form);
      var btn   = qs('button', form);
      var email = (input && input.value || '').trim();

      var valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!valid) {
        if (input) {
          input.focus();
          input.classList.add('error');
          input.addEventListener('input', function () {
            input.classList.remove('error');
          }, { once: true });
        }
        return;
      }

      // Optimistic success UI
      var original = btn && btn.textContent;
      if (btn)   btn.textContent = 'Subscribed';
      if (input) input.value     = '';

      setTimeout(function () {
        if (btn && original) btn.textContent = original;
      }, 3000);
    });
  });
}


/* =============================================================================
   Lazy Images
   Expects: <img data-src="actual.jpg" class="lazy">
   ============================================================================= */

function initLazyImages() {
  var images = qsa('img[data-src]');
  if (images.length === 0) return;

  function loadImg(img) {
    var src    = img.getAttribute('data-src');
    var srcset = img.getAttribute('data-srcset');
    if (src)    img.src    = src;
    if (srcset) img.srcset = srcset;
    img.removeAttribute('data-src');
    img.removeAttribute('data-srcset');
    img.classList.remove('lazy');
    img.classList.add('lazy-loaded');
  }

  if (!('IntersectionObserver' in window)) {
    images.forEach(loadImg);
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          loadImg(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '200px 0px' }
  );

  images.forEach(function (img) { observer.observe(img); });
}


/* =============================================================================
   Bootstrap — run all modules
   ============================================================================= */

function init() {
  initNavScroll();
  initActiveNavLinks();
  initMobileNav();
  initSmoothScroll();
  initRevealOnScroll();
  initHeroParallax();
  initCartBadge();
  initProductCards();
  initNewsletter();
  initLazyImages();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


/* =============================================================================
   Public API
   ============================================================================= */

window.MERIDIAN = window.MERIDIAN || {};

/**
 * Programmatically reveal a hidden element.
 * @param {Element} el
 */
window.MERIDIAN.reveal = function (el) {
  if (el) el.classList.add('visible');
};

/**
 * Smooth-scroll to any element.
 * @param {string|Element} target — CSS selector string or DOM element
 */
window.MERIDIAN.scrollTo = function (target) {
  var el = typeof target === 'string' ? qs(target) : target;
  if (!el) return;
  var nav       = qs('.nav');
  var navHeight = nav ? nav.getBoundingClientRect().height : 0;
  var top       = el.getBoundingClientRect().top + window.scrollY - navHeight - 24;
  window.scrollTo({
    top:      top,
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  });
};
