const API_BASE_URL = window.location.protocol === 'file:'
  ? 'http://localhost:3000/api'
  : `${window.location.origin}/api`;
const chatRefreshTimers = new Map();

function getToken() {
  return localStorage.getItem('carpool_token');
}

function saveSession(token, user) {
  localStorage.setItem('carpool_token', token);
  localStorage.setItem('carpool_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('carpool_token');
  localStorage.removeItem('carpool_user');
}

function getUser() {
  const raw = localStorage.getItem('carpool_user');
  return raw ? JSON.parse(raw) : null;
}

async function apiRequest(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatFare(value) {
  const fare = Number(value);
  if (!Number.isFinite(fare) || fare < 0) return '৳0';
  return `৳${fare.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function relativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sent recently';
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  const [unit, secondsPerUnit] = units.find(([, size]) => Math.abs(seconds) >= size) || ['second', 1];
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(seconds / secondsPerUnit), unit);
}

function getInitials(name) {
  return String(name || 'Carpool rider')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function loadingSkeletons(count = 2) {
  return Array.from({ length: count }, () => `
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton skeleton-wide"></div>
      <div class="skeleton skeleton-medium"></div>
      <div class="skeleton skeleton-short"></div>
    </div>
  `).join('');
}

function showToast(message) {
  let toast = document.querySelector('.app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'app-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

function chatMarkup(requestId) {
  return `
    <div class="conversation-wrap">
      <button type="button" class="btn btn-outline chat-toggle" data-open-chat="${requestId}" aria-expanded="false">Message <span aria-hidden="true">⌄</span></button>
      <section class="chat-panel" data-chat-panel="${requestId}" hidden>
        <div class="chat-messages" data-chat-messages="${requestId}" aria-live="polite"></div>
        <form class="chat-compose" data-chat-form="${requestId}">
          <label class="sr-only" for="chat-message-${requestId}">Write a message</label>
          <textarea id="chat-message-${requestId}" name="message" rows="2" maxlength="1000" placeholder="Write a message..." required></textarea>
          <button class="btn btn-primary" type="submit">Send</button>
        </form>
      </section>
    </div>
  `;
}

function stopChatRefresh() {
  chatRefreshTimers.forEach((timer) => window.clearInterval(timer));
  chatRefreshTimers.clear();
}

async function loadConversation(requestId) {
  const messagesEl = document.querySelector(`[data-chat-messages="${requestId}"]`);
  if (!messagesEl) return;
  if (!messagesEl.dataset.loaded) messagesEl.innerHTML = loadingSkeletons(1);

  try {
    const messages = await apiRequest(`/requests/${requestId}/messages`);
    const currentUserId = Number(getUser()?.id);
    messagesEl.innerHTML = messages.length
      ? messages.map((message) => `
          <article class="chat-message ${Number(message.sender_id) === currentUserId ? 'chat-message-mine' : ''}">
            <div class="chat-message-meta"><strong>${escapeHtml(message.sender_name)}</strong><time datetime="${escapeHtml(message.created_at)}">${escapeHtml(relativeTime(message.created_at))}</time></div>
            <p>${escapeHtml(message.message)}</p>
          </article>
        `).join('')
      : '<p class="chat-empty">No messages yet. Start the conversation.</p>';
    messagesEl.scrollTop = messagesEl.scrollHeight;
    messagesEl.dataset.loaded = 'true';
  } catch (error) {
    messagesEl.innerHTML = `<p class="chat-error">${escapeHtml(error.message)}</p>`;
  }
}

function initializeChatControls() {
  document.addEventListener('click', async (event) => {
    const toggle = event.target.closest('[data-open-chat]');
    if (!toggle) return;
    const requestId = toggle.dataset.openChat;
    const panel = document.querySelector(`[data-chat-panel="${requestId}"]`);
    if (!panel) return;
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    if (panel.hidden) {
      window.clearInterval(chatRefreshTimers.get(requestId));
      chatRefreshTimers.delete(requestId);
    } else {
      await loadConversation(requestId);
      if (!chatRefreshTimers.has(requestId)) {
        chatRefreshTimers.set(requestId, window.setInterval(() => loadConversation(requestId), 5000));
      }
    }
  });

  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-chat-form]');
    if (!form) return;
    event.preventDefault();
    const requestId = form.dataset.chatForm;
    const textarea = form.elements.message;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Sending';

    try {
      await apiRequest(`/requests/${requestId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: textarea.value })
      });
      form.reset();
      await loadConversation(requestId);
    } catch (error) {
      const messagesEl = document.querySelector(`[data-chat-messages="${requestId}"]`);
      if (messagesEl) messagesEl.insertAdjacentHTML('beforeend', `<p class="chat-error">${escapeHtml(error.message)}</p>`);
    } finally {
      button.disabled = false;
      button.textContent = 'Send';
    }
  });
}

function routeVisual(start, destination) {
  return `
    <div class="route-visual" aria-label="Route from ${start} to ${destination}">
      <div class="route-point"><span class="route-marker"></span><small>FROM</small><strong>${start}</strong></div>
      <span class="route-track" aria-hidden="true"><i></i></span>
      <div class="route-point"><span class="route-marker destination"></span><small>TO</small><strong>${destination}</strong></div>
    </div>
  `;
}

function setAuthButtons() {
  const user = getUser();
  const loginLink = document.querySelector('[data-auth="login"]');
  const registerLink = document.querySelector('[data-auth="register"]');
  const logoutBtn = document.querySelector('[data-auth="logout"]');

  if (user) {
    if (loginLink) {
      loginLink.textContent = user.name;
      loginLink.href = 'dashboard.html';
    }

    if (registerLink) {
      registerLink.textContent = 'Dashboard';
      registerLink.href = 'dashboard.html';
    }
  }

  if (logoutBtn) {
    logoutBtn.style.display = user ? 'inline-block' : 'none';
  }
}

async function handleAuthForm(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const messageEl = form.querySelector('[data-message]');

  const payload = Object.fromEntries(new FormData(form).entries());

  const originalLabel = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.classList.add('is-loading');
  submitButton.setAttribute('aria-busy', 'true');
  submitButton.textContent = form.dataset.endpoint.endsWith('/login') ? 'Signing in' : 'Creating account';

  try {
    const endpoint = form.dataset.endpoint;
    const response = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    saveSession(response.token, response.user);

    if (messageEl) {
      messageEl.textContent = response.message || 'Success';
      messageEl.classList.remove('error');
      messageEl.classList.add('success');
    }

    window.location.href = 'dashboard.html';
  } catch (error) {
    if (messageEl) {
      messageEl.textContent = error.message;
      messageEl.classList.remove('success');
      messageEl.classList.add('error');
    }
  } finally {
    submitButton.disabled = false;
    submitButton.classList.remove('is-loading');
    submitButton.removeAttribute('aria-busy');
    submitButton.textContent = originalLabel || form.dataset.submitText || 'Submit';
  }
}

function initializePasswordToggles() {
  document.querySelectorAll('[data-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = button.parentElement.querySelector('input');
      if (!input) return;
      const isVisible = input.type === 'text';
      input.type = isVisible ? 'password' : 'text';
      button.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
    });
  });
}

function updateOfferPreview(form) {
  const formData = new FormData(form);
  const start = formData.get('start_location')?.trim() || 'Starting point';
  const destination = formData.get('destination')?.trim() || 'Destination';
  const tripDate = formData.get('trip_date');
  const departureTime = formData.get('departure_time');
  const seats = Number(formData.get('available_seats') || 1);
  const vehicle = formData.get('vehicle')?.trim() || 'Add vehicle details';
  const fare = formData.get('fare_per_seat');
  const dateTime = [tripDate ? formatDate(`${tripDate}T00:00:00`) : '', departureTime || '']
    .filter(Boolean)
    .join(' · ') || 'Choose a date and time';

  document.querySelector('[data-preview="start"]').textContent = start;
  document.querySelector('[data-preview="destination"]').textContent = destination;
  document.querySelector('[data-preview="when"]').textContent = dateTime;
  document.querySelector('[data-preview="seats"]').textContent = `${seats} ${seats === 1 ? 'seat' : 'seats'} available`;
  document.querySelector('[data-preview="vehicle"]').textContent = vehicle;
  document.querySelector('[data-preview="fare"]').textContent = fare === '' ? 'Enter a fare' : `${formatFare(fare)} per seat`;
}

function initializeOfferPreview() {
  const form = document.querySelector('[data-offer-form]');
  if (!form) return;

  form.addEventListener('input', () => updateOfferPreview(form));
  form.addEventListener('change', () => updateOfferPreview(form));
  document.addEventListener('click', (event) => {
    const stepButton = event.target.closest('[data-seat-step]');
    if (!stepButton || !form.contains(stepButton)) return;
    const seatInput = form.querySelector('[name="available_seats"]');
    const current = Number(seatInput.value || 1);
    seatInput.value = Math.min(8, Math.max(1, current + Number(stepButton.dataset.seatStep)));
    seatInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  updateOfferPreview(form);
}

async function loadDashboard() {
  const user = getUser();
  const token = getToken();

  if (!token || !user) {
    window.location.href = 'login.html';
    return;
  }

  const welcome = document.querySelector('[data-dashboard="welcome"]');
  const userInfo = document.querySelector('[data-dashboard="user"]');
  const tripsEl = document.getElementById('dashboard-trips');
  const requestsEl = document.getElementById('dashboard-requests');
  if (tripsEl) tripsEl.innerHTML = loadingSkeletons(2);
  if (requestsEl) requestsEl.innerHTML = loadingSkeletons(2);

  try {
    const profile = await apiRequest('/auth/me');
    if (welcome) {
      welcome.textContent = `Welcome, ${profile.user.name}!`;
    }

    if (userInfo) {
      userInfo.innerHTML = `
        <p><strong>Name:</strong> ${profile.user.name}</p>
        <p><strong>Email:</strong> ${profile.user.email}</p>
        <p><strong>Role:</strong> ${profile.user.role}</p>
      `;
    }

    const dashboardAvatar = document.querySelector('[data-dashboard="avatar"]');
    if (dashboardAvatar) dashboardAvatar.textContent = getInitials(profile.user.name);

    localStorage.setItem('carpool_user', JSON.stringify(profile.user));
    const [trips, requests] = await Promise.all([
      apiRequest('/trips/mine'),
      apiRequest('/requests/my')
    ]);
    const tripCount = document.querySelector('[data-dashboard-stat="trips"]');
    const requestCount = document.querySelector('[data-dashboard-stat="requests"]');
    const pendingCount = document.querySelector('[data-dashboard-stat="pending"]');
    if (tripCount) tripCount.textContent = trips.length;
    if (requestCount) requestCount.textContent = requests.length;
    if (pendingCount) pendingCount.textContent = requests.filter((request) => request.status === 'pending').length;
    const today = new Date().toISOString().slice(0, 10);
    const upcomingTrips = trips.filter((trip) => String(trip.trip_date).slice(0, 10) >= today);
    if (tripsEl) {
      tripsEl.innerHTML = upcomingTrips.length
        ? upcomingTrips.map((trip) => `
            <article class="trip-card">
              ${routeVisual(trip.start_location, trip.destination)}
              <div class="trip-card-footer"><p class="trip-meta">${formatDate(trip.trip_date)} · ${trip.departure_time}</p><span class="pill">${trip.status || 'active'}</span></div>
            </article>
          `).join('')
        : '<div class="empty-state">No upcoming rides posted. Your future rides will appear here.</div>';
    }

    if (requestsEl) {
      requestsEl.innerHTML = requests.length
        ? requests.map((request) => `
            <article class="request-card">
              <p class="trip-route">${request.start_location} → ${request.destination}</p>
              <p><strong>Date:</strong> ${formatDate(request.trip_date)} · ${request.departure_time}</p>
              <p><strong>Driver:</strong> ${request.driver_name}</p>
              <p class="fare-line"><strong>1 seat fare:</strong> ${formatFare(request.fare_per_seat)}</p>
              <p><strong>Status:</strong> <span class="pill">${request.status}</span></p>
              ${request.status === 'pending' ? `<button class="btn btn-outline" data-cancel-request="${request.id}">Cancel request</button>` : ''}
            </article>
          `).join('')
        : '<div class="empty-state">You have not requested any rides yet.</div>';
    }
  } catch (error) {
    if (welcome?.textContent === 'Loading profile...') {
      clearSession();
      window.location.href = 'login.html';
    } else {
      const tripsEl = document.getElementById('dashboard-trips');
      if (tripsEl) tripsEl.innerHTML = `<div class="empty-state">${error.message}</div>`;
    }
  }
}

function bindLogoutButton() {
  const logoutBtn = document.querySelector('[data-auth="logout"]');
  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', () => {
    clearSession();
    window.location.href = 'index.html';
  });
}

function ensureLoggedIn(redirectPage = 'login.html') {
  if (!getToken()) {
    window.location.href = redirectPage;
    return false;
  }
  return true;
}

function renderTrips(trips, containerId = 'trip-list', options = {}) {
  const listEl = document.getElementById(containerId);
  if (!listEl) return;

  if (!trips.length) {
    listEl.innerHTML = `
      <div class="empty-state trip-empty-state">
        <svg viewBox="0 0 80 64" fill="none" aria-hidden="true"><path d="M7 47c13-12 20 5 32-4 11-8 20-15 34-8" stroke="#dfc9b6" stroke-width="8" stroke-linecap="round"/><path d="m24 36 4-10c1-3 4-5 7-5h17c4 0 6 2 8 5l5 10 5 2v7H18v-5c0-2 2-4 4-4h2Z" fill="#fb7185"/><circle cx="30" cy="47" r="5" fill="#292321"/><circle cx="55" cy="47" r="5" fill="#292321"/></svg>
        <strong>No rides match just yet.</strong><span>Try another date or route, or share a ride of your own.</span>
        <a href="offer-ride.html" class="btn btn-outline">Offer a ride</a>
      </div>
    `;
    return;
  }

  const currentUser = getUser();

  listEl.innerHTML = trips.map((trip) => `
    <article class="trip-card">
      ${routeVisual(trip.start_location, trip.destination)}
      <div class="trip-header">
        <div class="trip-driver"><span class="driver-avatar">${getInitials(trip.driver_name)}</span><span><strong>${trip.driver_name || 'Carpool driver'}</strong><small>${trip.vehicle || 'Vehicle details available'}</small></span></div>
        <span class="pill">${trip.status || 'active'}</span>
      </div>
      <div class="trip-body">
        <p><svg class="inline-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><strong>Date:</strong> ${formatDate(trip.trip_date)} <span aria-hidden="true">·</span> ${trip.departure_time}</p>
        <p><svg class="inline-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 19v-1a6 6 0 0 1 12 0v1M16 5a3 3 0 0 1 0 6m2 2a5 5 0 0 1 3 4.6v1"/></svg><strong>Seats:</strong> ${trip.available_seats} available</p>
        <p class="fare-line"><strong>1 seat fare:</strong> ${formatFare(trip.fare_per_seat)}</p>
        ${trip.notes ? `<p><strong>Note:</strong> ${trip.notes}</p>` : ''}
      </div>
      <div class="trip-actions">
        <a class="btn btn-outline" href="ride-details.html?trip=${trip.id}">View details <span aria-hidden="true">→</span></a>
        ${Number(currentUser?.id) !== Number(trip.driver_id) ? `<a class="btn btn-primary" href="ride-details.html?trip=${trip.id}">Request ride</a>` : ''}
      </div>
    </article>
  `).join('');
}

async function loadHomeTrips() {
  const homeTripsEl = document.getElementById('home-trips');
  if (!homeTripsEl) return;

  homeTripsEl.innerHTML = loadingSkeletons(3);
  try {
    const trips = await apiRequest('/trips?status=active');
    renderTrips(trips.slice(0, 6), 'home-trips');
  } catch (error) {
    homeTripsEl.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
}

async function loadTrips() {
  const filterForm = document.querySelector('[data-trip-filter]');
  const listEl = document.getElementById('trip-list');
  if (!listEl) return;
  listEl.innerHTML = loadingSkeletons(3);

  const params = {};
  if (filterForm) {
    const formData = new FormData(filterForm);
    const start = formData.get('start_location')?.trim();
    const dest = formData.get('destination')?.trim();
    if (start) params.start_location = start;
    if (dest) params.destination = dest;
    const date = formData.get('trip_date');
    const sort = formData.get('sort');
    if (date) params.trip_date = date;
    if (sort) params.sort = sort;
  }

  const query = new URLSearchParams(params).toString();
  try {
    const trips = await apiRequest(`/trips${query ? `?${query}` : ''}`);
    const minimumSeats = Number(filterForm?.elements.min_seats?.value || 0);
    renderTrips(trips.filter((trip) => Number(trip.available_seats) >= minimumSeats));
  } catch (error) {
    listEl.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
}

async function handleTripFilter(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const params = {
    start_location: formData.get('start_location')?.trim(),
    destination: formData.get('destination')?.trim(),
    trip_date: formData.get('trip_date'),
    sort: formData.get('sort')
  };
  const minimumSeats = Number(formData.get('min_seats') || 0);

  const query = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, value]) => value))).toString();
  const listEl = document.getElementById('trip-list');
  if (listEl) listEl.innerHTML = loadingSkeletons(3);
  try {
    const trips = await apiRequest(`/trips${query ? `?${query}` : ''}`);
    renderTrips(trips.filter((trip) => Number(trip.available_seats) >= minimumSeats));
  } catch (error) {
    if (listEl) listEl.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
}

async function handleCreateTrip(event) {
  event.preventDefault();
  if (!ensureLoggedIn()) return;

  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const messageEl = form.querySelector('[data-message]');
  const payload = Object.fromEntries(new FormData(form).entries());

  submitButton.disabled = true;
  submitButton.classList.add('is-loading');
  submitButton.setAttribute('aria-busy', 'true');
  submitButton.textContent = 'Posting ride';

  try {
    const trip = await apiRequest('/trips', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        available_seats: Number(payload.available_seats),
        fare_per_seat: Number(payload.fare_per_seat)
      })
    });

    if (messageEl) {
      messageEl.textContent = 'Ride posted successfully. It is now listed below.';
      messageEl.classList.remove('error');
      messageEl.classList.add('success');
    }
    form.classList.add('is-success');
    window.setTimeout(() => form.classList.remove('is-success'), 900);
    form.reset();
    updateOfferPreview(form);
    await renderOfferRidePage();
  } catch (error) {
    if (messageEl) {
      messageEl.textContent = error.message;
      messageEl.classList.remove('success');
      messageEl.classList.add('error');
    }
  } finally {
    submitButton.disabled = false;
    submitButton.classList.remove('is-loading');
    submitButton.removeAttribute('aria-busy');
    submitButton.textContent = 'Post ride';
  }
}

async function loadTripDetails() {
  const params = new URLSearchParams(window.location.search);
  const tripId = params.get('trip');
  const detailsEl = document.getElementById('trip-details');
  const requestForm = document.getElementById('request-ride-form');

  if (!tripId || !detailsEl) return;
  detailsEl.innerHTML = loadingSkeletons(1);

  try {
    const trips = await apiRequest('/trips?status=active');
    const trip = trips.find((item) => String(item.id) === tripId);

    if (!trip) {
      detailsEl.innerHTML = '<div class="empty-state">Trip not found.</div>';
      return;
    }

    const currentUser = getUser();
    let existingRequest = null;
    if (getToken()) {
      try {
        const requests = await apiRequest('/requests/my');
        existingRequest = requests.find((request) => String(request.trip_id) === String(trip.id));
      } catch (error) {
        existingRequest = null;
      }
    }

    detailsEl.innerHTML = `
      <div class="trip-detail-card">
        <p class="detail-route-heading">THE ROUTE</p>
        ${routeVisual(trip.start_location, trip.destination)}
        <div class="driver-profile"><span class="driver-avatar">${getInitials(trip.driver_name)}</span><div><strong>${trip.driver_name || 'Carpool driver'}</strong><small>Driver${trip.driver_phone ? ` · <a href="tel:${trip.driver_phone}">${trip.driver_phone}</a>` : ''}</small></div><span class="pill">${trip.status || 'active'}</span></div>
        <div class="detail-data-grid"><div class="detail-data"><small>DATE</small><strong>${formatDate(trip.trip_date)}</strong></div><div class="detail-data"><small>DEPARTURE</small><strong>${trip.departure_time}</strong></div><div class="detail-data"><small>SEATS LEFT</small><strong>${trip.available_seats} available</strong></div><div class="detail-data"><small>VEHICLE</small><strong>${trip.vehicle || 'Not specified'}</strong></div><div class="detail-data fare-data"><small>FARE PER SEAT</small><strong>${formatFare(trip.fare_per_seat)}</strong></div></div>
        <blockquote class="route-notes"><strong>A note from the driver</strong>${trip.notes || 'No extra details from the driver.'}</blockquote>
      </div>
    `;

    if (requestForm) {
      requestForm.dataset.tripId = trip.id;
      const requestPanel = requestForm.closest('.sticky-request');
      if (Number(currentUser?.id) === Number(trip.driver_id)) {
        if (requestPanel) requestPanel.hidden = true;
      } else if (existingRequest) {
        requestForm.hidden = true;
        requestForm.insertAdjacentHTML('beforebegin', `<div class="request-status-note"><span class="pill">${existingRequest.status}</span><p>You already requested this ride. The driver will update your request here.</p>${['pending', 'accepted'].includes(existingRequest.status) ? chatMarkup(existingRequest.id) : ''}</div>`);
      }
      requestForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!ensureLoggedIn()) return;
        const submitButton = requestForm.querySelector('button[type="submit"]');
        const message = requestForm.querySelector('textarea[name="message"]')?.value || '';
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.classList.add('is-loading');
          submitButton.setAttribute('aria-busy', 'true');
          submitButton.textContent = 'Sending request';
        }
        try {
          await apiRequest('/requests', {
            method: 'POST',
            body: JSON.stringify({ trip_id: Number(trip.id), message })
          });
          const messageEl = requestForm.querySelector('[data-message]');
          if (messageEl) {
            messageEl.textContent = 'Request sent successfully.';
            messageEl.classList.remove('error');
            messageEl.classList.add('success');
          }
          requestForm.reset();
        } catch (error) {
          const messageEl = requestForm.querySelector('[data-message]');
          if (messageEl) {
            messageEl.textContent = error.message;
            messageEl.classList.remove('success');
            messageEl.classList.add('error');
          }
        } finally {
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.classList.remove('is-loading');
            submitButton.removeAttribute('aria-busy');
            submitButton.innerHTML = 'Send request <span aria-hidden="true">→</span>';
          }
        }
      });
    }
  } catch (error) {
    detailsEl.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
}

async function renderRequestsPage() {
  if (!ensureLoggedIn()) return;
  stopChatRefresh();

  const myRequestsEl = document.getElementById('my-requests');
  const driverRequestsEl = document.getElementById('driver-requests');

  if (!myRequestsEl || !driverRequestsEl) return;
  myRequestsEl.innerHTML = loadingSkeletons(2);
  driverRequestsEl.innerHTML = loadingSkeletons(2);

  try {
    const [myRequests, trips] = await Promise.all([
      apiRequest('/requests/my'),
      apiRequest('/trips/mine')
    ]);

    myRequestsEl.innerHTML = myRequests.length
      ? myRequests.map((request) => `
          <div class="request-card">
            ${routeVisual(request.start_location, request.destination)}
            <div class="request-card-meta"><p>${formatDate(request.trip_date)} · ${request.departure_time}</p><span class="pill">${request.status}</span></div>
            <p class="fare-line"><strong>1 seat fare:</strong> ${formatFare(request.fare_per_seat)}</p>
            <p><strong>Driver:</strong> ${request.driver_name}</p>
            <blockquote class="request-quote">${request.message || 'No message included.'}</blockquote>
            ${['pending', 'accepted'].includes(request.status) ? chatMarkup(request.id) : ''}
            ${request.status === 'pending' ? `<button class="btn btn-outline" data-cancel-request="${request.id}">Cancel request</button>` : ''}
          </div>
        `).join('')
      : '<div class="empty-state">You have not requested any rides yet.</div>';

    if (!trips.length) {
      driverRequestsEl.innerHTML = '<div class="empty-state">You have no trips to manage yet.</div>';
      return;
    }

    const tripRequests = await Promise.all(
      trips.map(async (trip) => {
        const requests = await apiRequest(`/requests/trip/${trip.id}`);
        return requests.map((request) => ({
          ...request,
          tripTitle: `${trip.start_location} → ${trip.destination}`,
          fare_per_seat: trip.fare_per_seat,
          tripStatus: trip.status,
          seatsAvailable: trip.available_seats
        }));
      })
    );

    const flatRequests = tripRequests.flat();

    driverRequestsEl.innerHTML = flatRequests.length
      ? flatRequests.map((request) => `
          <div class="request-card">
            <p class="trip-meta">Trip · ${request.tripTitle}</p>
            <div class="rider-profile"><span class="rider-avatar">${getInitials(request.rider_name)}</span><span><strong>${request.rider_name}</strong><small>${request.created_at ? relativeTime(request.created_at) : 'Ride request'}</small></span><span class="pill">${request.status}</span></div>
            <p class="fare-line"><strong>1 seat fare:</strong> ${formatFare(request.fare_per_seat)}</p>
            <blockquote class="request-quote">${request.message || 'No message included.'}</blockquote>
            ${['pending', 'accepted'].includes(request.status) ? chatMarkup(request.id) : ''}
            ${request.status === 'pending' ? `<div class="trip-actions">
              ${request.tripStatus === 'active' && request.seatsAvailable > 0 ? `<button class="btn btn-success" data-request-status="${request.id}" data-status="accepted">Accept</button>` : ''}
              <button class="btn btn-danger" data-request-status="${request.id}" data-status="rejected">Reject</button>
            </div>` : ''}
          </div>
        `).join('')
      : '<div class="empty-state">No pending requests for your trips.</div>';

  } catch (error) {
    myRequestsEl.innerHTML = `<div class="empty-state">${error.message}</div>`;
    driverRequestsEl.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
}

async function renderOfferRidePage() {
  if (!ensureLoggedIn()) return;
  stopChatRefresh();

  const myTripsEl = document.getElementById('my-offers');
  const rideRequestsEl = document.getElementById('ride-requests');

  if (!myTripsEl || !rideRequestsEl) return;
  myTripsEl.innerHTML = loadingSkeletons(2);
  rideRequestsEl.innerHTML = loadingSkeletons(1);

  try {
    const trips = await apiRequest('/trips/mine');

    myTripsEl.innerHTML = trips.length
      ? trips.map((trip) => `
          <article class="trip-card">
            ${routeVisual(trip.start_location, trip.destination)}
            <div class="trip-header">
              <div>
                <p class="trip-meta">${formatDate(trip.trip_date)} · ${trip.departure_time}</p>
              </div>
              <span class="pill">${trip.status || 'active'}</span>
            </div>
            <div class="trip-body">
              <p><strong>Seats:</strong> ${trip.available_seats}</p>
              <p class="fare-line"><strong>1 seat fare:</strong> ${formatFare(trip.fare_per_seat)}</p>
              <p><strong>Vehicle:</strong> ${trip.vehicle || 'Not specified'}</p>
              <p><strong>Notes:</strong> ${trip.notes || 'No extra notes'}</p>
            </div>
            ${trip.status === 'active' ? `<div class="trip-actions">
              <button class="btn btn-outline" data-trip-status="${trip.id}" data-status="completed">Mark completed</button>
              <button class="btn btn-danger" data-cancel-trip="${trip.id}">Cancel ride</button>
            </div>
            <details class="edit-ride">
              <summary>Edit ride details</summary>
              <form data-edit-trip="${trip.id}" class="edit-ride-form">
                <label>From<input name="start_location" value="${trip.start_location}" required /></label>
                <label>To<input name="destination" value="${trip.destination}" required /></label>
                <label>Date<input name="trip_date" type="date" value="${String(trip.trip_date).slice(0, 10)}" required /></label>
                <label>Departure<input name="departure_time" type="time" value="${String(trip.departure_time).slice(0, 5)}" required /></label>
                <label>Seats available<input name="available_seats" type="number" min="0" value="${trip.available_seats}" required /></label>
                <label>Fare per seat (৳)<input name="fare_per_seat" type="number" min="0" max="99999999.99" step="0.01" value="${trip.fare_per_seat || 0}" required /></label>
                <label>Vehicle<input name="vehicle" value="${trip.vehicle || ''}" /></label>
                <label class="edit-notes">Notes<textarea name="notes" rows="2">${trip.notes || ''}</textarea></label>
                <button class="btn btn-primary" type="submit">Save changes</button>
                <p class="form-message" data-edit-message></p>
              </form>
            </details>` : ''}
          </article>
        `).join('')
      : '<div class="empty-state">You have not offered any rides yet.</div>';

    if (!trips.length) {
      rideRequestsEl.innerHTML = '<div class="empty-state">No requests yet. Your ride requests will appear here once riders ask to join.</div>';
      return;
    }

    const tripRequests = await Promise.all(
      trips.map(async (trip) => {
        const requests = await apiRequest(`/requests/trip/${trip.id}`);
        return { trip, requests };
      })
    );

    rideRequestsEl.innerHTML = tripRequests.map(({ trip, requests }) => `
      <div class="request-card">
        <p class="trip-route">${trip.start_location} → ${trip.destination}</p>
        <p class="trip-meta">${formatDate(trip.trip_date)} · ${trip.departure_time}</p>
        ${requests.length
          ? requests.map((request) => `
              <div class="request-item">
                <div class="rider-profile"><span class="rider-avatar">${getInitials(request.rider_name)}</span><span><strong>${request.rider_name}</strong><small>${request.created_at ? relativeTime(request.created_at) : 'Ride request'}</small></span></div>
                <p><strong>Status:</strong> <span class="pill">${request.status}</span></p>
                <p class="fare-line"><strong>1 seat fare:</strong> ${formatFare(trip.fare_per_seat)}</p>
                <blockquote class="request-quote">${request.message || 'No message included.'}</blockquote>
                ${['pending', 'accepted'].includes(request.status) ? chatMarkup(request.id) : ''}
                ${request.status === 'pending' ? `<div class="trip-actions">
                  ${trip.status === 'active' && trip.available_seats > 0 ? `<button class="btn btn-success" data-request-status="${request.id}" data-status="accepted">Accept</button>` : ''}
                  <button class="btn btn-danger" data-request-status="${request.id}" data-status="rejected">Reject</button>
                </div>` : ''}
              </div>
            `).join('')
          : '<div class="empty-state">No requests for this trip yet.</div>'}
      </div>
    `).join('');

    document.querySelectorAll('[data-request-status]').forEach((button) => {
      button.addEventListener('click', async () => {
        const id = button.dataset.requestStatus;
        const status = button.dataset.status;
        try {
          await apiRequest(`/requests/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
          });
          showToast(status === 'accepted' ? 'Ride request accepted.' : 'Ride request declined.');
          await renderOfferRidePage();
        } catch (error) {
          window.alert(error.message);
        }
      });
    });

    document.querySelectorAll('[data-trip-status]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await apiRequest(`/trips/${button.dataset.tripStatus}`, {
            method: 'PUT',
            body: JSON.stringify({ status: button.dataset.status })
          });
          await renderOfferRidePage();
        } catch (error) {
          window.alert(error.message);
        }
      });
    });
  } catch (error) {
    myTripsEl.innerHTML = `<div class="empty-state">${error.message}</div>`;
    rideRequestsEl.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
}

async function updateRideRequest(requestId, status) {
  try {
    await apiRequest(`/requests/${requestId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    showToast(status === 'accepted' ? 'Ride request accepted.' : 'Ride request declined.');
    await renderRequestsPage();
    await loadDashboard();
  } catch (error) {
    window.alert(error.message);
  }
}

async function cancelRideRequest(requestId) {
  try {
    await apiRequest(`/requests/${requestId}/cancel`, { method: 'PATCH' });
    showToast('Ride request cancelled.');
    await renderRequestsPage();
    await loadDashboard();
  } catch (error) {
    window.alert(error.message);
  }
}

async function updateOfferedTrip(form) {
  const tripId = form.dataset.editTrip;
  const messageEl = form.querySelector('[data-edit-message]');
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.available_seats = Number(payload.available_seats);
  payload.fare_per_seat = Number(payload.fare_per_seat);

  try {
    await apiRequest(`/trips/${tripId}`, { method: 'PUT', body: JSON.stringify(payload) });
    await renderOfferRidePage();
  } catch (error) {
    if (messageEl) messageEl.textContent = error.message;
  }
}

async function cancelOfferedTrip(tripId) {
  if (!window.confirm('Cancel this ride? Riders will no longer be able to request it.')) return;
  try {
    await apiRequest(`/trips/${tripId}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) });
    await renderOfferRidePage();
  } catch (error) {
    window.alert(error.message);
  }
}

function initializeRidePages() {
  const page = document.body.dataset.page;

  if (['ride-details', 'requests', 'offer-ride'].includes(page)) {
    initializeChatControls();
  }

  if (page === 'home') {
    loadHomeTrips();
  }

  if (page === 'rides') {
    const filterForm = document.querySelector('[data-trip-filter]');
    if (filterForm) {
      filterForm.addEventListener('submit', handleTripFilter);
    }
    loadTrips();
  }

  if (page === 'offer-ride') {
    initializeOfferPreview();
    const offerForm = document.querySelector('[data-offer-form]');
    if (offerForm) {
      offerForm.addEventListener('submit', handleCreateTrip);
    }
    renderOfferRidePage();
    document.addEventListener('submit', (event) => {
      const form = event.target.closest('[data-edit-trip]');
      if (form) {
        event.preventDefault();
        updateOfferedTrip(form);
      }
    });
    document.addEventListener('click', (event) => {
      const cancelButton = event.target.closest('[data-cancel-trip]');
      if (cancelButton) cancelOfferedTrip(cancelButton.dataset.cancelTrip);
    });
  }

  if (page === 'ride-details') {
    loadTripDetails();
  }

  if (page === 'requests') {
    renderRequestsPage();
    document.addEventListener('click', (event) => {
      const statusButton = event.target.closest('[data-request-status]');
      const cancelButton = event.target.closest('[data-cancel-request]');
      if (statusButton) updateRideRequest(statusButton.dataset.requestStatus, statusButton.dataset.status);
      if (cancelButton) cancelRideRequest(cancelButton.dataset.cancelRequest);
    });
  }

  if (page === 'dashboard') {
    document.addEventListener('click', (event) => {
      const cancelButton = event.target.closest('[data-cancel-request]');
      if (cancelButton) cancelRideRequest(cancelButton.dataset.cancelRequest);
    });
  }
}

function initializeAuthPage() {
  setAuthButtons();
  bindLogoutButton();
  initializePasswordToggles();

  const authForm = document.querySelector('[data-auth-form]');
  if (authForm) {
    authForm.addEventListener('submit', handleAuthForm);
  }

  if (document.body.dataset.page === 'dashboard') {
    loadDashboard();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initializeAuthPage();
  initializeRidePages();
});