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

// --- CONSTANTS ---
const THEME = {
  PRIMARY: '#3e2723', SECONDARY: '#5d4037', ACCENT: '#a1887f',
  SURFACE: '#efebe9', BACKGROUND: '#fafafa', TEXT_PRIMARY: '#2e2e2e',
  TEXT_SECONDARY: '#757575', SUCCESS: '#4caf50', WARNING: '#ff9800',
  ERROR: '#f44336'
};
const TEXT = {
  WELCOME: 'ยินดีต้อนรับสู่ DekCha Mueang Tak', POINT_BALANCE: 'แต้มสะสม',
  USER_INFO: 'ข้อมูลสมาชิก', MENU_TITLE: 'เมนู', HELP_TITLE: 'ช่วยเหลือ',
  USER_NOT_FOUND: 'ไม่พบข้อมูลสมาชิก กรุณาลงทะเบียนก่อน',
  ERROR_MESSAGE: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง'
};

// --- NEW: In-Memory Cache for Menu ---
const menuCache = {
  data: {},
  expiry: {},
  CACHE_DURATION: 5 * 60 * 1000, // 5 นาที
  get(key) {
    if (this.expiry[key] > Date.now()) {
      return this.data[key];
    }
    return null;
  },
  set(key, value) {
    this.data[key] = value;
    this.expiry[key] = Date.now() + this.CACHE_DURATION;
  }
};

// --- REFACTORED: Command Mapping ---
const commandMap = new Map([
  [['แต้มคงเหลือ', 'แต้ม', 'point', 'points'], (event, userId) => 
    handleUserReply(event, userId, createPointMessage, 'ไม่สามารถดึงข้อมูลแต้มสะสมได้')],
  [['ข้อมูลผู้ใช้งาน', 'ข้อมูลสมาชิก', 'profile', 'info'], (event, userId) => 
    handleUserReply(event, userId, createUserInfoMessage, 'ไม่สามารถดึงข้อมูลสมาชิกได้')],
  [['เมนู', 'menu'], (event) => reply(event, createMenuMessage())],
  [['ช่วยเหลือ', 'help'], (event) => reply(event, createHelpMessage())],
  [['สวัสดี', 'hello', 'hi'], (event, userId) => handleWelcome(event, userId)]
]);

// --- MAIN HANDLER (Unchanged) ---
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  try {
    const events = req.body.events || [];
    await Promise.all(events.map(handleEvent));
    res.status(200).json({ success: true, processed: events.length });
  } catch (err) {
    console.error('[Main] Error:', err);
    res.status(500).send('Internal Server Error');
  }
};

// --- REFACTORED: Event Handler ---
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return null;

  const { userId } = event.source;
  const text = event.message.text.trim().toLowerCase();
  console.log(`[Event] User: ${userId}, Message: "${text}"`);

  try {
    // 1. Check for menu commands with pagination using Regex
    const menuRegex = /^(เมนูทั่วไป|เมนูโปรโมชั่น)(?:\s*หน้า\s*(\d+))?$/;
    const menuMatch = text.match(menuRegex);

    if (menuMatch) {
      const menuName = menuMatch[1];
      const page = parseInt(menuMatch[2] || '1', 10);
      const menuType = menuName === 'เมนูทั่วไป' ? 0 : 2;
      
      const menuItems = await getMenuItems(menuType);
      return reply(event, createMenuDisplayMessage(menuItems, menuName, page, menuType));
    }

    // 2. Check for other commands using the command map
    for (const [aliases, handler] of commandMap.entries()) {
      if (aliases.includes(text)) {
        return handler(event, userId);
      }
    }

    // 3. Fallback to default message
    return reply(event, createDefaultMessage());

  } catch (error) {
    console.error(`[Event] Error handling event for text "${text}":`, error);
    return reply(event, createErrorMessage());
  }
}

// --- OPTIMIZED: Database Utilities ---
async function getUserData(userId) {
  if (!userId) return { user: null, error: 'ไม่พบ User ID' };
  try {
    const { data, error } = await supabase.from("user").select('*').eq('userid', userId).single();
    if (error || !data) {
      console.warn(`[getUserData] User not found or error for ${userId}:`, error?.message);
      return { user: null, error: 'ไม่พบข้อมูลผู้ใช้' };
    }
    return { user: data, error: null };
  } catch (e) {
    console.error("[getUserData] Unexpected error:", e);
    return { user: null, error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' };
  }
}

// OPTIMIZED with Caching
async function getMenuItems(status) {
  const cacheKey = `menu_status_${status}`;
  const cachedItems = menuCache.get(cacheKey);
  if (cachedItems) {
    console.log(`[getMenuItems] Cache HIT for status: ${status}`);
    return cachedItems;
  }
  console.log(`[getMenuItems] Cache MISS for status: ${status}. Fetching from DB.`);

  try {
    const { data, error } = await supabase.from('menu')
      .select('idmenu, name, point, category, image, exp, date').eq('status', status).order('name');

    if (error) throw error;

    const menuItems = (data || []).map(item => ({
        idmenu: item.idmenu || '',
        name: item.name || 'ไม่ระบุชื่อ',
        point: item.point || 0,
        category: item.category || 'อื่นๆ',
        image: item.image || '',
        exp: item.exp || null,
        date: item.date || null
    }));
      
    menuCache.set(cacheKey, menuItems); // Save to cache
    return menuItems;
  } catch (e) {
    console.error('[getMenuItems] Unexpected error:', e);
    return []; // Return empty on error, don't cache failures
  }
}

// --- REFACTORED: Wrapper Functions ---
async function handleUserReply(event, userId, createMessageFn, errorMsg) {
  try {
    const { user, error } = await getUserData(userId);
    if (error) {
        return reply(event, error === 'ไม่พบข้อมูลผู้ใช้' ? createUserNotFoundMessage() : createErrorMessage(error));
    }
    return reply(event, createMessageFn(user));
  } catch (e) {
    console.error('[handleUserReply] Error:', e);
    return reply(event, createErrorMessage(errorMsg));
  }
}

async function handleWelcome(event, userId) {
  try {
    const { user } = await getUserData(userId);
    return reply(event, createWelcomeMessage(user?.name || null));
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
  return client.replyMessage(event.replyToken, message).catch(err => {
    console.error('[reply] Error sending message:', err.originalError?.response?.data || err);
  });
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
        spacing: 'md',
        contents: [
          // Header
          headerBox('✨ แต้มสะสมของคุณ', level.title, level.color),
          { type: 'separator', margin: 'lg' },
          // Point Display Area
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: `${user.userpoint || 0}`,
                size: '5xl',
                weight: 'bold',
                color: THEME.PRIMARY,
                align: 'center',
                margin: 'none'
              },
              {
                type: 'text',
                text: 'แต้ม',
                size: 'sm',
                color: THEME.TEXT_SECONDARY,
                align: 'center'
              }
            ],
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
            height: 'md',
            margin: 'lg'
          }
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND
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

function createMenuDisplayMessage(menuItems, title, page = 1, menuType = 0) {
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

  // Handle general menu separately (single card)
  if (menuType === 0) {
    const listItems = menuItems.map(item => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'image',
          url: item.image || 'https://via.placeholder.com/100x100?text=No+Image',
          size: 'md',
          aspectRatio: '1:1',
          aspectMode: 'cover',
          cornerRadius: '8px',
          flex: 1
        },
        {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: item.name,
              weight: 'bold',
              size: 'md',
              wrap: true,
              color: THEME.TEXT_PRIMARY
            },
            {
              type: 'text',
              text: `ใช้ ${item.point} แต้ม`,
              size: 'sm',
              color: THEME.PRIMARY
            }
          ],
          flex: 4,
          margin: 'sm'
        }
      ],
      margin: 'lg'
    }));

    return {
      type: 'flex',
      altText: 'รายการเมนูทั่วไป',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            headerBox(title),
            { type: 'separator', margin: 'lg' },
            ...listItems,
            {
              type: 'button',
              action: { type: 'message', label: 'กลับเมนูหลัก', text: 'เมนู'},
              style: 'primary',
              color: THEME.PRIMARY,
              height: 'sm',
              margin: 'xl'
            }
          ],
          paddingAll: '20px',
          backgroundColor: THEME.BACKGROUND,
          spacing: 'md'
        }
      }
    };
  }


  // --- Promotion Menu with Pagination (Unchanged) ---
  const itemsPerPage = 5;
  const totalItems = menuItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  page = Math.max(1, Math.min(page, totalPages));

  const start = (page - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = menuItems.slice(start, end);

  const menuBubbles = pageItems.map(item => {
    const imageUrl = item.image || 'https://via.placeholder.com/640x400?text=No+Image';
    
    // Check if the promotion has expired
    const isPromotion = menuType === 2;
    const isExpired = isPromotion && item.exp && new Date(item.exp) < new Date();

    const additionalInfo = [];
    if (isPromotion && item.exp) {
        const expDate = new Date(item.exp);
        const formattedExp = expDate.toLocaleDateString('th-TH', { 
            year: 'numeric', month: 'long', day: 'numeric' 
        });
        additionalInfo.push({
            type: 'text',
            text: `หมดโปรโมชั่น: ${formattedExp}`,
            size: 'sm',
            color: THEME.ERROR, // Highlight in red
            margin: 'sm'
        });
    }

    // Display "Expired" message and disable button if expired
    const footerContents = [];
    if (isExpired) {
        footerContents.push({
            type: 'text',
            text: 'โปรโมชั่นหมดอายุแล้ว',
            size: 'sm',
            color: THEME.ERROR,
            align: 'center',
            wrap: true
        });
    } else {
        footerContents.push({
            type: 'button',
            action: {
                type: 'uri',
                label: 'แลกสิทธิ์',
                uri: `https://dekcha-frontend.vercel.app/order/${item.idmenu}`
            },
            style: 'primary',
            color: THEME.PRIMARY,
            height: 'sm'
        });
    }

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
        spacing: 'sm',
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
            color: THEME.TEXT_SECONDARY
          },
          ...additionalInfo, // Add new date fields here
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: 'ใช้',
                size: 'sm',
                color: THEME.TEXT_SECONDARY
              },
              {
                type: 'text',
                text: `${item.point} แต้ม`,
                size: 'xl',
                weight: 'bold',
                color: THEME.PRIMARY,
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
        contents: footerContents,
        paddingAll: '12px'
      }
    };
  });

  if (totalPages > 1) {
      const navContents = [];
      if (page > 1) {
        navContents.push({
          type: 'button',
          action: { type: 'message', label: '◀️ ก่อนหน้า', text: `${title} หน้า ${page - 1}`},
          style: 'secondary', color: THEME.SECONDARY, height: 'sm', flex: 1
        });
      }
      if (page < totalPages) {
        navContents.push({
          type: 'button',
          action: { type: 'message', label: 'ต่อไป ▶️', text: `${title} หน้า ${page + 1}`},
          style: 'secondary', color: THEME.SECONDARY, height: 'sm', flex: 1
        });
      }
      
      const navigationBubble = {
          type: 'bubble',
          body: {
              type: 'box',
              layout: 'vertical',
              spacing: 'md',
              contents: [
                  {
                      type: 'text',
                      text: `หน้า ${page} / ${totalPages}`,
                      align: 'center',
                      color: THEME.TEXT_SECONDARY
                  },
                  {
                      type: 'box',
                      layout: 'horizontal',
                      contents: navContents,
                      spacing: 'sm',
                      margin: 'md'
                  },
                  {
                      type: 'button',
                      action: { type: 'message', label: 'กลับเมนูหลัก', text: 'เมนู'},
                      style: 'primary',
                      color: THEME.PRIMARY,
                      height: 'sm',
                      margin: 'lg'
                  }
              ]
          }
      };
      menuBubbles.push(navigationBubble);
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