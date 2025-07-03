const line = require('@line/bot-sdk');
const { createClient } = require('@supabase/supabase-js');

// --- CONFIG ---
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'SxsAFfK/FAxY0kjcJjaSFjhyN0GZIG7JR9MeTjh0u1FysDLjQW4jq+v5tjUcxZQgjufRQOQEhLQl9zeotJboR8WjtCOOrIkWAlxTa3U946YVAx/PFUW/7fSdYfN1+TCGXIGZRRJuKgq6nGuVay5lFgdB04t89/1O/w1cDnyilFU=',
  channelSecret: process.env.LINE_CHANNEL_SECRET || 'de016ec05f8d96c9d92e46a86bd805c8'
};
const supabase = createClient(
  'https://mhpetiaaadwsvrtbkmue.supabase.co',
  process.env.SUPABASE_KEY
);
const client = new line.Client(config);

// --- THEME & TEXT ---
const THEME = {
  PRIMARY: '#5D4037', SECONDARY: '#8D6E63', ACCENT: '#FFAB91',
  BACKGROUND: '#FFF8E1', TEXT_DARK: '#3E2723', TEXT_LIGHT: '#D7CCC8',
  SUCCESS: '#81C784', ERROR: '#E57373', HEADER_BG: '#4E342E', FOOTER_BG: '#EFEBE9'
};
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
  if (!userId) return { user: null, found: false };
  const { data, error } = await supabase.from('users').select('*').eq('userid', userId);
  if (error || !data || !data.length) return { user: null, found: false };
  return { user: data[0], found: true };
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

// --- FLEX MESSAGE GENERATORS ---
function createWelcomeMessage(name) {
  return flexBubble(TEXT.WELCOME, [
    { type: 'text', text: name ? `สวัสดี คุณ${name}!` : 'สวัสดี!', size: 'lg', weight: 'bold', color: THEME.PRIMARY, align: 'center' },
    { type: 'text', text: 'ยินดีต้อนรับสู่ระบบสมาชิก ☕', size: 'sm', color: THEME.SECONDARY, align: 'center', margin: 'md' }
  ], [
    btn('ดูแต้มคงเหลือ', 'แต้มคงเหลือ', 'primary'),
    btn('ดูข้อมูลสมาชิก', 'ข้อมูลสมาชิก', 'secondary', 'sm')
  ]);
}

function createDefaultMessage() {
  return flexBubble('ไม่เข้าใจคำสั่ง', [
    { type: 'text', text: '🤖 ไม่เข้าใจคำสั่ง', weight: 'bold', size: 'lg', color: THEME.PRIMARY },
    { type: 'text', text: 'ลองพิมพ์ "ช่วยเหลือ" เพื่อดูคำสั่งที่ใช้ได้', margin: 'md', wrap: true }
  ], [btn('ช่วยเหลือ', 'ช่วยเหลือ', 'primary')]);
}

function createUserNotFoundMessage() {
  return flexBubble(TEXT.USER_NOT_FOUND, [
    { type: 'text', text: '🔎 ไม่พบข้อมูลสมาชิก', weight: 'bold', size: 'xl', color: THEME.ERROR },
    { type: 'text', text: TEXT.USER_NOT_FOUND, margin: 'md', wrap: true }
  ], [
    {
      type: 'button',
      action: { type: 'uri', label: 'ลงทะเบียนสมาชิก', uri: 'https://dekcha-frontend.vercel.app/' },
      style: 'primary', color: THEME.PRIMARY
    }
  ]);
}

function createPointFlexMessage(user) {
  return {
    type: 'flex',
    altText: `${TEXT.POINT_BALANCE} ${user.name}`,
    contents: {
      type: 'bubble',
      header: flexHeader(TEXT.POINT_BALANCE),
      hero: {
        type: 'box', layout: 'vertical', contents: [
          { type: 'text', text: `${user.userpoint}`, size: '5xl', weight: 'bold', align: 'center', color: THEME.PRIMARY },
          { type: 'text', text: 'แต้ม', size: 'sm', align: 'center', color: THEME.SECONDARY, margin: 'sm' }
        ], paddingAll: '20px', backgroundColor: THEME.BACKGROUND
      },
      body: {
        type: 'box', layout: 'vertical', contents: [
          flexRow('👤 สมาชิก', user.name),
          { type: 'separator', margin: 'lg', color: THEME.TEXT_LIGHT }
        ], paddingAll: '20px', backgroundColor: THEME.BACKGROUND
      },
      footer: flexFooter([btn('ดูข้อมูลสมาชิก', 'ข้อมูลผู้ใช้งาน', 'primary')])
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
      header: flexHeader(TEXT.USER_INFO),
      hero: {
        type: 'box', layout: 'vertical', contents: [
          { type: 'text', text: level.title, size: 'lg', weight: 'bold', align: 'center', color: level.color },
          { type: 'text', text: level.description, size: 'xs', align: 'center', color: THEME.SECONDARY, margin: 'sm' }
        ], paddingAll: '15px', backgroundColor: THEME.BACKGROUND
      },
      body: {
        type: 'box', layout: 'vertical', contents: [
          flexRow('👤 ชื่อสมาชิก', user.name, true),
          { type: 'separator', margin: 'lg', color: THEME.TEXT_LIGHT },
          flexRow('🔑 รหัสสมาชิก', user.uid, true),
          { type: 'separator', margin: 'lg', color: THEME.TEXT_LIGHT },
          flexRow('✨ แต้มสะสม', `${user.userpoint} แต้ม`, true, level.color)
        ], paddingAll: '20px', backgroundColor: THEME.BACKGROUND
      },
      footer: flexFooter([
        btn('ดูแต้มคงเหลือ', 'แต้มคงเหลือ', 'primary'),
        btn('ดูเมนู', 'เมนู', 'secondary', 'sm')
      ])
    }
  };
}

function createMenuFlexMessage() {
  return flexBubble(TEXT.MENU_TITLE, [
    { type: 'text', text: '☕ กาแฟ\n🍵 ชา\n🧁 ขนมหวาน\n🥪 ขนมปัง', wrap: true, size: 'md', color: THEME.TEXT_DARK }
  ], [btn('สั่งสินค้า', 'สั่งสินค้า', 'primary')]);
}

function createHelpFlexMessage() {
  return flexBubble(TEXT.HELP_TITLE, [
    { type: 'text', text: '📝 คำสั่งที่ใช้ได้:\n\n• "แต้มคงเหลือ" - ดูแต้มสะสม\n• "ข้อมูลสมาชิก" - ดูข้อมูลผู้ใช้งาน\n• "เมนู" - ดูเมนูสินค้า\n• "สวัสดี" - ข้อความต้อนรับ', wrap: true, size: 'sm', color: THEME.TEXT_DARK }
  ], [btn('ดูแต้มคงเหลือ', 'แต้มคงเหลือ', 'primary')]);
}

function createErrorFlexMessage(msg) {
  return flexBubble(TEXT.ERROR_TITLE, [
    { type: 'text', text: TEXT.ERROR_TITLE, weight: 'bold', size: 'xl', color: THEME.ERROR },
    { type: 'text', text: msg || TEXT.ERROR_MESSAGE, margin: 'md', wrap: true }
  ]);
}

// --- FLEX HELPERS ---
function flexBubble(altText, bodyContents, footerContents = []) {
  return {
    type: 'flex',
    altText,
    contents: {
      type: 'bubble',
      header: flexHeader(altText),
      body: { type: 'box', layout: 'vertical', contents: bodyContents, paddingAll: '20px', backgroundColor: THEME.BACKGROUND },
      ...(footerContents.length && { footer: flexFooter(footerContents) }),
      styles: { body: { backgroundColor: THEME.BACKGROUND }, footer: { backgroundColor: THEME.FOOTER_BG } }
    }
  };
}
function flexHeader(text) {
  return {
    type: 'box',
    layout: 'vertical',
    contents: [{ type: 'text', text, weight: 'bold', color: '#FFFFFF', size: 'xl', align: 'center' }],
    backgroundColor: THEME.HEADER_BG,
    paddingTop: '20px',
    paddingBottom: '20px'
  };
}
function flexFooter(contents) {
  return { type: 'box', layout: 'vertical', contents, paddingAll: '15px', backgroundColor: THEME.FOOTER_BG };
}
function flexRow(label, value, bold = false, color) {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: label, size: 'sm', color: THEME.SECONDARY, flex: 1, ...(bold && { weight: 'bold' }) },
      { type: 'text', text: value, size: 'sm', color: color || THEME.TEXT_DARK, align: 'end', flex: 2, ...(bold && { weight: 'bold' }) }
    ],
    margin: 'md'
  };
}
function btn(label, text, style = 'primary', margin) {
  return {
    type: 'button',
    action: { type: 'message', label, text },
    style,
    color: style === 'primary' ? THEME.PRIMARY : THEME.SECONDARY,
    ...(margin && { margin })
  };
}
function getMemberLevel(points) {
  if (points >= 50) return { title: 'GOLD MEMBER', description: 'สมาชิกระดับทอง', color: '#FFD700' };
  if (points >= 30) return { title: 'SILVER MEMBER', description: 'สมาชิกระดับเงิน', color: '#C0C0C0' };
  if (points >= 10) return { title: 'BRONZE MEMBER', description: 'สมาชิกระดับทองแดง', color: '#CD7F32' };
  return { title: 'MEMBER', description: 'สมาชิกทั่วไป', color: THEME.SECONDARY };
}