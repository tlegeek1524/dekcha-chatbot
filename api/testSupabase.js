const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ตั้งค่าการเชื่อมต่อ Supabase โดยตรง
const supabaseUrl = 'https://mhpetiaaadwsvrtbkmue.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ocGV0aWFhYWR3c3ZydGJrbXVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0OTIxNjAsImV4cCI6MjA2NzA2ODE2MH0.wcM-u1uVCpfgbuHwAfAshDLtG7iCj3KTid5jecP34U0';
const supabase = createClient(supabaseUrl, supabaseKey);

// คัดลอกฟังก์ชัน getUserData จาก webhook.js
async function getUserData(userId) {
  if (!userId) return { user: null, found: false };

  try {
    const { data, error } = await supabase
      .from("user")
      .select('*')
      .eq('userid', userId);

    if (error || !data || data.length === 0) {
      return { user: null, found: false };
    }

    return { user: data[0], found: true };
  } catch (e) {
    console.error("Error in getUserData:", e);
    return { user: null, found: false };
  }
}

// แก้ไขฟังก์ชัน getMenuItems ให้ดึงคอลัมน์ 'name', 'point' และ 'category' แทน
async function getMenuItems(status) {
  try {
    const { data, error } = await supabase
      .from('menu')
      .select('name, point, category') // ดึงคอลัมน์ที่ถูกต้อง
      .eq('status', status);

    if (error) {
      console.error('Error fetching menu items:', error);
      return [];
    }
    
    return data;
  } catch (e) {
    console.error('Error in getMenuItems:', e);
    return [];
  }
}

// ฟังก์ชันหลักสำหรับรันการทดสอบ
async function runTests() {
  console.log('--- เริ่มการทดสอบการเชื่อมต่อ Supabase ---');

  // ทดสอบดึงข้อมูลเมนูทั่วไป (status = 1)
  console.log('\n✅ ทดสอบดึงข้อมูล "เมนูทั่วไป" (status: 1)...');
  const generalMenu = await getMenuItems(1);
  console.log('   - จำนวนรายการที่พบ:', generalMenu.length);
  if (generalMenu.length > 0) {
    console.log('   - ตัวอย่างรายการ:', generalMenu[0]);
    console.log('   - ชื่อเมนู:', generalMenu[0].name);
    console.log('   - แต้มที่ใช้:', generalMenu[0].point);
    console.log('   - ประเภท:', generalMenu[0].category);
  } else {
    console.log('   - ไม่พบรายการเมนูในขณะนี้');
  }

  // ทดสอบดึงข้อมูลเมนูโปรโมชั่น (status = 2)
  console.log('\n✅ ทดสอบดึงข้อมูล "เมนูโปรโมชั่น" (status: 2)...');
  const promoMenu = await getMenuItems(2);
  console.log('   - จำนวนรายการที่พบ:', promoMenu.length);
  if (promoMenu.length > 0) {
    console.log('   - ตัวอย่างรายการ:', promoMenu[0]);
    console.log('   - ชื่อเมนู:', promoMenu[0].name);
    console.log('   - แต้มที่ใช้:', promoMenu[0].point);
    console.log('   - ประเภท:', promoMenu[0].category);
  } else {
    console.log('   - ไม่พบรายการเมนูในขณะนี้');
  }

  // ทดสอบดึงข้อมูลผู้ใช้ (ใช้ User ID ที่ถูกต้อง)
  console.log('\n✅ ทดสอบดึงข้อมูลผู้ใช้ (กรุณาใส่ user ID ที่ถูกต้อง)...');
  const testUserId = 'U00ecbe08348d5e0bec7b311938ac991e'; 
  const userResult = await getUserData(testUserId);
  if (userResult.found) {
    console.log('   - พบข้อมูลผู้ใช้:', userResult.user.name);
    console.log('   - ข้อมูลแต้มสะสม:', userResult.user.userpoint);
  } else {
    console.log('   - ไม่พบข้อมูลผู้ใช้สำหรับ ID:', testUserId);
  }
  
  console.log('\n--- สิ้นสุดการทดสอบ ---');
}

// เรียกใช้ฟังก์ชันทดสอบ
runTests();