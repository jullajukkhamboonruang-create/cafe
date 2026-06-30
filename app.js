// app.js
// โค้ดควบคุมระบบหลักของแอปพลิเคชัน POS ร้านกาแฟและระบบสะสมแต้ม

(() => {
// ==========================================
// 1. ตัวแปรเก็บสถานะและคอนฟิกูเรชันส่วนกลาง (State & Global Configuration)
// ==========================================

// ฟังก์ชันควบคุมการเชื่อมต่อฐานข้อมูล Supabase ผ่านเบราว์เซอร์ (LocalStorage)
function getSupabaseConfig() {
  const url = localStorage.getItem('cafe_pos_supabase_url') || '';
  const key = localStorage.getItem('cafe_pos_supabase_key') || '';
  return { url, key };
}

function saveSupabaseConfig(url, key) {
  localStorage.setItem('cafe_pos_supabase_url', url.trim());
  localStorage.setItem('cafe_pos_supabase_key', key.trim());
}

function clearSupabaseConfig() {
  localStorage.removeItem('cafe_pos_supabase_url');
  localStorage.removeItem('cafe_pos_supabase_key');
}

let supabaseInstance = null;

let supabaseUrl = '';
let supabaseKey = '';

function getSupabaseClient() {
  if (supabaseInstance) return supabaseInstance;

  if (!supabaseUrl || !supabaseKey) {
    const { url, key } = getSupabaseConfig();
    supabaseUrl = url;
    supabaseKey = key;
  }

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  try {
    if (typeof supabase === 'undefined') {
      console.error('Supabase CDN ยังโหลดไม่เสร็จหรือล้มเหลว');
      return null;
    }
    supabaseInstance = window.supabase.createClient(supabaseUrl, supabaseKey);
    return supabaseInstance;
  } catch (error) {
    console.error('ไม่สามารถเชื่อมต่อ Supabase client ได้:', error);
    return null;
  }
}

function reinitializeSupabase() {
  supabaseInstance = null;
  return getSupabaseClient();
}

let supabase = null;
let currentView = 'login';
let currentStaff = null; // ข้อมูลพนักงานที่กำลังล็อกอินอยู่
let isGuestMode = false; // Flag for guest mode (true if logged in as guest)

// ข้อมูลตะกร้าสินค้า
let cart = [];

// ข้อมูลลูกค้าระหว่างการสั่งซื้อ
let selectedMember = null;
let pointsRedeemed = 0; // แต้มที่ต้องการใช้แลกส่วนลด
let pointsEarned = 0;   // แต้มที่จะได้รับจากรายการนี้
let paymentMethod = 'cash'; // cash, qr_code, card

// เก็บอินสแตนซ์ของกราฟ (สำหรับเคลียร์ก่อนวาดใหม่)
let salesTrendChartInstance = null;
let categoryChartInstance = null;

// เก็บรายการสินค้าจำลองสำหรับใช้งานในโหมดสาธิตแบบผู้มาเยือน (Demo/Offline Guest Mode)
const mockProducts = [
  { id: '1', name: 'Espresso (ร้อน)', price: 50.00, category: 'coffee', image_url: 'https://images.unsplash.com/photo-1510707577719-0d7fe5b3940a?w=400&q=80', is_available: true, points_value: 1 },
  { id: '2', name: 'Iced Americano', price: 60.00, category: 'coffee', image_url: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=400&q=80', is_available: true, points_value: 1 },
  { id: '3', name: 'Iced Latte', price: 65.00, category: 'coffee', image_url: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400&q=80', is_available: true, points_value: 1 },
  { id: '4', name: 'Iced Cappuccino', price: 65.00, category: 'coffee', image_url: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&q=80', is_available: true, points_value: 1 },
  { id: '5', name: 'Matcha Latte เย็น', price: 70.00, category: 'coffee', image_url: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=400&q=80', is_available: true, points_value: 1 },
  { id: '6', name: 'Butter Croissant', price: 85.00, category: 'bakery', image_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80', is_available: true, points_value: 2 },
  { id: '7', name: 'Chocolate Cake', price: 95.00, category: 'bakery', image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80', is_available: true, points_value: 2 },
  { id: '8', name: 'Blueberry Cheesecake', price: 120.00, category: 'bakery', image_url: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400&q=80', is_available: true, points_value: 2 },
  { id: '9', name: 'Strawberry Waffle', price: 110.00, category: 'bakery', image_url: 'https://images.unsplash.com/photo-1562376502-6f769499c886?w=400&q=80', is_available: true, points_value: 2 }
];

// ==========================================
// 2. การเริ่มต้นระบบและการตั้งค่าแอปแรกเริ่ม (Initialization & Setup)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // บังคับแปลงไอคอน Lucide ในตอนแรก
  lucide.createIcons();
  
  // ตรวจสอบการตั้งค่าฐานข้อมูล
  checkSupabaseConnection();
  
  // ผูกการทำงานปุ่มกับฟังก์ชันต่างๆ
  bindEvents();
  
  // อัปเดตเวลาบนหัวเว็บทุกวินาที
  setInterval(updateDateTime, 1000);
  updateDateTime();
});

// ตรวจสอบการเชื่อมต่อฐานข้อมูล Supabase
async function checkSupabaseConnection() {
  const dbBanner = document.getElementById('db-setup-banner');
  
  // 1. พยายามโหลดคอนฟิกจาก Vercel Serverless API (/api/config)
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.supabaseUrl && data.supabaseKey) {
        supabaseUrl = data.supabaseUrl;
        supabaseKey = data.supabaseKey;
        console.log('โหลดการตั้งค่าสำเร็จจาก Vercel Environment Variables');
      }
    }
  } catch (err) {
    console.log('ทำงานในโหมดโลคอล (Offline/Local Mode) ไม่พบ Vercel API');
  }
  
  // 2. หากไม่พบคอนฟิกจาก Vercel API ให้ดึงจาก LocalStorage เป็นตัวสำรอง (Fallback)
  if (!supabaseUrl || !supabaseKey) {
    const localConfig = getSupabaseConfig();
    supabaseUrl = localConfig.url;
    supabaseKey = localConfig.key;
  }
  
  // 3. หากยังไม่มีคีย์ ให้แสดงป้ายตั้งค่าและเปิด Modal
  if (!supabaseUrl || !supabaseKey) {
    dbBanner.style.display = 'flex';
    openModal('overlay-db-config');
    return;
  }
  
  // 4. เชื่อมต่อ Supabase Client
  try {
    if (typeof window.supabase === 'undefined') {
      showToast('ไม่พบ Supabase CDN กรุณาตรวจสอบอินเทอร์เน็ต', 'error');
      return;
    }
    supabaseInstance = window.supabase.createClient(supabaseUrl, supabaseKey);
  } catch (err) {
    console.error('ไม่สามารถสร้าง Supabase Client:', err);
    dbBanner.style.display = 'flex';
    showToast('การสร้างการเชื่อมต่อฐานข้อมูลล้มเหลว', 'error');
    return;
  }
  
  // 5. ทดสอบ Query ดึงข้อมูล
  try {
    const { data, error } = await supabaseInstance.from('products').select('id').limit(1);
    if (error) throw error;
    
    // เชื่อมต่อสำเร็จ ปิดป้ายเตือน
    dbBanner.style.display = 'none';
    console.log('เชื่อมต่อฐานข้อมูลสำเร็จ!');
    
    // ตั้งค่าตัวแปรหลัก
    supabase = supabaseInstance;
    
    // ตรวจสอบเซสชันผู้ใช้ปัจจุบัน
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await loadStaffProfile(session.user.id);
    }
  } catch (err) {
    console.error('การทดสอบเชื่อมต่อฐานข้อมูลล้มเหลว:', err);
    dbBanner.style.display = 'flex';
    showToast('เชื่อมต่อฐานข้อมูลล้มเหลว ตรวจสอบสิทธิ์ของคีย์หรือตัวโปรเจกต์', 'error');
  }
}

// อัปเดตวันที่และเวลาปัจจุบันที่แสดงบน Header
function updateDateTime() {
  const dtText = document.getElementById('current-date-time');
  if (dtText) {
    const now = new Date();
    dtText.textContent = now.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}

// ==========================================
// 3. ระบบยืนยันตัวตนพนักงาน (Staff Authentication)
// ==========================================

// โหลดข้อมูลโปรไฟล์ของพนักงานที่ล็อกอินเข้าใช้งาน
async function loadStaffProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error) throw error;
    
    currentStaff = data;
    
    // อัปเดตการแสดงผลของโปรไฟล์พนักงานใน Sidebar
    document.getElementById('staff-name-display').textContent = data.name;
    document.getElementById('staff-role-display').textContent = data.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'พนักงาน (Staff)';
    document.getElementById('staff-avatar-char').textContent = data.name.charAt(0).toUpperCase();
    
    // แสดง Sidebar & Header
    document.getElementById('app-sidebar').style.display = 'flex';
    document.getElementById('app-header').style.display = 'flex';
    
    // สลับไปยังหน้า POS อัตโนมัติ
    switchView('pos');
    showToast(`ยินดีต้อนรับคุณ ${data.name}`, 'success');
  } catch (err) {
    console.error('เกิดข้อผิดพลาดในการโหลดโปรไฟล์พนักงาน:', err);
    showToast('ไม่พบข้อมูลโปรไฟล์พนักงานในระบบ กรุณาสมัครสมาชิกใหม่', 'error');
    logoutStaff();
  }
}

// ฟังก์ชันเข้าสู่ระบบ
async function loginStaff() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  if (!email || !password) {
    showToast('กรุณากรอกอีเมลและรหัสผ่าน', 'error');
    return;
  }
  
  if (!supabase) {
    showToast('ยังไม่ได้ตั้งค่าเชื่อมต่อฐานข้อมูล Supabase', 'error');
    return;
  }
  
  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader"></i> กำลังตรวจสอบ...';
  lucide.createIcons();
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (error) throw error;
    
    await loadStaffProfile(data.user.id);
  } catch (err) {
    console.error('การล็อกอินล้มเหลว:', err);
    showToast(err.message || 'รหัสผ่านผิดพลาดหรือไม่พบผู้ใช้ในระบบ', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="log-in"></i> เข้าสู่ระบบ';
    lucide.createIcons();
  }
}

// ข้อมูลสมาชิกจำลองสำหรับโหมดผู้มาเยือน
let mockMembers = [
  { id: 'mock-1', name: 'สมชาย ใจดี', phone: '0812345678', points: 120 },
  { id: 'mock-2', name: 'สมหญิง รักดี', phone: '0898765432', points: 55 },
  { id: 'mock-3', name: 'วิชัย มีแต้ม', phone: '0923456789', points: 10 },
];

// เข้าใช้งานในฐานะผู้มาเยือน (Guest) — ไม่ต้องมีการเชื่อมต่อ DB
function loginAsGuest() {
  currentStaff = {
    id: 'guest',
    name: 'ผู้มาเยือน (Guest)',
    role: 'guest',
    isGuest: true
  };
  // Enable guest mode flag
  isGuestMode = true;

  // Update UI for guest
  document.getElementById('staff-name-display').textContent = currentStaff.name;
  document.getElementById('staff-role-display').textContent = 'ผู้มาเยือน (Guest)';
  document.getElementById('staff-avatar-char').textContent = 'G';

  // Hide non-POS nav items for guest
  document.querySelectorAll('.nav-menu .nav-item').forEach(item => {
    const view = item.getAttribute('data-view');
    item.parentElement.style.display = (view === 'pos') ? '' : 'none';
  });

  // Show sidebar & header
  document.getElementById('app-sidebar').style.display = 'flex';
  document.getElementById('app-header').style.display = 'flex';

  // Switch to POS view
  switchView('pos');
  showToast('ยินดีต้อนรับผู้มาเยือน — สามารถสั่งซื้อสินค้าได้ทันที (โหมดจำลอง)', 'success');
}


// สมัครบัญชีพนักงานรายใหม่
async function registerNewStaff() {
  const name = document.getElementById('reg-staff-name').value.trim();
  const email = document.getElementById('reg-staff-email').value.trim();
  const password = document.getElementById('reg-staff-password').value;
  const role = document.getElementById('reg-staff-role').value;

  if (!name || !email || !password) {
    showToast('กรุณากรอกข้อมูลพนักงานให้ครบทุกช่อง', 'error');
    return;
  }
  
  if (password.length < 6) {
    showToast('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร', 'error');
    return;
  }
  
  const btn = document.getElementById('btn-execute-register-staff');
  btn.disabled = true;
  btn.innerHTML = 'กำลังลงทะเบียน...';
  
  try {
    // 1. สมัครข้อมูลใน Auth ของ Supabase
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          name: name,
          role: role
        }
      }
    });
    
    if (error) throw error;
    
    showToast('ลงทะเบียนพนักงานสำเร็จ! กรุณาล็อกอินเข้าสู่ระบบ', 'success');
    closeModal('overlay-register-staff');
    
    // กรอกอีเมลให้อัตโนมัติในช่องล็อกอิน
    document.getElementById('login-email').value = email;
    document.getElementById('login-password').value = '';
  } catch (err) {
    console.error('การสมัครบัญชีพนักงานผิดพลาด:', err);
    showToast(err.message || 'เกิดข้อผิดพลาดในการสมัครบัญชีพนักงาน', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'สมัครสมาชิก';
  }
}

// ออกจากระบบ
async function logoutStaff() {
  if (supabase && !isGuestMode) {
    await supabase.auth.signOut();
  }
  currentStaff = null;
  isGuestMode = false; // reset guest mode flag
  // Restore nav items visibility
  document.querySelectorAll('.nav-menu .nav-item').forEach(item => {
    item.parentElement.style.display = '';
  });
  document.getElementById('app-sidebar').style.display = 'none';
  document.getElementById('app-header').style.display = 'none';
  switchView('login');
  showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
}

// ==========================================
// 4. การควบคุมเปลี่ยนหน้าจอแสดงผล (View Routing & Navigation)
// ==========================================
function switchView(viewName) {
  // บังคับเปลี่ยนหน้าจอ
  // บังคับเปลี่ยนหน้าจอ
  currentView = viewName;
  // Restricted navigation for guest mode: only POS allowed
  if (isGuestMode && viewName !== 'pos') {
    showToast('ผู้มาเยือนสามารถใช้ได้เฉพาะหน้าขายของเท่านั้น', 'warning');
    return;
  }
  
  // ซ่อนทุกหน้าจอและแสดงหน้าจอที่เลือก
  const views = document.querySelectorAll('.view');
  views.forEach(v => v.classList.remove('active'));
  
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.add('active');
  
  // อัปเดตรายการ Active ในเมนู Sidebar
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  // อัปเดตชื่อ View บน Header
  const titleMap = {
    'login': 'ลงชื่อเข้าใช้ระบบ POS',
    'pos': 'ขายหน้าร้าน (POS)',
    'dashboard': 'สถิติยอดขาย (Dashboard)',
    'catalog': 'จัดการสินค้า (Catalog)',
    'members': 'สมาชิกสะสมแต้ม'
  };
  document.getElementById('current-view-title').textContent = titleMap[viewName] || 'Cafe 67 POS';
  
  // เรียกฟังก์ชันโหลดข้อมูลเฉพาะของแต่ละมุมมอง
  if (viewName === 'pos') {
    loadPOSProducts();
  } else if (viewName === 'dashboard') {
    loadDashboardData();
  } else if (viewName === 'catalog') {
    loadCatalogProducts();
  } else if (viewName === 'members') {
    loadMembersData();
  }
}

// ==========================================
// 5. หน้าจอรายการสินค้าและการแสดงผล (POS Products Grid)
// ==========================================
let allProducts = []; // เก็บสำเนารายการสินค้าทั้งหมด

async function loadPOSProducts() {
  if (!supabase || isGuestMode) {
  // Use mock products for guest or offline mode
  allProducts = mockProducts;
  renderPOSGrid(allProducts);
  return;
}
  
  const grid = document.getElementById('pos-products-grid');
  grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-light);"><i data-lucide="loader" class="spin"></i> กำลังโหลดรายการสินค้า...</div>';
  lucide.createIcons();
  
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });
      
    if (error) throw error;
    
    allProducts = data;
    renderPOSGrid(allProducts);
  } catch (err) {
    console.error('โหลดข้อมูลสินค้าระขายล้มเหลว:', err);
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--danger);">เกิดข้อผิดพลาดในการโหลดสินค้า: ${err.message}</div>`;
  }
}

// แสดงผลสินค้าลงในหน้า POS
function renderPOSGrid(productsList, filterCategory = 'all', searchQuery = '') {
  const grid = document.getElementById('pos-products-grid');
  grid.innerHTML = '';
  
  // กรองหมวดหมู่และค้นหาคำ
  const filtered = productsList.filter(prod => {
    const matchesCategory = filterCategory === 'all' || prod.category === filterCategory;
    const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  
  if (filtered.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-light);">ไม่พบสินค้าที่ตรงกับการค้นหา</div>';
    return;
  }
  
  filtered.forEach(product => {
    const card = document.createElement('div');
    card.className = `product-card ${product.is_available ? '' : 'unavailable'}`;
    
    // ตั้งค่ารูปภาพสำรองหากไม่มี Link
    const imgUrl = product.image_url || 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80';
    const tagEmoji = product.category === 'coffee' ? '☕' : (product.category === 'bakery' ? '🥐' : '📦');
    
    card.innerHTML = `
      <div class="product-image-container">
        <img class="product-image" src="${imgUrl}" alt="${product.name}" loading="lazy">
        <span class="product-badge">${tagEmoji} ${product.category === 'coffee' ? 'กาแฟ/เครื่องดื่ม' : (product.category === 'bakery' ? 'เบเกอรี่' : 'อื่นๆ')}</span>
      </div>
      <div class="product-info">
        <div class="product-category">${product.category}</div>
        <div class="product-name" title="${product.name}">${product.name}</div>
        <div class="product-footer">
          <div class="product-price">฿${parseFloat(product.price).toFixed(2)}</div>
          <div class="product-points">+${product.points_value} แต้ม</div>
        </div>
      </div>
    `;
    
    // หากพร้อมจำหน่าย ให้สามารถคลิกเพื่อแอดเข้าตะกร้าได้
    if (product.is_available) {
      card.addEventListener('click', () => addToCart(product));
    }
    
    grid.appendChild(card);
  });
  
  lucide.createIcons();
}

// ค้นหาสินค้า
document.getElementById('pos-search').addEventListener('input', (e) => {
  const activeTab = document.querySelector('.category-tabs .tab-btn.active');
  const cat = activeTab ? activeTab.getAttribute('data-category') : 'all';
  renderPOSGrid(allProducts, cat, e.target.value);
});

// กรองประเภทสินค้าผ่านปุ่ม Tab
const tabBtns = document.querySelectorAll('.category-tabs .tab-btn');
tabBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const cat = btn.getAttribute('data-category');
    const searchVal = document.getElementById('pos-search').value;
    renderPOSGrid(allProducts, cat, searchVal);
  });
});

// ==========================================
// 6. ตรรกะระบบตะกร้าสั่งซื้อสินค้า (Shopping Cart Logic)
// ==========================================
function addToCart(product) {
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: parseFloat(product.price),
      points_value: product.points_value,
      quantity: 1
    });
  }
  
  updateCartUI();
  showToast(`เพิ่ม ${product.name} ลงในรายการแล้ว`, 'info');
}

function updateCartQty(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;
  
  item.quantity += delta;
  if (item.quantity <= 0) {
    cart = cart.filter(i => i.id !== productId);
  }
  updateCartUI();
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.id !== productId);
  updateCartUI();
}

function clearCart() {
  cart = [];
  selectedMember = null;
  pointsRedeemed = 0;
  paymentMethod = 'cash';
  
  // อัปเดต UI ชิ้นส่วนสมาชิก
  document.getElementById('pos-member-phone').value = '';
  document.getElementById('pos-member-info').style.display = 'none';
  document.getElementById('pos-member-redeem').style.display = 'none';
  
  // รีเซ็ตปุ่มวิธีจ่ายเงิน
  const methodBtns = document.querySelectorAll('.checkout-methods .method-btn');
  methodBtns.forEach(b => b.classList.remove('active'));
  document.querySelector('.checkout-methods .method-btn[data-method="cash"]').classList.add('active');
  
  updateCartUI();
}

// อัปเดตตะกร้าสินค้าในหน้า POS
function updateCartUI() {
  const cartList = document.getElementById('cart-items-list');
  const cartBadge = document.getElementById('cart-badge-count');
  
  // สรุปยอดเงิน
  let subtotal = 0;
  let totalPoints = 0;
  let totalItemsCount = 0;
  
  cartList.innerHTML = '';
  
  if (cart.length === 0) {
    cartList.innerHTML = `
      <div class="empty-cart-state">
        <i data-lucide="shopping-cart"></i>
        <p>ยังไม่มีสินค้าในตะกร้า<br><small>คลิกเลือกสินค้าจากเมนูฝั่งซ้ายเพื่อสั่งซื้อ</small></p>
      </div>
    `;
    cartBadge.textContent = '0';
    
    // ตั้งค่าสรุปยอดทั้งหมดเป็น 0
    document.getElementById('summary-subtotal').textContent = '0.00';
    document.getElementById('summary-discount').textContent = '0.00';
    document.getElementById('summary-total').textContent = '0.00';
    document.getElementById('row-points-earned').style.display = 'none';
    document.getElementById('btn-checkout-execute').disabled = true;
    
    lucide.createIcons();
    return;
  }
  
  cart.forEach(item => {
    const itemSubtotal = item.price * item.quantity;
    subtotal += itemSubtotal;
    totalPoints += item.points_value * item.quantity;
    totalItemsCount += item.quantity;
    
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div class="cart-item-info">
        <div class="cart-item-name" title="${item.name}">${item.name}</div>
        <div class="cart-item-price">฿${item.price.toFixed(2)}</div>
      </div>
      <div class="cart-item-actions">
        <button class="cart-qty-btn" onclick="window.updateCartQty('${item.id}', -1)">-</button>
        <span class="cart-qty-num">${item.quantity}</span>
        <button class="cart-qty-btn" onclick="window.updateCartQty('${item.id}', 1)">+</button>
      </div>
      <div class="cart-item-subtotal">฿${itemSubtotal.toFixed(2)}</div>
      <button class="btn-remove-item" onclick="window.removeFromCart('${item.id}')" title="ลบรายการ">
        <i data-lucide="x"></i>
      </button>
    `;
    cartList.appendChild(div);
  });
  
  // เซ็ตคะแนนสะสมที่ได้รับ
  pointsEarned = totalPoints;
  cartBadge.textContent = totalItemsCount;
  
  // คำนวณส่วนลดแลกแต้มสะสม
  // หากแลกแต้มมากกว่าราคาของตระกร้า ให้ปัดเศษลง
  let finalDiscount = pointsRedeemed;
  if (finalDiscount > subtotal) {
    finalDiscount = subtotal;
  }
  
  const grandTotal = subtotal - finalDiscount;
  
  // อัปเดตส่วนสรุปรายการเงินบน UI
  document.getElementById('summary-subtotal').textContent = subtotal.toFixed(2);
  document.getElementById('summary-discount').textContent = finalDiscount.toFixed(2);
  document.getElementById('summary-total').textContent = grandTotal.toFixed(2);
  
  if (selectedMember) {
    document.getElementById('row-points-earned').style.display = 'flex';
    document.getElementById('summary-points-earned').textContent = pointsEarned;
  } else {
    document.getElementById('row-points-earned').style.display = 'none';
  }
  
  // เปิดใช้ปุ่มชำระเงิน
  document.getElementById('btn-checkout-execute').disabled = false;
  
  lucide.createIcons();
}

// เปิดฟังก์ชันตะกร้าให้ใช้งานผ่าน HTML inline onclick
window.updateCartQty = updateCartQty;
window.removeFromCart = removeFromCart;

// ==========================================
// 7. ระบบสมาชิกและการสะสม/แลกคะแนนสะสม (Loyalty Points System)
// ==========================================

// ค้นหาข้อมูลสมาชิกด้วยเบอร์โทรศัพท์
async function searchPOSMember() {
  const phone = document.getElementById('pos-member-phone').value.trim();
  if (!phone) {
    showToast('กรุณากรอกเบอร์โทรศัพท์ของลูกค้า', 'error');
    return;
  }
  
  // โหมดผู้มาเยือน: ค้นหาจากข้อมูลจำลอง
  if (isGuestMode || !supabase) {
    const found = mockMembers.find(m => m.phone === phone);
    if (found) {
      selectedMember = found;
      pointsRedeemed = 0;
      document.getElementById('pos-member-name').textContent = `คุณ ${found.name}`;
      document.getElementById('pos-member-points').textContent = found.points;
      document.getElementById('pos-member-info').style.display = 'flex';
      renderRedeemWidget(found.points);
      updateCartUI();
      showToast('ค้นหาสมาชิก (จำลอง) สำเร็จ!', 'success');
    } else {
      showToast('ไม่พบรายชื่อลูกค้านี้ (โหมดจำลอง) — กดปุ่ม + เพื่อสมัครสมาชิก', 'warning');
      document.getElementById('pos-member-info').style.display = 'none';
      document.getElementById('pos-member-redeem').style.display = 'none';
      selectedMember = null;
      pointsRedeemed = 0;
      updateCartUI();
    }
    return;
  }
  
  try {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();
      
    if (error) throw error;
    
    if (data) {
      selectedMember = data;
      pointsRedeemed = 0; // ล้างแต้มที่เคยเลือกใช้ของลูกค้าคนเก่า
      
      // แสดงข้อมูลรายละเอียดสมาชิกบนจอขาย
      document.getElementById('pos-member-name').textContent = `คุณ ${data.name}`;
      document.getElementById('pos-member-points').textContent = data.points;
      document.getElementById('pos-member-info').style.display = 'flex';
      
      // แสดงส่วนลดให้เลือกตามแต้มสะสม
      renderRedeemWidget(data.points);
      
      updateCartUI();
      showToast('ค้นหาสมาชิกสะสมแต้มสำเร็จ!', 'success');
    } else {
      showToast('ไม่พบรายชื่อลูกค้านี้ในระบบ คุณสามารถกดสมัครใหม่ได้ทันที', 'warning');
      document.getElementById('pos-member-info').style.display = 'none';
      document.getElementById('pos-member-redeem').style.display = 'none';
      selectedMember = null;
      pointsRedeemed = 0;
      updateCartUI();
    }
  } catch (err) {
    console.error('เกิดข้อผิดพลาดในการค้นหาข้อมูลสมาชิก:', err);
    showToast('เกิดข้อผิดพลาดในการค้นหาข้อมูลสมาชิก', 'error');
  }
}

// แสดงส่วนตัวเลือกแลกแต้ม
function renderRedeemWidget(memberPoints) {
  const widget = document.getElementById('pos-member-redeem');
  widget.style.display = 'flex';
  
  const buttons = document.querySelectorAll('.redeem-options .redeem-btn');
  buttons.forEach(btn => {
    const pointsRequired = parseInt(btn.getAttribute('data-discount'));
    
    // ตั้งค่าเริ่มต้น
    btn.classList.remove('active');
    if (pointsRequired === 0) {
      btn.classList.add('active'); // เลือก "ไม่ใช้แต้ม" เป็นค่าเริ่มต้น
    }
    
    // หากแต้มของสมาชิกมีไม่ถึงแต้มที่ต้องใช้ ให้ปิดปุ่ม
    if (memberPoints < pointsRequired) {
      btn.disabled = true;
      btn.style.opacity = '0.4';
      btn.style.cursor = 'not-allowed';
    } else {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    }
  });
}

// ผูกตรรกะการคลิกปุ่มแลกแต้ม
const redeemBtns = document.querySelectorAll('.redeem-options .redeem-btn');
redeemBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    
    redeemBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    pointsRedeemed = parseInt(btn.getAttribute('data-discount'));
    updateCartUI();
  });
});

// บันทึกการลงทะเบียนข้อมูลสมาชิกใหม่
async function saveMemberFromModal() {
  const name = document.getElementById('modal-member-name').value.trim();
  const phone = document.getElementById('modal-member-phone').value.trim();
  
  if (!name || !phone) {
    showToast('กรุณากรอกชื่อและเบอร์โทรศัพท์ของลูกค้า', 'error');
    return;
  }
  
  // โหมดผู้มาเยือน: เพิ่มสมาชิกจำลองในหน่วยความจำ
  if (isGuestMode || !supabase) {
    const duplicate = mockMembers.find(m => m.phone === phone);
    if (duplicate) {
      showToast('เบอร์โทรศัพท์นี้สมัครสมาชิกไปแล้ว (โหมดจำลอง)', 'error');
      return;
    }
    const newMock = { id: `mock-${Date.now()}`, name, phone, points: 0 };
    mockMembers.push(newMock);
    selectedMember = newMock;
    showToast('สมัครสมาชิกรายใหม่สำเร็จ! (โหมดจำลอง)', 'success');
    closeModal('overlay-member-form');
    document.getElementById('pos-member-phone').value = phone;
    document.getElementById('pos-member-name').textContent = `คุณ ${name}`;
    document.getElementById('pos-member-points').textContent = '0';
    document.getElementById('pos-member-info').style.display = 'flex';
    document.getElementById('pos-member-redeem').style.display = 'none';
    updateCartUI();
    return;
  }
  
  try {
    const { data, error } = await supabase
      .from('members')
      .insert({ name, phone, points: 0 })
      .select()
      .single();
      
    if (error) {
      if (error.code === '23505') { // รหัส Error คีย์เบอร์โทรศัพท์ซ้ำ
        throw new Error('เบอร์โทรศัพท์นี้สมัครสมาชิกไปแล้ว');
      }
      throw error;
    }
    
    showToast('สมัครสมาชิกรายใหม่สำเร็จ!', 'success');
    closeModal('overlay-member-form');
    
    // ตั้งค่าเป็นสมาชิกคนปัจจุบันบนหน้า POS ทันที
    selectedMember = data;
    document.getElementById('pos-member-phone').value = data.phone;
    document.getElementById('pos-member-name').textContent = `คุณ ${data.name}`;
    document.getElementById('pos-member-points').textContent = '0';
    document.getElementById('pos-member-info').style.display = 'flex';
    document.getElementById('pos-member-redeem').style.display = 'none'; // ยังไม่มีแต้มให้แลก
    
    updateCartUI();
  } catch (err) {
    console.error('การลงทะเบียนสมาชิกล้มเหลว:', err);
    showToast(err.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก', 'error');
  }
}

// ==========================================
// 8. ขั้นตอนการชำระเงินและการจำลองคิวอาร์พร้อมเพย์ (Checkout Execution)
// ==========================================

// เริ่มกระบวนการชำระเงิน
async function startCheckoutProcess() {
  if (cart.length === 0) return;
  
  const subtotal = parseFloat(document.getElementById('summary-subtotal').textContent);
  const discount = parseFloat(document.getElementById('summary-discount').textContent);
  const total = subtotal - discount;
  
  if (paymentMethod === 'qr_code') {
    // แสดง QR Code PromptPay
    // ใช้ API Mock จาก promptpay.io เพื่อสร้างรูป QR Code ของจริงที่สแกนระบุยอดได้
    const mockPhoneNumber = '000-000-0000'; // เบอร์รับเงินสมมติ
    const qrCodeUrl = `https://promptpay.io/${mockPhoneNumber}/${total}.png`;
    
    document.getElementById('qr-code-image').src = qrCodeUrl;
    document.getElementById('qr-amount-value').textContent = total.toFixed(2);
    
    openModal('overlay-qr-payment');
  } else {
    // เงินสด หรือ บัตรเครดิต สามารถชำระเงินและบันทึกลง Supabase ได้ทันที
    await finalizeCheckout(total, discount);
  }
}

// จำลองชำระเงินสำเร็จสำหรับผู้มาเยือนกรณีไม่สามารถบันทึกฐานข้อมูลได้
function simulateGuestCheckoutSuccess() {
  showToast('ชำระเงินและจบรายการสั่งซื้อเรียบร้อยแล้ว! (โหมดจำลองการทำงาน)', 'success');
  closeModal('overlay-qr-payment');
  clearCart();
}

// สรุปยอดเงินและบันทึกออเดอร์ลงฐานข้อมูล
async function finalizeCheckout(grandTotal, discount = 0) {
  // โหมดผู้มาเยือน: จำลองการชำระเงินโดยไม่บันทึก DB
  if (isGuestMode || !supabase) {
    simulateGuestCheckoutSuccess();
    return;
  }
  
  let staffId = null;
  
  if (currentStaff && currentStaff.isGuest) {
    try {
      // ดึงไอดีของพนักงานจริงสักคนในฐานข้อมูลมาใช้งานเพื่อหลีกเลี่ยงการติด Foreign Key Constraints
      const { data: firstProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
      
      if (profileErr) throw profileErr;
      
      if (firstProfile && firstProfile.length > 0) {
        staffId = firstProfile[0].id;
      } else {
        showToast('ไม่พบข้อมูลพนักงานในระบบ (ระบบจะบันทึกแบบจำลองในเครื่องแทน)', 'warning');
        simulateGuestCheckoutSuccess();
        return;
      }
    } catch (err) {
      console.error('ไม่สามารถจำลองไอดีพนักงานได้:', err);
      showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ (ระบบจะบันทึกแบบจำลองในเครื่องแทน)', 'warning');
      simulateGuestCheckoutSuccess();
      return;
    }
  } else {
    // ดึง UUID พนักงานปัจจุบันจาก Supabase Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast('การเชื่อมต่อพนักงานหลุด กรุณาล็อกอินใหม่อีกครั้ง', 'error');
      switchView('login');
      return;
    }
    staffId = user.id;
  }
  
  const btn = document.getElementById('btn-checkout-execute');
  btn.disabled = true;
  btn.textContent = 'กำลังทำรายการ...';
  
  try {
    // 1. บันทึกออเดอร์ลงในตาราง orders
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        staff_id: staffId,
        member_id: selectedMember ? selectedMember.id : null,
        total_amount: grandTotal,
        discount: discount,
        points_earned: selectedMember ? pointsEarned : 0,
        points_redeemed: selectedMember ? pointsRedeemed : 0,
        payment_method: paymentMethod
      })
      .select()
      .single();
      
    if (orderErr) throw orderErr;
    
    // 2. บันทึกรายการสินค้าแต่ละตัวลงตาราง order_items
    const orderItemsToInsert = cart.map(item => ({
      order_id: order.id,
      product_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.price * item.quantity
    }));
    
    const { error: itemsErr } = await supabase
      .from('order_items')
      .insert(orderItemsToInsert);
      
    if (itemsErr) throw itemsErr;
    
    // 3. หากเป็นลูกค้าสมาชิก และมีการใช้แต้ม หรือ ได้แต้มเพิ่ม
    if (selectedMember) {
      const newPoints = selectedMember.points + pointsEarned - pointsRedeemed;
      const { error: memberErr } = await supabase
        .from('members')
        .update({ points: newPoints })
        .eq('id', selectedMember.id);
        
      if (memberErr) throw memberErr;
    }
    
    // จบการขายสำเร็จ
    showToast('ชำระเงินและจบรายการสั่งซื้อเรียบร้อยแล้ว!', 'success');
    closeModal('overlay-qr-payment');
    clearCart();
    
  } catch (err) {
    console.error('การบันทึกรายการขายล้มเหลว:', err);
    showToast(`ทำรายการชำระเงินไม่สำเร็จ: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="check-circle-2"></i> ชำระเงิน';
    lucide.createIcons();
  }
}

// ==========================================
// 9. ระบบแดชบอร์ดสรุปข้อมูลการขายและกราฟสถิติ (Sales Dashboard & Charts)
// ==========================================
async function loadDashboardData() {
  if (!supabase) return;
  
  try {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // 1. ดึงข้อมูลรายการออเดอร์ของวันนี้
    const { data: todayOrders, error: ordersErr } = await supabase
      .from('orders')
      .select('*, profiles(name)')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false });
      
    if (ordersErr) throw ordersErr;
    
    // สรุปยอด Metrics รายวัน
    let salesTotal = 0;
    let ordersCount = todayOrders.length;
    
    todayOrders.forEach(ord => {
      salesTotal += parseFloat(ord.total_amount);
    });
    
    document.getElementById('dash-today-sales').textContent = salesTotal.toFixed(2);
    document.getElementById('dash-today-orders').textContent = ordersCount;
    
    // 2. ดึงจำนวนสมาชิกใหม่วันนี้
    const { count: newMembersCount, error: memberErr } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());
      
    if (memberErr) throw memberErr;
    document.getElementById('dash-new-members').textContent = newMembersCount || 0;
    
    // 3. ดึงสินค้าและปริมาณการขายแยกประเภทในวันนี้
    const { data: orderItems, error: itemsErr } = await supabase
      .from('order_items')
      .select('*, products(category)')
      .gte('created_at', today.toISOString());
      
    if (itemsErr) throw itemsErr;
    
    let coffeeSales = 0;
    let bakerySales = 0;
    
    orderItems.forEach(item => {
      const category = item.products ? item.products.category : 'other';
      const subtotal = parseFloat(item.subtotal);
      if (category === 'coffee') {
        coffeeSales += subtotal;
      } else if (category === 'bakery') {
        bakerySales += subtotal;
      }
    });
    
    const totalCatSales = coffeeSales + bakerySales;
    let coffeePct = 0;
    let bakeryPct = 0;
    
    if (totalCatSales > 0) {
      coffeePct = Math.round((coffeeSales / totalCatSales) * 100);
      bakeryPct = 100 - coffeePct;
    }
    
    document.getElementById('dash-sales-ratio').textContent = `${coffeePct}% : ${bakeryPct}%`;
    
    // 4. แสดงตารางธุรกรรมล่าสุดวันนี้ในแดชบอร์ด
    renderRecentTransactionsTable(todayOrders);
    
    // 5. โหลดข้อมูลวาดกราฟเส้นยอดขาย 7 วันย้อนหลัง และกราฟยอดขายรายสินค้า
    await renderDashboardCharts();
    
  } catch (err) {
    console.error('การดึงข้อมูลสถิติล้มเหลว:', err);
    showToast('ไม่สามารถโหลดข้อมูลสถิติ แดชบอร์ดได้', 'error');
  }
}

// เรนเดอร์ตารางยอดธุรกรรมล่าสุด
function renderRecentTransactionsTable(ordersList) {
  const tbody = document.getElementById('dash-transactions-body');
  tbody.innerHTML = '';
  
  if (ordersList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-light);">ไม่มีข้อมูลยอดขายวันนี้</td></tr>`;
    return;
  }
  
  ordersList.forEach(ord => {
    const tr = document.createElement('tr');
    
    const time = new Date(ord.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const orderNum = ord.id.substring(0, 8).toUpperCase();
    const paymentLabel = ord.payment_method === 'cash' ? 'เงินสด' : (ord.payment_method === 'qr_code' ? 'QR Code' : 'บัตรเครดิต');
    
    tr.innerHTML = `
      <td>${time} น.</td>
      <td><strong>#${orderNum}</strong></td>
      <td>${ord.member_id ? 'ลูกค้าสมาชิก' : 'ลูกค้าทั่วไป (Walk-in)'}</td>
      <td style="font-weight:700;">฿${parseFloat(ord.total_amount).toFixed(2)}</td>
      <td style="color:var(--danger)">-฿${parseFloat(ord.discount).toFixed(2)}</td>
      <td><span class="badge-payment ${ord.payment_method}">${paymentLabel}</span></td>
      <td>
        ${ord.points_earned > 0 ? `<span style="color:var(--accent-text)">+${ord.points_earned}</span>` : ''}
        ${ord.points_redeemed > 0 ? ` <span style="color:var(--danger)">-${ord.points_redeemed}</span>` : ''}
        ${ord.points_earned === 0 && ord.points_redeemed === 0 ? '-' : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ดึงสถิติยอดขาย 7 วันล่าสุดและวาดกราฟ
async function renderDashboardCharts() {
  const chartSales = document.getElementById('salesTrendChart');
  const chartCat = document.getElementById('categoryChart');
  
  if (!chartSales || !chartCat) return;
  
  try {
    const last7Days = [];
    const dateLabels = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0,0,0,0);
      last7Days.push(d);
      dateLabels.push(d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }));
    }
    
    // ดึงประวัติคำสั่งซื้อทั้งหมดใน 7 วันล่าสุด
    const startDate = last7Days[0];
    const { data: weeklyOrders, error } = await supabase
      .from('orders')
      .select('total_amount, created_at')
      .gte('created_at', startDate.toISOString());
      
    if (error) throw error;
    
    // สรุปค่ารายวันลงใน Array
    const dailySalesAmounts = Array(7).fill(0);
    
    weeklyOrders.forEach(ord => {
      const ordDate = new Date(ord.created_at);
      ordDate.setHours(0,0,0,0);
      
      const idx = last7Days.findIndex(d => d.getTime() === ordDate.getTime());
      if (idx !== -1) {
        dailySalesAmounts[idx] += parseFloat(ord.total_amount);
      }
    });
    
    // ดึงประเภทสินค้าที่ขายไปใน 7 วันล่าสุด
    const { data: weeklyItems, error: itemErr } = await supabase
      .from('order_items')
      .select('subtotal, products(category)')
      .gte('created_at', startDate.toISOString());
      
    if (itemErr) throw itemErr;
    
    let coffeeTotal = 0;
    let bakeryTotal = 0;
    let otherTotal = 0;
    
    weeklyItems.forEach(item => {
      const cat = item.products ? item.products.category : 'other';
      const amt = parseFloat(item.subtotal);
      if (cat === 'coffee') coffeeTotal += amt;
      else if (cat === 'bakery') bakeryTotal += amt;
      else otherTotal += amt;
    });
    
    // ----------------------------------------------------
    // วาดกราฟที่ 1: กราฟเส้นแนวโน้มยอดขายรายวัน
    // ----------------------------------------------------
    if (salesTrendChartInstance) salesTrendChartInstance.destroy();
    
    salesTrendChartInstance = new Chart(chartSales, {
      type: 'line',
      data: {
        labels: dateLabels,
        datasets: [{
          label: 'ยอดขายรายวัน (บาท)',
          data: dailySalesAmounts,
          borderColor: '#8D6E63',
          backgroundColor: 'rgba(141, 110, 99, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#5D4037',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(141, 110, 99, 0.05)' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
    
    // ----------------------------------------------------
    // วาดกราฟที่ 2: กราฟวงกลมแยกหมวดหมู่
    // ----------------------------------------------------
    if (categoryChartInstance) categoryChartInstance.destroy();
    
    categoryChartInstance = new Chart(chartCat, {
      type: 'doughnut',
      data: {
        labels: ['เครื่องดื่ม (Coffee)', 'เบเกอรี่ (Bakery)', 'อื่นๆ (Other)'],
        datasets: [{
          data: [coffeeTotal, bakeryTotal, otherTotal],
          backgroundColor: ['#8D6E63', '#E8F5E9', '#D7CCC8'],
          borderColor: ['#FFFFFF', '#FFFFFF', '#FFFFFF'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { family: 'Sarabun', size: 11 } }
          }
        },
        cutout: '65%'
      }
    });
    
  } catch (err) {
    console.error('การวาดกราฟสถิติขัดข้อง:', err);
  }
}

// ==========================================
// 10. ระบบจัดการรายการและคลังสินค้า (Catalog & Inventory Management)
// ==========================================
async function loadCatalogProducts() {
  if (!supabase) return;
  
  const tbody = document.getElementById('catalog-table-body');
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-light);">กำลังดึงสินค้า...</td></tr>`;
  
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });
      
    if (error) throw error;
    
    tbody.innerHTML = '';
    
    if (products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-light);">ไม่มีสินค้าในคลังข้อมูล</td></tr>`;
      return;
    }
    
    products.forEach(p => {
      const tr = document.createElement('tr');
      const mockImg = p.image_url || 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80';
      const catLabel = p.category === 'coffee' ? '☕ เครื่องดื่ม' : (p.category === 'bakery' ? '🥐 เบเกอรี่' : '📦 อื่นๆ');
      
      tr.innerHTML = `
        <td><img src="${mockImg}" class="catalog-img-preview" alt="product"></td>
        <td><strong>${p.name}</strong></td>
        <td>${catLabel}</td>
        <td>฿${parseFloat(p.price).toFixed(2)}</td>
        <td>${p.points_value} แต้ม</td>
        <td>
          <span style="color: ${p.is_available ? 'var(--success)' : 'var(--danger)'}; font-weight:600;">
            ● ${p.is_available ? 'พร้อมขาย' : 'ปิดจำหน่าย'}
          </span>
        </td>
        <td>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary" style="padding:6px 10px; font-size:11px;" onclick="window.editCatalogProduct('${p.id}')">
              <i data-lucide="edit" style="width:12px;height:12px;"></i> แก้ไข
            </button>
            <button class="btn btn-danger-light" style="padding:6px 10px; font-size:11px;" onclick="window.deleteCatalogProduct('${p.id}')">
              <i data-lucide="trash" style="width:12px;height:12px;"></i> ลบ
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    lucide.createIcons();
  } catch (err) {
    console.error('การโหลดคลังสินค้าล้มเหลว:', err);
    showToast('เกิดข้อผิดพลาดในการโหลดสินค้าในหน้าคลังสินค้า', 'error');
  }
}

// ปิด/เปิดโหมดแก้ไข และกรอกข้อมูลฟอร์ม
async function editCatalogProduct(id) {
  if (!supabase) return;
  
  try {
    const { data: p, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) throw error;
    
    // เอาข้อมูลมาใส่ในฟอร์มขวา
    document.getElementById('cat-product-id').value = p.id;
    document.getElementById('cat-product-name').value = p.name;
    document.getElementById('cat-product-price').value = p.price;
    document.getElementById('cat-product-points').value = p.points_value;
    document.getElementById('cat-product-category').value = p.category;
    document.getElementById('cat-product-image').value = p.image_url || '';
    document.getElementById('cat-product-available').checked = p.is_available;
    
    // ปรับแต่ง UI หัวฟอร์ม
    document.getElementById('catalog-form-title').textContent = 'แก้ไขข้อมูลสินค้า';
    document.getElementById('catalog-form-title-icon').setAttribute('data-lucide', 'edit-3');
    document.getElementById('btn-catalog-form-reset').style.display = 'block';
    
    lucide.createIcons();
    
  } catch (err) {
    console.error('โหลดข้อมูลรายละเอียดสินค้าล้มเหลว:', err);
    showToast('ไม่สามารถดึงข้อมูลสินค้าได้', 'error');
  }
}

// ลบสินค้าออก
async function deleteCatalogProduct(id) {
  if (!confirm('คุณแน่ใจว่าต้องการลบรายการสินค้านี้ออกอย่างถาวรใช่หรือไม่?')) return;
  if (!supabase) return;
  
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
    
    showToast('ลบสินค้าออกจากระบบสำเร็จ', 'success');
    resetCatalogForm();
    loadCatalogProducts();
  } catch (err) {
    console.error('ลบข้อมูลสินค้าผิดพลาด:', err);
    showToast('ไม่สามารถลบสินค้าได้: ' + err.message, 'error');
  }
}

// เคลียร์ค่าในฟอร์มคลังสินค้า
function resetCatalogForm() {
  document.getElementById('cat-product-id').value = '';
  document.getElementById('catalog-product-form').reset();
  
  document.getElementById('catalog-form-title').textContent = 'เพิ่มสินค้าใหม่';
  document.getElementById('catalog-form-title-icon').setAttribute('data-lucide', 'plus-circle');
  document.getElementById('btn-catalog-form-reset').style.display = 'none';
  
  lucide.createIcons();
}

// บันทึกฟอร์มสินค้า (เพิ่ม/แก้ไข)
async function submitProductForm(e) {
  e.preventDefault();
  if (!supabase) return;
  
  const id = document.getElementById('cat-product-id').value;
  const name = document.getElementById('cat-product-name').value.trim();
  const price = parseFloat(document.getElementById('cat-product-price').value);
  const points = parseInt(document.getElementById('cat-product-points').value);
  const category = document.getElementById('cat-product-category').value;
  const imageUrl = document.getElementById('cat-product-image').value.trim();
  const isAvailable = document.getElementById('cat-product-available').checked;
  
  const productData = {
    name: name,
    price: price,
    points_value: points,
    category: category,
    image_url: imageUrl || null,
    is_available: isAvailable
  };
  
  try {
    if (id) {
      // แก้ไขรายการสินค้าเดิม
      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', id);
        
      if (error) throw error;
      showToast('ปรับปรุงข้อมูลสินค้าสำเร็จ', 'success');
    } else {
      // สร้างสินค้าชิ้นใหม่
      const { error } = await supabase
        .from('products')
        .insert(productData);
        
      if (error) throw error;
      showToast('เพิ่มสินค้าชิ้นใหม่สำเร็จ', 'success');
    }
    
    resetCatalogForm();
    loadCatalogProducts();
  } catch (err) {
    console.error('บันทึกข้อมูลสินค้าผิดพลาด:', err);
    showToast('ไม่สามารถบันทึกข้อมูลสินค้าได้: ' + err.message, 'error');
  }
}

window.editCatalogProduct = editCatalogProduct;
window.deleteCatalogProduct = deleteCatalogProduct;

// ==========================================
// 11. ระบบจัดการฐานข้อมูลสมาชิกสะสมแต้ม (Member Database Management)
// ==========================================
async function loadMembersData(searchVal = '') {
  if (!supabase) return;
  
  const tbody = document.getElementById('members-table-body');
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-light);">กำลังโหลดข้อมูลสมาชิก...</td></tr>`;
  
  try {
    let query = supabase
      .from('members')
      .select('*')
      .order('name', { ascending: true });
      
    if (searchVal) {
      // ค้นหาผ่านชื่อหรือเบอร์โทรศัพท์ (ใช้ ILIKE คล้ายๆ Like %val% ใน SQL)
      query = query.or(`name.ilike.%${searchVal}%,phone.ilike.%${searchVal}%`);
    }
    
    const { data: members, error } = await query;
    if (error) throw error;
    
    tbody.innerHTML = '';
    
    if (members.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-light);">ไม่พบข้อมูลสมาชิกในระบบ</td></tr>`;
      return;
    }
    
    members.forEach(member => {
      const regDate = new Date(member.created_at).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${member.name}</strong></td>
        <td>${member.phone}</td>
        <td>
          <span class="member-points-display" style="font-size:12px;">
            ${member.points} แต้ม
          </span>
        </td>
        <td>${regDate}</td>
        <td>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary" style="padding:6px 10px; font-size:11px;" onclick="window.editMemberInfo('${member.id}')">
              <i data-lucide="edit-3" style="width:12px;height:12px;"></i> แก้ไข
            </button>
            <button class="btn btn-danger-light" style="padding:6px 10px; font-size:11px;" onclick="window.deleteMember('${member.id}')">
              <i data-lucide="trash-2" style="width:12px;height:12px;"></i> ลบ
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    lucide.createIcons();
  } catch (err) {
    console.error('ดาวน์โหลดรายชื่อสมาชิกสะสมแต้มผิดพลาด:', err);
    showToast('ไม่สามารถดึงรายชื่อสมาชิกสะสมแต้มได้', 'error');
  }
}

// แก้ไขข้อมูลสมาชิก
async function editMemberInfo(id) {
  if (!supabase) return;
  
  try {
    const { data: m, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) throw error;
    
    document.getElementById('modal-member-id').value = m.id;
    document.getElementById('modal-member-name').value = m.name;
    document.getElementById('modal-member-phone').value = m.phone;
    
    document.getElementById('member-modal-title').textContent = 'แก้ไขข้อมูลสมาชิก';
    openModal('overlay-member-form');
  } catch (err) {
    console.error('เปิดฟอร์มแก้ไขสมาชิกขัดข้อง:', err);
    showToast('ดึงข้อมูลสมาชิกล้มเหลว', 'error');
  }
}

// ลบสมาชิก
async function deleteMember(id) {
  if (!confirm('คุณต้องการลบสมาชิกรวมถึงประวัติคะแนนสะสมทั้งหมดใช่หรือไม่? (การกระทำนี้ไม่สามารถย้อนกลับได้)')) return;
  if (!supabase) return;
  
  try {
    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
    
    showToast('ลบสมาชิกออกจากระบบสำเร็จ', 'success');
    loadMembersData();
  } catch (err) {
    console.error('ลบข้อมูลสมาชิกสะสมแต้มขัดข้อง:', err);
    showToast('ไม่สามารถลบข้อมูลสมาชิกได้: ' + err.message, 'error');
  }
}

// จัดเก็บข้อมูลสมาชิกจาก Modal แถบสมาชิกโดยตรง
async function submitMemberFormFromModal() {
  const id = document.getElementById('modal-member-id').value;
  const name = document.getElementById('modal-member-name').value.trim();
  const phone = document.getElementById('modal-member-phone').value.trim();
  
  if (!name || !phone) {
    showToast('กรุณากรอกข้อมูลสมาชิกให้ครบ', 'error');
    return;
  }
  
  try {
    if (id) {
      // อัปเดตข้อมูลสมาชิก
      const { error } = await supabase
        .from('members')
        .update({ name, phone })
        .eq('id', id);
        
      if (error) throw error;
      showToast('ปรับปรุงข้อมูลสมาชิกสำเร็จ', 'success');
    } else {
      // สร้างใหม่
      const { error } = await supabase
        .from('members')
        .insert({ name, phone, points: 0 });
        
      if (error) {
        if (error.code === '23505') throw new Error('เบอร์โทรศัพท์นี้สมัครสมาชิกไปแล้ว');
        throw error;
      }
      showToast('ลงทะเบียนสมาชิกสำเร็จ', 'success');
    }
    
    closeModal('overlay-member-form');
    loadMembersData();
  } catch (err) {
    console.error('บันทึกฟอร์มสมาชิกล้มเหลว:', err);
    showToast(err.message || 'บันทึกข้อมูลสมาชิกล้มเหลว', 'error');
  }
}

window.editMemberInfo = editMemberInfo;
window.deleteMember = deleteMember;

// ==========================================
// 12. การควบคุมหน้าต่างกล่องเตือนและ Modal (General UI & Modal Control)
// ==========================================

// ค้นหาและบันทึกข้อมูล Supabase
async function saveSupabaseConfigAction() {
  const url = document.getElementById('config-sb-url').value.trim();
  const key = document.getElementById('config-sb-key').value.trim();
  
  if (!url || !key) {
    showToast('กรุณากรอกข้อมูลให้ครบทั้ง Project URL และ API Key', 'error');
    return;
  }
  
  saveSupabaseConfig(url, key);
  supabaseUrl = url;
  supabaseKey = key;
  reinitializeSupabase();
  
  closeModal('overlay-db-config');
  showToast('บันทึกการตั้งค่าแล้ว กำลังเริ่มระบบใหม่...', 'info');
  
  await checkSupabaseConnection();
  
  // โหลดหน้าใหม่หากเชื่อมต่อสำเร็จ
  if (supabase) {
    if (currentStaff) {
      switchView(currentView);
    } else {
      switchView('login');
    }
  }
}

// ทดสอบความเสถียรฐานข้อมูลก่อนบันทึก
async function testDbConnectionAction() {
  const url = document.getElementById('config-sb-url').value.trim();
  const key = document.getElementById('config-sb-key').value.trim();
  
  if (!url || !key) {
    showToast('กรุณากรอกข้อมูลทดสอบ', 'error');
    return;
  }
  
  try {
    const testClient = window.supabase.createClient(url, key);
    const { error } = await testClient.from('products').select('id').limit(1);
    if (error) throw error;
    showToast('ทดสอบเชื่อมต่อฐานข้อมูลสำเร็จ! ตาราง POS พร้อมใช้งาน', 'success');
  } catch (err) {
    showToast('ทดสอบล้มเหลว ตรวจสอบคีย์หรือการรันไฟล์ SQL schema.sql บน Supabase', 'error');
  }
}

// เปิดการทำงาน Modal
function openModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (overlay) {
    overlay.classList.add('active');
  }
}

// ปิดการทำงาน Modal
function closeModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (overlay) {
    overlay.classList.remove('active');
  }
}

// ระบบ Toast Notification กลางตัวเดียว
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast-notification');
  const msgEl = document.getElementById('toast-message');
  const iconEl = document.getElementById('toast-icon');
  
  // เคลียร์คลาสก่อนหน้า
  toast.className = 'toast';
  toast.classList.add(type);
  msgEl.textContent = message;
  
  // ตั้งค่าไอคอนสำหรับแจ้งเตือน
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  else if (type === 'error') iconName = 'alert-triangle';
  else if (type === 'warning') iconName = 'alert-circle';
  
  iconEl.setAttribute('data-lucide', iconName);
  lucide.createIcons();
  
  // แสดงผล
  toast.classList.add('active');
  
  // ซ่อนอัตโนมัติใน 3.5 วินาที
  setTimeout(() => {
    toast.classList.remove('active');
  }, 3500);
}

// ==========================================
// 13. การเชื่อมโยงเหตุการณ์ปุ่มและฟอร์มต่างๆ (Bind DOM Event Listeners)
// ==========================================
function bindEvents() {
  // เมนูด้านข้าง (Navigation)
  const navItems = document.querySelectorAll('.nav-menu .nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.getAttribute('data-view');
      switchView(targetView);
    });
  });

  // การคลิกจัดการป้ายแจ้งข้อมูลเชื่อมต่อ Supabase
  document.getElementById('btn-open-db-config').addEventListener('click', () => {
    const { url, key } = getSupabaseConfig();
    document.getElementById('config-sb-url').value = url;
    document.getElementById('config-sb-key').value = key;
    openModal('overlay-db-config');
  });
  
  document.getElementById('btn-settings-toggle').addEventListener('click', () => {
    const { url, key } = getSupabaseConfig();
    document.getElementById('config-sb-url').value = url;
    document.getElementById('config-sb-key').value = key;
    openModal('overlay-db-config');
  });

  document.getElementById('btn-close-db-config').addEventListener('click', () => closeModal('overlay-db-config'));
  document.getElementById('btn-save-db-config').addEventListener('click', saveSupabaseConfigAction);
  document.getElementById('btn-test-db-connection').addEventListener('click', testDbConnectionAction);

  // เหตุการณ์ของ Login & Auth
  document.getElementById('btn-login').addEventListener('click', loginStaff);
  document.getElementById('btn-login-guest').addEventListener('click', loginAsGuest);
  
  // ให้สามารถกด Enter เพื่อล็อกอินได้
  document.getElementById('login-password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginStaff();
  });
  
  document.getElementById('btn-logout-action').addEventListener('click', logoutStaff);
  
  // Modal พนักงานใหม่
  document.getElementById('btn-register-staff-modal').addEventListener('click', () => {
    document.getElementById('reg-staff-name').value = '';
    document.getElementById('reg-staff-email').value = '';
    document.getElementById('reg-staff-password').value = '';
    openModal('overlay-register-staff');
  });
  document.getElementById('btn-close-register-staff').addEventListener('click', () => closeModal('overlay-register-staff'));
  document.getElementById('btn-cancel-register-staff').addEventListener('click', () => closeModal('overlay-register-staff'));
  document.getElementById('btn-execute-register-staff').addEventListener('click', registerNewStaff);

  // เหตุการณ์ภายในหน้า POS (ค้นหาและตะกร้า)
  document.getElementById('btn-clear-cart').addEventListener('click', () => {
    if (confirm('คุณต้องการนำสินค้าทุกอย่างออกจากตะกร้าสั่งซื้อใช่หรือไม่?')) clearCart();
  });

  // ระบบค้นหาสมาชิกสะสมแต้มหน้าร้าน
  document.getElementById('btn-pos-member-search').addEventListener('click', searchPOSMember);
  
  // สมัครสมาชิกทางลัดจากหน้าขาย
  document.getElementById('btn-pos-member-add').addEventListener('click', () => {
    document.getElementById('modal-member-id').value = '';
    document.getElementById('modal-member-name').value = '';
    document.getElementById('modal-member-phone').value = document.getElementById('pos-member-phone').value;
    document.getElementById('member-modal-title').textContent = 'สมัครสมาชิกใหม่';
    openModal('overlay-member-form');
  });

  // ให้สามารถกด Enter เพื่อค้นหาสมาชิกได้
  document.getElementById('pos-member-phone').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchPOSMember();
  });

  // หน้าต่างสมัคร/แก้ไข ข้อมูลสมาชิก
  document.getElementById('btn-close-member-modal').addEventListener('click', () => closeModal('overlay-member-form'));
  document.getElementById('btn-cancel-member-modal').addEventListener('click', () => closeModal('overlay-member-form'));
  document.getElementById('btn-save-member').addEventListener('click', () => {
    const id = document.getElementById('modal-member-id').value;
    if (currentView === 'members') {
      submitMemberFormFromModal();
    } else {
      saveMemberFromModal();
    }
  });

  // ปุ่มกดสมัครสมาชิกในหน้าจัดการรายชื่อสมาชิก
  document.getElementById('btn-add-member-top').addEventListener('click', () => {
    document.getElementById('modal-member-id').value = '';
    document.getElementById('modal-member-name').value = '';
    document.getElementById('modal-member-phone').value = '';
    document.getElementById('member-modal-title').textContent = 'สมัครสมาชิกใหม่';
    openModal('overlay-member-form');
  });

  // ค้นหาข้อมูลสมาชิกในหน้ารวมสมาชิก
  document.getElementById('member-search-input').addEventListener('input', (e) => {
    loadMembersData(e.target.value);
  });

  // วิธีชำระเงิน (คลิกเลือกประเภท)
  const methodBtns = document.querySelectorAll('.checkout-methods .method-btn');
  methodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      methodBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      paymentMethod = btn.getAttribute('data-method');
      updateCartUI();
    });
  });

  // ปุ่มชำระเงิน Execute
  document.getElementById('btn-checkout-execute').addEventListener('click', startCheckoutProcess);

  // ปุ่มจำลองการทำงาน QR Code PromptPay
  document.getElementById('btn-close-qr-modal').addEventListener('click', () => closeModal('overlay-qr-payment'));
  document.getElementById('btn-cancel-qr-payment').addEventListener('click', () => closeModal('overlay-qr-payment'));
  
  document.getElementById('btn-simulate-qr-success').addEventListener('click', () => {
    const subtotal = parseFloat(document.getElementById('summary-subtotal').textContent);
    const discount = parseFloat(document.getElementById('summary-discount').textContent);
    const total = subtotal - discount;
    finalizeCheckout(total, discount);
  });

  // หน้าจัดการคลังสินค้า (Catalog)
  document.getElementById('catalog-product-form').addEventListener('submit', submitProductForm);
  document.getElementById('btn-catalog-form-reset').addEventListener('click', resetCatalogForm);
  document.getElementById('btn-catalog-refresh').addEventListener('click', loadCatalogProducts);
}
})();
