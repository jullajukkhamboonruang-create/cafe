-- สคริปต์ SQL สำหรับสร้างโครงสร้างฐานข้อมูลร้านกาแฟ (Cafe POS) บน Supabase
-- วิธีใช้งาน: คัดลอกคำสั่งทั้งหมดนี้ไปวางและรันในเมนู SQL Editor ของโครงการ Supabase ของคุณ

-- 1. ล้างตารางเดิม (ในกรณีที่ต้องการเริ่มต้นสร้างตารางใหม่เพื่อทดสอบระบบ)
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS profiles;

-- 2. สร้างตารางข้อมูลพนักงาน (Profiles) - เก็บข้อมูลขยายเพิ่มเติมที่ผูกกับตารางผู้ใช้ของ Supabase Auth
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. สร้างตารางข้อมูลสินค้าในร้าน (Products) - ทั้งเครื่องดื่ม กาแฟ และเบเกอรี่
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  category TEXT NOT NULL CHECK (category IN ('coffee', 'bakery', 'other')),
  image_url TEXT,
  is_available BOOLEAN DEFAULT TRUE NOT NULL,
  points_value INTEGER DEFAULT 1 NOT NULL, -- จำนวนแต้มสะสมที่จะได้รับเมื่อซื้อสินค้าชิ้นนี้ 1 ชิ้น
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. สร้างตารางข้อมูลสมาชิกสะสมแต้ม (Members) - ลูกค้าของร้านคาเฟ่
CREATE TABLE members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  points INTEGER DEFAULT 0 CHECK (points >= 0) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. สร้างตารางประวัติการสั่งซื้อ (Orders) - ยอดขายและรายการชำระเงินของแต่ละบิล
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES auth.users NOT NULL, -- ลิงก์ไปยังไอดีผู้ใช้ในระบบล็อกอิน Supabase Auth
  member_id UUID REFERENCES members(id), -- เป็นค่าว่างเปล่า (NULL) ได้ในกรณีที่ลูกค้าไม่ใช่สมาชิก
  total_amount NUMERIC(10, 2) NOT NULL,
  discount NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
  points_earned INTEGER DEFAULT 0 NOT NULL,
  points_redeemed INTEGER DEFAULT 0 NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash', 'qr_code', 'card')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. สร้างตารางสินค้าในแต่ละออเดอร์ (Order Items) - รายละเอียดสินค้าที่ขายในบิลนั้นๆ
CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL,
  subtotal NUMERIC(10, 2) NOT NULL
);

-- 7. สร้างฟังก์ชันการบันทึกข้อมูลพนักงานเข้าสู่ตาราง profiles อัตโนมัติเมื่อมีการสมัครสมาชิกผ่าน Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'พนักงานทั่วไป'),
    COALESCE(new.raw_user_meta_data->>'role', 'staff')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- สร้างตัวทริกเกอร์สำหรับตรวจจับเหตุการณ์สมัครสมาชิกพนักงานใหม่
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. ปิดระบบความปลอดภัยระดับแถว (Row Level Security - RLS) เพื่อความสะดวกในการสร้างแอปพลิเคชันต้นแบบ
-- หมายเหตุ: สำหรับการใช้งานจริง ควรตั้งค่าเขียน Policy ควบคุมสิทธิ์การอ่าน/เขียน เพื่อความปลอดภัยทางข้อมูล
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE members DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;

-- 9. เพิ่มรายการข้อมูลสินค้าตัวอย่างเริ่มต้น
-- ☕ กาแฟ / เครื่องดื่ม
INSERT INTO products (name, price, category, points_value, is_available, image_url) VALUES
('Espresso (ร้อน)',    50.00, 'coffee', 1, TRUE,
  'https://images.unsplash.com/photo-1510707577719-0d7fe5b3940a?w=400&q=80'),
('Iced Americano',     60.00, 'coffee', 1, TRUE,
  'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=400&q=80'),
('Iced Latte',         65.00, 'coffee', 1, TRUE,
  'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400&q=80'),
('Iced Cappuccino',    65.00, 'coffee', 1, TRUE,
  'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&q=80'),
('Matcha Latte เย็น', 70.00, 'coffee', 1, TRUE,
  'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=400&q=80'),
('Hot Latte',          65.00, 'coffee', 1, TRUE,
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80'),
('Cold Brew',          75.00, 'coffee', 1, TRUE,
  'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&q=80'),
('Caramel Macchiato',  80.00, 'coffee', 1, TRUE,
  'https://images.unsplash.com/photo-1485808191679-5f86510bd3e4?w=400&q=80'),
-- 🥐 เบเกอรี่ / เค้ก
('Butter Croissant',      85.00, 'bakery', 2, TRUE,
  'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80'),
('Chocolate Cake',        95.00, 'bakery', 2, TRUE,
  'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80'),
('Blueberry Cheesecake', 120.00, 'bakery', 2, TRUE,
  'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400&q=80'),
('Strawberry Waffle',    110.00, 'bakery', 2, TRUE,
  'https://images.unsplash.com/photo-1562376502-6f769499c886?w=400&q=80'),
('Chocolate Chip Cookie', 45.00, 'bakery', 1, TRUE,
  'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&q=80'),
('Banana Bread',          55.00, 'bakery', 1, TRUE,
  'https://images.unsplash.com/photo-1605190557-945a10c3cf84?w=400&q=80'),
('Cinnamon Roll',         75.00, 'bakery', 2, TRUE,
  'https://images.unsplash.com/photo-1509365390695-b5a8f4af5f75?w=400&q=80');

-- 10. เพิ่มข้อมูลลูกค้าสมาชิกสะสมแต้ม (ตรงกับ mockMembers ใน app.js)
INSERT INTO members (name, phone, points) VALUES
('สมชาย ใจดี',        '0812345678', 120),
('สมหญิง รักดี',      '0898765432',  55),
('วิชัย มีแต้ม',      '0923456789',  10),
('กิตติศักดิ์ มีสุข', '0855551234',   0),
('พิมพ์ใจ สุขสบาย',  '0867890123', 200),
('ธนพล รุ่งเรือง',    '0899001122',  35);

