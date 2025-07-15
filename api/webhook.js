const line = require('@line/bot-sdk');
const { createClient } = require('@supabase/supabase-js');

// --- CONFIG ---
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const supabase = createClient(
  'https://mhpetiaaadwsvrtbkmue.supabase.co',
  process.env.SUPABASE_KEY
);
const client = new line.Client(config);

// --- MODERN CAFE THEME ---
const THEME = {
  PRIMARY: '#8B4513',      // Rich brown - เหมือนเมล็ดกาแฟ
  SECONDARY: '#D2691E',    // Orange brown - อบอุ่น
  ACCENT: '#F5DEB3',       // Wheat - ครีมนวล
  BACKGROUND: '#FFFEF7',   // Off white - สีพื้นหลังนุ่มนวล
  SURFACE: '#F8F6F0',      // Light beige - พื้นผิวการ์ด
  TEXT_PRIMARY: '#2D1B17', // Dark brown - ข้อความหลัก
  TEXT_SECONDARY: '#8B7355', // Medium brown - ข้อความรอง
  SUCCESS: '#228B22',      // Forest green - สีเขียวธรรมชาติ
  WARNING: '#FF8C00',      // Orange - สีเตือน
  ERROR: '#CD5C5C',        // Indian red - สีแดงนุ่ม
  GRADIENT_START: '#8B4513',
  GRADIENT_END: '#D2691E'
};

const TEXT = {
  WELCOME: 'ยินดีต้อนรับสู่ TeaVibes Cafe',
  POINT_BALANCE: 'แต้มสะสมของคุณ',
  USER_INFO: 'ข้อมูลสมาชิก',
  MENU_TITLE: 'เมนูหลัก',
  HELP_TITLE: 'ช่วยเหลือ',
  ERROR_TITLE: 'พบข้อผิดพลาด',
  USER_NOT_FOUND: 'ไม่พบข้อมูลสมาชิก กรุณาลงทะเบียนก่อนใช้งาน',
  ERROR_MESSAGE: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้งในภายหลัง',
};

// --- MAIN HANDLER ---
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  try {
    const results = await Promise.all((req.body.events || []).map(handleEvent));
    res.status(200).json(results);
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
  
  switch (text) {
    case 'แต้มคงเหลือ': case 'แต้ม': case 'point': case 'points':
      return handleUserReply(event, userId, createPointFlexMessage, 'ไม่สามารถดึงข้อมูลแต้มสะสมได้');
    case 'ข้อมูลผู้ใช้งาน': case 'ข้อมูลสมาชิก': case 'profile': case 'info':
      return handleUserReply(event, userId, createUserInfoFlexMessage, 'ไม่สามารถดึงข้อมูลสมาชิกได้');
    case 'เมนู': case 'menu':
      return reply(event, createMenuFlexMessage());
    case 'ช่วยเหลือ': case 'help':
      return reply(event, createHelpFlexMessage());
    case 'สวัสดี': case 'hello': case 'hi':
      return handleWelcome(event, userId);
    default:
      return reply(event, createDefaultMessage());
  }
}

// --- UTILITIES ---
async function getUserData(userId) {
  console.log("getUserData called with userId:", userId);

  if (!userId) {
    console.warn("No userId provided");
    return { user: null, found: false };
  }

  try {
    const { data, error } = await supabase
      .from("user")
      .select('*')
      .eq('userid', userId);

    console.log("Supabase response:", { data, error });

    if (error) {
      console.error("Error fetching user data:", error.message);
      return { user: null, found: false };
    }

    if (!data || data.length === 0) {
      console.info("No user found with given userId:", userId);
      return { user: null, found: false };
    }

    console.log("User found:", data[0]);
    return { user: data[0], found: true };

  } catch (e) {
    console.error("Unexpected error in getUserData:", e);
    return { user: null, found: false };
  }
}

async function handleUserReply(event, userId, messageFn, errorMsg) {
  try {
    const { user, found } = await getUserData(userId);
    return reply(event, found ? messageFn(user) : createUserNotFoundMessage());
  } catch (e) {
    return reply(event, createErrorFlexMessage(errorMsg));
  }
}

async function handleWelcome(event, userId) {
  const { user, found } = await getUserData(userId);
  return reply(event, createWelcomeMessage(found ? user.name : null));
}

function reply(event, message) {
  return client.replyMessage(event.replyToken, message);
}

// --- MODERN FLEX MESSAGE GENERATORS ---
function createWelcomeMessage(name) {
  return {
    type: 'flex',
    altText: TEXT.WELCOME,
    contents: {
      type: 'bubble',
      size: 'giga',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: TEXT.WELCOME,
                size: 'xl',
                weight: 'bold',
                color: THEME.PRIMARY,
                align: 'center'
              },
              {
                type: 'text',
                text: name ? `สวัสดีคุณ ${name}` : 'สวัสดี',
                size: 'lg',
                color: THEME.TEXT_PRIMARY,
                align: 'center',
                margin: 'md'
              },
              {
                type: 'text',
                text: 'ยินดีต้อนรับสู่ระบบสมาชิก',
                size: 'sm',
                color: THEME.TEXT_SECONDARY,
                align: 'center',
                margin: 'sm'
              }
            ],
            backgroundColor: THEME.SURFACE,
            paddingAll: '24px',
            cornerRadius: '16px',
            margin: 'none'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              modernButton('ดูแต้มคงเหลือ', 'แต้มคงเหลือ', true),
              modernButton('ดูข้อมูลสมาชิก', 'ข้อมูลสมาชิก', false)
            ],
            spacing: 'md',
            margin: 'xl'
          }
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'none'
      }
    }
  };
}

function createPointFlexMessage(user) {
  return {
    type: 'flex',
    altText: `${TEXT.POINT_BALANCE} ${user.name}`,
    contents: {
      type: 'bubble',
      size: 'giga',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: TEXT.POINT_BALANCE,
            size: 'xl',
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
                text: `${user.userpoint}`,
                size: '5xl',
                weight: 'bold',
                color: THEME.PRIMARY,
                align: 'center'
              },
              {
                type: 'text',
                text: 'แต้ม',
                size: 'md',
                color: THEME.TEXT_SECONDARY,
                align: 'center',
                margin: 'sm'
              }
            ],
            backgroundColor: THEME.SURFACE,
            cornerRadius: '20px',
            paddingAll: '32px',
            margin: 'xl'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              infoRow('สมาชิก', user.name),
              {
                type: 'separator',
                margin: 'lg',
                color: THEME.ACCENT
              },
              infoRow('ระดับ', getMemberLevel(user.userpoint).title)
            ],
            backgroundColor: THEME.SURFACE,
            cornerRadius: '16px',
            paddingAll: '20px',
            margin: 'lg'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'uri',
                  label: 'แลกสิทธิพิเศษ',
                  uri: 'https://dekcha-frontend.vercel.app/'
                },
                style: 'primary',
                color: THEME.PRIMARY,
                height: 'md'
              }
            ],
            margin: 'xl'
          }
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'none'
      }
    }
  };
}

function createUserInfoFlexMessage(user) {
  const level = getMemberLevel(user.userpoint);
  return {
    type: 'flex',
    altText: `${TEXT.USER_INFO} ${user.name}`,
    contents: {
      type: 'bubble',
      size: 'giga',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: TEXT.USER_INFO,
            size: 'xl',
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
                text: level.title,
                size: 'lg',
                weight: 'bold',
                color: level.color,
                align: 'center'
              },
              {
                type: 'text',
                text: level.description,
                size: 'sm',
                color: THEME.TEXT_SECONDARY,
                align: 'center',
                margin: 'sm'
              }
            ],
            backgroundColor: THEME.SURFACE,
            cornerRadius: '16px',
            paddingAll: '20px',
            margin: 'xl'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              infoRow('ชื่อสมาชิก', user.name),
              {
                type: 'separator',
                margin: 'lg',
                color: THEME.ACCENT
              },
              infoRow('รหัสสมาชิก', user.uid),
              {
                type: 'separator',
                margin: 'lg',
                color: THEME.ACCENT
              },
              infoRow('แต้มสะสม', `${user.userpoint} แต้ม`, level.color)
            ],
            backgroundColor: THEME.SURFACE,
            cornerRadius: '16px',
            paddingAll: '20px',
            margin: 'lg'
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              modernButton('ดูแต้มคงเหลือ', 'แต้มคงเหลือ', true, 'sm'),
              modernButton('ดูเมนู', 'เมนู', false, 'sm')
            ],
            spacing: 'md',
            margin: 'xl'
          }
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'none'
      }
    }
  };
}

function createMenuFlexMessage() {
  const menuItems = [
    { name: 'เครื่องดื่มร้อน', desc: 'กาแฟ, ชา, ช็อกโกแลต' },
    { name: 'เครื่องดื่มเย็น', desc: 'ชานมไข่มุก, กาแฟเย็น' },
    { name: 'ขนมหวาน', desc: 'เค้ก, คุกกี้, มาการอง' },
    { name: 'ขนมปัง', desc: 'แซนวิช, ครัวซอง' }
  ];

  return {
    type: 'flex',
    altText: TEXT.MENU_TITLE,
    contents: {
      type: 'bubble',
      size: 'giga',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: TEXT.MENU_TITLE,
            size: 'xl',
            weight: 'bold',
            color: THEME.PRIMARY,
            align: 'center'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: menuItems.map(item => createMenuItem(item.name, item.desc)),
            backgroundColor: THEME.SURFACE,
            cornerRadius: '16px',
            paddingAll: '20px',
            margin: 'xl',
            spacing: 'md'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'uri',
                  label: 'สั่งสินค้า',
                  uri: 'https://dekcha-frontend.vercel.app/'
                },
                style: 'primary',
                color: THEME.PRIMARY,
                height: 'md'
              }
            ],
            margin: 'xl'
          }
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'none'
      }
    }
  };
}

function createHelpFlexMessage() {
  const commands = [
    { cmd: 'แต้มคงเหลือ', desc: 'ดูแต้มสะสมของคุณ' },
    { cmd: 'ข้อมูลสมาชิก', desc: 'ดูข้อมูลผู้ใช้งาน' },
    { cmd: 'เมนู', desc: 'ดูเมนูสินค้า' },
    { cmd: 'สวัสดี', desc: 'ข้อความต้อนรับ' }
  ];

  return {
    type: 'flex',
    altText: TEXT.HELP_TITLE,
    contents: {
      type: 'bubble',
      size: 'giga',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: TEXT.HELP_TITLE,
            size: 'xl',
            weight: 'bold',
            color: THEME.PRIMARY,
            align: 'center'
          },
          {
            type: 'text',
            text: 'คำสั่งที่ใช้ได้',
            size: 'md',
            color: THEME.TEXT_SECONDARY,
            align: 'center',
            margin: 'md'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: commands.map(item => createHelpItem(item.cmd, item.desc)),
            backgroundColor: THEME.SURFACE,
            cornerRadius: '16px',
            paddingAll: '20px',
            margin: 'xl',
            spacing: 'md'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              modernButton('ดูแต้มคงเหลือ', 'แต้มคงเหลือ', true)
            ],
            margin: 'xl'
          }
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'none'
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
            text: 'ไม่เข้าใจคำสั่ง',
            size: 'xl',
            weight: 'bold',
            color: THEME.WARNING,
            align: 'center'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'กรุณาเลือกคำสั่งที่ถูกต้อง',
                size: 'md',
                color: THEME.TEXT_SECONDARY,
                align: 'center'
              },
              {
                type: 'text',
                text: 'หรือพิมพ์ "ช่วยเหลือ" เพื่อดูคำสั่งทั้งหมด',
                size: 'sm',
                color: THEME.TEXT_SECONDARY,
                align: 'center',
                margin: 'sm',
                wrap: true
              }
            ],
            backgroundColor: THEME.SURFACE,
            cornerRadius: '16px',
            paddingAll: '20px',
            margin: 'xl'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              modernButton('ช่วยเหลือ', 'ช่วยเหลือ', true)
            ],
            margin: 'xl'
          }
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'none'
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
            text: 'ไม่พบข้อมูลสมาชิก',
            size: 'xl',
            weight: 'bold',
            color: THEME.ERROR,
            align: 'center'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: TEXT.USER_NOT_FOUND,
                size: 'md',
                color: THEME.TEXT_SECONDARY,
                align: 'center',
                wrap: true
              }
            ],
            backgroundColor: THEME.SURFACE,
            cornerRadius: '16px',
            paddingAll: '20px',
            margin: 'xl'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'uri',
                  label: 'ลงทะเบียนสมาชิก',
                  uri: 'https://dekcha-frontend.vercel.app/'
                },
                style: 'primary',
                color: THEME.PRIMARY,
                height: 'md'
              }
            ],
            margin: 'xl'
          }
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'none'
      }
    }
  };
}

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
          {
            type: 'text',
            text: TEXT.ERROR_TITLE,
            size: 'xl',
            weight: 'bold',
            color: THEME.ERROR,
            align: 'center'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: msg || TEXT.ERROR_MESSAGE,
                size: 'md',
                color: THEME.TEXT_SECONDARY,
                align: 'center',
                wrap: true
              }
            ],
            backgroundColor: THEME.SURFACE,
            cornerRadius: '16px',
            paddingAll: '20px',
            margin: 'xl'
          }
        ],
        paddingAll: '20px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'none'
      }
    }
  };
}

// --- MODERN HELPER FUNCTIONS ---
function modernButton(label, text, isPrimary, size = 'md') {
  return {
    type: 'button',
    action: {
      type: 'message',
      label: label,
      text: text
    },
    style: isPrimary ? 'primary' : 'secondary',
    color: isPrimary ? THEME.PRIMARY : THEME.SECONDARY,
    height: size,
    flex: 1
  };
}

function infoRow(label, value, valueColor = THEME.TEXT_PRIMARY) {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: label,
        size: 'sm',
        color: THEME.TEXT_SECONDARY,
        flex: 1
      },
      {
        type: 'text',
        text: value,
        size: 'sm',
        color: valueColor,
        weight: 'bold',
        align: 'end',
        flex: 2
      }
    ],
    margin: 'md'
  };
}

function createMenuItem(name, desc) {
  return {
    type: 'box',
    layout: 'vertical',
    contents: [
      {
        type: 'text',
        text: name,
        size: 'md',
        weight: 'bold',
        color: THEME.PRIMARY
      },
      {
        type: 'text',
        text: desc,
        size: 'sm',
        color: THEME.TEXT_SECONDARY,
        margin: 'xs'
      }
    ]
  };
}

function createHelpItem(cmd, desc) {
  return {
    type: 'box',
    layout: 'vertical',
    contents: [
      {
        type: 'text',
        text: `"${cmd}"`,
        size: 'sm',
        weight: 'bold',
        color: THEME.PRIMARY
      },
      {
        type: 'text',
        text: desc,
        size: 'xs',
        color: THEME.TEXT_SECONDARY,
        margin: 'xs'
      }
    ]
  };
}

function getMemberLevel(points) {
  if (points >= 50) return { title: 'GOLD MEMBER', description: 'สมาชิกระดับทอง', color: '#B8860B' };
  if (points >= 30) return { title: 'SILVER MEMBER', description: 'สมาชิกระดับเงิน', color: '#708090' };
  if (points >= 10) return { title: 'BRONZE MEMBER', description: 'สมาชิกระดับทองแดง', color: '#CD7F32' };
  return { title: 'MEMBER', description: 'สมาชิกทั่วไป', color: THEME.SECONDARY };
}