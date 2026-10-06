const API_BASE_URL = window.location.protocol === 'file:'
  ? 'http://localhost:3000/api'
  : `${window.location.origin}/api`;

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

  submitButton.disabled = true;
  submitButton.textContent = 'Please wait...';

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
    submitButton.textContent = form.dataset.submitText || 'Submit';
  }
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

    localStorage.setItem('carpool_user', JSON.stringify(profile.user));
    const [trips, requests] = await Promise.all([
      apiRequest('/trips/mine'),
      apiRequest('/requests/my')
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const upcomingTrips = [
      ...trips.filter((trip) => trip.status === 'active' && String(trip.trip_date).slice(0, 10) >= today),
      ...requests
        .filter((request) => request.status === 'accepted' && String(request.trip_date).slice(0, 10) >= today)
        .map((request) => ({ ...request, available_seats: null, isBookedRide: true }))
    ];
    const tripsEl = document.getElementById('dashboard-trips');
    const requestsEl = document.getElementById('dashboard-requests');

    if (tripsEl) {
      tripsEl.innerHTML = upcomingTrips.length
        ? upcomingTrips.map((trip) => `
            <article class="trip-card">
              <div class="trip-header"><div><p class="trip-route">${trip.start_location} → ${trip.destination}</p><p class="trip-meta">${formatDate(trip.trip_date)} · ${trip.departure_time}${trip.driver_name ? ` · Driver: ${trip.driver_name}` : ''}</p></div><span class="pill">${trip.isBookedRide ? 'Accepted' : `${trip.available_seats} seats left`}</span></div>
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
    listEl.innerHTML = '<div class="empty-state">No active rides right now. Check back soon.</div>';
    return;
  }

  const currentUser = getUser();

  listEl.innerHTML = trips.map((trip) => `
    <article class="trip-card">
      <div class="trip-header">
        <div>
          <p class="trip-route">${trip.start_location} → ${trip.destination}</p>
          <p class="trip-meta">Driver: ${trip.driver_name || 'Unknown'} · ${trip.available_seats} seats left</p>
        </div>
        <span class="pill">${trip.status || 'active'}</span>
      </div>
      <div class="trip-body">
        <p><strong>Date:</strong> ${formatDate(trip.trip_date)}</p>
        <p><strong>Departure:</strong> ${trip.departure_time}</p>
        <p><strong>Vehicle:</strong> ${trip.vehicle || 'Not specified'}</p>
        <p><strong>Notes:</strong> ${trip.notes || 'No extra notes'}</p>
      </div>
      <div class="trip-actions">
        <a class="btn btn-outline" href="ride-details.html?trip=${trip.id}">View details</a>
        ${Number(currentUser?.id) !== Number(trip.driver_id) ? `<a class="btn btn-primary" href="ride-details.html?trip=${trip.id}">Request ride</a>` : ''}
      </div>
    </article>
  `).join('');
}

async function loadHomeTrips() {
  const homeTripsEl = document.getElementById('home-trips');
  if (!homeTripsEl) return;

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
    renderTrips(trips);
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

  const query = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, value]) => value))).toString();
  const listEl = document.getElementById('trip-list');
  try {
    const trips = await apiRequest(`/trips${query ? `?${query}` : ''}`);
    renderTrips(trips);
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
  submitButton.textContent = 'Posting...';

  try {
    const trip = await apiRequest('/trips', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        available_seats: Number(payload.available_seats)
      })
    });

    if (messageEl) {
      messageEl.textContent = 'Ride posted successfully. It is now listed below.';
      messageEl.classList.remove('error');
      messageEl.classList.add('success');
    }
    form.reset();
    await renderOfferRidePage();
  } catch (error) {
    if (messageEl) {
      messageEl.textContent = error.message;
      messageEl.classList.remove('success');
      messageEl.classList.add('error');
    }
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Post ride';
  }
}

async function loadTripDetails() {
  const params = new URLSearchParams(window.location.search);
  const tripId = params.get('trip');
  const detailsEl = document.getElementById('trip-details');
  const requestForm = document.getElementById('request-ride-form');

  if (!tripId || !detailsEl) return;

  try {
    const trips = await apiRequest('/trips?status=active');
    const trip = trips.find((item) => String(item.id) === tripId);

    if (!trip) {
      detailsEl.innerHTML = '<div class="empty-state">Trip not found.</div>';
      return;
    }

    detailsEl.innerHTML = `
      <div class="trip-detail-card">
        <p class="trip-route">${trip.start_location} → ${trip.destination}</p>
        <p><strong>Driver:</strong> ${trip.driver_name}</p>
        <p><strong>Driver phone:</strong> ${trip.driver_phone || 'Not provided'}</p>
        <p><strong>Date:</strong> ${formatDate(trip.trip_date)}</p>
        <p><strong>Departure time:</strong> ${trip.departure_time}</p>
        <p><strong>Available seats:</strong> ${trip.available_seats}</p>
        <p><strong>Vehicle:</strong> ${trip.vehicle || 'Not specified'}</p>
        <p><strong>Notes:</strong> ${trip.notes || 'No extra notes'}</p>
      </div>
    `;

    if (requestForm) {
      requestForm.dataset.tripId = trip.id;
      requestForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!ensureLoggedIn()) return;
        const submitButton = requestForm.querySelector('button[type="submit"]');
        const message = requestForm.querySelector('textarea[name="message"]')?.value || '';
        if (submitButton) submitButton.disabled = true;
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
          if (submitButton) submitButton.disabled = false;
        }
      });
    }
  } catch (error) {
    detailsEl.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
}

async function renderRequestsPage() {
  if (!ensureLoggedIn()) return;

  const myRequestsEl = document.getElementById('my-requests');
  const driverRequestsEl = document.getElementById('driver-requests');

  if (!myRequestsEl || !driverRequestsEl) return;

  try {
    const [myRequests, trips] = await Promise.all([
      apiRequest('/requests/my'),
      apiRequest('/trips/mine')
    ]);

    myRequestsEl.innerHTML = myRequests.length
      ? myRequests.map((request) => `
          <div class="request-card">
            <p><strong>Route:</strong> ${request.start_location} → ${request.destination}</p>
            <p><strong>Date:</strong> ${formatDate(request.trip_date)} · ${request.departure_time}</p>
            <p><strong>Driver:</strong> ${request.driver_name}</p>
            <p><strong>Status:</strong> <span class="pill">${request.status}</span></p>
            <p><strong>Message:</strong> ${request.message || 'No message'}</p>
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
          tripStatus: trip.status,
          seatsAvailable: trip.available_seats
        }));
      })
    );

    const flatRequests = tripRequests.flat();

    driverRequestsEl.innerHTML = flatRequests.length
      ? flatRequests.map((request) => `
          <div class="request-card">
            <p><strong>Trip:</strong> ${request.tripTitle}</p>
            <p><strong>Rider:</strong> ${request.rider_name}</p>
            <p><strong>Status:</strong> <span class="pill">${request.status}</span></p>
            <p><strong>Message:</strong> ${request.message || 'No message'}</p>
            ${request.status === 'pending' ? `<div class="trip-actions">
              ${request.tripStatus === 'active' && request.seatsAvailable > 0 ? `<button class="btn btn-outline" data-request-status="${request.id}" data-status="accepted">Accept</button>` : ''}
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

  const myTripsEl = document.getElementById('my-offers');
  const rideRequestsEl = document.getElementById('ride-requests');

  if (!myTripsEl || !rideRequestsEl) return;

  try {
    const trips = await apiRequest('/trips/mine');

    myTripsEl.innerHTML = trips.length
      ? trips.map((trip) => `
          <article class="trip-card">
            <div class="trip-header">
              <div>
                <p class="trip-route">${trip.start_location} → ${trip.destination}</p>
                <p class="trip-meta">${formatDate(trip.trip_date)} · ${trip.departure_time}</p>
              </div>
              <span class="pill">${trip.status || 'active'}</span>
            </div>
            <div class="trip-body">
              <p><strong>Seats:</strong> ${trip.available_seats}</p>
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
                <p><strong>Rider:</strong> ${request.rider_name}</p>
                <p><strong>Status:</strong> <span class="pill">${request.status}</span></p>
                <p><strong>Message:</strong> ${request.message || 'No message'}</p>
                ${request.status === 'pending' ? `<div class="trip-actions">
                  ${trip.status === 'active' && trip.available_seats > 0 ? `<button class="btn btn-outline" data-request-status="${request.id}" data-status="accepted">Accept</button>` : ''}
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
    await renderRequestsPage();
    await loadDashboard();
  } catch (error) {
    window.alert(error.message);
  }
}

async function cancelRideRequest(requestId) {
  try {
    await apiRequest(`/requests/${requestId}/cancel`, { method: 'PATCH' });
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