document.addEventListener('DOMContentLoaded', function () {
  const API = 'http://138.124.124.41/api'; // <- твой бэкенд

  const grid = document.getElementById('toursGrid');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const bookingModal = document.getElementById('modal');
  const burgerBtn = document.getElementById('burgerBtn');
  const mainNav = document.querySelector('.main-nav');
  const bookBtn = document.getElementById('bookBtn');
  const modal = document.getElementById('modal');
  const modalClose = document.getElementById('modalClose');
  const bookingForm = document.getElementById('bookingForm');
  const formMessage = document.getElementById('formMessage');
  const bestGrid = document.getElementById('bestGrid') || document.querySelector('.cards');
  const carousel = document.getElementById('carousel');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');

  let slidesData = [];
  let currentSlide = 0;
  let autoSlideInterval;
  let allTours = [];
  let isLoading = false;
  let debounceTimer = null;

  // --- normalize tour (подгоняем поля из API под единый формат) ---
  function normalize(t) {
    const title = t.title || t.name || t.name_ru || 'Без названия';
    const place = t.place || t.destination || t.country || '';
    const duration = t.duration || '';
    const id = String(t.id ?? t._id ?? title);
    const name = t.name;
    const img = API + (t.img || t.image || t.imageUrl);
    const price = t.price ?? t.cost ?? 0;
    const priceOld = t.priceOld ?? t.oldPrice ?? null;
    const description = t.description || t.desc || t.info || '';
    const searchText = (title + ' ' + place + ' ' + description).toLowerCase();
    return { id, name, title, place, img, price, priceOld, description, searchText, duration, raw: t };
  }

  // --- UI: включение/выключение контролов при загрузке ---
  function setControlsEnabled(enabled) {
    if (searchInput) searchInput.disabled = !enabled;
    if (searchBtn) searchBtn.disabled = !enabled;
  }
  function showLoading() {
    isLoading = true;
    setControlsEnabled(false);
    if (grid) grid.innerHTML = '<p class="loading">Загрузка туров...</p>';
  }
  function hideLoading() {
    isLoading = false;
    setControlsEnabled(true);
  }

  // --- загрузка туров из API  ---
  async function loadTours() {
    showLoading();
    try {
      const api_tours = API + "/tours"
      const res = await fetch(api_tours, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      let arr = Array.isArray(data) ? data : (data.data || data.tours || []);
      if (!Array.isArray(arr) || arr.length === 0) {
        console.warn('API вернул пустой/неожиданный ответ.');
      }
      allTours = arr.map(normalize);
      render(allTours);
      console.info('Туры загружены, count=', allTours.length);
    } catch (err) {
      console.error('Ошибка загрузки туров:', err);
      render(allTours);
    } finally {
      hideLoading();
    }
  }

  // --- рендер карточек ---
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function render(list) {
    if (!grid) return;
    if (!Array.isArray(list) || list.length === 0) {
      grid.innerHTML = '<p>Туры не найдены.</p>';
      return;
    }
    const html = list.map(t => `
      <article class="card" data-id="${escapeHtml(t.id)}">
        <img src="${escapeHtml(t.img)}" alt="${escapeHtml(t.title)}">
        <h3>${escapeHtml(t.title)}</h3>
        <p>${escapeHtml(t.place)} — ${escapeHtml(t.duration)}</p>
        <div class="card-row">
          <div class="price">${t.priceOld ? `<span class="old">₽${escapeHtml(t.priceOld)}</span>` : ''} <strong>₽${escapeHtml(t.price)}</strong></div>
          <a class="btn" href="#" data-action="open">Подробнее</a>
        </div>
      </article>
    `).join('');
    grid.innerHTML = html;
  }

  if (burgerBtn && mainNav) {
    burgerBtn.addEventListener('click', () => {
      mainNav.classList.toggle('active');
      burgerBtn.classList.toggle('active'); // меняем бургер на крестик
    });

    // Закрытие при клике по ссылке
    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('active');
        burgerBtn.classList.remove('active'); // возвращаем бургер
      });
    });
  }

  // --- делегирование кликов по grid: открываем модал тура ---
  // создаём модал если его нет
  let tourModal = document.getElementById('tourModal');
  if (!tourModal) {
    tourModal = document.createElement('div');
    tourModal.id = 'tourModal';
    tourModal.className = 'modal';
    tourModal.setAttribute('aria-hidden', 'true');
    tourModal.innerHTML = `
      <div class="modal-dialog" style="max-width:800px;">
        <button class="modal-close" id="tourModalClose">✕</button>
        <h2 id="tourModalTitle"></h2>
        <div class="tour-modal-content">
          <div class="tour-gallery"><img src="" alt="" id="tourModalImage"></div>
          <div class="tour-info">
            <div class="price" id="tourModalPrice"></div>
            <button class="btn primary" id="bookTourNow">Забронировать</button>
            <p id="tourModalDuration"></p>
          </div>
        </div>
          <div class="tour-description" id="tourModalDescription"></div>
      </div>
    `;
    document.body.appendChild(tourModal);
  }

  function openTourModalById(id, fallbackCardElement) {
    const tour = allTours.find(t => String(t.id) === String(id));
    if (tour) {
      fillModalFromTour(tour);
    } else if (fallbackCardElement) {
      // если не нашли объект (вдруг id не совпадает) — читаем из DOM
      const img = API + fallbackCardElement.querySelector('img')?.src || '';
      const title = fallbackCardElement.querySelector('h3')?.textContent || '';
      const place = fallbackCardElement.querySelector('p')?.textContent || '';
      const priceHtml = fallbackCardElement.querySelector('.price')?.innerHTML || '';
      fillModalFromDOM({ img, title, place, priceHtml });
    }
    tourModal.setAttribute('aria-hidden', 'false');
  }

  function fillModalFromTour(t) {
    document.getElementById('tourModalImage').src = t.img;
    document.getElementById('tourModalTitle').textContent = t.title;
    document.getElementById('tourModalPrice').innerHTML = (t.priceOld ? `<span class="old">₽${t.priceOld}</span>` : '') + ` <strong>₽${t.price}</strong>`;
    document.getElementById('tourModalDuration').textContent = t.duration;
    console.log(t.duration)
    document.getElementById('tourModalDescription').textContent = t.description || `Подробное описание тура "${t.title}".`;
  }
  function fillModalFromDOM({ img, title, place, priceHtml }) {
    document.getElementById('tourModalImage').src = img;
    document.getElementById('tourModalTitle').textContent = title;
    document.getElementById('tourModalPrice').innerHTML = priceHtml || '';
    document.getElementById('tourModalDuration').textContent = duration || '';
    document.getElementById('tourModalDescription').textContent = `Подробное описание тура "${title}".`;
  }

  if (grid) {
    grid.addEventListener('click', function (e) {
      const btn = e.target.closest('a.btn');
      if (!btn) return;
      e.preventDefault();
      const card = btn.closest('.card');
      if (!card) return;
      const id = card.dataset.id;
      openTourModalById(id, card);
    });
  }

  // закрытие модалки тура
  document.addEventListener('click', function (e) {
    if (e.target && (e.target.id === 'tourModalClose' || e.target.classList.contains('modal-close'))) {
      tourModal.setAttribute('aria-hidden', 'true');
    }
  });
  // клик по фону модалки (закрыть)
  tourModal.addEventListener('click', function (e) {
    if (e.target === tourModal) tourModal.setAttribute('aria-hidden', 'true');
  });

  // кнопка забронировать в модалке тура: откроет внешний booking modal (если есть)
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'bookTourNow') {
      // Закрываем модалку тура
      tourModal.setAttribute('aria-hidden', 'true');

      // Получаем название тура
      const tourName = document.getElementById('tourModalTitle')?.textContent || '';

      // Открываем модалку бронирования
      if (bookingModal) {
        bookingModal.setAttribute('aria-hidden', 'false');

        // Заполняем поле message
        const messageField = bookingModal.querySelector('[name="message"]');
        if (messageField) {
          messageField.value = tourName;
        }
      }
    }
  });

  // --- поиск (использует allTours.searchText) ---
  function searchTours(q) {
    if (isLoading) return;
    const query = (q || '').toLowerCase().trim();
    if (!query) { render(allTours); return; }
    const filtered = allTours.filter(t => t.title.toLowerCase().includes(query));
    render(filtered);
  }

  // кнопка, Enter, и input с debounce
  if (searchBtn) {
    searchBtn.addEventListener('click', () => searchTours(searchInput?.value));
  }
  if (searchInput) {
    searchInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') { e.preventDefault(); searchTours(searchInput.value); }
    });
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => searchTours(searchInput.value), 250);
    });
  }

  if (bookBtn && modal) {
    bookBtn.addEventListener('click', () => {
      modal.setAttribute('aria-hidden', 'false');
      mainNav?.classList.remove('active');   // закрыть меню
      burgerBtn?.classList.remove('active'); // вернуть иконку ☰
    });
  }

  if (modalClose) {
    modalClose.addEventListener('click', () => {
      modal.setAttribute('aria-hidden', 'true');
    });
  }

  // Клик по фону — закрытие
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.setAttribute('aria-hidden', 'true');
    }
  });

  // ====== ОТПРАВКА ФОРМЫ ======
  bookingForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    formMessage.textContent = 'Отправка...';

    const formData = Object.fromEntries(new FormData(bookingForm).entries());
    console.log(formData)
    try {
      const res = await fetch(API + '/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) throw new Error('Ошибка сервера');
      formMessage.textContent = '✅ Заявка отправлена!';
      bookingForm.reset();
    } catch (err) {
      formMessage.textContent = '❌ Не удалось отправить заявку';
      console.error(err);
    }
  });

  async function loadBestTours() {
    if (!bestGrid) {
      return;
    }

    try {
      const res = await fetch(API + '/best', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      let data = await res.json();
      let arr = Array.isArray(data) ? data : (data.data || data.tours || []);
      if (!Array.isArray(arr) || arr.length === 0) {
        console.warn('API /best не отправил данные');
        return;
      }

      const normalized = arr.map(normalize);
      allTours.push(...normalized); // чтобы модалка работала
      renderBest(normalized, bestGrid);

    } catch (err) {
      console.error('Ошибка загрузки /best:', err);
    }
  }

  // рендер для лучших туров
  function renderBest(list, container) {
    if (!container) return;
    const html = list.map(t => `
    <article class="card" data-id="${escapeHtml(t.id)}">
      <img src="${escapeHtml(t.img)}" alt="${escapeHtml(t.title)}">
      <h3>${escapeHtml(t.title)}</h3>
      <p>${escapeHtml(t.place)} — ${escapeHtml(t.duration || '')}</p>
      <div class="card-row">
        <div class="price">
          ${t.priceOld ? `<span class="old">₽${escapeHtml(t.priceOld)}</span>` : ''}
          <strong>₽${escapeHtml(t.price)}</strong>
        </div>
        <a class="btn" href="#" data-action="open">Подробнее</a>
      </div>
    </article>
  `).join('');
    container.innerHTML = html;
  }

  // клики по карточкам лучших туров (модалка та же)
  if (bestGrid) {
    bestGrid.addEventListener('click', function (e) {
      const btn = e.target.closest('a.btn');
      if (!btn) return;
      e.preventDefault();
      const card = btn.closest('.card');
      if (!card) return;
      const id = card.dataset.id;
      openTourModalById(id, card);
    });
  }

  async function loadCarousel() {
    try {
      const res = await fetch(API + '/best', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      slidesData = Array.isArray(data) ? data : (data.slides || []);
      slidesData = slidesData.map(normalize)
      console.log(slidesData)
      renderCarousel();
      startAutoSlide();
    } catch (err) {
      console.error('Ошибка загрузки слайдов:', err);
    }
  }

  function renderCarousel() {
    if (!carousel) return;
    carousel.innerHTML = slidesData.map((s, idx) => `
    <div class="slide ${idx === 0 ? 'active' : ''}">
      <img src="${escapeHtml(s.img)}" alt="${s.name}">
      <div class="slide-caption">
        <h3>${s.name}</h3>
        <p>${s.description || ''}</p>
        <a class="btn" href="tours.html">Подробнее</a>
      </div>
    </div>
  `).join('') + `
    <button class="carousel-prev" id="prev">←</button>
    <button class="carousel-next" id="next">→</button>
  `;

    // после перерендера заново ищем кнопки
    document.getElementById('prev').addEventListener('click', showPrevSlide);
    document.getElementById('next').addEventListener('click', showNextSlide);
  }

  function showSlide(index) {
    const slides = carousel.querySelectorAll('.slide');
    slides[currentSlide].classList.remove('active');
    currentSlide = (index + slides.length) % slides.length;
    slides[currentSlide].classList.add('active');
  }

  function showPrevSlide() {
    showSlide(currentSlide - 1);
    restartAutoSlide();
  }

  function showNextSlide() {
    showSlide(currentSlide + 1);
    restartAutoSlide();
  }

  function startAutoSlide() {
    autoSlideInterval = setInterval(showNextSlide, 5000);
  }

  function restartAutoSlide() {
    clearInterval(autoSlideInterval);
    startAutoSlide();
  }

  loadCarousel();


  loadTours();
  loadBestTours();

  // =====================  АДМИН-ПАНЕЛЬ =====================
  // Инициализируем панель только если она на странице
  if (document.getElementById('loginBtn')) {
    let token = '';
    let editTourId = null;

    const loginBtn = document.getElementById('loginBtn');
    const createTourForm = document.getElementById('createTourForm');

    loginBtn.addEventListener('click', async () => {
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      try {
        const res = await fetch(API + '/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        token = data.access_token;
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('bookings-section').style.display = 'block';
        document.getElementById('create-tour-section').style.display = 'block';
        document.getElementById('tours-admin-section').style.display = 'block';
        loadAdminTours();
        loadBookings();
      } catch {
        document.getElementById('loginMessage').textContent = '❌ Неверный логин или пароль';
      }
    });

    async function loadBookings() {
      const res = await fetch(API + '/bookings', {
        headers: { Authorization: 'Bearer ' + token }
      });
      const bookings = await res.json();
      document.getElementById('bookingsTable').innerHTML = bookings.map(b =>
        `<tr><td>${b.id}</td><td>${b.name}</td><td>${b.phone}</td><td>${b.message}</td></tr>`
      ).join('');
    }

    createTourForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const method = editTourId ? 'PUT' : 'POST';
      const url = editTourId ? `${API}/tours/${editTourId}` : `${API}/tours`;
      const res = await fetch(url, {
        method,
        headers: { Authorization: 'Bearer ' + token },
        body: formData
      });
      const data = await res.json();
      document.getElementById('createTourMessage').textContent = data.message || 'OK';
      e.target.reset();
      resetTourForm();
      loadAdminTours();
    });

    async function loadAdminTours() {
      const res = await fetch(API + '/tours');
      const tours = await res.json();
      document.getElementById('adminToursTable').innerHTML = tours.map(t =>
        `<tr>
        <td>${t.id}</td>
        <td>${t.title}</td>
        <td>
          <button onclick="viewTour(${t.id})">Посмотреть</button>
          <button onclick="editTour(${t.id})">Редактировать</button>
          <button onclick="deleteTour(${t.id})">Удалить</button>
        </td>
      </tr>`
      ).join('');
    }

    window.viewTour = async function (id) {
      const res = await fetch(API + '/tours/' + id);
      const t = await res.json();
      alert(`Тур: ${t.name}\nСтрана: ${t.country}\nЦена: ${t.price}₽`);
    };

    window.editTour = async function (id) {
      const res = await fetch(API + '/tours/' + id);
      const t = await res.json();
      editTourId = id;
      createTourForm.name.value = t.name;
      createTourForm.country.value = t.country;
      createTourForm.duration.value = t.duration;
      createTourForm.price.value = t.price;
      createTourForm.old_price.value = t.old_price || '';
      createTourForm.description.value = t.description;
      createTourForm.best.checked = t.best || false;
      document.getElementById('tourFormTitle').textContent = 'Редактировать тур';
      document.getElementById('tourSubmitBtn').textContent = 'Сохранить';
      document.getElementById('cancelEditBtn').style.display = 'inline-block';
    };

    window.deleteTour = async function (id) {
      if (!confirm('Удалить тур?')) return;
      const res = await fetch(API + '/tours/' + id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      alert(data.message);
      loadAdminTours();
    };

    document.getElementById('cancelEditBtn')?.addEventListener('click', resetTourForm);

    function resetTourForm() {
      editTourId = null;
      createTourForm.reset();
      document.getElementById('tourFormTitle').textContent = 'Создать тур';
      document.getElementById('tourSubmitBtn').textContent = 'Создать';
      document.getElementById('cancelEditBtn').style.display = 'none';
    }
  }

});
