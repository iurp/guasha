/* ============================================================
   MERIDIAN — cart.js
   Full shopping cart: localStorage persistence + sidebar drawer.
   Public API exposed on window.MeridianCart.
   ============================================================ */

(function () {
  'use strict';

  var STORAGE_KEY = 'meridian_cart';

  /* ──────────────────────────────────────────────
     Core data helpers
  ────────────────────────────────────────────── */

  /**
   * getCart()
   * Returns the cart array from localStorage.
   * Each item: { id: string, name: string, price: number, qty: number }
   * @returns {Array}
   */
  function getCart() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('[MeridianCart] Could not parse cart:', e);
      return [];
    }
  }

  /**
   * saveCart(cart)
   * Writes the cart array to localStorage, then refreshes all UI.
   * Also fires a 'cart:updated' CustomEvent for external listeners (e.g. main.js).
   * @param {Array} cart
   */
  function saveCart(cart) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
      console.error('[MeridianCart] Could not save cart:', e);
    }
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart: cart } }));
    renderCartIcon();
    renderCartSidebar();
  }

  /* ──────────────────────────────────────────────
     Cart operations
  ────────────────────────────────────────────── */

  /**
   * addToCart(productId, name, price)
   * Adds a product or increments its quantity if already in the cart.
   * Opens the sidebar drawer on success.
   * @param {string} productId
   * @param {string} name
   * @param {number} price
   */
  function addToCart(productId, name, price) {
    var cart = getCart();
    var existing = null;

    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === productId) {
        existing = cart[i];
        break;
      }
    }

    if (existing) {
      existing.qty = (existing.qty || 1) + 1;
    } else {
      cart.push({
        id:    String(productId),
        name:  String(name),
        price: Number(price) || 0,
        qty:   1
      });
    }

    saveCart(cart);
    openCart();
  }

  /**
   * addItem(productId, name, price, qty)
   * Legacy alias for addToCart with optional qty parameter.
   * Kept for backward compatibility with existing product pages.
   * @param {string} productId
   * @param {string} name
   * @param {number} price
   * @param {number} [qty=1]
   * @returns {Array} Updated cart
   */
  function addItem(productId, name, price, qty) {
    qty = parseInt(qty, 10) || 1;
    var cart = getCart();
    var existing = null;

    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === productId) {
        existing = cart[i];
        break;
      }
    }

    if (existing) {
      existing.qty = (existing.qty || 1) + qty;
    } else {
      cart.push({
        id:    String(productId),
        name:  String(name),
        price: Number(price) || 0,
        qty:   qty
      });
    }

    saveCart(cart);
    return cart;
  }

  /**
   * removeFromCart(productId)
   * Removes a product entirely from the cart.
   * @param {string} productId
   */
  function removeFromCart(productId) {
    var cart = getCart().filter(function (item) {
      return item.id !== productId;
    });
    saveCart(cart);
  }

  /**
   * removeItem(productId)
   * Alias for removeFromCart (backward compatibility).
   * @param {string} productId
   * @returns {Array} Updated cart
   */
  function removeItem(productId) {
    removeFromCart(productId);
    return getCart();
  }

  /**
   * updateQuantity(productId, qty)
   * Sets a cart item's quantity. Removes the item if qty <= 0.
   * @param {string} productId
   * @param {number} qty
   */
  function updateQuantity(productId, qty) {
    qty = parseInt(qty, 10);
    if (isNaN(qty) || qty < 0) return;

    if (qty === 0) {
      removeFromCart(productId);
      return;
    }

    var cart = getCart();
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === productId) {
        cart[i].qty = qty;
        break;
      }
    }
    saveCart(cart);
  }

  /**
   * clearCart()
   * Empties the entire cart.
   */
  function clearCart() {
    saveCart([]);
  }

  /**
   * calculateTotal()
   * Returns the sum of (price * qty) across all cart items.
   * @returns {number}
   */
  function calculateTotal() {
    return getCart().reduce(function (sum, item) {
      return sum + (Number(item.price) || 0) * (Number(item.qty) || 0);
    }, 0);
  }

  /* ──────────────────────────────────────────────
     UI helpers
  ────────────────────────────────────────────── */

  function formatPrice(amount) {
    return '$' + Number(amount).toFixed(2);
  }

  function totalItems() {
    return getCart().reduce(function (sum, item) {
      return sum + (Number(item.qty) || 0);
    }, 0);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ──────────────────────────────────────────────
     Render: Nav cart icon badge
  ────────────────────────────────────────────── */

  /**
   * renderCartIcon()
   * Updates the cart count badge in the nav.
   * Supports both #cartBadge (new) and .nav-cart__count (existing CSS class).
   */
  function renderCartIcon() {
    var count = totalItems();
    var displayText = count > 99 ? '99+' : String(count);

    // New badge element used in about.html / cart.html
    var badge = document.getElementById('cartBadge');
    if (badge) {
      badge.textContent = displayText;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }

    // Existing .nav-cart__count elements (main.js also handles these)
    var oldBadges = document.querySelectorAll('.nav-cart__count');
    for (var i = 0; i < oldBadges.length; i++) {
      oldBadges[i].textContent = displayText;
      oldBadges[i].style.display = count > 0 ? 'flex' : 'none';
    }
  }

  /* ──────────────────────────────────────────────
     Render: Cart sidebar drawer
  ────────────────────────────────────────────── */

  /**
   * renderCartSidebar()
   * Builds the HTML content for the #cartSidebar element.
   * Called automatically after every cart mutation.
   */
  function renderCartSidebar() {
    var sidebar = document.getElementById('cartSidebar');
    if (!sidebar) return;

    var cart = getCart();
    var total = calculateTotal();
    var html = '';

    /* Header */
    html += '<div class="cs-header">'
          +   '<span class="cs-title">Your Cart</span>'
          +   '<button class="cs-close" id="cartCloseBtn" aria-label="Close cart">'
          +     svgClose()
          +   '</button>'
          + '</div>';

    /* Body */
    if (cart.length === 0) {
      html += '<div class="cs-body cs-empty">'
            +   '<p>Your cart is empty.</p>'
            +   '<a href="products.html" class="cs-browse-link">Browse products &rarr;</a>'
            + '</div>';
    } else {
      html += '<div class="cs-body">';
      html += '<ul class="cs-list">';

      for (var i = 0; i < cart.length; i++) {
        var item = cart[i];
        html += '<li class="cs-item">'
              +   '<div class="cs-item-info">'
              +     '<span class="cs-item-name">' + escapeHtml(item.name) + '</span>'
              +     '<span class="cs-item-unit-price">' + formatPrice(item.price) + '</span>'
              +   '</div>'
              +   '<div class="cs-item-row2">'
              +     '<div class="cs-qty-wrap">'
              +       '<button class="cs-qty-btn cs-qty-dec" data-id="' + escapeHtml(item.id) + '" aria-label="Decrease">−</button>'
              +       '<span class="cs-qty-val">' + item.qty + '</span>'
              +       '<button class="cs-qty-btn cs-qty-inc" data-id="' + escapeHtml(item.id) + '" aria-label="Increase">+</button>'
              +     '</div>'
              +     '<span class="cs-item-subtotal">' + formatPrice(item.price * item.qty) + '</span>'
              +     '<button class="cs-remove" data-id="' + escapeHtml(item.id) + '" aria-label="Remove">'
              +       svgTrash()
              +     '</button>'
              +   '</div>'
              + '</li>';
      }

      html += '</ul>';
      html += '</div>'; /* .cs-body */

      /* Footer */
      html += '<div class="cs-footer">'
            +   '<div class="cs-total-row">'
            +     '<span>Subtotal</span>'
            +     '<span class="cs-total-amount">' + formatPrice(total) + '</span>'
            +   '</div>'
            +   '<p class="cs-shipping-note">Shipping &amp; taxes calculated at checkout</p>'
            +   '<button class="cs-checkout-btn" id="cartCheckoutBtn">Proceed to Checkout</button>'
            +   '<a href="cart.html" class="cs-view-cart-link">View full cart</a>'
            + '</div>';
    }

    sidebar.innerHTML = html;
    bindSidebarEvents(sidebar);
  }

  /* ──────────────────────────────────────────────
     Sidebar event binding
  ────────────────────────────────────────────── */

  function bindSidebarEvents(sidebar) {
    var closeBtn = document.getElementById('cartCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeCart);
    }

    var checkoutBtn = document.getElementById('cartCheckoutBtn');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', initCheckout);
    }

    var decBtns = sidebar.querySelectorAll('.cs-qty-dec');
    for (var d = 0; d < decBtns.length; d++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-id');
          var cart = getCart();
          for (var i = 0; i < cart.length; i++) {
            if (cart[i].id === id) {
              updateQuantity(id, cart[i].qty - 1);
              break;
            }
          }
        });
      }(decBtns[d]));
    }

    var incBtns = sidebar.querySelectorAll('.cs-qty-inc');
    for (var n = 0; n < incBtns.length; n++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-id');
          var cart = getCart();
          for (var i = 0; i < cart.length; i++) {
            if (cart[i].id === id) {
              updateQuantity(id, cart[i].qty + 1);
              break;
            }
          }
        });
      }(incBtns[n]));
    }

    var removeBtns = sidebar.querySelectorAll('.cs-remove');
    for (var r = 0; r < removeBtns.length; r++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          removeFromCart(btn.getAttribute('data-id'));
        });
      }(removeBtns[r]));
    }
  }

  /* ──────────────────────────────────────────────
     Open / Close / Toggle
  ────────────────────────────────────────────── */

  /** openCart() — slides the cart drawer in from the right. */
  function openCart() {
    var sidebar = document.getElementById('cartSidebar');
    var overlay = document.getElementById('cartOverlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  /** closeCart() — slides the cart drawer away. */
  function closeCart() {
    var sidebar = document.getElementById('cartSidebar');
    var overlay = document.getElementById('cartOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  /** toggleCart() — opens if closed, closes if open. */
  function toggleCart() {
    var sidebar = document.getElementById('cartSidebar');
    if (!sidebar) return;
    if (sidebar.classList.contains('open')) {
      closeCart();
    } else {
      openCart();
    }
  }

  /* ──────────────────────────────────────────────
     Checkout
  ────────────────────────────────────────────── */

  /**
   * initCheckout()
   * Placeholder: alerts an order summary.
   * Replace this function body with a Stripe Checkout session call when ready.
   */
  function initCheckout() {
    var cart = getCart();

    if (cart.length === 0) {
      alert('Your cart is empty.');
      return;
    }

    /* TODO: Replace with Stripe Checkout integration
       e.g. fetch('/api/create-checkout-session', { method: 'POST', body: JSON.stringify(cart) })
              .then(res => res.json())
              .then(data => stripe.redirectToCheckout({ sessionId: data.id }))             */

    var lines = cart.map(function (item) {
      return '  ' + item.name + '  \u00d7' + item.qty + '  \u2014  ' + formatPrice(item.price * item.qty);
    });

    alert(
      'Checkout coming soon.\n\n'
      + 'Order summary:\n'
      + lines.join('\n')
      + '\n\n'
      + 'Total: ' + formatPrice(calculateTotal())
    );
  }

  /* ──────────────────────────────────────────────
     Product page: "Add to Cart" button binding
  ────────────────────────────────────────────── */

  function bindAddToCartButtons() {
    var btns = document.querySelectorAll('[data-product-id]');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        if (btn.dataset.cartBound) return;
        btn.dataset.cartBound = 'true';

        btn.addEventListener('click', function () {
          var id    = btn.dataset.productId;
          var name  = btn.dataset.productName  || id;
          var price = parseFloat(btn.dataset.productPrice) || 0;

          addItem(id, name, price, 1);
          openCart();

          /* Brief "Added" feedback */
          var original = btn.textContent;
          btn.textContent = 'Added';
          btn.style.opacity = '0.75';
          setTimeout(function () {
            btn.textContent = original;
            btn.style.opacity = '';
          }, 1400);
        });
      }(btns[i]));
    }
  }

  /* ──────────────────────────────────────────────
     Wishlist binding (preserved from original)
  ────────────────────────────────────────────── */

  function bindWishlist() {
    var btns = document.querySelectorAll('[data-wishlist-id]');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        if (btn.dataset.wishlistBound) return;
        btn.dataset.wishlistBound = 'true';

        btn.addEventListener('click', function () {
          var id = btn.dataset.wishlistId;
          var wish = [];
          try {
            wish = JSON.parse(localStorage.getItem('meridian_wishlist') || '[]');
          } catch (e) {}

          if (wish.indexOf(id) === -1) {
            wish.push(id);
            localStorage.setItem('meridian_wishlist', JSON.stringify(wish));
            btn.textContent = 'Saved to Wishlist';
          } else {
            btn.textContent = 'Already in Wishlist';
          }
          setTimeout(function () {
            btn.textContent = 'Add to Wishlist';
          }, 1600);
        });
      }(btns[i]));
    }
  }

  /* ──────────────────────────────────────────────
     SVG helpers
  ────────────────────────────────────────────── */

  function svgClose() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"'
         + ' stroke-linecap="round" stroke-linejoin="round" width="20" height="20">'
         + '<line x1="18" y1="6" x2="6" y2="18"/>'
         + '<line x1="6" y1="6" x2="18" y2="18"/>'
         + '</svg>';
  }

  function svgTrash() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"'
         + ' stroke-linecap="round" stroke-linejoin="round" width="14" height="14">'
         + '<polyline points="3 6 5 6 21 6"/>'
         + '<path d="M19 6l-1 14H6L5 6"/>'
         + '<path d="M10 11v6"/><path d="M14 11v6"/>'
         + '<path d="M9 6V4h6v2"/>'
         + '</svg>';
  }

  /* ──────────────────────────────────────────────
     Inject sidebar CSS (once, on load)
  ────────────────────────────────────────────── */

  function injectCartStyles() {
    if (document.getElementById('meridian-cart-styles')) return;

    var css = [
      /* Drawer structure */
      '.cart-sidebar { display: flex; flex-direction: column; font-family: var(--font-sans, "Inter", sans-serif); }',

      /* Header */
      '.cs-header { display:flex; align-items:center; justify-content:space-between;',
      '  padding:1.5rem 1.75rem; border-bottom:1px solid var(--color-border,#2a2320); flex-shrink:0; }',
      '.cs-title { font-family:var(--font-serif,"Cormorant Garamond",serif); font-size:1.2rem;',
      '  font-weight:400; letter-spacing:0.1em; color:var(--color-text,#f5f0eb); }',
      '.cs-close { background:none; border:none; cursor:pointer; color:var(--color-text-muted,#9c8f85);',
      '  padding:0.25rem; line-height:1; transition:color 0.2s; }',
      '.cs-close:hover { color:var(--color-copper,#b87333); }',

      /* Body scroll area */
      '.cs-body { flex:1; overflow-y:auto; padding:1.5rem 1.75rem; }',
      '.cs-empty { display:flex; flex-direction:column; align-items:center; justify-content:center;',
      '  gap:1.5rem; color:var(--color-text-muted,#9c8f85); font-size:0.9rem; min-height:200px; }',
      '.cs-browse-link { font-size:0.75rem; letter-spacing:0.15em; text-transform:uppercase;',
      '  color:var(--color-copper,#b87333); text-decoration:none; }',
      '.cs-browse-link:hover { text-decoration:underline; }',

      /* Items list */
      '.cs-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:1.25rem; }',
      '.cs-item { display:flex; flex-direction:column; gap:0.6rem;',
      '  padding-bottom:1.25rem; border-bottom:1px solid var(--color-border,#2a2320); }',
      '.cs-item:last-child { border-bottom:none; padding-bottom:0; }',

      '.cs-item-info { display:flex; justify-content:space-between; align-items:flex-start; gap:0.75rem; }',
      '.cs-item-name { font-size:0.875rem; color:var(--color-text,#f5f0eb); line-height:1.4; flex:1; }',
      '.cs-item-unit-price { font-size:0.8rem; color:var(--color-text-muted,#9c8f85); white-space:nowrap; }',

      '.cs-item-row2 { display:flex; align-items:center; gap:0.75rem; }',

      '.cs-qty-wrap { display:flex; align-items:center; gap:0.35rem; }',
      '.cs-qty-btn { width:26px; height:26px; background:var(--color-surface-2,#241e1b);',
      '  border:1px solid var(--color-border-light,#3a302c); color:var(--color-text,#f5f0eb);',
      '  font-size:1rem; line-height:1; cursor:pointer; display:flex; align-items:center;',
      '  justify-content:center; transition:border-color 0.2s,color 0.2s; }',
      '.cs-qty-btn:hover { border-color:var(--color-copper,#b87333); color:var(--color-copper,#b87333); }',
      '.cs-qty-val { min-width:1.75rem; text-align:center; font-size:0.875rem;',
      '  color:var(--color-text,#f5f0eb); }',

      '.cs-item-subtotal { margin-left:auto; font-size:0.875rem;',
      '  color:var(--color-copper,#b87333); white-space:nowrap; }',

      '.cs-remove { background:none; border:none; cursor:pointer; color:var(--color-text-faint,#5a504a);',
      '  padding:0.2rem; line-height:1; transition:color 0.2s; flex-shrink:0; }',
      '.cs-remove:hover { color:#c0392b; }',

      /* Footer */
      '.cs-footer { padding:1.25rem 1.75rem; border-top:1px solid var(--color-border,#2a2320);',
      '  flex-shrink:0; display:flex; flex-direction:column; gap:0.75rem; }',
      '.cs-total-row { display:flex; justify-content:space-between; align-items:center;',
      '  font-size:0.9rem; color:var(--color-text-muted,#9c8f85); }',
      '.cs-total-amount { font-size:1rem; color:var(--color-text,#f5f0eb); font-weight:500; }',
      '.cs-shipping-note { font-size:0.75rem; color:var(--color-text-faint,#5a504a); }',

      '.cs-checkout-btn { width:100%; padding:0.9rem 1rem;',
      '  background:var(--color-copper,#b87333); color:var(--color-bg,#0f0d0c);',
      '  border:none; font-size:0.75rem; letter-spacing:0.2em; text-transform:uppercase;',
      '  cursor:pointer; font-family:var(--font-sans,"Inter",sans-serif); font-weight:500;',
      '  transition:background 0.2s; }',
      '.cs-checkout-btn:hover { background:var(--color-copper-light,#d4956a); }',

      '.cs-view-cart-link { display:block; text-align:center; font-size:0.75rem;',
      '  letter-spacing:0.1em; color:var(--color-text-faint,#5a504a); text-decoration:none;',
      '  transition:color 0.2s; }',
      '.cs-view-cart-link:hover { color:var(--color-copper,#b87333); }'
    ].join('\n');

    var style = document.createElement('style');
    style.id = 'meridian-cart-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ──────────────────────────────────────────────
     Initialization
  ────────────────────────────────────────────── */

  function init() {
    injectCartStyles();
    renderCartIcon();
    renderCartSidebar();
    bindAddToCartButtons();
    bindWishlist();

    /* Nav cart toggle button */
    var toggleBtn = document.getElementById('cartToggleBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleCart);
    }

    /* Click overlay to close */
    var overlay = document.getElementById('cartOverlay');
    if (overlay) {
      overlay.addEventListener('click', closeCart);
    }

    /* ESC key to close */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeCart(); }
    });

    /* Re-bind add-to-cart buttons when new product cards are injected dynamically */
    document.addEventListener('products:rendered', bindAddToCartButtons);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ──────────────────────────────────────────────
     Public API
  ────────────────────────────────────────────── */

  window.MeridianCart = {
    /* Primary API (task requirements) */
    addToCart:         addToCart,
    removeFromCart:    removeFromCart,
    updateQuantity:    updateQuantity,
    getCart:           getCart,
    saveCart:          saveCart,
    renderCartIcon:    renderCartIcon,
    renderCartSidebar: renderCartSidebar,
    toggleCart:        toggleCart,
    openCart:          openCart,
    closeCart:         closeCart,
    calculateTotal:    calculateTotal,
    initCheckout:      initCheckout,
    /* Legacy aliases */
    addItem:           addItem,
    removeItem:        removeItem,
    clearCart:         clearCart
  };

}());
