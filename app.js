// Priced — Grocery Price Tracker
// Firebase: ainvested-703ec

const FB_CONFIG = {
  apiKey: "AIzaSyC2fezwrXSOeDCytG84RES-dJ04teLvmuo",
  authDomain: "ainvested-703ec.firebaseapp.com",
  databaseURL: "https://ainvested-703ec-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ainvested-703ec",
  storageBucket: "ainvested-703ec.appspot.com",
  messagingSenderId: "727721440588",
  appId: "1:727721440588:web:5a7b8c9d0e1f2a3b4c5d6e"
};

const CATEGORIES = [
  { id: 'produce', label: 'Produce', color: '#3fb950' },
  { id: 'dairy', label: 'Dairy & Eggs', color: '#a371f7' },
  { id: 'meat', label: 'Meat & Seafood', color: '#da3633' },
  { id: 'bakery', label: 'Bakery', color: '#d29922' },
  { id: 'pantry', label: 'Pantry', color: '#db6d28' },
  { id: 'frozen', label: 'Frozen', color: '#39d2c0' },
  { id: 'beverages', label: 'Beverages', color: '#58a6ff' },
  { id: 'snacks', label: 'Snacks', color: '#f778ba' },
  { id: 'household', label: 'Household', color: '#8b949e' },
  { id: 'other', label: 'Other', color: '#6e7681' }
];

const LS_KEY = 'priced_v1';

// State
let items = [];
let editId = null;
let user = null;
let db = null;
let selectedCat = '';

// DOM
const $list = document.getElementById('items-list');
const $search = document.getElementById('search');
const $filterStore = document.getElementById('filter-store');
const $filterCat = document.getElementById('filter-category');
const $modal = document.getElementById('modal-overlay');
const $modalTitle = document.getElementById('modal-title');
const $catChips = document.getElementById('cat-chips');
const $edCat = document.getElementById('ed-category');
const $storeList = document.getElementById('store-list');
const $btnLogin = document.getElementById('btn-login');
const $toast = document.getElementById('toast');

// Init
document.addEventListener('DOMContentLoaded', () => {
  initCategories();
  loadLocal();
  renderCategoryFilter();
  initFirebase();
  bindEvents();
});

function initCategories() {
  $catChips.innerHTML = CATEGORIES.map(c =>
    `<span class="chip" data-cat="${c.id}">${c.label}</span>`
  ).join('');
  $catChips.addEventListener('click', e => {
    if (e.target.classList.contains('chip')) {
      const cat = e.target.dataset.cat;
      if (selectedCat === cat) {
        selectedCat = '';
        highlightChip(null);
      } else {
        selectedCat = cat;
        highlightChip(e.target);
      }
    }
  });
}

function highlightChip(el) {
  document.querySelectorAll('#cat-chips .chip').forEach(c => c.classList.remove('selected'));
  if (el) el.classList.add('selected');
}

function bindEvents() {
  document.getElementById('btn-add').addEventListener('click', () => openModal());
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('btn-save').addEventListener('click', saveItem);
  document.getElementById('btn-delete').addEventListener('click', deleteItem);
  $modal.addEventListener('click', e => { if (e.target === $modal) closeModal(); });
  $search.addEventListener('input', render);
  $filterStore.addEventListener('change', render);
  $filterCat.addEventListener('change', render);
  $btnLogin.addEventListener('click', toggleAuth);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $modal.classList.contains('show')) closeModal();
  });
}

// Firebase
function initFirebase() {
  try {
    firebase.initializeApp(FB_CONFIG);
    db = firebase.database();
    firebase.auth().onAuthStateChanged(u => {
      user = u;
      $btnLogin.textContent = u ? '👤' : '🔐';
      if (u) {
        loadFirebase();
      } else {
        loadLocal();
      }
    });
  } catch(e) {
    console.warn('Firebase init failed, using local storage', e);
    render();
  }
}

function toggleAuth() {
  if (user) {
    firebase.auth().signOut();
  } else {
    firebase.auth().signInAnonymously().catch(e => {
      toast('Sign in failed: ' + e.message);
    });
  }
}

// Data
function loadLocal() {
  try {
    items = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch { items = []; }
  render();
  updateStoreList();
}

function loadFirebase() {
  if (!user) return;
  db.ref(`users/${user.uid}/priced`).once('value', snap => {
    const data = snap.val();
    items = data ? Object.entries(data).map(([id, v]) => ({ id, ...v })) : [];
    saveLocal();
    render();
    updateStoreList();
  });
}

function saveLocal() {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

function saveFirebase(item) {
  if (!user) return;
  const ref = db.ref(`users/${user.uid}/priced/${item.id}`);
  const { id, ...data } = item;
  ref.set(data);
}

function deleteFirebase(id) {
  if (!user) return;
  db.ref(`users/${user.uid}/priced/${id}`).remove();
}

function addItem(data) {
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: data.name.trim(),
    category: selectedCat || 'other',
    price: parseFloat(data.price) || 0,
    qty: data.qty.trim() || '1 unit',
    store: data.store.trim(),
    date: data.date || new Date().toISOString().split('T')[0],
    notes: data.notes.trim(),
    createdAt: Date.now()
  };
  items.unshift(item);
  saveLocal();
  saveFirebase(item);
  render();
  updateStoreList();
}

function updateItem(id, data) {
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return;
  items[idx] = {
    ...items[idx],
    name: data.name.trim(),
    category: selectedCat || items[idx].category,
    price: parseFloat(data.price) || 0,
    qty: data.qty.trim(),
    store: data.store.trim(),
    date: data.date,
    notes: data.notes.trim(),
    updatedAt: Date.now()
  };
  saveLocal();
  saveFirebase(items[idx]);
  render();
  updateStoreList();
}

function removeItem(id) {
  items = items.filter(i => i.id !== id);
  saveLocal();
  deleteFirebase(id);
  render();
  updateStoreList();
}

// Render
function render() {
  const search = $search.value.toLowerCase();
  const storeFilter = $filterStore.value;
  const catFilter = $filterCat.value;

  let filtered = items;
  if (search) filtered = filtered.filter(i => i.name.toLowerCase().includes(search));
  if (storeFilter) filtered = filtered.filter(i => i.store === storeFilter);
  if (catFilter) filtered = filtered.filter(i => i.category === catFilter);

  if (filtered.length === 0) {
    $list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🛒</div>
        <p>${items.length === 0 ? 'No prices logged yet' : 'No matching items'}</p>
        <p class="empty-hint">${items.length === 0 ? 'Tap + to add your first grocery item' : 'Try a different filter'}</p>
      </div>`;
    return;
  }

  $list.innerHTML = filtered.map(item => {
    const cat = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[CATEGORIES.length - 1];
    const priceStr = item.price.toFixed(2);
    return `
      <div class="item" data-id="${item.id}">
        <div class="item-cat-dot" style="background:${cat.color};" title="${cat.label}"></div>
        <div class="item-body">
          <div class="item-name">${esc(item.name)}</div>
          <div class="item-meta">
            <span>${item.qty}</span>
            <span>·</span>
            <span>${esc(item.store || '—')}</span>
            <span>·</span>
            <span>${item.date}</span>
          </div>
        </div>
        <div class="item-price">
          RM ${priceStr}
          <div class="unit">/${item.qty.split(' ')[1] || 'unit'}</div>
        </div>
      </div>`;
  }).join('');

  // Click to edit
  $list.querySelectorAll('.item').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      const item = items.find(i => i.id === id);
      if (item) openModal(item);
    });
  });
}

function renderCategoryFilter() {
  $filterCat.innerHTML = '<option value="">All categories</option>' +
    CATEGORIES.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
}

function updateStoreList() {
  const stores = [...new Set(items.map(i => i.store).filter(Boolean))].sort();
  $filterStore.innerHTML = '<option value="">All stores</option>' +
    stores.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  $storeList.innerHTML = stores.map(s => `<option value="${esc(s)}">`).join('');
}

// Modal
function openModal(item) {
  if (item) {
    editId = item.id;
    $modalTitle.textContent = 'Edit Price';
    document.getElementById('ed-name').value = item.name;
    document.getElementById('ed-price').value = item.price;
    document.getElementById('ed-qty').value = item.qty;
    document.getElementById('ed-store').value = item.store || '';
    document.getElementById('ed-date').value = item.date;
    document.getElementById('ed-notes').value = item.notes || '';
    selectedCat = item.category;
    highlightChip(document.querySelector(`#cat-chips .chip[data-cat="${item.category}"]`));
    document.getElementById('btn-delete').style.display = 'block';
  } else {
    editId = null;
    $modalTitle.textContent = 'Add Price';
    document.getElementById('ed-name').value = '';
    document.getElementById('ed-price').value = '';
    document.getElementById('ed-qty').value = '';
    document.getElementById('ed-store').value = '';
    document.getElementById('ed-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('ed-notes').value = '';
    selectedCat = '';
    highlightChip(null);
    document.getElementById('btn-delete').style.display = 'none';
  }
  $modal.classList.add('show');
  document.getElementById('ed-name').focus();
}

function closeModal() {
  $modal.classList.remove('show');
  editId = null;
  selectedCat = '';
}

function saveItem() {
  const data = {
    name: document.getElementById('ed-name').value,
    price: document.getElementById('ed-price').value,
    qty: document.getElementById('ed-qty').value || '1 unit',
    store: document.getElementById('ed-store').value,
    date: document.getElementById('ed-date').value,
    notes: document.getElementById('ed-notes').value
  };

  if (!data.name.trim()) { toast('Item name is required'); return; }
  if (!data.price || parseFloat(data.price) < 0) { toast('Valid price is required'); return; }

  if (editId) {
    updateItem(editId, data);
  } else {
    addItem(data);
  }
  closeModal();
}

function deleteItem() {
  if (!editId) return;
  if (confirm('Delete this price entry?')) {
    removeItem(editId);
    closeModal();
    toast('Deleted');
  }
}

// Helpers
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

let toastTimer;
function toast(msg) {
  clearTimeout(toastTimer);
  $toast.textContent = msg;
  $toast.classList.add('show');
  toastTimer = setTimeout(() => $toast.classList.remove('show'), 2000);
}
