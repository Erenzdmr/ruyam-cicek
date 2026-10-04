import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs, setDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const defaultFirebaseConfig = {
  apiKey: "AIzaSyC3UNbmvU2HUoaL7t1LZfpvuKVW6XKMlOY",
  authDomain: "ruyam-cicek.firebaseapp.com",
  projectId: "ruyam-cicek",
  storageBucket: "ruyam-cicek.firebasestorage.app",
  messagingSenderId: "877998133702",
  appId: "1:877998133702:web:14ed960d40e006825822c7",
  measurementId: "G-7G56JVJYEW"
};

const firebaseConfig = window.RUYAM_FIREBASE_CONFIG || defaultFirebaseConfig;

if (!firebaseConfig.projectId || firebaseConfig.projectId !== 'ruyam-cicek') {
  console.warn('Uyarı: Firebase projesi, kodda beklenen proje ile eşleşmiyor. Lütfen ruyam-cicek projesinde admin kullanıcı oluşturun.');
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const productsCollection = collection(db, 'products');

let isLoggedIn = sessionStorage.getItem('ruyam_logged_in') === 'true';

onAuthStateChanged(auth, (user) => {
  isLoggedIn = !!user;
  if (user) {
    sessionStorage.setItem('ruyam_logged_in', 'true');
  } else {
    sessionStorage.removeItem('ruyam_logged_in');
  }
});

document.addEventListener('DOMContentLoaded', () => {

  // ===== AUTHENTICATION =====
  isLoggedIn = sessionStorage.getItem('ruyam_logged_in') === 'true';

  const loginOverlay = document.getElementById('login-overlay');
  const loginModal = document.getElementById('login-modal');
  const loginCloseBtn = document.getElementById('login-close-btn');
  const loginForm = document.getElementById('login-form');
  const loginUsername = document.getElementById('login-username');
  const loginPassword = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');
  const passwordToggle = document.getElementById('password-toggle');

  function openLoginModal() {
    loginOverlay.classList.add('open');
    loginModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    loginError.textContent = '';
    loginError.classList.remove('visible');
    loginUsername.value = '';
    loginPassword.value = '';
    setTimeout(() => loginUsername.focus(), 400);
  }

  function closeLoginModal() {
    loginOverlay.classList.remove('open');
    loginModal.classList.remove('open');
    document.body.style.overflow = '';
  }

  loginCloseBtn.addEventListener('click', closeLoginModal);
  loginOverlay.addEventListener('click', closeLoginModal);

  passwordToggle.addEventListener('click', () => {
    const eyeOpen = passwordToggle.querySelector('.eye-open');
    const eyeClosed = passwordToggle.querySelector('.eye-closed');
    if (loginPassword.type === 'password') {
      loginPassword.type = 'text';
      eyeOpen.style.display = 'none';
      eyeClosed.style.display = 'block';
    } else {
      loginPassword.type = 'password';
      eyeOpen.style.display = 'block';
      eyeClosed.style.display = 'none';
    }
  });
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = loginUsername.value.trim();
    const password = loginPassword.value;

    loginError.textContent = '';
    loginError.classList.remove('visible');

    if (!email || !email.includes('@')) {
      loginError.textContent = 'Admin girişi için Firebase Authentication’daki e-posta adresini yazın. Kullanıcı adı değil.';
      loginError.classList.add('visible');
      loginUsername.focus();
      return;
    }

    if (!password) {
      loginError.textContent = 'Şifre alanı boş bırakılamaz.';
      loginError.classList.add('visible');
      loginPassword.focus();
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);

      isLoggedIn = true;
      sessionStorage.setItem('ruyam_logged_in', 'true');
      closeLoginModal();
      setTimeout(() => openAdminPanel(), 300);
    } catch (error) {
      console.error('Firebase login hatası:', error);

      const code = error?.code || '';
      if (code === 'auth/invalid-email') {
        loginError.textContent = 'Geçersiz e-posta formatı. Lütfen Firebase’deki gerçek e-posta adresini girin.';
      } else if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        loginError.textContent = 'E-posta veya şifre hatalı. Firebase Authentication’da kayıtlı admin hesabını kullanın.';
      } else {
        loginError.textContent = 'Giriş başarısız oldu. Lütfen Firebase kullanıcı bilgilerini kontrol edin.';
      }

      loginError.classList.add('visible');
      loginModal.classList.add('shake');
      setTimeout(() => loginModal.classList.remove('shake'), 500);
      loginPassword.value = '';
      loginPassword.focus();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (loginModal.classList.contains('open')) closeLoginModal();
      else if (adminPanel.classList.contains('open')) closeAdminPanel();
    }
  });

  const CATEGORY_MAP = {
    guller: 'Güller',
    laleler: 'Laleler',
    orkideler: 'Orkideler',
    karanfiller: 'Karanfiller',
    aycicekleri: 'Ay Çiçekleri',
    zambaklar: 'Zambaklar',
    karisik: 'Karışık'
  };

  function getSafeArrayFromStorage(key, fallback = []) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (error) {
      console.warn(`Geçersiz ${key} verisi temizlendi.`, error);
      localStorage.removeItem(key);
      return fallback;
    }
  }

  let deletedCategories = getSafeArrayFromStorage('ruyam_deleted_categories', []);

  function getAllCategories() {
    const cats = { ...CATEGORY_MAP };
    Object.values(products).forEach(p => {
       if (!cats[p.category]) {
           cats[p.category] = p.category;
       }
    });
    deletedCategories.forEach(c => delete cats[c]);
    return cats;
  }

  const WHATSAPP_NUMBER = '905320520831';

  let products = {};

  async function initProducts() {
    try {
      const snapshot = await getDocs(productsCollection);
      products = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        products[docSnap.id] = { id: docSnap.id, ...data };
      });
    } catch (err) {
      console.error('Firestore ürünler yüklenemedi.', err);
    }
    renderProductCards();
    renderFilterPills();
  }

  async function syncCreate(id, data) {
    try {
      await setDoc(doc(db, 'products', id), data);
    } catch (e) {
      console.error('Ürün oluşturulamadı:', e);
    }
  }
  async function syncUpdate(id, data) {
    try {
      await updateDoc(doc(db, 'products', id), data);
    } catch (e) {
      console.error('Ürün güncellenemedi:', e);
    }
  }
  async function syncDelete(id) {
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (e) {
      console.error('Ürün silinemedi:', e);
    }
  }

  // ===== RENDER PRODUCT CARDS =====
  const bouquetsGrid = document.getElementById('bouquets-grid');
  const filterPillsContainer = document.getElementById('filter-pills');

  function renderProductCards() {
    bouquetsGrid.innerHTML = '';

    const ids = Object.keys(products);
    if (ids.length === 0) {
      bouquetsGrid.innerHTML = '<div class="no-results">Henüz ürün eklenmemiş.</div>';
      return;
    }

    ids.forEach(id => {
      const p = products[id];
      const allCats = getAllCategories();
      const categoryLabel = allCats[p.category] || p.category;
      const card = document.createElement('div');
      card.className = 'bouquet-card fade-in visible';
      card.setAttribute('data-category', p.category);
      card.setAttribute('data-product-id', id);

      const stock = p.stock ?? 0;
      let badgeClass = 'in-stock';
      let badgeText = `Stok: ${stock}`;
      let outOfStockClass = '';

      if (stock <= 0) {
        badgeClass = 'out-of-stock';
        badgeText = 'Tükendi';
        outOfStockClass = ' out-of-stock-card';
      } else if (stock <= 3) {
        badgeClass = 'low-stock';
        badgeText = `Son ${stock} adet`;
      }

      if (outOfStockClass) card.classList.add('out-of-stock-card');

      const waText = encodeURIComponent(`Merhaba, "${p.name}" çiçeğini sipariş vermek istiyorum.`);
      const imgSrc = p.image || 'images/bouquet_pink.png';

      card.innerHTML = `
        <div class="bouquet-img">
          <img src="${imgSrc}" alt="${p.name}">
          <span class="stock-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="bouquet-info">
          <span class="bouquet-category-tag">${categoryLabel}</span>
          <span class="bouquet-name">«${p.name}»</span>
          <span class="bouquet-price">₺${p.price}</span>
          <a href="https://wa.me/${WHATSAPP_NUMBER}?text=${waText}" target="_blank" class="bouquet-btn"${stock <= 0 ? ' style="pointer-events:none;opacity:0.4"' : ''}>Satın Al</a>
        </div>
      `;

      bouquetsGrid.appendChild(card);
    });
  }

  function renderFilterPills() {
    filterPillsContainer.innerHTML = '';
    const dropdownMenu = document.getElementById('dropdown-menu');
    const mobileDropdownItems = document.querySelector('.mobile-dropdown-items');
    
    if (dropdownMenu) dropdownMenu.innerHTML = '';
    if (mobileDropdownItems) mobileDropdownItems.innerHTML = '';

    const usedCategories = new Set();
    Object.values(products).forEach(p => usedCategories.add(p.category));

    // Always add "Tümü"
    const allBtn = document.createElement('button');
    allBtn.className = 'filter-pill active';
    allBtn.setAttribute('data-filter', 'all');
    allBtn.textContent = 'Tümü';
    filterPillsContainer.appendChild(allBtn);

    if (dropdownMenu) {
      dropdownMenu.innerHTML += `<a href="#urunler" class="dropdown-item active" data-filter="all">Tümü</a>`;
    }
    if (mobileDropdownItems) {
      mobileDropdownItems.innerHTML += `<a href="#urunler" class="mobile-filter-item active" data-filter="all">Tümü</a>`;
    }

    const allCats = getAllCategories();
    Object.keys(allCats).forEach(key => {
      if (usedCategories.has(key)) {
        const btn = document.createElement('button');
        btn.className = 'filter-pill';
        btn.setAttribute('data-filter', key);
        btn.textContent = allCats[key];
        filterPillsContainer.appendChild(btn);

        if (dropdownMenu) {
          dropdownMenu.innerHTML += `<a href="#urunler" class="dropdown-item" data-filter="${key}">${allCats[key]}</a>`;
        }
        if (mobileDropdownItems) {
          mobileDropdownItems.innerHTML += `<a href="#urunler" class="mobile-filter-item" data-filter="${key}">${allCats[key]}</a>`;
        }
      }
    });

    // Attach filter events
    filterPillsContainer.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        filterByCategory(pill.getAttribute('data-filter'));
      });
    });

    if (dropdownMenu) {
      dropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          filterByCategory(item.getAttribute('data-filter'));
          document.getElementById('nav-kategoriler').classList.remove('open');
        });
      });
    }

    if (mobileDropdownItems) {
      mobileDropdownItems.querySelectorAll('.mobile-filter-item').forEach(item => {
        item.addEventListener('click', () => {
          filterByCategory(item.getAttribute('data-filter'));
          setTimeout(() => {
            document.querySelector('.mobile-menu').classList.remove('open');
            const spans = document.querySelector('.hamburger').querySelectorAll('span');
            spans[0].style.transform = '';
            spans[1].style.opacity = '';
            spans[2].style.transform = '';
          }, 300);
        });
      });
    }
  }

  // ===== FILTERING =====
  let currentFilter = 'all';

  function filterByCategory(category) {
    currentFilter = category;
    const cards = bouquetsGrid.querySelectorAll('[data-category]');

    cards.forEach((card, index) => {
      const cardCat = card.getAttribute('data-category');
      const show = category === 'all' || cardCat === category;
      if (show) {
        card.classList.remove('filter-hidden');
        card.classList.add('filter-show');
        card.style.position = '';
        card.style.width = '';
        card.style.height = '';
        card.style.overflow = '';
        card.style.padding = '';
        card.style.margin = '';
        card.style.border = '';
        card.style.animationDelay = `${index * 0.06}s`;
      } else {
        card.classList.remove('filter-show');
        card.classList.add('filter-hidden');
      }
    });

    // No results check
    const existing = bouquetsGrid.querySelector('.no-results');
    if (existing) existing.remove();
    const visibleCards = bouquetsGrid.querySelectorAll('[data-category]:not(.filter-hidden)');
    if (visibleCards.length === 0 && cards.length > 0) {
      const msg = document.createElement('div');
      msg.className = 'no-results';
      msg.textContent = 'Bu kategoride ürün bulunmamaktadır.';
      bouquetsGrid.appendChild(msg);
    }

    // Sync active pill
    filterPillsContainer.querySelectorAll('.filter-pill').forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-filter') === category);
    });

    // Sync active dropdown items
    document.querySelectorAll('.dropdown-item, .mobile-filter-item').forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-filter') === category);
    });
  }

  // ===== ADMIN PANEL =====
  const adminBtn = document.getElementById('admin-panel-btn');
  const adminPanel = document.getElementById('admin-panel');
  const adminOverlay = document.getElementById('admin-overlay');
  const adminCloseBtn = document.getElementById('admin-close-btn');
  const adminLogoutBtn = document.getElementById('admin-logout-btn');
  const adminTableBody = document.getElementById('admin-table-body');

  adminBtn.addEventListener('click', () => {
    if (isLoggedIn) openAdminPanel();
    else openLoginModal();
  });

  function openAdminPanel() {
    adminPanel.classList.add('open');
    adminOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    renderAdminTable();
  }

  function closeAdminPanel() {
    adminPanel.classList.remove('open');
    adminOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  adminCloseBtn.addEventListener('click', closeAdminPanel);
  adminOverlay.addEventListener('click', closeAdminPanel);

  adminLogoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.warn('Çıkış isteği sırasında hata oluştu.', error);
    }

    isLoggedIn = false;
    sessionStorage.removeItem('ruyam_logged_in');
    closeAdminPanel();
  });

  // ===== ADD PRODUCT =====
  const addBtn = document.getElementById('admin-add-btn');
  const addForm = document.getElementById('admin-add-form');
  const addCancelBtn = document.getElementById('add-cancel-btn');
  const addSaveBtn = document.getElementById('add-save-btn');
  const toggleCategoryBtn = document.getElementById('toggle-category-btn');
  const addCategoryInput = document.getElementById('add-category');
  const addNewCategoryInput = document.getElementById('add-new-category');
  const addCategoryTriggerLabel = document.querySelector('#add-category-trigger .custom-select-label');
  const addCategoryOptions = document.getElementById('add-category-options');
  let isAddingNewCategory = false;

  function populateCategorySelect() {
    addCategoryOptions.innerHTML = '';
    const allCats = getAllCategories();
    let isFirst = true;

    Object.keys(allCats).forEach(k => {
      if (isFirst && !addCategoryInput.value) {
        addCategoryInput.value = k;
        addCategoryTriggerLabel.textContent = allCats[k];
      }
      isFirst = false;

      const opt = document.createElement('div');
      opt.className = 'custom-select-option';
      opt.setAttribute('data-value', k);
      
      opt.innerHTML = `
        <span>${allCats[k]}</span>
        <div class="custom-option-actions">
          <button type="button" class="custom-edit-btn" data-cat="${k}" title="Kategoriyi Düzenle">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button type="button" class="custom-delete-btn" data-cat="${k}" title="Kategoriyi Sil">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </div>
      `;
      addCategoryOptions.appendChild(opt);
    });

    addCategoryOptions.querySelectorAll('.custom-select-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        if (e.target.closest('.custom-delete-btn') || e.target.closest('.custom-edit-btn')) return;
        const val = opt.getAttribute('data-value');
        const text = opt.querySelector('span').textContent;
        addCategoryInput.value = val;
        addCategoryTriggerLabel.textContent = text;
        addCategoryOptions.classList.remove('open');
      });
    });

    addCategoryOptions.querySelectorAll('.custom-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const selectedCat = btn.getAttribute('data-cat');
        const currentName = allCats[selectedCat];
        
        const newName = prompt(`"${currentName}" kategorisinin yeni adını girin:`, currentName);
        if (newName !== null && newName.trim() !== '' && newName.trim() !== currentName) {
          const trimmedNewName = newName.trim();
          
          const productsUsingCat = Object.values(products).filter(p => p.category === selectedCat);
          if (productsUsingCat.length > 0) {
            productsUsingCat.forEach(p => {
              const id = Object.keys(products).find(key => products[key] === p);
              if (id) {
                products[id].category = trimmedNewName;
                syncUpdate(id, products[id]);
              }
            });
          }
          
          const isDefault = Object.keys(CATEGORY_MAP).includes(selectedCat);
          if (isDefault) {
             if (!deletedCategories.includes(selectedCat)) {
               deletedCategories.push(selectedCat);
               localStorage.setItem('ruyam_deleted_categories', JSON.stringify(deletedCategories));
             }
          }
          
          const defaultCatId = Object.keys(CATEGORY_MAP).find(k => CATEGORY_MAP[k].toLowerCase() === trimmedNewName.toLowerCase());
          const catToUndelete = defaultCatId || trimmedNewName;
          const idx = deletedCategories.indexOf(catToUndelete);
          if (idx > -1) {
            deletedCategories.splice(idx, 1);
            localStorage.setItem('ruyam_deleted_categories', JSON.stringify(deletedCategories));
          }

          if (addCategoryInput.value === selectedCat) {
             addCategoryInput.value = trimmedNewName;
             addCategoryTriggerLabel.textContent = trimmedNewName;
          }
          
          populateCategorySelect();
          renderFilterPills();
          renderAdminTable();
          renderProductCards();
        }
      });
    });

    addCategoryOptions.querySelectorAll('.custom-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const selectedCat = btn.getAttribute('data-cat');
        
        const productsUsingCat = Object.values(products).filter(p => p.category === selectedCat);
        let confirmMsg = `"${allCats[selectedCat]}" kategorisini silmek istediğinize emin misiniz?`;
        
        if (productsUsingCat.length > 0) {
          confirmMsg = `Bu kategoriye ait ${productsUsingCat.length} adet ürün bulunuyor. Kategoriyi silerseniz BU KATEGORİDEKİ TÜM ÜRÜNLER DE SİLİNECEKTİR! Devam etmek istediğinize emin misiniz?`;
        }

        if (confirm(confirmMsg)) {
          if (productsUsingCat.length > 0) {
            productsUsingCat.forEach(p => {
              const id = Object.keys(products).find(key => products[key] === p);
              if (id) {
                delete products[id];
                syncDelete(id);
              }
            });
            renderProductCards();
          }

          if (!deletedCategories.includes(selectedCat)) {
            deletedCategories.push(selectedCat);
            localStorage.setItem('ruyam_deleted_categories', JSON.stringify(deletedCategories));
          }
          if (addCategoryInput.value === selectedCat) {
             addCategoryInput.value = '';
             addCategoryTriggerLabel.textContent = 'Seçiniz...';
          }
          populateCategorySelect();
          renderFilterPills();
          renderAdminTable();
        }
      });
    });
  }

  document.getElementById('add-category-trigger').addEventListener('click', () => {
    addCategoryOptions.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('add-category-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      addCategoryOptions.classList.remove('open');
    }
  });

  toggleCategoryBtn.addEventListener('click', () => {
    isAddingNewCategory = !isAddingNewCategory;
    const addCategoryWrapper = document.getElementById('add-category-wrapper');
    if (isAddingNewCategory) {
      addCategoryWrapper.style.display = 'none';
      addNewCategoryInput.style.display = 'block';
      toggleCategoryBtn.textContent = '×';
      toggleCategoryBtn.title = 'Seçime Dön';
      addNewCategoryInput.focus();
    } else {
      addCategoryWrapper.style.display = 'block';
      addNewCategoryInput.style.display = 'none';
      toggleCategoryBtn.textContent = '+';
      toggleCategoryBtn.title = 'Yeni Kategori Ekle';
      addNewCategoryInput.value = '';
    }
  });

  addBtn.addEventListener('click', () => {
    populateCategorySelect();
    addForm.style.display = addForm.style.display === 'none' ? 'block' : 'none';
  });

  addCancelBtn.addEventListener('click', () => {
    addForm.style.display = 'none';
    clearAddForm();
  });

  addSaveBtn.addEventListener('click', async () => {
    const name = document.getElementById('add-name').value.trim();
    let category = '';
    if (isAddingNewCategory) {
      category = addNewCategoryInput.value.trim();
      if (!category) {
        alert('Lütfen yeni kategori adını girin.');
        return;
      }
      
      const defaultCatId = Object.keys(CATEGORY_MAP).find(k => CATEGORY_MAP[k].toLowerCase() === category.toLowerCase());
      const catToUndelete = defaultCatId || category;
      const idx = deletedCategories.indexOf(catToUndelete);
      if (idx > -1) {
        deletedCategories.splice(idx, 1);
        localStorage.setItem('ruyam_deleted_categories', JSON.stringify(deletedCategories));
      }
      if (defaultCatId) category = defaultCatId;
    } else {
      category = addCategoryInput.value;
    }
    const price = parseInt(document.getElementById('add-price').value);
    const stock = parseInt(document.getElementById('add-stock').value);
    const imageFile = document.getElementById('add-image-file').files[0];

    if (!name || isNaN(price) || price <= 0) {
      alert('Lütfen ürün adı ve geçerli bir fiyat girin.');
      return;
    }

    const id = name.toLowerCase()
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    if (products[id]) {
      alert('Bu isimde bir ürün zaten mevcut!');
      return;
    }

    let imagePath = 'images/bouquet_pink.png';
    if (imageFile) {
      try {
        const storageRef = ref(storage, `products/${Date.now()}-${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        imagePath = await getDownloadURL(storageRef);
      } catch (err) {
        console.error('Görsel yüklenemedi:', err);
        alert('Görsel yüklenirken bir hata oluştu, varsayılan görsel kullanılacak.');
      }
    }

    products[id] = {
      name,
      category,
      price,
      stock: isNaN(stock) ? 0 : stock,
      image: imagePath
    };

    syncCreate(id, products[id]);
    renderProductCards();
    renderFilterPills();
    filterByCategory(currentFilter);
    renderAdminTable();
    clearAddForm();
    addForm.style.display = 'none';
  });

  function clearAddForm() {
    document.getElementById('add-name').value = '';
    document.getElementById('add-price').value = '';
    document.getElementById('add-stock').value = '';
    document.getElementById('add-image-file').value = '';
    
    isAddingNewCategory = false;
    document.getElementById('add-category-wrapper').style.display = 'block';
    addNewCategoryInput.style.display = 'none';
    addNewCategoryInput.value = '';
    toggleCategoryBtn.textContent = '+';
    toggleCategoryBtn.title = 'Yeni Kategori Ekle';
    
    addCategoryInput.value = '';
    addCategoryTriggerLabel.textContent = 'Seçiniz...';
    
    populateCategorySelect();
  }

  // ===== RENDER ADMIN TABLE =====
  function renderAdminTable() {
    adminTableBody.innerHTML = '';
    const allCats = getAllCategories();
    const categoryOptions = Object.keys(allCats).map(k =>
      `<option value="${k}">${allCats[k]}</option>`
    ).join('');

    Object.keys(products).forEach(productId => {
      const p = products[productId];
      const stock = p.stock ?? 0;

      let statusClass = 'status-ok';
      let countClass = '';
      if (stock <= 0) { statusClass = 'status-out'; countClass = 'out'; }
      else if (stock <= 3) { statusClass = 'status-low'; countClass = 'low'; }

      const row = document.createElement('tr');
      row.innerHTML = `
        <td><span class="product-name">«${p.name}»</span></td>
        <td>
          <select class="edit-select" data-id="${productId}" data-field="category">
            ${categoryOptions}
          </select>
        </td>
        <td>
          <input type="number" class="edit-input" data-id="${productId}" data-field="price" value="${p.price}" min="1">
        </td>
        <td>
          <div class="stock-cell">
            <span class="stock-status ${statusClass}"></span>
            <span>${stock}</span>
          </div>
        </td>
        <td>
          <div class="admin-actions-cell">
            <div class="stock-controls">
              <button class="stock-btn decrease" data-id="${productId}" data-action="decrease">−</button>
              <div class="stock-count ${countClass}">${stock}</div>
              <button class="stock-btn increase" data-id="${productId}" data-action="increase">+</button>
            </div>
            <button class="delete-btn" data-id="${productId}" title="Ürünü Sil">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
          </div>
        </td>
      `;

      // Set the correct category in select
      const select = row.querySelector('.edit-select');
      select.value = p.category;

      adminTableBody.appendChild(row);
    });

    // Stock +/- buttons
    adminTableBody.querySelectorAll('.stock-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        if (action === 'increase') products[id].stock = (products[id].stock ?? 0) + 1;
        else products[id].stock = Math.max(0, (products[id].stock ?? 0) - 1);
        syncUpdate(id, products[id]);
        renderProductCards();
        filterByCategory(currentFilter);
        renderAdminTable();
      });
    });

    // Inline category edit
    adminTableBody.querySelectorAll('.edit-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const id = sel.getAttribute('data-id');
        products[id].category = sel.value;
        syncUpdate(id, products[id]);
        renderProductCards();
        renderFilterPills();
        filterByCategory(currentFilter);
        renderAdminTable();
      });
    });

    // Inline price edit
    adminTableBody.querySelectorAll('.edit-input').forEach(inp => {
      inp.addEventListener('change', () => {
        const id = inp.getAttribute('data-id');
        const val = parseInt(inp.value);
        if (!isNaN(val) && val > 0) {
          products[id].price = val;
          syncUpdate(id, products[id]);
          renderProductCards();
          filterByCategory(currentFilter);
        }
      });
    });

    // Delete buttons
    adminTableBody.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const name = products[id]?.name || id;
        if (confirm(`"${name}" ürününü silmek istediğinize emin misiniz?`)) {
          delete products[id];
          syncDelete(id);
          renderProductCards();
          renderFilterPills();
          filterByCategory(currentFilter);
          renderAdminTable();
        }
      });
    });
  }

  // ===== INITIAL RENDER =====
  initProducts();

  // ===== NAVBAR SCROLL =====
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  });

  // ===== MOBILE MENU =====
  const hamburger = document.querySelector('.hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');

  hamburger.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
    const spans = hamburger.querySelectorAll('span');
    if (mobileMenu.classList.contains('open')) {
      spans[0].style.transform = 'rotate(45deg) translate(5px,5px)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(5px,-5px)';
    } else {
      spans[0].style.transform = '';
      spans[1].style.opacity = '';
      spans[2].style.transform = '';
    }
  });

  mobileMenu.querySelectorAll('a:not(.mobile-dropdown-toggle):not(.mobile-filter-item)').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      const spans = hamburger.querySelectorAll('span');
      spans[0].style.transform = '';
      spans[1].style.opacity = '';
      spans[2].style.transform = '';
    });
  });

  const mobileDropdownToggle = document.querySelector('.mobile-dropdown-toggle');
  const mobileDropdownItems = document.querySelector('.mobile-dropdown-items');

  if (mobileDropdownToggle && mobileDropdownItems) {
    mobileDropdownToggle.addEventListener('click', (e) => {
      e.preventDefault();
      mobileDropdownToggle.classList.toggle('open');
      mobileDropdownItems.classList.toggle('open');
    });
  }

  // Navbar Dropdown Click Toggle
  const navKategoriler = document.getElementById('nav-kategoriler');
  if (navKategoriler) {
    const dropdownToggle = navKategoriler.querySelector('.dropdown-toggle');
    if (dropdownToggle) {
      dropdownToggle.addEventListener('click', (e) => {
        e.preventDefault();
        navKategoriler.classList.toggle('open');
      });
    }
    
    document.addEventListener('click', (e) => {
      if (!navKategoriler.contains(e.target)) {
        navKategoriler.classList.remove('open');
      }
    });
  }

  // ===== SCROLL REVEAL =====
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const parent = entry.target.parentElement;
        const siblings = Array.from(parent.children).filter(c => c.classList.contains('fade-in'));
        const siblingIndex = siblings.indexOf(entry.target);
        setTimeout(() => entry.target.classList.add('visible'), siblingIndex * 100);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

  // ===== HERO PARALLAX =====
  const heroImage = document.querySelector('.hero-image img');
  if (heroImage) {
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY;
      const heroHeight = document.querySelector('.hero').offsetHeight;
      if (scrolled < heroHeight) {
        heroImage.style.transform = `scale(1.1) translateY(${scrolled * 0.15}px)`;
      }
    });
  }

  // ===== ACTIVE NAV LINK =====
  const sections = document.querySelectorAll('section[id], .section-about, .section-reasons');
  const navLinks = document.querySelectorAll('.nav-links-left a:not(.dropdown-toggle):not(.dropdown-item), .nav-links-right a');

  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
      if (window.scrollY >= section.offsetTop - 200) current = section.getAttribute('id') || '';
    });
    navLinks.forEach(link => {
      link.style.color = '';
      if (link.getAttribute('href') === '#' + current) link.style.color = 'var(--cream)';
    });
  });
});
