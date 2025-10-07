// Set current year in footer
document.addEventListener('DOMContentLoaded', () => {
  // Backend toggle: set to false to work fully offline with a single local user
  const BACKEND_ENABLED = false;
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Highlight active nav link
  const current = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('[data-nav]').forEach((link) => {
    const anchor = link;
    if (anchor.getAttribute('href') === current) {
      anchor.classList.add('active');
    }
  });

  // Simple contact form validation (delegated if form exists)
  const form = document.querySelector('form[data-contact]');
  if (form) {
    form.addEventListener('submit', (e) => {
      const name = form.querySelector('input[name="nombre"]');
      const email = form.querySelector('input[name="email"]');
      const message = form.querySelector('textarea[name="mensaje"]');
      let hasError = false;

      const setError = (el, msg) => {
        let hint = el.nextElementSibling;
        if (!hint || !hint.classList || !hint.classList.contains('field-error')) {
          hint = document.createElement('div');
          hint.className = 'field-error';
          el.after(hint);
        }
        hint.textContent = msg;
      };
      const clearError = (el) => {
        const hint = el.nextElementSibling;
        if (hint && hint.classList && hint.classList.contains('field-error')) {
          hint.textContent = '';
        }
      };

      if (!name.value.trim()) { setError(name, 'Ingresa tu nombre'); hasError = true; } else { clearError(name); }
      const emailVal = email.value.trim();
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);
      if (!emailOk) { setError(email, 'Correo inválido'); hasError = true; } else { clearError(email); }
      if (!message.value.trim()) { setError(message, 'Escribe un mensaje'); hasError = true; } else { clearError(message); }

      if (hasError) {
        e.preventDefault();
      } else {
        e.preventDefault();
        alert('¡Gracias! Hemos recibido tu mensaje.');
        form.reset();
      }
    });
  }

  // Auth + Profile UI
  const profileArea = document.getElementById('profileArea');
  const brandLinks = document.querySelectorAll('.brand');
  const DEFAULT_LOGO_URL = 'https://barpanch.com/wp-content/uploads/2025/09/6e50e389-b09d-4263-b313-dfea69e4c087.png';
  // Set default logo immediately
  brandLinks.forEach(a => { a.innerHTML = `<img src="${DEFAULT_LOGO_URL}" alt="Urban Life RP" />`; });
  // Try to fetch config only if backend is enabled
  if (BACKEND_ENABLED) {
    (async () => {
      try {
        const r = await fetch('http://localhost:3001/api/config');
        if (r.ok) {
          const cfg = await r.json();
          if (cfg.logoUrl) {
            brandLinks.forEach(a => { a.innerHTML = `<img src="${cfg.logoUrl}" alt="Urban Life RP" />`; });
          }
        }
      } catch {}
    })();
  }
  const getSession = () => {
    try { return JSON.parse(localStorage.getItem('tm_session') || 'null'); } catch { return null; }
  };
  const setSession = (data) => localStorage.setItem('tm_session', JSON.stringify(data));
  const clearSession = () => localStorage.removeItem('tm_session');

  const renderProfile = () => {
    if (!profileArea) return;
    const session = getSession();
    if (session && session.user) {
      const initials = (session.user.name || session.user.email || 'U').trim().charAt(0).toUpperCase();
      profileArea.innerHTML = `
        <div class="profile-menu">
          <button class="profile-btn" id="btnProfile"><span class="avatar" id="navAvatar">${initials}</span> ${session.user.name || ''}</button>
          <div class="dropdown" id="menuProfile">
            <a href="perfil.html">Panel de perfil</a>
            <a href="admin.html">Admin</a>
            <button id="btnLogout">Cerrar sesión</button>
          </div>
        </div>
      `;
      const btn = document.getElementById('btnProfile');
      const menu = document.getElementById('menuProfile');
      const logout = document.getElementById('btnLogout');
      const navAvatar = document.getElementById('navAvatar');
      if (session.user.photo && navAvatar) {
        navAvatar.style.backgroundImage = `url(${session.user.photo})`;
        navAvatar.setAttribute('data-hasimg','1');
        navAvatar.textContent = '';
      }
      btn?.addEventListener('click', () => menu?.classList.toggle('open'));
      logout?.addEventListener('click', () => { clearSession(); renderProfile(); });
      document.addEventListener('click', (e) => {
        if (!menu || !btn) return;
        if (!menu.contains(e.target) && !btn.contains(e.target)) menu.classList.remove('open');
      });
    } else {
      profileArea.innerHTML = `
        <button class="profile-btn" id="btnAuth">Iniciar sesión</button>
      `;
      const btn = document.getElementById('btnAuth');
      btn?.addEventListener('click', openAuthModal);
    }
  };

  // Modal for login (single local admin user when BACKEND is disabled)
  const openAuthModal = () => {
    let backdrop = document.getElementById('authBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'authBackdrop';
      backdrop.className = 'modal-backdrop open';
      backdrop.innerHTML = `
        <div class="modal">
          <header>Tu cuenta</header>
          <div class="content">
            <div class="tabs">
              <button class="tab active" data-tab="login">Ingresar</button>
            </div>
            <form id="formLogin">
              <div>
                <label for="lEmail">Correo</label>
                <input id="lEmail" type="email" required />
              </div>
              <div>
                <label for="lPass">Contraseña</label>
                <input id="lPass" type="password" required />
              </div>
              <button class="btn btn-primary" type="submit">Entrar</button>
            </form>
          </div>
        </div>
      `;
      document.body.appendChild(backdrop);
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });

      const [tabLogin] = backdrop.querySelectorAll('.tab');
      const formLogin = backdrop.querySelector('#formLogin');

      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = backdrop.querySelector('#lEmail').value.trim();
        const pass = backdrop.querySelector('#lPass').value.trim();
        // Local single-user auth when backend is disabled
        if (!BACKEND_ENABLED) {
          const ok = email.toLowerCase() === 'admin@admin.com' && pass === 'admin12';
          if (!ok) { alert('Credenciales incorrectas'); return; }
          setSession({ user: { email: 'admin@admin.com', name: 'Administrador', photo: '', role: 'admin' }, ts: Date.now() });
          backdrop.remove();
          renderProfile();
          if (location.pathname.endsWith('perfil.html')) loadProfilePage();
          return;
        }
        // Backend path (kept for future use)
        try {
          const r = await fetch('http://localhost:3001/api/users/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, pass }) });
          const data = await r.json();
          if (!r.ok) throw new Error(data.error || 'login_failed');
          setSession({ user: { email: data.email, name: data.name, photo: data.photo }, ts: Date.now() });
          backdrop.remove();
          renderProfile();
          if (location.pathname.endsWith('perfil.html')) loadProfilePage();
        } catch (err) {
          alert('No se pudo conectar con el servidor.');
          console.error('Login error:', err);
        }
      });
      // Registration disabled in single-user mode
    } else {
      backdrop.classList.add('open');
    }
  };

  const loadProfilePage = () => {
    const session = getSession();
    const nameEl = document.getElementById('profileName');
    const emailEl = document.getElementById('profileEmail');
    const avatarEl = document.getElementById('profileAvatar');
    if (session?.user && nameEl && emailEl && avatarEl) {
      nameEl.textContent = session.user.name || 'Usuario';
      emailEl.textContent = session.user.email || '';
      const initial = (session.user.name || session.user.email || 'U').trim().charAt(0).toUpperCase();
      if (session.user.photo) {
        avatarEl.style.backgroundImage = `url(${session.user.photo})`;
        avatarEl.style.backgroundSize = 'cover';
        avatarEl.textContent = '';
      } else {
        avatarEl.style.backgroundImage = '';
        avatarEl.textContent = initial;
      }
      // Forms
      const formDatos = document.getElementById('formDatos');
      const formPassword = document.getElementById('formPassword');
      const formFoto = document.getElementById('formFoto');
      const formTarjeta = document.getElementById('formTarjeta');
      const listaTarjetas = document.getElementById('listaTarjetas');

      if (formDatos) {
        formDatos.nombre.value = session.user.name || '';
        formDatos.correo.value = session.user.email || '';
        formDatos.addEventListener('submit', (e) => {
          e.preventDefault();
          const users = JSON.parse(localStorage.getItem('tm_users') || '{}');
          const currentEmail = session.user.email;
          const newName = formDatos.nombre.value.trim();
          const newEmail = formDatos.correo.value.trim();
          const user = users[currentEmail];
          if (!user) return;
          if (newEmail !== currentEmail && users[newEmail]) { alert('Ese correo ya existe.'); return; }
          delete users[currentEmail];
          users[newEmail] = { ...user, name: newName };
          localStorage.setItem('tm_users', JSON.stringify(users));
          setSession({ user: { email: newEmail, name: newName, photo: user.photo }, ts: Date.now() });
          renderProfile();
          loadProfilePage();
          alert('Datos actualizados');
        });
      }
      if (formPassword) {
        formPassword.addEventListener('submit', (e) => {
          e.preventDefault();
          const users = JSON.parse(localStorage.getItem('tm_users') || '{}');
          const currentEmail = session.user.email;
          const user = users[currentEmail];
          const passActual = formPassword.passActual.value;
          const passNueva = formPassword.passNueva.value;
          if (!user || user.pass !== passActual) { alert('Contraseña actual incorrecta'); return; }
          user.pass = passNueva;
          users[currentEmail] = user;
          localStorage.setItem('tm_users', JSON.stringify(users));
          alert('Contraseña actualizada');
        });
      }
      if (formFoto) {
        formFoto.addEventListener('submit', (e) => {
          e.preventDefault();
          const url = formFoto.fotoUrl.value.trim();
          const users = JSON.parse(localStorage.getItem('tm_users') || '{}');
          const currentEmail = session.user.email;
          if (!users[currentEmail]) return;
          users[currentEmail].photo = url;
          localStorage.setItem('tm_users', JSON.stringify(users));
          setSession({ user: { ...session.user, photo: url }, ts: Date.now() });
          loadProfilePage();
          renderProfile();
        });
      }
      const loadCards = () => {
        const users = JSON.parse(localStorage.getItem('tm_users') || '{}');
        const user = users[session.user.email];
        const cards = user?.cards || [];
        if (listaTarjetas) {
          listaTarjetas.innerHTML = cards.map((c, i) => `<div class="card" style="padding:10px; display:flex; justify-content:space-between; align-items:center;">
            <div><strong>${c.alias}</strong> — ${c.masked}</div>
            <button class="profile-btn" data-del="${i}">Eliminar</button>
          </div>`).join('');
          listaTarjetas.querySelectorAll('[data-del]').forEach(btn => {
            btn.addEventListener('click', () => {
              const idx = Number(btn.getAttribute('data-del'));
              const users2 = JSON.parse(localStorage.getItem('tm_users') || '{}');
              const user2 = users2[session.user.email];
              user2.cards = (user2.cards || []).filter((_, j) => j !== idx);
              users2[session.user.email] = user2;
              localStorage.setItem('tm_users', JSON.stringify(users2));
              loadCards();
            });
          });
        }
      };
      if (formTarjeta) {
        formTarjeta.addEventListener('submit', (e) => {
          e.preventDefault();
          const alias = formTarjeta.cardAlias.value.trim();
          const masked = formTarjeta.cardMasked.value.trim();
          const users = JSON.parse(localStorage.getItem('tm_users') || '{}');
          const user = users[session.user.email];
          user.cards = user.cards || [];
          user.cards.push({ alias, masked });
          users[session.user.email] = user;
          localStorage.setItem('tm_users', JSON.stringify(users));
          formTarjeta.reset();
          loadCards();
        });
      }
      loadCards();
    } else {
      // If not logged in, prompt
      if (location.pathname.endsWith('perfil.html')) {
        openAuthModal();
      }
    }
  };

  // Admin panel logic
  const loadAdminPage = async () => {
    const inAdmin = location.pathname.endsWith('admin.html');
    if (!inAdmin) return;
    const session = getSession();
    if (!session?.user) { openAuthModal(); return; }

    // Sidebar sections (WP-like)
    const sideLinks = document.querySelectorAll('.admin-nav a[data-section]');
    const sections = ['tabProductos','tabVentas','tabPagos','tabUsuarios','tabConfig'].map(id => document.getElementById(id));
    const activate = (id) => {
      sideLinks.forEach(a => a.classList.remove('active'));
      sections.forEach(s => s && (s.style.display = 'none'));
      const link = Array.from(sideLinks).find(a => a.getAttribute('data-section') === id);
      if (link) link.classList.add('active');
      const target = document.getElementById(id);
      if (target) target.style.display = '';
    };
    sideLinks.forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      activate(a.getAttribute('data-section'));
    }));

    // Data helpers (offline localStorage or online API)
    let db;
    if (!BACKEND_ENABLED) {
      const read = (k, defVal) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(defVal)); } catch { return defVal; } };
      const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      const genId = () => `loc_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      // Ensure admin user exists locally
      const ensureLocalAdmin = () => {
        const users = read('tm_users', []);
        if (!users.find(u => (u.email||'').toLowerCase() === 'admin@admin.com')) {
          users.push({ email: 'admin@admin.com', name: 'Administrador', role: 'admin' });
          write('tm_users', users);
        }
      };
      ensureLocalAdmin();
      db = {
        async getProducts() { return read('tm_products', []); },
        async addProduct(p) { const items = read('tm_products', []); const prod = { id: genId(), ...p }; items.push(prod); write('tm_products', items); return prod; },
        async updateProduct(id, p) { const items = read('tm_products', []); const i = items.findIndex(x => x.id === id); if (i !== -1) { items[i] = { ...items[i], ...p }; write('tm_products', items); return items[i]; } return null; },
        async deleteProduct(id) { let items = read('tm_products', []); const before = items.length; items = items.filter(x => x.id !== id); write('tm_products', items); return { removed: before !== items.length }; },
        async getSales() { return read('tm_sales', []); },
        async addSale(s) { const items = read('tm_sales', []); const sale = { id: genId(), ...s, ts: Date.now() }; items.push(sale); write('tm_sales', items); return sale; },
        async getPayout() { return read('tm_payout', null); },
        async setPayout(v) { write('tm_payout', v); return v; },
        async getUsers() { return read('tm_users', [ { email: 'admin@admin.com', name: 'Administrador', role: 'admin' } ]); },
        async setUserRole(payload) { const users = read('tm_users', []); const idx = users.findIndex(u => u.email === payload.email); if (idx !== -1) users[idx].role = payload.role; else users.push({ email: payload.email, name: payload.email.split('@')[0], role: payload.role }); write('tm_users', users); return { ...payload }; },
        async getConfig() { return read('tm_config', {}); },
        async setConfig(cfg) { const prev = read('tm_config', {}); const next = { ...prev, ...cfg }; write('tm_config', next); return next; },
        async createPayPalOrder() { return {}; },
        async capturePayPalOrder() { return {}; },
      };
    } else {
      const API_BASE = 'http://localhost:3001/api';
      db = {
        async getProducts() { const r = await fetch(`${API_BASE}/products`); return await r.json(); },
        async addProduct(p) { const r = await fetch(`${API_BASE}/products`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(p) }); return await r.json(); },
        async updateProduct(id, p) { const r = await fetch(`${API_BASE}/products/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(p) }); return await r.json(); },
        async deleteProduct(id) { const r = await fetch(`${API_BASE}/products/${id}`, { method:'DELETE' }); return await r.json(); },
        async getSales() { const r = await fetch(`${API_BASE}/sales`); return await r.json(); },
        async addSale(s) { const r = await fetch(`${API_BASE}/sales`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(s) }); return await r.json(); },
        async getPayout() { const r = await fetch(`${API_BASE}/payout`); return await r.json(); },
        async setPayout(v) { const r = await fetch(`${API_BASE}/payout`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(v) }); return await r.json(); },
        async getUsers() { const r = await fetch(`${API_BASE}/users`); return await r.json(); },
        async setUserRole(payload) { const r = await fetch(`${API_BASE}/users/role`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }); return await r.json(); },
        async getConfig() { const r = await fetch(`${API_BASE}/config`); return await r.json(); },
        async setConfig(payload) { const r = await fetch(`${API_BASE}/config`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }); return await r.json(); },
        async createPayPalOrder(amount, currency, description) { const r = await fetch(`${API_BASE}/paypal/create-order`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ amount, currency, description }) }); return await r.json(); },
        async capturePayPalOrder(orderId) { const r = await fetch(`${API_BASE}/paypal/capture-order`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orderId }) }); return await r.json(); },
      };
    }

    // Productos
    const formProducto = document.getElementById('formProducto');
    const listaProductos = document.getElementById('listaProductos');
    const renderProductos = async () => {
      const products = await db.getProducts();
      if (!listaProductos) return;
      listaProductos.innerHTML = products.map((p, i) => `
        <div class="card" style="padding:10px; display:grid; grid-template-columns: 1fr auto; gap: 10px; align-items:center;">
          <div>
            <div style="font-weight:700;">${p.name} — $${Number(p.price).toFixed(2)}</div>
            <div style="color:var(--muted); font-size:14px;">${p.descShort || ''}</div>
            <div style="color:var(--muted); font-size:12px;">Tags: ${(p.tags||[]).join(', ')} | Categorías: ${(p.categories||[]).join(', ')}</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="profile-btn" data-edit="${p.id}">Editar</button>
            <button class="profile-btn" data-del="${p.id}">Eliminar</button>
          </div>
        </div>`).join('');
      listaProductos.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-del');
        await db.deleteProduct(id);
        renderProductos();
      }));
      listaProductos.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-edit');
        const products = await db.getProducts();
        const p = products.find(x => x.id === id);
        if (!p) return;
        const name = prompt('Nombre', p.name) ?? p.name;
        const price = prompt('Precio', String(p.price)) ?? String(p.price);
        const descShort = prompt('Descripción corta', p.descShort || '') ?? (p.descShort || '');
        const descLong = prompt('Descripción larga', p.descLong || '') ?? (p.descLong || '');
        const img = prompt('Imagen URL', p.img || '') ?? (p.img || '');
        const tags = prompt('Etiquetas (coma)', (p.tags||[]).join(', ')) ?? (p.tags||[]).join(', ');
        const categories = prompt('Categorías (coma)', (p.categories||[]).join(', ')) ?? (p.categories||[]).join(', ');
        await db.updateProduct(id, { name, price: Number(price), descShort, descLong, img, tags: tags.split(',').map(s=>s.trim()).filter(Boolean), categories: categories.split(',').map(s=>s.trim()).filter(Boolean) });
        renderProductos();
      }));
    };
    if (formProducto) {
      formProducto.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('pNombre').value.trim();
        const price = Number(document.getElementById('pPrecio').value);
        const descShort = document.getElementById('pDescShort').value.trim();
        const descLong = document.getElementById('pDescLong').value.trim();
        const img = document.getElementById('pImg').value.trim();
        const tags = document.getElementById('pTags').value.split(',').map(s=>s.trim()).filter(Boolean);
        const categories = Array.from(formProducto.querySelectorAll('input[name="cats"]:checked')).map(x => x.value);
        await db.addProduct({ name, price, descShort, descLong, img, tags, categories });
        (e.target).reset();
        renderProductos();
      });
      renderProductos();
    }

    // Ventas
    const listaVentas = document.getElementById('listaVentas');
    const resumenVentas = document.getElementById('resumenVentas');
    const renderVentas = async () => {
      const sales = await db.getSales();
      const total = sales.reduce((acc, s) => acc + Number(s.total || 0), 0);
      if (resumenVentas) resumenVentas.innerHTML = `<strong>Ventas:</strong> ${sales.length} | <strong>Total:</strong> $${total.toFixed(2)}`;
      if (listaVentas) listaVentas.innerHTML = sales.map(s => `
        <div class="card" style="padding:10px;">
          <div><strong>${s.productName}</strong> — $${Number(s.total).toFixed(2)}</div>
          <div style="color:var(--muted); font-size:14px;">${new Date(s.ts).toLocaleString()}</div>
        </div>`).join('');
    };
    renderVentas();

    // Pagos
    const payMethod = document.getElementById('payMethod');
    const paypalFields = document.getElementById('paypalFields');
    const debitoFields = document.getElementById('debitoFields');
    const formPayout = document.getElementById('formPayout');
    const applyPayoutUI = () => {
      if (!payMethod) return;
      const method = payMethod.value;
      if (method === 'paypal') {
        paypalFields.style.display = '';
        debitoFields.style.display = 'none';
      } else {
        paypalFields.style.display = 'none';
        debitoFields.style.display = '';
      }
    };
    payMethod?.addEventListener('change', applyPayoutUI);
    if (formPayout) {
      const saved = await db.getPayout();
      if (saved) {
        payMethod.value = saved.method;
        if (saved.method === 'paypal') document.getElementById('payPaypal').value = saved.email || '';
        if (saved.method === 'debito') document.getElementById('payDebito').value = saved.account || '';
        applyPayoutUI();
      }
      formPayout.addEventListener('submit', async (e) => {
        e.preventDefault();
        const method = payMethod.value;
        const data = { method };
        if (method === 'paypal') data.email = document.getElementById('payPaypal').value.trim();
        if (method === 'debito') data.account = document.getElementById('payDebito').value.trim();
        await db.setPayout(data);
        alert('Método de pago guardado');
      });
      applyPayoutUI();
    }

    // Usuarios (roles)
    const listaUsuarios = document.getElementById('listaUsuarios');
    const renderUsuarios = async () => {
      if (!listaUsuarios) return;
      const users = await db.getUsers();
      const roles = ['cliente','admin','ayudante'];
      listaUsuarios.innerHTML = users.map(u => `
        <div class="card" style="padding:10px; display:grid; grid-template-columns: 1fr auto; gap: 10px; align-items:center;">
          <div>
            <div style="font-weight:700;">${u.name || u.email}</div>
            <div style="color:var(--muted); font-size:14px;">${u.email}</div>
          </div>
          <div>
            <select data-email="${u.email}" class="roleSelect">
              ${roles.map(r => `<option value="${r}" ${u.role===r?'selected':''}>${r}</option>`).join('')}
            </select>
          </div>
        </div>`).join('');
      listaUsuarios.querySelectorAll('.roleSelect').forEach(sel => sel.addEventListener('change', async () => {
        const email = sel.getAttribute('data-email');
        const role = sel.value;
        await db.setUserRole({ email, role });
        renderUsuarios();
      }));
    };
    renderUsuarios();

    // Config (FiveM)
    const formConfig = document.getElementById('formConfig');
    const connectBtn = document.getElementById('btnConnectFiveM');
    const loadConfig = async () => {
      const cfg = await db.getConfig();
      const fHost = document.getElementById('fHost');
      const fPort = document.getElementById('fPort');
      const fPass = document.getElementById('fPass');
      const ppId = document.getElementById('ppId');
      const ppCur = document.getElementById('ppCur');
      const logo = document.getElementById('logoUrl');
      if (fHost) fHost.value = cfg.fivemHost || '';
      if (fPort) fPort.value = cfg.fivemPort || '';
      if (fPass) fPass.value = cfg.fivemPassword || '';
      if (ppId) ppId.value = cfg.paypalClientId || '';
      if (ppCur) ppCur.value = cfg.currency || 'USD';
      if (logo) logo.value = cfg.logoUrl || '';
      // Apply logo to header brand links site-wide if present
      if (cfg.logoUrl) {
        brandLinks.forEach(a => { a.innerHTML = `<img src="${cfg.logoUrl}" alt="Urban Life RP" />`; });
      }
    };
    if (formConfig) {
      await loadConfig();
      formConfig.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          fivemHost: document.getElementById('fHost').value.trim(),
          fivemPort: document.getElementById('fPort').value.trim(),
          fivemPassword: document.getElementById('fPass').value.trim(),
          paypalClientId: document.getElementById('ppId').value.trim(),
          currency: document.getElementById('ppCur').value,
        };
        await db.setConfig(payload);
        alert('Configuración guardada');
      });
    }
    connectBtn?.addEventListener('click', async () => {
      const cfg = await db.getConfig();
      const host = cfg.fivemHost || '';
      const port = cfg.fivemPort || '';
      // FiveM custom URL scheme
      const url = port ? `fivem://connect/${host}:${port}` : `fivem://connect/${host}`;
      location.href = url;
    });
  };

  loadAdminPage();
  // Ensure default admin section when opening admin page
  if (location.pathname.endsWith('admin.html')) {
    const first = document.querySelector('.admin-nav a[data-section]');
    if (first) first.dispatchEvent(new Event('click'));
  }
  renderProfile();
  loadProfilePage();
  // Tienda page rendering
  const gridTienda = document.getElementById('gridTienda');
  if (gridTienda) {
    if (!BACKEND_ENABLED) {
      gridTienda.innerHTML = '<div class="card" style="padding:12px;">La tienda está deshabilitada sin backend.</div>';
      return;
    }
    const API_BASE = 'http://localhost:3001/api';
    const fetchProducts = async () => { const r = await fetch(`${API_BASE}/products`); return await r.json(); };
    const fetchConfig = async () => { const r = await fetch(`${API_BASE}/config`); return await r.json(); };
    const renderCat = async (cat) => {
      const all = await fetchProducts();
      const filtered = all.filter(p => (p.categories||[]).some(c => c.toLowerCase() === cat.toLowerCase()));
      gridTienda.innerHTML = (filtered.length ? filtered : all).map(p => `
        <article class="card product">
          <div class="card-media" style="background:${p.img?`url(${p.img}) center/cover no-repeat`:'linear-gradient(135deg, #1f254d, #2f3a7a)'}"></div>
          <div class="card-body">
            <h3>${p.name}</h3>
            <p>${p.descShort || ''}</p>
            <div class="price-row">
              <span class="price">$${Number(p.price).toFixed(2)}</span>
              <button class="btn btn-secondary" data-buy="${p.id}">Comprar</button>
            </div>
          </div>
        </article>
      `).join('');
      gridTienda.querySelectorAll('[data-buy]').forEach(btn => btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-buy');
        const product = (await fetchProducts()).find(x => x.id === id);
        if (!product) return;
        const cfg = await fetchConfig();
        if (!cfg.paypalClientId) {
          alert('PayPal no está configurado. Ve a Admin > Configuración.');
          return;
        }
        // Load PayPal JS SDK dynamically
        const existing = document.getElementById('paypal-sdk');
        if (!existing) {
          const s = document.createElement('script');
          s.id = 'paypal-sdk';
          s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(cfg.paypalClientId)}&currency=${encodeURIComponent(cfg.currency||'USD')}`;
          document.body.appendChild(s);
          await new Promise(res => { s.onload = res; });
        }
        const container = document.createElement('div');
        container.className = 'modal-backdrop open';
        container.innerHTML = `<div class="modal"><header>Pago con PayPal</header><div class="content"><div id="paypalButtons"></div></div></div>`;
        document.body.appendChild(container);
        container.addEventListener('click', (e) => { if (e.target === container) container.remove(); });
        // @ts-ignore
        paypal.Buttons({
          createOrder: async () => {
            const resp = await fetch(`${API_BASE}/paypal/create-order`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ amount: Number(product.price), currency: cfg.currency || 'USD', description: product.name }) });
            const data = await resp.json();
            return data.id;
          },
          onApprove: async (data) => {
            const resp = await fetch(`${API_BASE}/paypal/capture-order`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orderId: data.orderID }) });
            const cap = await resp.json();
            if (cap.status === 'COMPLETED' || cap.purchase_units) {
              await fetch(`${API_BASE}/sales`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ productId: id, productName: product.name, total: Number(product.price) }) });
              alert('Pago completado. ¡Gracias!');
              container.remove();
            } else {
              alert('No se pudo completar el pago');
            }
          },
          onCancel: () => container.remove(),
          onError: () => { alert('Error en PayPal'); container.remove(); }
        }).render('#paypalButtons');
      }));
    };
    const tabs = document.querySelectorAll('.tab[data-cat]');
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      renderCat(t.getAttribute('data-cat'));
    }));
    // Default category
    renderCat('Armas VIP');
  }
});


