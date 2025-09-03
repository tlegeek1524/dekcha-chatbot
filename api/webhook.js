const line = require('@line/bot-sdk');
const { createClient } = require('@supabase/supabase-js');

// --- CONFIG ---
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const supabase = createClient(
  'https://uibaorxgziixlbslvlcm.supabase.co',
  process.env.SUPABASE_KEY
);

const client = new line.Client(config);

// --- MODERN BROWN THEME ---
const THEME = {
  PRIMARY: '#3e2723',      
  SECONDARY: '#5d4037',    
  ACCENT: '#a1887f',       
  SURFACE: '#efebe9',      
  BACKGROUND: '#fafafa',   
  TEXT_PRIMARY: '#2e2e2e',
  TEXT_SECONDARY: '#757575',
  SUCCESS: '#4caf50',
  WARNING: '#ff9800',
  ERROR: '#f44336'
};

const TEXT = {
  WELCOME: 'ยินดีต้อนรับสู่ DekCha Mueang Tak',
  POINT_BALANCE: 'แต้มสะสม',
  USER_INFO: 'ข้อมูลสมาชิก',
  MENU_TITLE: 'เมนู',
  HELP_TITLE: 'ช่วยเหลือ',
  USER_NOT_FOUND: 'ไม่พบข้อมูลสมาชิก กรุณาลงทะเบียนก่อน',
  ERROR_MESSAGE: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง',
  LOADING: 'กำลังโหลดข้อมูล...'
};

// --- MAIN HANDLER ---
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  try {
    const events = req.body.events || [];
    console.log(`[Main] Processing ${events.length} events`);
    
    const results = await Promise.all(events.map(handleEvent));
    res.status(200).json({ success: true, processed: events.length });
  } catch (err) {
    console.error('[Main] Error:', err);
    res.status(500).send('Internal Server Error');
  }
};

// --- EVENT HANDLER ---
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return null;
  
  const { userId } = event.source;
  const text = event.message.text.trim().toLowerCase();
  
  console.log(`[Event] User: ${userId}, Message: "${text}"`);
  
  try {
    // จับ text ที่มี pagination เช่น "เมนูทั่วไป หน้า 2"
    let menuType = null;
    let page = 1;
    if (text.startsWith('เมนูทั่วไป')) {
      menuType = 1; // status=1 สำหรับทั่วไป
      const parts = text.split('หน้า');
      if (parts.length > 1) page = parseInt(parts[1].trim()) || 1;
    } else if (text.startsWith('เมนูโปรโมชั่น')) {
      menuType = 2; // status=2 สำหรับโปรโมชั่น
      const parts = text.split('หน้า');
      if (parts.length > 1) page = parseInt(parts[1].trim()) || 1;
    }

    switch (text) {
      case 'แต้มคงเหลือ': case 'แต้ม': case 'point': case 'points':
        return handleUserReply(event, userId, createPointMessage, 'ไม่สามารถดึงข้อมูลแต้มสะสมได้');
      
      case 'ข้อมูลผู้ใช้งาน': case 'ข้อมูลสมาชิก': case 'profile': case 'info':
        return handleUserReply(event, userId, createUserInfoMessage, 'ไม่สามารถดึงข้อมูลสมาชิกได้');
      
      case 'เมนู': case 'menu':
        return reply(event, createMenuMessage());
      
      case 'เมนูทั่วไป':
      case 'เมนูโปรโมชั่น':
        // ถ้าไม่มี "หน้า" จะ fallback ไป page=1
        const generalOrPromoMenu = await getMenuItems(menuType || (text === 'เมนูทั่วไป' ? 1 : 2));
        return reply(event, createMenuDisplayMessage(generalOrPromoMenu, text.toUpperCase(), page));
      
      case 'ช่วยเหลือ': case 'help':
        return reply(event, createHelpMessage());
      
      case 'สวัสดี': case 'hello': case 'hi':
        return handleWelcome(event, userId);
      
      default:
        // ถ้า text มี pagination จาก case ข้างบน
        if (menuType !== null) {
          const menuItems = await getMenuItems(menuType);
          return reply(event, createMenuDisplayMessage(menuItems, menuType === 1 ? 'เมนูทั่วไป' : 'เมนูโปรโมชั่น', page));
        }
        return reply(event, createDefaultMessage());
    }
  } catch (error) {
    console.error(`[Event] Error handling event:`, error);
    return reply(event, createErrorMessage());
  }
}

// --- OPTIMIZED UTILITIES ---
async function getUserData(userId) {
  if (!userId) {
    console.warn('[getUserData] No userId provided');
    return { user: null, found: false, error: 'ไม่พบ User ID' };
  }
  
  try {
    console.log(`[getUserData] Fetching data for user: ${userId}`);
    
    const { data, error } = await supabase
      .from("user")
      .select('*')
      .eq('userid', userId)
      .single();

    if (error) {
      console.error('[getUserData] Supabase error:', error);
      return { user: null, found: false, error: error.message };
    }

    if (!data) {
      console.warn('[getUserData] No user data found');
      return { user: null, found: false, error: 'ไม่พบข้อมูลผู้ใช้' };
    }

    console.log(`[getUserData] Successfully fetched data for: ${data.name}`);
    return { user: data, found: true, error: null };
    
  } catch (e) {
    console.error("[getUserData] Unexpected error:", e);
    return { user: null, found: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' };
  }
}

async function getMenuItems(status) {
  try {
    console.log(`[getMenuItems] Fetching menu items with status: ${status}`);
    
    const { data, error } = await supabase
      .from('menu')
      .select('idmenu, name, point, category, image')
      .eq('status', status)
      .order('name');

    if (error) {
      console.error('[getMenuItems] Supabase error:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      console.warn(`[getMenuItems] No menu items found for status: ${status}`);
      return [];
    }

    const validatedItems = data.map(item => ({
      idmenu: item.idmenu || '',
      name: item.name || 'ไม่ระบุชื่อ',
      point: item.point || 0,
      category: item.category || 'อื่นๆ',
      image: item.image || ''
    }));

    console.log(`[getMenuItems] Successfully fetched ${validatedItems.length} items`);
    return validatedItems;
    
  } catch (e) {
    console.error('[getMenuItems] Unexpected error:', e);
    return [];
  }
}

async function handleUserReply(event, userId, messageFn, errorMsg) {
  try {
    const { user, found, error } = await getUserData(userId);
    
    if (!found) {
      return reply(event, createUserNotFoundMessage());
    }
    
    if (error) {
      return reply(event, createErrorMessage(error));
    }
    
    return reply(event, messageFn(user));
    
  } catch (e) {
    console.error('[handleUserReply] Error:', e);
    return reply(event, createErrorMessage(errorMsg));
  }
}

async function handleWelcome(event, userId) {
  try {
    const { user, found } = await getUserData(userId);
    return reply(event, createWelcomeMessage(found ? user.name : null));
  } catch (e) {
    console.error('[handleWelcome] Error:', e);
    return reply(event, createWelcomeMessage(null));
  }
}

function reply(event, message) {
  if (!event.replyToken) {
    console.error('[reply] No reply token found');
    return Promise.resolve();
  }

  try {
    const messageSize = JSON.stringify(message).length;
    console.log(`[reply] Message size: ${messageSize} bytes`);
    
    if (messageSize > 50000) {
      console.warn('[reply] Message too large, sending simple text instead');
      const fallbackMessage = {
        type: 'text',
        text: 'ข้อมูลมีขนาดใหญ่เกินไป กรุณาใช้เว็บไซต์เพื่อดูรายละเอียด: https://dekcha-frontend.vercel.app/'
      };
      return client.replyMessage(event.replyToken, fallbackMessage);
    }
    
    return client.replyMessage(event.replyToken, message);
  } catch (error) {
    console.error('[reply] Error sending message:', error);
    const errorMessage = {
      type: 'text',
      text: 'เกิดข้อผิดพลาดในการส่งข้อมูล กรุณาลองใหม่อีกครั้ง'
    };
    return client.replyMessage(event.replyToken, errorMessage);
  }
}

// --- IMPROVED FLEX MESSAGE GENERATORS ---
function createWelcomeMessage(name) {
  return {
    type: 'flex',
    altText: TEXT.WELCOME,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: TEXT.WELCOME,
            size: 'lg',
            weight: 'bold',
            color: THEME.PRIMARY,
            align: 'center',
            wrap: true
          },
          {
            type: 'text',
            text: name ? `สวัสดีคุณ ${name}` : 'สวัสดี',
            size: 'md',
            color: THEME.TEXT_SECONDARY,
            align: 'center',
            margin: 'md'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              compactButton('แต้มสะสม', 'แต้มคงเหลือ', true),
              compactButton('ข้อมูล', 'ข้อมูลสมาชิก', false)
            ],
            spacing: 'sm',
            margin: 'lg'
          }
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'md'
      }
    }
  };
}

function createPointMessage(user) {
  const level = getMemberLevel(user.userpoint || 0);
  return {
    type: 'flex',
    altText: `${TEXT.POINT_BALANCE} ${user.userpoint || 0} แต้ม`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: TEXT.POINT_BALANCE,
            size: 'lg',
            weight: 'bold',
            color: THEME.PRIMARY,
            align: 'center'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: `${user.userpoint || 0}`,
                size: '4xl',
                weight: 'bold',
                color: THEME.PRIMARY,
                align: 'center'
              },
              {
                type: 'text',
                text: 'แต้ม',
                size: 'sm',
                color: THEME.TEXT_SECONDARY,
                align: 'center'
              }
            ],
            backgroundColor: THEME.SURFACE,
            cornerRadius: '12px',
            paddingAll: '20px',
            margin: 'lg'
          },
          compactInfoBox([
            { label: 'สมาชิก', value: user.name || 'ไม่ระบุ' },
            { label: 'ระดับ', value: level.title, color: level.color }
          ]),
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'แลกสิทธิพิเศษ',
              uri: 'https://dekcha-frontend.vercel.app/login/menu'
            },
            style: 'primary',
            color: THEME.PRIMARY,
            height: 'sm',
            margin: 'lg'
          }
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'md'
      }
    }
  };
}

function createUserInfoMessage(user) {
  const level = getMemberLevel(user.userpoint || 0);
  return {
    type: 'flex',
    altText: `${TEXT.USER_INFO} ${user.name || 'ไม่ระบุ'}`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          headerBox(TEXT.USER_INFO, level.title, level.color),
          compactInfoBox([
            { label: 'ชื่อสมาชิก', value: user.name || 'ไม่ระบุ' },
            { label: 'รหัสสมาชิก', value: user.uid || 'ไม่ระบุ' },
            { label: 'แต้มสะสม', value: `${user.userpoint || 0} แต้ม`, color: level.color }
          ]),
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              compactButton('แต้มสะสม', 'แต้มคงเหลือ', true),
              compactButton('เมนู', 'เมนู', false)
            ],
            spacing: 'sm',
            margin: 'lg'
          }
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'md'
      }
    }
  };
}

function createMenuMessage() {
  return {
    type: 'flex',
    altText: TEXT.MENU_TITLE,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: TEXT.MENU_TITLE,
            size: 'lg',
            weight: 'bold',
            color: THEME.PRIMARY,
            align: 'center'
          },
          {
            type: 'text',
            text: 'กรุณาเลือกประเภทเมนูที่ต้องการดู',
            size: 'sm',
            color: THEME.TEXT_SECONDARY,
            align: 'center',
            wrap: true,
            margin: 'md'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'message',
                  label: 'เมนูทั่วไป',
                  text: 'เมนูทั่วไป'
                },
                style: 'primary',
                color: THEME.PRIMARY,
                height: 'sm',
                margin: 'sm'
              },
              {
                type: 'button',
                action: {
                  type: 'message',
                  label: 'เมนูโปรโมชั่น',
                  text: 'เมนูโปรโมชั่น'
                },
                style: 'secondary',
                color: THEME.SECONDARY,
                height: 'sm',
                margin: 'sm'
              }
            ],
            margin: 'lg'
          }
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'md'
      }
    }
  };
}

function createMenuDisplayMessage(menuItems, title, page = 1) {
  if (!menuItems || menuItems.length === 0) {
    return {
      type: 'flex',
      altText: `รายการ${title}`,
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: title,
              size: 'lg',
              weight: 'bold',
              color: THEME.PRIMARY,
              align: 'center'
            },
            {
              type: 'separator',
              margin: 'lg'
            },
            {
              type: 'text',
              text: 'ไม่พบรายการเมนูในขณะนี้',
              size: 'md',
              color: THEME.TEXT_SECONDARY,
              align: 'center',
              margin: 'lg'
            },
            {
              type: 'button',
              action: {
                type: 'message',
                label: 'กลับไปเมนูหลัก',
                text: 'เมนู'
              },
              style: 'primary',
              color: THEME.PRIMARY,
              height: 'sm',
              margin: 'lg'
            }
          ],
          paddingAll: '20px',
          backgroundColor: THEME.BACKGROUND,
          spacing: 'md'
        }
      }
    };
  }

  // Pagination logic
  const itemsPerPage = 5; // ปรับได้ ถ้าต้องการมากกว่านี้ แต่ไม่เกิน 10 เพื่อหลีกเลี่ยง size ใหญ่
  const totalItems = menuItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  page = Math.max(1, Math.min(page, totalPages)); // Validate page

  const start = (page - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = menuItems.slice(start, end);

  // สร้าง bubbles สำหรับหน้านี้
  const menuBubbles = pageItems.map(item => {
    const imageUrl = item.image || 'https://via.placeholder.com/640x400?text=No+Image';
    return {
      type: 'bubble',
      hero: {
        type: 'image',
        url: imageUrl,
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: item.name,
            weight: 'bold',
            size: 'lg',
            wrap: true,
            color: THEME.TEXT_PRIMARY
          },
          {
            type: 'text',
            text: `ประเภท: ${item.category}`,
            size: 'sm',
            color: THEME.TEXT_SECONDARY,
            margin: 'sm'
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: 'ใช้แต้ม',
                size: 'sm',
                color: THEME.TEXT_SECONDARY,
                flex: 1
              },
              {
                type: 'text',
                text: `${item.point} แต้ม`,
                size: 'md',
                color: THEME.PRIMARY,
                weight: 'bold',
                flex: 2,
                align: 'end'
              }
            ],
            margin: 'md'
          }
        ],
        paddingAll: '16px'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'สั่งเลย',
              uri: `https://dekcha-frontend.vercel.app/order/${item.idmenu}`
            },
            style: 'primary',
            color: THEME.PRIMARY,
            height: 'sm'
          }
        ],
        paddingAll: '12px'
      }
    };
  });

  // เพิ่ม pagination buttons ใน bubble สุดท้าย (หรือสร้าง bubble แยกสำหรับ navigation ถ้าต้องการ)
  if (menuBubbles.length > 0) {
    const navContents = [];
    if (page > 1) {
      navContents.push({
        type: 'button',
        action: {
          type: 'message',
          label: 'หน้าก่อนหน้า',
          text: `${title} หน้า ${page - 1}`
        },
        style: 'secondary',
        color: THEME.SECONDARY,
        height: 'sm',
        margin: 'sm'
      });
    }
    if (page < totalPages) {
      navContents.push({
        type: 'button',
        action: {
          type: 'message',
          label: 'หน้าต่อไป',
          text: `${title} หน้า ${page + 1}`
        },
        style: 'secondary',
        color: THEME.SECONDARY,
        height: 'sm',
        margin: 'sm'
      });
    }
    navContents.push({
      type: 'button',
      action: {
        type: 'message',
        label: 'กลับเมนูหลัก',
        text: 'เมนู'
      },
      style: 'secondary',
      color: THEME.SECONDARY,
      height: 'sm',
      margin: 'sm'
    });

    // เพิ่ม nav ลง footer ของ bubble สุดท้าย
    const lastBubble = menuBubbles[menuBubbles.length - 1];
    lastBubble.footer.contents.push(...navContents);
  }

  return {
    type: 'flex',
    altText: `รายการ${title} (หน้า ${page}/${totalPages})`,
    contents: {
      type: 'carousel',
      contents: menuBubbles
    }
  };
}

function createHelpMessage() {
  const commands = [
    { cmd: 'แต้มคงเหลือ', desc: 'ดูแต้มสะสม' },
    { cmd: 'ข้อมูลสมาชิก', desc: 'ดูข้อมูลผู้ใช้' },
    { cmd: 'เมนู', desc: 'ดูเมนูสินค้า' },
    { cmd: 'สวัสดี', desc: 'ข้อความต้อนรับ' }
  ];

  return {
    type: 'flex',
    altText: TEXT.HELP_TITLE,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: TEXT.HELP_TITLE,
            size: 'lg',
            weight: 'bold',
            color: THEME.PRIMARY,
            align: 'center'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: commands.map(item => ({
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: `"${item.cmd}"`,
                  size: 'sm',
                  weight: 'bold',
                  color: THEME.PRIMARY,
                  flex: 3
                },
                {
                  type: 'text',
                  text: item.desc,
                  size: 'sm',
                  color: THEME.TEXT_SECONDARY,
                  flex: 2,
                  align: 'end'
                }
              ],
              margin: 'md'
            })),
            backgroundColor: THEME.SURFACE,
            cornerRadius: '12px',
            paddingAll: '16px',
            margin: 'lg',
            spacing: 'sm'
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: 'ดูแต้มสะสม',
              text: 'แต้มคงเหลือ'
            },
            style: 'primary',
            color: THEME.PRIMARY,
            height: 'sm',
            margin: 'lg'
          }
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'md'
      }
    }
  };
}

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
            text: '❓ ไม่เข้าใจคำสั่ง',
            size: 'lg',
            weight: 'bold',
            color: THEME.WARNING,
            align: 'center'
          },
          {
            type: 'text',
            text: 'พิมพ์ "ช่วยเหลือ" เพื่อดูคำสั่งทั้งหมด',
            size: 'md',
            color: THEME.TEXT_SECONDARY,
            align: 'center',
            wrap: true,
            margin: 'lg'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              compactButton('ช่วยเหลือ', 'ช่วยเหลือ', true),
              compactButton('เมนู', 'เมนู', false)
            ],
            spacing: 'sm',
            margin: 'lg'
          }
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'md'
      }
    }
  };
}

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
            text: '⚠️ ไม่พบข้อมูลสมาชิก',
            size: 'lg',
            weight: 'bold',
            color: THEME.ERROR,
            align: 'center'
          },
          {
            type: 'text',
            text: TEXT.USER_NOT_FOUND,
            size: 'md',
            color: THEME.TEXT_SECONDARY,
            align: 'center',
            wrap: true,
            margin: 'lg'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'ลงทะเบียนสมาชิก',
              uri: 'https://dekcha-frontend.vercel.app/'
            },
            style: 'primary',
            color: THEME.PRIMARY,
            height: 'sm',
            margin: 'lg'
          }
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'md'
      }
    }
  };
}

function createErrorMessage(msg) {
  return {
    type: 'flex',
    altText: 'พบข้อผิดพลาด',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '❌ พบข้อผิดพลาด',
            size: 'lg',
            weight: 'bold',
            color: THEME.ERROR,
            align: 'center'
          },
          {
            type: 'text',
            text: msg || TEXT.ERROR_MESSAGE,
            size: 'md',
            color: THEME.TEXT_SECONDARY,
            align: 'center',
            wrap: true,
            margin: 'lg'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: 'ลองใหม่อีกครั้ง',
              text: 'สวัสดี'
            },
            style: 'primary',
            color: THEME.PRIMARY,
            height: 'sm',
            margin: 'lg'
          }
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'md'
      }
    }
  };
}

// --- COMPACT HELPER FUNCTIONS ---
function compactButton(label, text, isPrimary) {
  return {
    type: 'button',
    action: {
      type: 'message',
      label: label,
      text: text
    },
    style: isPrimary ? 'primary' : 'secondary',
    color: isPrimary ? THEME.PRIMARY : THEME.SECONDARY,
    height: 'sm',
    flex: 1
  };
}

function headerBox(title, subtitle, subtitleColor = THEME.TEXT_SECONDARY) {
  return {
    type: 'box',
    layout: 'vertical',
    contents: [
      {
        type: 'text',
        text: title,
        size: 'lg',
        weight: 'bold',
        color: THEME.PRIMARY,
        align: 'center'
      },
      subtitle ? {
        type: 'text',
        text: subtitle,
        size: 'md',
        color: subtitleColor,
        align: 'center',
        margin: 'sm'
      } : null
    ].filter(Boolean)
  };
}

function compactInfoBox(items) {
  return {
    type: 'box',
    layout: 'vertical',
    contents: items.map(item => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: item.label,
          size: 'sm',
          color: THEME.TEXT_SECONDARY,
          flex: 1
        },
        {
          type: 'text',
          text: item.value,
          size: 'sm',
          color: item.color || THEME.TEXT_PRIMARY,
          weight: 'bold',
          align: 'end',
          flex: 2
        }
      ]
    })),
    backgroundColor: THEME.SURFACE,
    cornerRadius: '12px',
    paddingAll: '16px',
    margin: 'lg',
    spacing: 'sm'
  };
}

function getMemberLevel(points) {
  points = points || 0;
  if (points >= 50) return { title: 'GOLD', description: 'สมาชิกทอง', color: '#FFD700' };
  if (points >= 30) return { title: 'SILVER', description: 'สมาชิกเงิน', color: '#C0C0C0' };
  if (points >= 10) return { title: 'BRONZE', description: 'สมาชิกทองแดง', color: '#CD7F32' };
  return { title: 'MEMBER', description: 'สมาชิกทั่วไป', color: THEME.SECONDARY };
}