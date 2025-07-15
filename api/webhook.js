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

// --- MODERN BROWN THEME ---
const THEME = {
  PRIMARY: '#3e2723',      // Dark brown
  SECONDARY: '#5d4037',    // Medium brown
  ACCENT: '#a1887f',       // Light brown
  SURFACE: '#efebe9',      // Very light brown
  BACKGROUND: '#fafafa',   // Almost white
  TEXT_PRIMARY: '#2e2e2e',
  TEXT_SECONDARY: '#757575',
  SUCCESS: '#4caf50',
  WARNING: '#ff9800',
  ERROR: '#f44336'
};

const TEXT = {
  WELCOME: 'ยินดีต้อนรับสู่ TeaVibes Cafe',
  POINT_BALANCE: 'แต้มสะสม',
  USER_INFO: 'ข้อมูลสมาชิก',
  MENU_TITLE: 'เมนู',
  HELP_TITLE: 'ช่วยเหลือ',
  USER_NOT_FOUND: 'ไม่พบข้อมูลสมาชิก กรุณาลงทะเบียนก่อน',
  ERROR_MESSAGE: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง'
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
      return handleUserReply(event, userId, createPointMessage, 'ไม่สามารถดึงข้อมูลแต้มสะสมได้');
    case 'ข้อมูลผู้ใช้งาน': case 'ข้อมูลสมาชิก': case 'profile': case 'info':
      return handleUserReply(event, userId, createUserInfoMessage, 'ไม่สามารถดึงข้อมูลสมาชิกได้');
    case 'เมนู': case 'menu':
      return reply(event, createMenuMessage());
    case 'ช่วยเหลือ': case 'help':
      return reply(event, createHelpMessage());
    case 'สวัสดี': case 'hello': case 'hi':
      return handleWelcome(event, userId);
    default:
      return reply(event, createDefaultMessage());
  }
}

// --- UTILITIES ---
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

async function handleUserReply(event, userId, messageFn, errorMsg) {
  try {
    const { user, found } = await getUserData(userId);
    return reply(event, found ? messageFn(user) : createUserNotFoundMessage());
  } catch (e) {
    return reply(event, createErrorMessage(errorMsg));
  }
}

async function handleWelcome(event, userId) {
  const { user, found } = await getUserData(userId);
  return reply(event, createWelcomeMessage(found ? user.name : null));
}

function reply(event, message) {
  return client.replyMessage(event.replyToken, message);
}

// --- COMPACT FLEX MESSAGE GENERATORS ---
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
          headerBox(TEXT.WELCOME, name ? `สวัสดีคุณ ${name}` : 'สวัสดี'),
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
        paddingAll: '16px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'sm'
      }
    }
  };
}

function createPointMessage(user) {
  const level = getMemberLevel(user.userpoint);
  return {
    type: 'flex',
    altText: `${TEXT.POINT_BALANCE} ${user.userpoint} แต้ม`,
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
                text: `${user.userpoint}`,
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
            margin: 'md'
          },
          compactInfoBox([
            { label: 'สมาชิก', value: user.name },
            { label: 'ระดับ', value: level.title, color: level.color }
          ]),
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'แลกสิทธิพิเศษ',
              uri: 'https://dekcha-frontend.vercel.app/'
            },
            style: 'primary',
            color: THEME.PRIMARY,
            height: 'sm',
            margin: 'lg'
          }
        ],
        paddingAll: '16px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'sm'
      }
    }
  };
}

function createUserInfoMessage(user) {
  const level = getMemberLevel(user.userpoint);
  return {
    type: 'flex',
    altText: `${TEXT.USER_INFO} ${user.name}`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          headerBox(TEXT.USER_INFO, level.title, level.color),
          compactInfoBox([
            { label: 'ชื่อสมาชิก', value: user.name },
            { label: 'รหัสสมาชิก', value: user.uid },
            { label: 'แต้มสะสม', value: `${user.userpoint} แต้ม`, color: level.color }
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
        paddingAll: '16px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'sm'
      }
    }
  };
}

function createMenuMessage() {
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
            type: 'box',
            layout: 'vertical',
            contents: menuItems.map(item => ({
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: item.name,
                  size: 'sm',
                  weight: 'bold',
                  color: THEME.PRIMARY
                },
                {
                  type: 'text',
                  text: item.desc,
                  size: 'xs',
                  color: THEME.TEXT_SECONDARY,
                  margin: 'xs'
                }
              ]
            })),
            backgroundColor: THEME.SURFACE,
            cornerRadius: '12px',
            paddingAll: '16px',
            margin: 'md',
            spacing: 'md'
          },
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'สั่งสินค้า',
              uri: 'https://dekcha-frontend.vercel.app/'
            },
            style: 'primary',
            color: THEME.PRIMARY,
            height: 'sm',
            margin: 'lg'
          }
        ],
        paddingAll: '16px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'sm'
      }
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
            type: 'box',
            layout: 'vertical',
            contents: commands.map(item => ({
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: `"${item.cmd}"`,
                  size: 'xs',
                  weight: 'bold',
                  color: THEME.PRIMARY,
                  flex: 2
                },
                {
                  type: 'text',
                  text: item.desc,
                  size: 'xs',
                  color: THEME.TEXT_SECONDARY,
                  flex: 3
                }
              ]
            })),
            backgroundColor: THEME.SURFACE,
            cornerRadius: '12px',
            paddingAll: '16px',
            margin: 'md',
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
        paddingAll: '16px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'sm'
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
            size: 'md',
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
                text: 'พิมพ์ "ช่วยเหลือ" เพื่อดูคำสั่งทั้งหมด',
                size: 'sm',
                color: THEME.TEXT_SECONDARY,
                align: 'center',
                wrap: true
              }
            ],
            backgroundColor: THEME.SURFACE,
            cornerRadius: '12px',
            paddingAll: '16px',
            margin: 'md'
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: 'ช่วยเหลือ',
              text: 'ช่วยเหลือ'
            },
            style: 'primary',
            color: THEME.PRIMARY,
            height: 'sm',
            margin: 'lg'
          }
        ],
        paddingAll: '16px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'sm'
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
            size: 'md',
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
                size: 'sm',
                color: THEME.TEXT_SECONDARY,
                align: 'center',
                wrap: true
              }
            ],
            backgroundColor: THEME.SURFACE,
            cornerRadius: '12px',
            paddingAll: '16px',
            margin: 'md'
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
        paddingAll: '16px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'sm'
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
            text: 'พบข้อผิดพลาด',
            size: 'md',
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
                size: 'sm',
                color: THEME.TEXT_SECONDARY,
                align: 'center',
                wrap: true
              }
            ],
            backgroundColor: THEME.SURFACE,
            cornerRadius: '12px',
            paddingAll: '16px',
            margin: 'md'
          }
        ],
        paddingAll: '16px',
        backgroundColor: THEME.BACKGROUND,
        spacing: 'sm'
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
        size: 'sm',
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
    margin: 'md',
    spacing: 'sm'
  };
}

function getMemberLevel(points) {
  if (points >= 50) return { title: 'GOLD', description: 'สมาชิกทอง', color: '#FFD700' };
  if (points >= 30) return { title: 'SILVER', description: 'สมาชิกเงิน', color: '#C0C0C0' };
  if (points >= 10) return { title: 'BRONZE', description: 'สมาชิกทองแดง', color: '#CD7F32' };
  return { title: 'MEMBER', description: 'สมาชิกทั่วไป', color: THEME.SECONDARY };
}