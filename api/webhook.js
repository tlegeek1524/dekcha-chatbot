const line = require('@line/bot-sdk');
const { createClient } = require('@supabase/supabase-js');

// ตั้งค่า Supabase
const supabaseUrl = 'https://sgncxqqiizwnnffjffok.supabase.co';  // แก้เป็น URL โปรเจกต์คุณ
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnbmN4cXFpaXp3bm5mZmpmZm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0ODIwMDQsImV4cCI6MjA2NzA1ODAwNH0.nQegkuQ1sC5b_8Hr70FbBkm0nulsLPNOGervJe9Su0A'; // แก้เป็น Key ของคุณ

const supabase = createClient(supabaseUrl, supabaseKey);

// LINE Bot configuration
const config = {
  channelAccessToken: 'REG0CAijX1esVbPqu1wlpUkKeFP739y86ZFzDk2QDKGP1v2HfGKdKnBBzNNdMcdkjufRQOQEhLQl9zeotJboR8WjtCOOrIkWAlxTa3U946Z19XemRyjymvs36n0Ee7ZtOpe+nwycCC4QNngADupCRgdB04t89/1O/w1cDnyilFU=',
  channelSecret: 'de016ec05f8d96c9d92e46a86bd805c8'
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
    console.error(err);
    return res.status(500).send('Internal Server Error');
  }
};

// ฟังก์ชันจัดการเหตุการณ์
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userMessage = event.message.text.trim().toLowerCase();
  const userId = event.source.userId;

  switch (userMessage) {
    case 'แต้มคงเหลือ':
    case 'แต้ม':
    case 'points':
      return handlePointBalance(event, userId);
    case 'ข้อมูลผู้ใช้งาน':
    case 'ข้อมูลสมาชิก':
    case 'ข้อมูล':
    case 'profile':
      return handleUserInfo(event, userId);
    case 'เมนู':
    case 'menu':
      return client.replyMessage(event.replyToken, createMenuFlexMessage());
    default:
      return client.replyMessage(event.replyToken, createHelpFlexMessage());
  }
}

// ดึงแต้มคงเหลือ
async function handlePointBalance(event, userId) {
  try {
    console.log(`[handlePointBalance] กำลังดึงข้อมูลจาก table 'user' ด้วย userId: ${userId}`);
    const { data: users, error } = await supabase
      .from('user') // ใช้ table 'user'
      .select('*')
      .eq('userId', userId); // ใช้ userId ในการค้นหา

    if (error) {
      console.error(`[handlePointBalance] ERROR:`, error);
      return client.replyMessage(event.replyToken, createErrorFlexMessage('เกิดข้อผิดพลาดในการดึงข้อมูล'));
    }

    console.log(`[handlePointBalance] SUCCESS:`, users);

    if (!users || users.length === 0) {
      return client.replyMessage(event.replyToken, createUserNotFoundMessage());
    }

    const user = users[0]; // เอาข้อมูลแรก
    return client.replyMessage(event.replyToken, createPointFlexMessage(user));
  } catch (err) {
    console.error('[handlePointBalance] Exception:', err);
    return client.replyMessage(event.replyToken, createErrorFlexMessage('ไม่สามารถดึงข้อมูลแต้มสะสมได้'));
  }
}

// ดึงข้อมูลผู้ใช้งาน
async function handleUserInfo(event, userId) {
  try {
    console.log(`[handleUserInfo] กำลังดึงข้อมูลจาก table 'user' ด้วย userId: ${userId}`);
    const { data: users, error } = await supabase
      .from('user') // ใช้ table 'user'
      .select('*')
      .eq('userId', userId); // ใช้ userId ในการค้นหา

    if (error) {
      console.error(`[handleUserInfo] ERROR:`, error);
      return client.replyMessage(event.replyToken, createErrorFlexMessage('เกิดข้อผิดพลาดในการดึงข้อมูล'));
    }

    console.log(`[handleUserInfo] SUCCESS:`, users);

    if (!users || users.length === 0) {
      return client.replyMessage(event.replyToken, createUserNotFoundMessage());
    }

    const user = users[0]; // เอาข้อมูลแรก
    return client.replyMessage(event.replyToken, createUserInfoFlexMessage(user));
  } catch (err) {
    console.error('[handleUserInfo] Exception:', err);
    return client.replyMessage(event.replyToken, createErrorFlexMessage('ไม่สามารถดึงข้อมูลสมาชิกได้'));
  }
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
  // ตัวอย่างเมนู (ปรับตามต้องการ)
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
          { type: 'text', text: '1. กาแฟ\n2. ชา\n3. ขนมหวาน', wrap: true }
        ],
        paddingAll: '20px',
      }
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
          { type: 'text', text: 'พิมพ์ "แต้มคงเหลือ" เพื่อดูแต้มสะสม\nพิมพ์ "ข้อมูลสมาชิก" เพื่อดูข้อมูลผู้ใช้งาน\nพิมพ์ "เมนู" เพื่อดูเมนูสินค้า', wrap: true }
        ],
        paddingAll: '20px',
      }
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
      },
      styles: {
        body: { backgroundColor: THEME.BACKGROUND },
      },
    },
  };
}
