const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ตั้งค่าการเชื่อมต่อ Supabase โดยใช้ URL และ Key
const supabaseUrl = 'https://uibaorxgziixlbslvlcm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpYmFvcnhnemlpeGxic2x2bGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0Njc2NDEsImV4cCI6MjA3MTA0MzY0MX0.J2EAtuE4UlwsS54Pfi2iiD6lb-NuNBbgwsLXUGcruE0';
const supabase = createClient(supabaseUrl, supabaseKey);

// ฟังก์ชันสำหรับดึงข้อมูลผู้ใช้จาก Supabase
async function getUserData(userId) {
  try {
    console.log(`🔍 กำลังค้นหาผู้ใช้ ID: ${userId}`);

    const { data: user, error } = await supabase
      .from('user')
      .select('*')
      .eq('userid', userId)
      .maybeSingle();

    if (error) {
      console.error("❌ เกิดข้อผิดพลาด:", error);
      return null;
    }

    if (!user) {
      console.log("ℹ️ ไม่พบผู้ใช้");
      return null;
    }

    console.log("✅ พบผู้ใช้:", user);
    return user;
    
  } catch (e) {
    console.error("❌ Error:", e.message);
    return null;
  }
}

// ฟังก์ชันสำหรับดึงข้อมูลเมนูทั่วไป (status = 1) - ไม่มี order
async function getRegularMenu() {
  try {
    console.log('🍽️ กำลังดึงข้อมูลเมนูทั่วไป (status = 1)');

    const { data: menuItems, error } = await supabase
      .from('menu')
      .select('*')
      .eq('status', 0);

    if (error) {
      console.error("❌ เกิดข้อผิดพลาดในการดึงเมนูทั่วไป:", error);
      return null;
    }

    console.log(`✅ พบเมนูทั่วไป ${menuItems.length} รายการ`);
    return menuItems;
    
  } catch (e) {
    console.error("❌ Error:", e.message);
    return null;
  }
}

// ฟังก์ชันสำหรับดึงข้อมูลเมนูโปรโมชั่น (status = 2) - ไม่มี order
async function getPromotionMenu() {
  try {
    console.log('🎉 กำลังดึงข้อมูลเมนูโปรโมชั่น (status = 2)');

    const { data: promoItems, error } = await supabase
      .from('menu')
      .select('*')
      .eq('status', 2);

    if (error) {
      console.error("❌ เกิดข้อผิดพลาดในการดึงเมนูโปรโมชั่น:", error);
      return null;
    }

    console.log(`✅ พบเมนูโปรโมชั่น ${promoItems.length} รายการ`);
    return promoItems;
    
  } catch (e) {
    console.error("❌ Error:", e.message);
    return null;
  }
}

// ฟังก์ชันสำหรับดึงข้อมูลเมนูทั้งหมดแยกตาม status - ไม่มี order
async function getAllMenuByStatus() {
  try {
    console.log('📋 กำลังดึงข้อมูลเมนูทั้งหมดแยกตาม status');

    const { data: allMenuItems, error } = await supabase
      .from('menu')
      .select('*')
      .in('status', [0, 2]);

    if (error) {
      console.error("❌ เกิดข้อผิดพลาดในการดึงเมนูทั้งหมด:", error);
      return null;
    }

    // แยกข้อมูลตาม status
    const regularMenu = allMenuItems.filter(item => item.status === 1);
    const promotionMenu = allMenuItems.filter(item => item.status === 2);

    console.log(`✅ พบเมนูทั่วไป ${regularMenu.length} รายการ และเมนูโปรโมชั่น ${promotionMenu.length} รายการ`);
    
    return {
      regular: regularMenu,
      promotion: promotionMenu,
      total: allMenuItems.length
    };
    
  } catch (e) {
    console.error("❌ Error:", e.message);
    return null;
  }
}

// ฟังก์ชันสำหรับดึงข้อมูลเมนูทั้งหมด (ไม่ใส่เงื่อนไข status)
async function getAllMenu() {
  try {
    console.log('🍴 กำลังดึงข้อมูลเมนูทั้งหมด');

    const { data: allMenuItems, error } = await supabase
      .from('menu')
      .select('*');

    if (error) {
      console.error("❌ เกิดข้อผิดพลาดในการดึงเมนูทั้งหมด:", error);
      return null;
    }

    console.log(`✅ พบเมนูทั้งหมด ${allMenuItems.length} รายการ`);
    return allMenuItems;
    
  } catch (e) {
    console.error("❌ Error:", e.message);
    return null;
  }
}

// ฟังก์ชันหลักสำหรับทดสอบการทำงาน
async function main() {
    const testUserId = 'U00ecbe08348d5e0bec7b311938ac991e';
    console.log('='.repeat(50));
    console.log('--- เริ่มการทดสอบการดึงข้อมูล ---');
    console.log('='.repeat(50));

    // 1. ทดสอบการดึงข้อมูลผู้ใช้
    console.log('\n1️⃣ ทดสอบการดึงข้อมูลผู้ใช้:');
    console.log('-'.repeat(30));
    const userData = await getUserData(testUserId);
    if (userData) {
        console.log('📄 ข้อมูลผู้ใช้:');
        console.log(JSON.stringify(userData, null, 2));
    }

    // 2. ทดสอบการดึงข้อมูลเมนูทั่วไป
    console.log('\n2️⃣ ทดสอบการดึงเมนูทั่วไป (status = 1):');
    console.log('-'.repeat(30));
    const regularMenu = await getRegularMenu();
    if (regularMenu && regularMenu.length > 0) {
        console.log('📄 เมนูทั่วไป (แสดง 3 รายการแรก):');
        console.log(JSON.stringify(regularMenu.slice(0, 3), null, 2));
        if (regularMenu.length > 3) {
            console.log(`... และอีก ${regularMenu.length - 3} รายการ`);
        }
    }

    // 3. ทดสอบการดึงข้อมูลเมนูโปรโมชั่น
    console.log('\n3️⃣ ทดสอบการดึงเมนูโปรโมชั่น (status = 2):');
    console.log('-'.repeat(30));
    const promotionMenu = await getPromotionMenu();
    if (promotionMenu && promotionMenu.length > 0) {
        console.log('📄 เมนูโปรโมชั่น (แสดง 3 รายการแรก):');
        console.log(JSON.stringify(promotionMenu.slice(0, 3), null, 2));
        if (promotionMenu.length > 3) {
            console.log(`... และอีก ${promotionMenu.length - 3} รายการ`);
        }
    } else {
        console.log('ℹ️ ไม่พบเมนูโปรโมชั่น');
    }

    // 4. ทดสอบการดึงข้อมูลเมนูทั้งหมดแยกตาม status
    console.log('\n4️⃣ สรุปข้อมูลเมนูทั้งหมด:');
    console.log('-'.repeat(30));
    const allMenu = await getAllMenuByStatus();
    if (allMenu) {
        console.log(`📊 สรุป:`);
        console.log(`   - เมนูทั่วไป: ${allMenu.regular.length} รายการ`);
        console.log(`   - เมนูโปรโมชั่น: ${allMenu.promotion.length} รายการ`);
        console.log(`   - รวมทั้งหมด: ${allMenu.total} รายการ`);
    }

    // 5. ทดสอบการดึงข้อมูลเมนูทั้งหมด (ไม่ใส่เงื่อนไข)
    console.log('\n5️⃣ ทดสอบการดึงเมนูทั้งหมด (ไม่ใส่เงื่อนไข status):');
    console.log('-'.repeat(30));
    const allMenus = await getAllMenu();
    if (allMenus && allMenus.length > 0) {
        console.log('📄 เมนูทั้งหมด (แสดง 3 รายการแรก):');
        console.log(JSON.stringify(allMenus.slice(0, 3), null, 2));
        if (allMenus.length > 3) {
            console.log(`... และอีก ${allMenus.length - 3} รายการ`);
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('--- สิ้นสุดการทดสอบ ---');
    console.log('='.repeat(50));
}

// เรียกใช้ฟังก์ชันหลัก
main();