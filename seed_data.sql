-- ======================================================
-- seed_data.sql  -  เพิ่มข้อมูลตัวอย่างสำหรับระบบ Cafe 67 POS
-- วิธีใช้: เปิด Supabase Dashboard -> SQL Editor -> วางและรันไฟล์นี้
-- ** ไม่ลบตาราง เพียงลบข้อมูลเก่าและใส่ใหม่ **
-- ======================================================

-- ล้างข้อมูลเดิมก่อน (เรียงจาก child ไป parent เพื่อหลีกเลี่ยง FK error)
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM members;
DELETE FROM products;

-- ======================================================
-- 1. สินค้า (Products)
-- ======================================================
INSERT INTO products (name, price, category, points_value, is_available, image_url) VALUES
('Espresso (ร้อน)',    50.00, 'coffee', 1, TRUE, 'https://images.unsplash.com/photo-1510707577719-0d7fe5b3940a?w=400&q=80'),
('Iced Americano',     60.00, 'coffee', 1, TRUE, 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=400&q=80'),
('Iced Latte',         65.00, 'coffee', 1, TRUE, 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400&q=80'),
('Iced Cappuccino',    65.00, 'coffee', 1, TRUE, 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&q=80'),
('Matcha Latte เย็น', 70.00, 'coffee', 1, TRUE, 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=400&q=80'),
('Hot Latte',          65.00, 'coffee', 1, TRUE, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80'),
('Cold Brew',          75.00, 'coffee', 1, TRUE, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&q=80'),
('Caramel Macchiato',  80.00, 'coffee', 1, TRUE, 'https://images.unsplash.com/photo-1485808191679-5f86510bd3e4?w=400&q=80'),
('Butter Croissant',      85.00, 'bakery', 2, TRUE, 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80'),
('Chocolate Cake',        95.00, 'bakery', 2, TRUE, 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80'),
('Blueberry Cheesecake', 120.00, 'bakery', 2, TRUE, 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400&q=80'),
('Strawberry Waffle',    110.00, 'bakery', 2, TRUE, 'https://images.unsplash.com/photo-1562376502-6f769499c886?w=400&q=80'),
('Chocolate Chip Cookie', 45.00, 'bakery', 1, TRUE, 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&q=80'),
('Banana Bread',          55.00, 'bakery', 1, TRUE, 'https://images.unsplash.com/photo-1605190557-945a10c3cf84?w=400&q=80'),
('Cinnamon Roll',         75.00, 'bakery', 2, TRUE, 'https://images.unsplash.com/photo-1509365390695-b5a8f4af5f75?w=400&q=80');

-- ======================================================
-- 2. สมาชิกสะสมแต้ม (Members)
-- ======================================================
INSERT INTO members (name, phone, points) VALUES
('สมชาย ใจดี',        '0812345678', 120),
('สมหญิง รักดี',      '0898765432',  55),
('วิชัย มีแต้ม',      '0923456789',  10),
('กิตติศักดิ์ มีสุข', '0855551234',   0),
('พิมพ์ใจ สุขสบาย',  '0867890123', 200),
('ธนพล รุ่งเรือง',    '0899001122',  35);

-- ตรวจสอบผลลัพธ์
SELECT 'products' AS table_name, COUNT(*) AS rows FROM products
UNION ALL
SELECT 'members', COUNT(*) FROM members;
