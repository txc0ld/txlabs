/* ============================================================
   TXLABS storefront engine — cart, catalog, checkout
   ============================================================ */
(function () {
  'use strict';

  const CATALOG = window.TXLABS_CATALOG || { products: [], categories: [] };
  const PRODUCTS = CATALOG.products;
  const CART_KEY = 'txlabs_cart_v1';
  const CONTACT = { email: 'orders@txlabs.bio', telegram: '@txlabs_orders' };

  /* ---------- utils ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const money = n => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const qs = k => new URLSearchParams(location.search).get(k);
  const bySlug = s => PRODUCTS.find(p => p.slug === s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const catCount = c => PRODUCTS.filter(p => p.category === c).length;

  /* ---------- cart store ---------- */
  const Cart = {
    read() { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { return []; } },
    write(items) { localStorage.setItem(CART_KEY, JSON.stringify(items)); updateCartCount(); },
    count() { return this.read().reduce((a, i) => a + i.qty, 0); },
    subtotal() { return this.read().reduce((a, i) => a + i.price * i.qty, 0); },
    add(item) {
      const items = this.read();
      const ex = items.find(i => i.sku === item.sku);
      if (ex) ex.qty += item.qty; else items.push(item);
      this.write(items);
    },
    setQty(sku, qty) {
      let items = this.read();
      const it = items.find(i => i.sku === sku);
      if (it) { it.qty = Math.max(1, qty); }
      this.write(items);
    },
    remove(sku) { this.write(this.read().filter(i => i.sku !== sku)); },
    clear() { this.write([]); }
  };

  function updateCartCount() {
    const c = Cart.count();
    $$('.cart-btn .count').forEach(el => {
      el.textContent = c;
      el.classList.toggle('show', c > 0);
    });
  }

  /* ---------- vial svg fragment ---------- */
  const vial = () => '<div class="vial"><div class="cap"></div><div class="body"><div class="lvl"></div></div></div>';

  /* ---------- toast ---------- */
  let toastWrap;
  function toast(title, sub) {
    if (!toastWrap) { toastWrap = document.createElement('div'); toastWrap.className = 'toast-wrap'; document.body.appendChild(toastWrap); }
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span class="tic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span><div><div class="tt">${esc(title)}</div>${sub ? `<div class="ts">${esc(sub)}</div>` : ''}</div>`;
    toastWrap.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 500); }, 2600);
  }

  /* ---------- global UI: nav, reveal ---------- */
  function initChrome() {
    const nav = $('.nav');
    if (nav) {
      const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 12);
      onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    }
    const burger = $('.burger'), menu = $('.mobile-menu');
    if (burger && menu) {
      burger.addEventListener('click', () => {
        const open = burger.classList.toggle('open');
        menu.classList.toggle('open', open);
        document.body.style.overflow = open ? 'hidden' : '';
      });
      $$('.mobile-menu a').forEach(a => a.addEventListener('click', () => {
        burger.classList.remove('open'); menu.classList.remove('open'); document.body.style.overflow = '';
      }));
    }
    // reveal
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      $$('.reveal').forEach(el => io.observe(el));
    } else { $$('.reveal').forEach(el => el.classList.add('in')); }
    updateCartCount();
  }

  /* ---------- product card ---------- */
  function productCard(p) {
    const fromTxt = p.variants.length > 1
      ? `<span class="from">From</span><span class="val">${money(p.from_price)}<span> USD</span></span>`
      : `<span class="from">Price</span><span class="val">${money(p.from_price)}<span> USD</span></span>`;
    return `<a class="p-card reveal" href="product.html?p=${encodeURIComponent(p.slug)}">
      <div class="p-card__vis">
        <span class="p-card__sku mono">${esc(p.variants[0].sku)}</span>
        ${vial()}
        <img class="p-card__img" src="${esc(p.img)}" alt="${esc(p.name)} research peptide vial" loading="lazy" onerror="this.remove()">
      </div>
      <div class="p-card__body">
        <div class="p-card__cat-lbl">${esc(p.category)}</div>
        <h3>${esc(p.name)}</h3>
        <p class="desc">${esc(p.description)}</p>
        <div class="p-card__foot">
          <div class="price">${fromTxt}</div>
          <span class="vcount">${p.variants.length} ${p.variants.length > 1 ? 'sizes' : 'size'}</span>
        </div>
      </div>
    </a>`;
  }

  /* ============================================================
     SHOP PAGE
     ============================================================ */
  function initShop() {
    const grid = $('#shop-grid'); if (!grid) return;
    const state = { q: '', cat: qs('cat') || 'all', sort: 'featured' };

    // filters
    const filterBox = $('#filter-cats');
    const cats = CATALOG.categories;
    filterBox.innerHTML =
      `<button class="filter-opt ${state.cat === 'all' ? 'active' : ''}" data-cat="all"><b>All products</b><span class="n">${PRODUCTS.length}</span></button>` +
      cats.map(c => `<button class="filter-opt ${state.cat === c ? 'active' : ''}" data-cat="${esc(c)}"><span>${esc(c)}</span><span class="n">${catCount(c)}</span></button>`).join('');

    const searchInput = $('#shop-search');
    const sortSel = $('#shop-sort');

    function render() {
      let list = PRODUCTS.slice();
      if (state.cat !== 'all') list = list.filter(p => p.category === state.cat);
      if (state.q) {
        const q = state.q.toLowerCase();
        list = list.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.variants.some(v => (v.sku || '').toLowerCase().includes(q)));
      }
      if (state.sort === 'price-asc') list.sort((a, b) => a.from_price - b.from_price);
      else if (state.sort === 'price-desc') list.sort((a, b) => b.from_price - a.from_price);
      else if (state.sort === 'az') list.sort((a, b) => a.name.localeCompare(b.name));

      $('#result-count').innerHTML = `<b>${list.length}</b> ${list.length === 1 ? 'compound' : 'compounds'}`;
      grid.innerHTML = list.length
        ? list.map(productCard).join('')
        : `<div class="empty"><h3>No compounds found</h3><p>Try a different search term or category filter.</p></div>`;
      // re-trigger reveal
      $$('.p-card.reveal', grid).forEach((el, i) => { el.dataset.d = (i % 5) + 1; requestAnimationFrame(() => el.classList.add('in')); });
      // active states
      $$('.filter-opt', filterBox).forEach(b => b.classList.toggle('active', b.dataset.cat === state.cat));
    }

    filterBox.addEventListener('click', e => {
      const b = e.target.closest('.filter-opt'); if (!b) return;
      state.cat = b.dataset.cat; render();
      history.replaceState({}, '', state.cat === 'all' ? 'shop.html' : 'shop.html?cat=' + encodeURIComponent(state.cat));
    });
    let t;
    searchInput.addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value.trim(); render(); }, 120); });
    sortSel.addEventListener('change', e => { state.sort = e.target.value; render(); });

    render();
  }

  /* ============================================================
     PRODUCT DETAIL PAGE
     ============================================================ */
  function initProduct() {
    const root = $('#pd-root'); if (!root) return;
    const p = bySlug(qs('p')) || PRODUCTS[0];
    if (!p) { root.innerHTML = '<p class="muted">Product not found.</p>'; return; }
    document.title = `${p.name} — TXLABS`;

    let sel = 0; // selected variant index
    let qty = 1;

    const variantRow = (v, i) => `
      <button class="variant ${i === sel ? 'sel' : ''}" data-i="${i}">
        <div>
          <div class="variant__spec">${esc(v.spec)}</div>
          <div class="variant__sku">CAT. ${esc(v.sku)}</div>
          ${v.note ? `<div class="variant__note">${esc(v.note)}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:14px">
          <div class="variant__price">${money(v.price)}</div>
          <div class="variant__radio"></div>
        </div>
      </button>`;

    function render() {
      const v = p.variants[sel];
      root.innerHTML = `
      <div class="pd reveal">
        <div class="pd__media">
          <div class="pd__media-inner">
            <div class="grid-bg"></div>
            ${vial()}
            <img class="pd__img" src="${esc(p.img)}" alt="${esc(p.name)} research peptide vial" onerror="this.remove()">
          </div>
        </div>
        <div class="pd__info">
          <div class="pd__crumbs"><a href="shop.html">Catalog</a><span>/</span><a href="shop.html?cat=${encodeURIComponent(p.category)}">${esc(p.category)}</a></div>
          <div class="pd__cat">${esc(p.category)}</div>
          <h1>${esc(p.name)}</h1>
          <p class="pd__desc">${esc(p.description)}</p>
          <div class="pd__price">
            <span class="big">${money(v.price)}<span> USD</span></span>
            <span class="unit">/ ${esc(v.spec)}</span>
          </div>

          <div class="opt-label">Select specification</div>
          <div class="variants" id="pd-variants">${p.variants.map(variantRow).join('')}</div>

          <div class="opt-label">Quantity</div>
          <div class="qty-row">
            <div class="qty">
              <button id="q-minus" aria-label="decrease">–</button>
              <input id="q-input" value="${qty}" inputmode="numeric" aria-label="quantity">
              <button id="q-plus" aria-label="increase">+</button>
            </div>
            <span class="muted mono" style="font-size:12px">×&nbsp;${esc(v.spec)}</span>
          </div>

          <div class="pd__add">
            <button class="btn btn--signal" id="add-cart">Add to cart — <span class="mono" id="add-total">${money(v.price * qty)}</span> <span class="ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></button>
            <a class="btn btn--ghost no-ic" href="cart.html">View cart</a>
          </div>

          <div class="spec-table">
            <div class="row"><div class="k">Catalog No.</div><div class="v mono">${esc(v.sku)}</div></div>
            <div class="row"><div class="k">Specification</div><div class="v">${esc(v.spec)}</div></div>
            <div class="row"><div class="k">Form</div><div class="v">Lyophilized powder</div></div>
            <div class="row"><div class="k">Purity (HPLC)</div><div class="v">${esc(v.note && /purity/i.test(v.note) ? v.note : '≥ 98%')}</div></div>
            <div class="row"><div class="k">Storage</div><div class="v">-20°C, desiccated, protected from light</div></div>
            <div class="row"><div class="k">Classification</div><div class="v">Research reference material · For Research Use Only</div></div>
          </div>
        </div>
      </div>
      <div class="pd-bar">
        <div class="pd-bar__info">
          <span class="pd-bar__name">${esc(p.name)} · ${esc(v.spec)}</span>
          <span class="pd-bar__price">${money(v.price * qty)}<span>&nbsp;&nbsp;USD</span></span>
        </div>
        <button class="btn btn--signal" id="add-cart-bar">Add to cart <span class="ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></button>
      </div>`;

      // wire variant select
      $$('#pd-variants .variant').forEach(b => b.addEventListener('click', () => { sel = +b.dataset.i; qty = 1; render(); }));
      $('#q-minus').addEventListener('click', () => { qty = Math.max(1, qty - 1); syncQty(); });
      $('#q-plus').addEventListener('click', () => { qty = Math.min(999, qty + 1); syncQty(); });
      $('#q-input').addEventListener('input', e => { qty = Math.max(1, Math.min(999, parseInt(e.target.value.replace(/\D/g, '')) || 1)); syncTotal(); });
      $('#q-input').addEventListener('blur', syncQty);
      const addToCart = () => {
        Cart.add({ sku: v.sku, name: p.name, slug: p.slug, spec: v.spec, price: v.price, qty });
        toast('Added to cart', `${p.name} · ${v.spec} ×${qty}`);
      };
      $('#add-cart').addEventListener('click', addToCart);
      const barBtn = $('#add-cart-bar'); if (barBtn) barBtn.addEventListener('click', addToCart);
      requestAnimationFrame(() => $('.pd.reveal').classList.add('in'));
    }
    function syncTotal() {
      const v = p.variants[sel]; const tot = money(v.price * qty);
      const el = $('#add-total'); if (el) el.textContent = tot;
      const bp = $('.pd-bar__price'); if (bp) bp.innerHTML = tot + '<span>&nbsp;&nbsp;USD</span>';
    }
    function syncQty() { const el = $('#q-input'); if (el) el.value = qty; syncTotal(); }

    render();

    // related
    const rel = PRODUCTS.filter(x => x.category === p.category && x.slug !== p.slug).slice(0, 4);
    const relBox = $('#pd-related');
    if (relBox && rel.length) {
      relBox.innerHTML = `<div class="sec-head reveal"><div><div class="eyebrow"><span class="dot"></span>Related</div><h2 class="h-lg" style="margin-top:18px">More in ${esc(p.category)}</h2></div><a class="btn btn--ghost" href="shop.html?cat=${encodeURIComponent(p.category)}">View category <span class="ic"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></a></div><div class="grid">${rel.map(productCard).join('')}</div>`;
    }
  }

  /* ============================================================
     CART + CHECKOUT PAGE
     ============================================================ */
  function initCart() {
    const root = $('#cart-root'); if (!root) return;

    function renderCart() {
      const items = Cart.read();
      if (!items.length) {
        root.innerHTML = `<div class="empty" style="max-width:560px;margin:40px auto"><h3>Your cart is empty</h3><p style="margin:10px 0 24px">Browse the catalog to add research compounds.</p><a class="btn btn--signal" href="shop.html" style="margin:0 auto;width:max-content">Explore catalog <span class="ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></a></div>`;
        return;
      }
      const sub = Cart.subtotal();
      const shipping = sub >= 300 ? 0 : 35;
      root.innerHTML = `
      <div class="cart-layout">
        <div>
          <div class="cart-list">
            ${items.map(it => `
              <div class="cart-item" data-sku="${esc(it.sku)}">
                <div class="cart-item__vis">${vial()}<img class="ci-img" src="assets/img/products/${esc(it.slug)}.jpg" alt="${esc(it.name)}" onerror="this.remove()"></div>
                <div>
                  <h4>${esc(it.name)}</h4>
                  <div class="meta">${esc(it.spec)} · CAT. ${esc(it.sku)} · ${money(it.price)} ea</div>
                  <div class="qty qty--sm" style="margin-top:12px">
                    <button data-act="dec">–</button>
                    <input value="${it.qty}" data-sku="${esc(it.sku)}" inputmode="numeric">
                    <button data-act="inc">+</button>
                  </div>
                </div>
                <div class="ci-right">
                  <div class="ci-price mono">${money(it.price * it.qty)}</div>
                  <button class="ci-remove" data-act="rm">Remove</button>
                </div>
              </div>`).join('')}
          </div>
        </div>
        <div class="summary">
          <div class="summary__inner">
            <h3>Order summary</h3>
            <div class="sum-row"><span>Subtotal</span><span class="mono">${money(sub)}</span></div>
            <div class="sum-row"><span>Shipping ${shipping === 0 ? '· free over $300' : '· discreet express'}</span><span class="mono">${shipping === 0 ? 'FREE' : money(shipping)}</span></div>
            <div class="sum-row total"><span>Total</span><span class="mono">${money(sub + shipping)}</span></div>
            <button class="btn btn--signal btn--block" id="to-checkout" style="margin-top:20px">Proceed to checkout <span class="ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></button>
            <p class="note">Orders are confirmed manually for compliance. After checkout you'll receive payment and shipping instructions by email within 12 hours. All items supplied <b>For Research Use Only</b>.</p>
          </div>
        </div>
      </div>`;

      // wire
      $$('.cart-item').forEach(row => {
        const sku = row.dataset.sku;
        row.addEventListener('click', e => {
          const b = e.target.closest('[data-act]'); if (!b) return;
          const act = b.dataset.act;
          const it = Cart.read().find(i => i.sku === sku);
          if (act === 'inc') Cart.setQty(sku, it.qty + 1);
          else if (act === 'dec') Cart.setQty(sku, it.qty - 1);
          else if (act === 'rm') Cart.remove(sku);
          renderCart();
        });
        const inp = row.querySelector('input');
        inp.addEventListener('change', () => { Cart.setQty(sku, parseInt(inp.value.replace(/\D/g, '')) || 1); renderCart(); });
      });
      $('#to-checkout').addEventListener('click', () => { renderCheckout(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    }

    function renderCheckout() {
      const items = Cart.read();
      const sub = Cart.subtotal();
      const shipping = sub >= 300 ? 0 : 35;
      const total = sub + shipping;
      root.innerHTML = `
      <button class="btn btn--ghost btn--sm" id="back-cart" style="margin-bottom:24px"><span class="ic" style="transform:rotate(180deg)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span> Back to cart</button>
      <div class="cart-layout">
        <form id="checkout-form">
          <div class="info-block" style="margin-bottom:32px">
            <h2 style="font-size:1.4rem;margin-bottom:6px">Shipping details</h2>
            <p class="muted" style="font-size:13px;margin-bottom:20px">Encrypted submission · we never store payment data on-site.</p>
            <div class="field-row">
              <div class="field"><label>First name</label><input name="fname" required></div>
              <div class="field"><label>Last name</label><input name="lname" required></div>
            </div>
            <div class="field"><label>Email</label><input type="email" name="email" required></div>
            <div class="field-row">
              <div class="field"><label>Telegram / Signal (optional)</label><input name="messenger" placeholder="@handle"></div>
              <div class="field"><label>Phone (optional)</label><input name="phone"></div>
            </div>
            <div class="field"><label>Address line</label><input name="addr" required></div>
            <div class="field-row">
              <div class="field"><label>City</label><input name="city" required></div>
              <div class="field"><label>Postal code</label><input name="zip" required></div>
            </div>
            <div class="field-row">
              <div class="field"><label>Country</label><input name="country" required></div>
              <div class="field"><label>State / Region</label><input name="state"></div>
            </div>
            <div class="field"><label>Order notes (optional)</label><textarea name="notes" placeholder="Anything we should know about handling, batch CoA requests, etc."></textarea></div>
          </div>
          <div class="info-block">
            <h2 style="font-size:1.4rem;margin-bottom:14px">Payment method</h2>
            <div class="pay-opts" id="pay-opts">
              <label class="pay-opt sel"><input type="radio" name="pay" value="Crypto (BTC / ETH / USDT)" checked><span class="radio"></span><div><div class="t">Cryptocurrency</div><div class="s">BTC · ETH · USDT — 10% discount applied at invoice</div></div></label>
              <label class="pay-opt"><input type="radio" name="pay" value="Bank / Wire transfer"><span class="radio"></span><div><div class="t">Bank / Wire transfer</div><div class="s">SWIFT details sent with invoice</div></div></label>
              <label class="pay-opt"><input type="radio" name="pay" value="Zelle / Wise"><span class="radio"></span><div><div class="t">Zelle / Wise</div><div class="s">Fast settlement, US & EU</div></div></label>
            </div>
            <label style="display:flex;gap:10px;align-items:flex-start;margin-top:20px;font-size:13px;color:var(--on-variant);cursor:pointer">
              <input type="checkbox" id="agree" required style="margin-top:3px;accent-color:var(--signal)">
              <span>I confirm I am 21+ and that all products are purchased strictly as <b>research reference materials</b>, not for human or veterinary consumption. I have read the <a href="info.html#compliance" class="accent">compliance terms</a>.</span>
            </label>
          </div>
        </form>
        <div class="summary">
          <div class="summary__inner">
            <h3>Your order</h3>
            <div style="display:grid;gap:12px;margin-bottom:18px">
              ${items.map(it => `<div class="sum-row" style="padding:0"><span>${esc(it.name)} <span class="muted mono" style="font-size:11px">×${it.qty}</span><br><span class="muted mono" style="font-size:11px">${esc(it.spec)}</span></span><span class="mono">${money(it.price * it.qty)}</span></div>`).join('')}
            </div>
            <div class="sum-row" style="border-top:1px solid var(--hairline);padding-top:14px"><span>Subtotal</span><span class="mono">${money(sub)}</span></div>
            <div class="sum-row"><span>Shipping</span><span class="mono">${shipping === 0 ? 'FREE' : money(shipping)}</span></div>
            <div class="sum-row total"><span>Total</span><span class="mono">${money(total)}</span></div>
            <button class="btn btn--signal btn--block" id="place-order" type="button" style="margin-top:20px">Place order <span class="ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></button>
            <p class="note">No charge is taken now. You'll receive a secure invoice with payment instructions by email. Typical dispatch 24–72h after payment confirmation.</p>
          </div>
        </div>
      </div>`;

      $('#back-cart').addEventListener('click', () => { renderCart(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
      $$('#pay-opts .pay-opt').forEach(o => o.addEventListener('click', () => {
        $$('#pay-opts .pay-opt').forEach(x => x.classList.remove('sel')); o.classList.add('sel');
      }));
      $('#place-order').addEventListener('click', placeOrder);
    }

    function placeOrder() {
      const form = $('#checkout-form');
      if (!form.reportValidity()) return;
      if (!$('#agree').checked) { toast('Please confirm the research-use terms'); return; }
      const data = Object.fromEntries(new FormData(form).entries());
      const items = Cart.read();
      const sub = Cart.subtotal();
      const shipping = sub >= 300 ? 0 : 35;
      const total = sub + shipping;
      const ref = 'TX-' + Date.now().toString(36).toUpperCase().slice(-6) + '-' + Math.floor(1000 + (sub % 9000));

      const order = { ref, date: new Date().toISOString(), customer: data, items, subtotal: sub, shipping, total };
      try { localStorage.setItem('txlabs_last_order', JSON.stringify(order)); } catch (e) {}

      // Build a human-readable order body (for email / backend submission)
      const lines = items.map(i => `• ${i.name} | ${i.spec} | CAT.${i.sku} | x${i.qty} | ${money(i.price * i.qty)}`).join('\n');
      const body =
`TXLABS ORDER ${ref}
--------------------------------
${lines}
--------------------------------
Subtotal: ${money(sub)}
Shipping: ${shipping === 0 ? 'FREE' : money(shipping)}
TOTAL:    ${money(total)}

Customer: ${data.fname} ${data.lname}
Email:    ${data.email}
Messenger:${data.messenger || '-'}
Phone:    ${data.phone || '-'}
Ship to:  ${data.addr}, ${data.city}, ${data.state || ''} ${data.zip}, ${data.country}
Payment:  ${data.pay}
Notes:    ${data.notes || '-'}`;

      // Attempt async submission to a form endpoint if configured; always fall through to confirmation.
      const endpoint = document.body.dataset.orderEndpoint;
      const finish = () => { Cart.clear(); localStorage.setItem('txlabs_last_order', JSON.stringify(order)); location.href = 'confirmation.html'; };
      if (endpoint) {
        fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) })
          .then(finish).catch(() => { window.open(mailto(ref, body), '_blank'); finish(); });
      } else {
        // open a prefilled email as the order channel, then confirm
        window.open(mailto(ref, body), '_blank');
        finish();
      }
    }

    function mailto(ref, body) {
      return `mailto:${CONTACT.email}?subject=${encodeURIComponent('New order ' + ref)}&body=${encodeURIComponent(body)}`;
    }

    renderCart();
  }

  /* ============================================================
     CONFIRMATION PAGE
     ============================================================ */
  function initConfirmation() {
    const root = $('#confirm-root'); if (!root) return;
    let order; try { order = JSON.parse(localStorage.getItem('txlabs_last_order')); } catch (e) {}
    if (!order) { root.innerHTML = `<div class="confirm"><h1 class="h-lg">No recent order</h1><p class="muted" style="margin:16px 0 28px">Looks like you arrived here directly.</p><a class="btn btn--signal" href="shop.html" style="margin:0 auto;width:max-content">Browse catalog</a></div>`; return; }
    const d = order.customer;
    root.innerHTML = `
    <div class="confirm reveal in">
      <div class="confirm__badge"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div>
      <div class="eyebrow" style="margin:0 auto 18px;width:max-content"><span class="dot"></span>Order received</div>
      <h1 class="h-lg">Thank you, ${esc(d.fname)}.</h1>
      <p class="lead" style="margin:18px auto 0">Your order has been logged. A secure invoice with payment and discreet-shipping instructions is on its way to <b style="color:#fff">${esc(d.email)}</b> — usually within 12 hours.</p>
      <div class="order-ref" style="margin-top:28px">${esc(order.ref)}</div>
      <div class="order-box">
        <div class="row"><span class="k">Items</span><span class="v">${order.items.reduce((a, i) => a + i.qty, 0)}</span></div>
        <div class="row"><span class="k">Subtotal</span><span class="v">${money(order.subtotal)}</span></div>
        <div class="row"><span class="k">Shipping</span><span class="v">${order.shipping === 0 ? 'FREE' : money(order.shipping)}</span></div>
        <div class="row" style="border-top:1px solid var(--hairline);margin-top:6px;padding-top:14px"><span class="k" style="color:#fff;font-weight:700">Total</span><span class="v" style="color:var(--signal);font-size:1.15rem">${money(order.total)}</span></div>
        <div class="row"><span class="k">Payment</span><span class="v">${esc(d.pay)}</span></div>
      </div>
      <p class="muted" style="font-size:13px;margin-bottom:28px">Didn't get the email? Check spam, or message us at <span class="accent">${CONTACT.email}</span> / Telegram <span class="accent">${CONTACT.telegram}</span> with your reference.</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <a class="btn btn--signal" href="shop.html">Continue shopping <span class="ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></a>
        <a class="btn btn--ghost no-ic" href="index.html">Back to home</a>
      </div>
    </div>`;
  }

  /* ============================================================
     HOME — render category rail + featured
     ============================================================ */
  function initHome() {
    const railEl = $('#home-cats');
    if (railEl) {
      railEl.innerHTML = CATALOG.categories.map((c, i) =>
        `<a class="cat-card reveal" data-d="${(i % 4) + 1}" href="shop.html?cat=${encodeURIComponent(c)}">
          <div class="idx mono">0${i + 1}</div>
          <h4>${esc(c)}</h4>
          <div class="meta"><span>${catCount(c)} compounds</span><span class="arrow">→</span></div>
        </a>`).join('');
    }
    const feat = $('#home-featured');
    if (feat) {
      const picks = ['retatrutide', 'bpc-157', 'tirzepatide', 'semaglutide', 'tb500-thymosin-b4-acetate', 'mt-2-melanotan-2-acetate', 'epithalon', 'nad'];
      let chosen = picks.map(s => PRODUCTS.find(p => p.slug === s || p.slug.startsWith(s))).filter(Boolean);
      if (chosen.length < 8) chosen = chosen.concat(PRODUCTS.filter(p => !chosen.includes(p)).slice(0, 8 - chosen.length));
      feat.innerHTML = chosen.slice(0, 8).map(productCard).join('');
    }
    // animate hero console bars
    setTimeout(() => { $$('.bar-fill').forEach(b => { b.style.width = b.dataset.w || '60%'; }); }, 300);
  }

  /* ---------- info page nav highlight ---------- */
  function initInfo() {
    const navLinks = $$('.info-nav a'); if (!navLinks.length) return;
    const blocks = $$('.info-block');
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    blocks.forEach(b => io.observe(b));
  }

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    initChrome();
    initHome();
    initShop();
    initProduct();
    initCart();
    initConfirmation();
    initInfo();
  });

  window.TX = { Cart, money, toast };
})();
