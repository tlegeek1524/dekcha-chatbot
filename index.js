const line = require('@line/bot-sdk');
import { createClient } from '@supabase/supabase-js'

// ตั้งค่า Supabase
const supabaseUrl = 'https://mhpetiaaadwsvrtbkmue.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY

// Log การเชื่อมต่อ Supabase
console.log('[Supabase] Initializing connection with URL:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);
console.log('[Supabase] Connection initialized successfully');

// LINE Bot configuration
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

// ธีมสีหลัก
const THEME = {
  PRIMARY: '#5D4037',
  SECONDARY: '#8D6E63',
  ACCENT: '#FFAB91',
  BACKGROUND: '#FFF8E1',
  TEXT_DARK: '#3E2723',
  TEXT_LIGHT: '#D7CCC8',
  SUCCESS: '#81C784',
  ERROR: '#E57373',
  HEADER_BG: '#4E342E',
  FOOTER_BG: '#EFEBE9',
};

// ข้อความทั่วไป
const TEXT = {
  WELCOME: '☕ ยินดีต้อนรับสู่ TeaVibes Cafe',
  POINT_BALANCE: '☕ แต้มสะสมของคุณ',
  USER_INFO: '☕ ข้อมูลสมาชิก',
  MENU_TITLE: '☕ เมนูหลัก',
  HELP_TITLE: '☕ ช่วยเหลือ',
  ERROR_TITLE: '⚠️ พบข้อผิดพลาด',
  USER_NOT_FOUND: 'ไม่พบข้อมูลสมาชิก กรุณาลงทะเบียนก่อนใช้งาน',
  ERROR_MESSAGE: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้งในภายหลัง',
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const events = req.body.events;
    const results = await Promise.all(events.map(handleEvent));
    return res.status(200).json(results);
  } catch (err) {
    console.error('[Main] Error processing events:', err);
    return res.status(500).send('Internal Server Error');
  }
};

// ฟังก์ชันหลักสำหรับจัดการ event จาก LINE
async function handleEvent(event) {
  console.log(`[handleEvent] ได้รับ event:`, event);
  console.log(`[handleEvent] Event type: ${event.type}`);
  
  // ตรวจสอบว่าเป็น message event หรือไม่
  if (event.type !== 'message' || event.message.type !== 'text') {
    console.log(`[handleEvent] ไม่ใช่ text message event - ข้าม`);
    return Promise.resolve(null);
  }

  const userid = event.source.userId;
  const messageText = event.message.text.trim();
  
  console.log(`[handleEvent] User ID: ${userid}`);
  console.log(`[handleEvent] Message: "${messageText}"`);

  try {
    // จัดการข้อความตามคำสั่ง
    switch (messageText.toLowerCase()) {
      case 'แต้มคงเหลือ':
      case 'แต้ม':
      case 'point':
      case 'points':
        return await handlePointBalance(event, userid);
        
      case 'ข้อมูลผู้ใช้งาน':
      case 'ข้อมูลสมาชิก':
      case 'profile':
      case 'info':
        return await handleUserInfo(event, userid);
        
      case 'เมนู':
      case 'menu':
        return await handleMenu(event);
        
      case 'ช่วยเหลือ':
      case 'help':
        return await handleHelp(event);
        
      case 'สวัสดี':
      case 'hello':
      case 'hi':
        return await handleWelcome(event, userid);
        
      default:
        return await handleDefault(event);
    }
  } catch (error) {
    console.error(`[handleEvent] Error processing event:`, error);
    return client.replyMessage(event.replyToken, createErrorFlexMessage('เกิดข้อผิดพลาดในการประมวลผล'));
  }
}

async function getUserData(userid) {
  console.log(`[getUserData] ดึงข้อมูลจาก table 'users'`);
  console.log(`[getUserData] userid: '${userid}' (type: ${typeof userid})`);

  // Validate userid
  if (!userid || typeof userid !== 'string') {
    console.error(`[getUserData] Invalid userid: '${userid}'`);
    throw new Error('Invalid userid');
  }

  // Debug mode: ดึงข้อมูล 5 แถวแรกถ้าเปิด debug
  if (process.env.DEBUG_MODE === 'true') {
    console.log('[getUserData] Debug mode enabled, fetching first 5 rows from users table');
    const { data: allUsers, error: getAllError } = await supabase
      .from('users')
      .select('*')
      .limit(5);
    console.log(`[getUserData] ข้อมูลใน table 'users' (5 แถวแรก):`, JSON.stringify(allUsers, null, 2));
    if (getAllError) {
      console.error(`[getUserData] Debug query error:`, getAllError.message, getAllError.details);
    }
  }

  // ค้นหาข้อมูลด้วย userid โดยไม่ใช้ .single()
  console.log(`[getUserData] Querying table 'users' for userid: '${userid}'`);
  const { data: users, error } = await supabase
  .from('users')
  .select('*')
  .eq('userid', userid.trim());

// เพิ่มการ log เพื่อดูค่า users และ error
console.log('[getUserData] ผลลัพธ์จาก Supabase:', { users, error });

if (error) {
  console.error(`[getUserData] Supabase query error for userid '${userid}':`, error.message, error.details);
  return { user: null, found: false };
}

if (!users || users.length === 0) {
  console.log(`[getUserData] ❌ ไม่พบ userid: '${userid}' in table 'users'`);
  return { user: null, found: false };
}

if (users.length > 1) {
  console.warn(`[getUserData] ⚠️ Found multiple users for userid: '${userid}'`, JSON.stringify(users, null, 2));
}

const user = users[0]; // ใช้แถวแรกถ้ามีหลายแถว
console.log(`[getUserData] ข้อมูลที่ค้นหาได้:`, JSON.stringify(user, null, 2));
return { user, found: true };
}

// ฟังก์ชันสำหรับจัดการการตอบกลับ
async function handleUserResponse(event, userid, messageCreator, errorMsg) {
  try {
    const { user, found } = await getUserData(userid);

    if (!found) {
      console.log(`[handleUserResponse] User not found for userid: "${userid}"`);
      return client.replyMessage(event.replyToken, createUserNotFoundMessage());
    }

    return client.replyMessage(event.replyToken, messageCreator(user));

  } catch (error) {
    console.error(`[handleUserResponse] Exception for userid "${userid}":`, error.message, error.stack);
    return client.replyMessage(event.replyToken, createErrorFlexMessage(errorMsg));
  }
}

// ดึงแต้มคงเหลือ - เวอร์ชันย่อ
async function handlePointBalance(event, userid) {
  console.log(`[handlePointBalance] เริ่มกระบวนการดึงแต้มสะสมสำหรับ userid: "${userid}"`);
  return handleUserResponse(
    event, 
    userid, 
    createPointFlexMessage, 
    'ไม่สามารถดึงข้อมูลแต้มสะสมได้'
  );
}

// ดึงข้อมูลผู้ใช้งาน - เวอร์ชันย่อ
async function handleUserInfo(event, userid) {
  console.log(`[handleUserInfo] เริ่มกระบวนการดึงข้อมูลสมาชิกสำหรับ userid: '${userid}'`);
  return handleUserResponse(
    event, 
    userid, 
    createUserInfoFlexMessage, 
    'ไม่สามารถดึงข้อมูลสมาชิกได้'
  );
}

// จัดการเมนู
async function handleMenu(event) {
  console.log(`[handleMenu] แสดงเมนู`);
  return client.replyMessage(event.replyToken, createMenuFlexMessage());
}

// จัดการช่วยเหลือ
async function handleHelp(event) {
  console.log(`[handleHelp] แสดงความช่วยเหลือ`);
  return client.replyMessage(event.replyToken, createHelpFlexMessage());
}

// จัดการข้อความต้อนรับ
async function handleWelcome(event, userid) {
  console.log(`[handleWelcome] ข้อความต้อนรับสำหรับ userid: "${userid}"`);
  
  try {
    const { user, found } = await getUserData(userid);
    
    if (found) {
      console.log(`[handleWelcome] Found user: ${user.name}`);
      return client.replyMessage(event.replyToken, createWelcomeMessage(user.name));
    } else {
      console.log(`[handleWelcome] No user found, sending generic welcome`);
      return client.replyMessage(event.replyToken, createWelcomeMessage());
    }
  } catch (error) {
    console.error(`[handleWelcome] Error for userid "${userid}":`, error.message, error.stack);
    return client.replyMessage(event.replyToken, createWelcomeMessage());
  }
}

// จัดการข้อความที่ไม่รู้จัก
async function handleDefault(event) {
  console.log(`[handleDefault] ข้อความที่ไม่รู้จัก`);
  return client.replyMessage(event.replyToken, createDefaultMessage());
}

// สร้างข้อความต้อนรับ
function createWelcomeMessage(userName = null) {
  const greeting = userName ? `สวัสดี คุณ${userName}!` : 'สวัสดี!';
  
  return {
    type: 'flex',
    altText: TEXT.WELCOME,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: TEXT.WELCOME,
            weight: 'bold',
            color: '#FFFFFF',
            size: 'xl',
            align: 'center',
          },
        ],
        backgroundColor: THEME.HEADER_BG,
        paddingTop: '20px',
        paddingBottom: '20px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: greeting,
            size: 'lg',
            weight: 'bold',
            color: THEME.PRIMARY,
            align: 'center',
          },
          {
            type: 'text',
            text: 'ยินดีต้อนรับสู่ระบบสมาชิก ☕',
            size: 'sm',
            color: THEME.SECONDARY,
            align: 'center',
            margin: 'md',
          },
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: { type: 'message', label: 'ดูแต้มคงเหลือ', text: 'แต้มคงเหลือ' },
            style: 'primary',
            color: THEME.PRIMARY,
          },
          {
            type: 'button',
            action: { type: 'message', label: 'ดูข้อมูลสมาชิก', text: 'ข้อมูลสมาชิก' },
            style: 'secondary',
            color: THEME.SECONDARY,
            margin: 'sm',
          },
        ],
        paddingAll: '15px',
        backgroundColor: THEME.FOOTER_BG,
      },
    },
  };
}

// สร้างข้อความเริ่มต้น
function createDefaultMessage() {
  return {
    type: 'flex',
    altText: 'ไม่เข้าใจคำสั่ง',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🤖 ไม่เข้าใจคำสั่ง',
            weight: 'bold',
            size: 'lg',
            color: THEME.PRIMARY,
          },
          {
            type: 'text',
            text: 'ลองพิมพ์ "ช่วยเหลือ" เพื่อดูคำสั่งที่ใช้ได้',
            margin: 'md',
            wrap: true,
          },
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: { type: 'message', label: 'ช่วยเหลือ', text: 'ช่วยเหลือ' },
            style: 'primary',
            color: THEME.PRIMARY,
          },
        ],
        paddingAll: '15px',
        backgroundColor: THEME.FOOTER_BG,
      },
    },
  };
}

// สร้าง Flex Message กรณีไม่พบผู้ใช้
function createUserNotFoundMessage() {
  return {
    type: 'flex',
    altText: TEXT.USER_NOT_FOUND,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🔎 ไม่พบข้อมูลสมาชิก',
            weight: 'bold',
            size: 'xl',
            color: THEME.ERROR,
          },
          {
            type: 'text',
            text: TEXT.USER_NOT_FOUND,
            margin: 'md',
            wrap: true,
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'ลงทะเบียนสมาชิก',
              uri: 'https://dekcha-frontend.vercel.app/',
            },
            style: 'primary',
            color: THEME.PRIMARY,
          },
        ],
      },
      styles: {
        body: { backgroundColor: THEME.BACKGROUND },
        footer: { backgroundColor: THEME.FOOTER_BG },
      },
    },
  };
}

// สร้าง Flex Message แสดงแต้ม
function createPointFlexMessage(user) {
  return {
    type: 'flex',
    altText: `${TEXT.POINT_BALANCE} ${user.name}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: TEXT.POINT_BALANCE,
            weight: 'bold',
            color: '#FFFFFF',
            size: 'xl',
            align: 'center',
          },
        ],
        backgroundColor: THEME.HEADER_BG,
        paddingTop: '20px',
        paddingBottom: '20px',
      },
      hero: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `${user.userpoint}`,
            size: '5xl',
            weight: 'bold',
            align: 'center',
            color: THEME.PRIMARY,
          },
          {
            type: 'text',
            text: 'แต้ม',
            size: 'sm',
            align: 'center',
            color: THEME.SECONDARY,
            margin: 'sm',
          },
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '👤 สมาชิก', size: 'sm', color: THEME.SECONDARY, flex: 1 },
              { type: 'text', text: `${user.name}`, size: 'sm', color: THEME.TEXT_DARK, align: 'end', flex: 2 },
            ],
            margin: 'md',
          },
          { type: 'separator', margin: 'lg', color: THEME.TEXT_LIGHT },
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: { type: 'message', label: 'ดูข้อมูลสมาชิก', text: 'ข้อมูลผู้ใช้งาน' },
            style: 'primary',
            color: THEME.PRIMARY,
          },
        ],
        paddingAll: '15px',
        backgroundColor: THEME.FOOTER_BG,
      },
    },
  };
}

// สร้าง Flex Message แสดงข้อมูลสมาชิก
function createUserInfoFlexMessage(user) {
  const memberLevel = getMemberLevel(user.userpoint);

  return {
    type: 'flex',
    altText: `${TEXT.USER_INFO} ${user.name}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: TEXT.USER_INFO, weight: 'bold', color: '#FFFFFF', size: 'xl', align: 'center' },
        ],
        backgroundColor: THEME.HEADER_BG,
        paddingTop: '20px',
        paddingBottom: '20px',
      },
      hero: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: memberLevel.title, size: 'lg', weight: 'bold', align: 'center', color: memberLevel.color },
          { type: 'text', text: memberLevel.description, size: 'xs', align: 'center', color: THEME.SECONDARY, margin: 'sm' },
        ],
        paddingAll: '15px',
        backgroundColor: THEME.BACKGROUND,
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '👤 ชื่อสมาชิก', weight: 'bold', size: 'sm', color: THEME.SECONDARY, flex: 1 },
              { type: 'text', text: `${user.name}`, size: 'sm', color: THEME.TEXT_DARK, align: 'end', flex: 2 },
            ],
            margin: 'md',
          },
          { type: 'separator', margin: 'lg', color: THEME.TEXT_LIGHT },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '🔑 รหัสสมาชิก', weight: 'bold', size: 'sm', color: THEME.SECONDARY, flex: 1 },
              { type: 'text', text: `${user.uid}`, size: 'sm', color: THEME.TEXT_DARK, align: 'end', flex: 2 },
            ],
            margin: 'md',
          },
          { type: 'separator', margin: 'lg', color: THEME.TEXT_LIGHT },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '✨ แต้มสะสม', weight: 'bold', size: 'sm', color: THEME.SECONDARY, flex: 1 },
              { type: 'text', text: `${user.userpoint} แต้ม`, size: 'sm', color: memberLevel.color, align: 'end', flex: 2, weight: 'bold' },
            ],
            margin: 'md',
          },
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'button', action: { type: 'message', label: 'ดูแต้มคงเหลือ', text: 'แต้มคงเหลือ' }, style: 'primary', color: THEME.PRIMARY },
          { type: 'button', action: { type: 'message', label: 'ดูเมนู', text: 'เมนู' }, style: 'secondary', color: THEME.SECONDARY, margin: 'sm' },
        ],
        paddingAll: '15px',
        backgroundColor: THEME.FOOTER_BG,
      },
    },
  };
}

// ฟังก์ชันคำนวณระดับสมาชิก
function getMemberLevel(points) {
  if (points >= 50) return { title: 'GOLD MEMBER', description: 'สมาชิกระดับทอง', color: '#FFD700' };
  if (points >= 30) return { title: 'SILVER MEMBER', description: 'สมาชิกระดับเงิน', color: '#C0C0C0' };
  if (points >= 10) return { title: 'BRONZE MEMBER', description: 'สมาชิกระดับทองแดง', color: '#CD7F32' };
  return { title: 'MEMBER', description: 'สมาชิกทั่วไป', color: THEME.SECONDARY };
}

// สร้าง Flex Message เมนู
function createMenuFlexMessage() {
  return {
    type: 'flex',
    altText: TEXT.MENU_TITLE,
    contents: {
      type: 'bubble',
      header: {
       

        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: TEXT.MENU_TITLE, weight: 'bold', size: 'xl', color: '#FFFFFF', align: 'center' }
        ],
        backgroundColor: THEME.HEADER_BG,
        paddingTop: '20px',
        paddingBottom: '20px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { 
            type: 'text', 
            text: '☕ กาแฟ\n🍵 ชา\n🧁 ขนมหวาน\n🥪 ขนมปัง', 
            wrap: true,
            size: 'md',
            color: THEME.TEXT_DARK
          }
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: { type: 'message', label: 'สั่งสินค้า', text: 'สั่งสินค้า' },
            style: 'primary',
            color: THEME.PRIMARY,
          },
        ],
        paddingAll: '15px',
        backgroundColor: THEME.FOOTER_BG,
      },
    }
  };
}

// สร้าง Flex Message ช่วยเหลือ
function createHelpFlexMessage() {
  return {
    type: 'flex',
    altText: TEXT.HELP_TITLE,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: TEXT.HELP_TITLE, weight: 'bold', size: 'xl', color: '#FFFFFF', align: 'center' }
        ],
        backgroundColor: THEME.HEADER_BG,
        paddingTop: '20px',
        paddingBottom: '20px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📝 คำสั่งที่ใช้ได้:\n\n• "แต้มคงเหลือ" - ดูแต้มสะสม\n• "ข้อมูลสมาชิก" - ดูข้อมูลผู้ใช้งาน\n• "เมนู" - ดูเมนูสินค้า\n• "สวัสดี" - ข้อความต้อนรับ',
            wrap: true,
            size: 'sm',
            color: THEME.TEXT_DARK
          }
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: { type: 'message', label: 'ดูแต้มคงเหลือ', text: 'แต้มคงเหลือ' },
            style: 'primary',
            color: THEME.PRIMARY,
          },
        ],
        paddingAll: '15px',
        backgroundColor: THEME.FOOTER_BG,
      },
    }
  };
}

// สร้าง Flex Message แสดงข้อความผิดพลาด
function createErrorFlexMessage(msg) {
  return {
    type: 'flex',
    altText: TEXT.ERROR_TITLE,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: TEXT.ERROR_TITLE, weight: 'bold', size: 'xl', color: THEME.ERROR },
          { type: 'text', text: msg || TEXT.ERROR_MESSAGE, margin: 'md', wrap: true },
        ],
        paddingAll: '20px',
      },
      styles: {
        body: { backgroundColor: THEME.BACKGROUND },
      },
    },
  };
}