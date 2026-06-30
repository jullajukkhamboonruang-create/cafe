// db.js
// โมดูลการจัดการเชื่อมต่อฐานข้อมูล Supabase แบบพกพา

// ดึงคีย์เชื่อมต่อที่บันทึกอยู่ในเครื่องคอมพิวเตอร์ผ่านเบราว์เซอร์ (LocalStorage)
export function getSupabaseConfig() {
  const url = localStorage.getItem('cafe_pos_supabase_url') || '';
  const key = localStorage.getItem('cafe_pos_supabase_key') || '';
  return { url, key };
}

// บันทึกคีย์เชื่อมต่อใหม่ลงใน LocalStorage
export function saveSupabaseConfig(url, key) {
  localStorage.setItem('cafe_pos_supabase_url', url.trim());
  localStorage.setItem('cafe_pos_supabase_key', key.trim());
}

// ล้างการเชื่อมต่อ (กรณีต้องการแก้ไขหรือเปลี่ยนฐานข้อมูล)
export function clearSupabaseConfig() {
  localStorage.removeItem('cafe_pos_supabase_url');
  localStorage.removeItem('cafe_pos_supabase_key');
}

// อินสแตนซ์หลักสำหรับคุยกับ Supabase
let supabaseInstance = null;

export function getSupabaseClient() {
  if (supabaseInstance) return supabaseInstance;

  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    return null; // ยังไม่ได้เซ็ตคีย์ จะมี Modal ขึ้นมาถามใน UI
  }

  try {
    // เช็กว่าโหลดสคริปต์ของ Supabase จาก CDN ใน index.html สำเร็จหรือไม่
    if (typeof supabase === 'undefined') {
      console.error('Supabase CDN ยังโหลดไม่เสร็จหรือล้มเหลว');
      return null;
    }
    // สร้างการเชื่อมต่อ Supabase Client
    supabaseInstance = supabase.createClient(url, key);
    return supabaseInstance;
  } catch (error) {
    console.error('ไม่สามารถเชื่อมต่อ Supabase client ได้:', error);
    return null;
  }
}

// ฟังก์ชันบังคับรีบูตการเชื่อมต่อ Supabase
export function reinitializeSupabase() {
  supabaseInstance = null;
  return getSupabaseClient();
}
