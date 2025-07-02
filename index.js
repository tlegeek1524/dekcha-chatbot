const express = require('express');
const line = require('@line/bot-sdk');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

// LINE Bot configuration
const config = {
  channelAccessToken: 'REG0CAijX1esVbPqu1wlpUkKeFP739y86ZFzDk2QDKGP1v2HfGKdKnBBzNNdMcdkjufRQOQEhLQl9zeotJboR8WjtCOOrIkWAlxTa3U946Z19XemRyjymvs36n0Ee7ZtOpe+nwycCC4QNngADupCRgdB04t89/1O/w1cDnyilFU=',
  channelSecret: 'de016ec05f8d96c9d92e46a86bd805c8'
};

const client = new line.Client(config);

// ตั้งค่าธีมสีหลักสำหรับร้านคาเฟ่
const THEME = {
  PRIMARY: '#5D4037',        // น้ำตาลเข้ม (สีหลัก)
  SECONDARY: '#8D6E63',      // น้ำตาลอ่อน (สีรอง)
  ACCENT: '#FFAB91',         // สีส้มพีช (สีเน้น)
  BACKGROUND: '#FFF8E1',     // ครีมอ่อน (พื้นหลัง)
  TEXT_DARK: '#3E2723',      // สีข้อความเข้ม
  TEXT_LIGHT: '#D7CCC8',     // สีข้อความอ่อน
  SUCCESS: '#81C784',        // สีเขียวอ่อน (สำเร็จ)
  ERROR: '#E57373',          // สีแดงอ่อน (ผิดพลาด)
  HEADER_BG: '#4E342E',      // สีพื้นหลังส่วนหัว
  FOOTER_BG: '#EFEBE9',      // สีพื้นหลังส่วนท้าย
};

// ข้อความทั่วไปที่ใช้ในแอป
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

// Webhook endpoint
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(result => res.json(result))
    .catch(err => {
      console.error(err);
      res.status(500).end();
    });
});

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

// จัดการคำสั่งดูแต้มคงเหลือ
async function handlePointBalance(event, userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { userId: userId },
    });
    if (user) {
      return client.replyMessage(event.replyToken, createPointFlexMessage(user));
    } else {
      return client.replyMessage(event.replyToken, createUserNotFoundMessage());
    }
  } catch (err) {
    console.error(err);
    return client.replyMessage(event.replyToken, createErrorFlexMessage('ไม่สามารถดึงข้อมูลแต้มสะสมได้'));
  }
}

// จัดการคำสั่งดูข้อมูลผู้ใช้งาน
async function handleUserInfo(event, userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { userId: userId },
    });
    if (user) {
      return client.replyMessage(event.replyToken, createUserInfoFlexMessage(user));
    } else {
      return client.replyMessage(event.replyToken, createUserNotFoundMessage());
    }
  } catch (err) {
    console.error(err);
    return client.replyMessage(event.replyToken, createErrorFlexMessage('ไม่สามารถดึงข้อมูลสมาชิกได้'));
  }
}

// สร้าง Flex Message สำหรับกรณีไม่พบข้อมูลผู้ใช้
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
              uri: 'https://example.com/register',
            },
            style: 'primary',
            color: THEME.PRIMARY,
          },
        ],
      },
      styles: {
        body: {
          backgroundColor: THEME.BACKGROUND,
        },
        footer: {
          backgroundColor: THEME.FOOTER_BG,
        },
      },
    },
  };
}

// สร้าง Flex Message สำหรับแสดงแต้มคงเหลือ (ลบหลอดออก)
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
              {
                type: 'text',
                text: '👤 สมาชิก',
                size: 'sm',
                color: THEME.SECONDARY,
                flex: 1,
              },
              {
                type: 'text',
                text: `${user.name}`,
                size: 'sm',
                color: THEME.TEXT_DARK,
                align: 'end',
                flex: 2,
              },
            ],
            margin: 'md',
          },
          {
            type: 'separator',
            margin: 'lg',
            color: THEME.TEXT_LIGHT,
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
            action: {
              type: 'message',
              label: 'ดูข้อมูลสมาชิก',
              text: 'ข้อมูลผู้ใช้งาน',
            },
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
          {
            type: 'text',
            text: TEXT.USER_INFO,
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
            text: memberLevel.title,
            size: 'lg',
            weight: 'bold',
            align: 'center',
            color: memberLevel.color,
          },
          {
            type: 'text',
            text: memberLevel.description,
            size: 'xs',
            align: 'center',
            color: THEME.SECONDARY,
            margin: 'sm',
          },
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
              {
                type: 'text',
                text: '👤 ชื่อสมาชิก',
                weight: 'bold',
                size: 'sm',
                color: THEME.SECONDARY,
                flex: 1,
              },
              {
                type: 'text',
                text: `${user.name}`,
                size: 'sm',
                color: THEME.TEXT_DARK,
                align: 'end',
                flex: 2,
              },
            ],
            margin: 'md',
          },
          {
            type: 'separator',
            margin: 'lg',
            color: THEME.TEXT_LIGHT,
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '🔑 รหัสสมาชิก',
                weight: 'bold',
                size: 'sm',
                color: THEME.SECONDARY,
                flex: 1,
              },
              {
                type: 'text',
                text: `${user.uid}`,
                size: 'sm',
                color: THEME.TEXT_DARK,
                align: 'end',
                flex: 2,
              },
            ],
            margin: 'md',
          },
          {
            type: 'separator',
            margin: 'lg',
            color: THEME.TEXT_LIGHT,
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '✨ แต้มสะสม',
                weight: 'bold',
                size: 'sm',
                color: THEME.SECONDARY,
                flex: 1,
              },
              {
                type: 'text',
                text: `${user.userpoint} แต้ม`,
                size: 'sm',
                color: memberLevel.color,
                align: 'end',
                flex: 2,
                weight: 'bold',
              },
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
          {
            type: 'button',
            action: {
              type: 'message',
              label: 'ดูแต้มคงเหลือ',
              text: 'แต้มคงเหลือ',
            },
            style: 'primary',
            color: THEME.PRIMARY,
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: 'ดูเมนู',
              text: 'เมนู',
            },
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

// ฟังก์ชันคำนวณระดับสมาชิก
function getMemberLevel(points) {
  if (points >= 50) {
    return {
      title: 'GOLD MEMBER',
      description: 'สมาชิกระดับทอง',
      color: '#FFD700',
    };
  } else if (points >= 30) {
    return {
      title: 'SILVER MEMBER',
      description: 'สมาชิกระดับเงิน',
      color: '#C0C0C0',
    };
  } else if (points >= 10) {
    return {
      title: 'BRONZE MEMBER',
      description: 'สมาชิกระดับทองแดง',
      color: '#CD7F32',
    };
  } else {
    return {
      title: 'MEMBER',
      description: 'สมาชิกทั่วไป',
      color: THEME.SECONDARY,
    };
  }
}

// สร้าง Flex Message สำหรับแสดงเมนู (ลบปุ่มโปรโมชั่น)
function createMenuFlexMessage() {
  return {
    type: 'flex',
    altText: TEXT.MENU_TITLE,
    contents: {
      type: 'carousel',
      contents: [
        // เมนูบัตรที่ 1: คำสั่งหลัก
        {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: TEXT.MENU_TITLE,
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
                type: 'button',
                action: {
                  type: 'message',
                  label: '💰 แต้มคงเหลือ',
                  text: 'แต้มคงเหลือ',
                },
                style: 'primary',
                color: THEME.PRIMARY,
                margin: 'md',
              },
              {
                type: 'button',
                action: {
                  type: 'message',
                  label: '👤 ข้อมูลสมาชิก',
                  text: 'ข้อมูลผู้ใช้งาน',
                },
                style: 'primary',
                color: THEME.SECONDARY,
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
                type: 'text',
                text: 'เลือกเมนูที่ต้องการ',
                size: 'xs',
                color: THEME.SECONDARY,
                align: 'center',
              },
            ],
            backgroundColor: THEME.FOOTER_BG,
            paddingAll: '10px',
          },
        },
        // เมนูบัตรที่ 2: ความช่วยเหลือ
        {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: TEXT.HELP_TITLE,
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
                text: 'วิธีใช้งาน',
                weight: 'bold',
                size: 'lg',
                margin: 'md',
                color: THEME.PRIMARY,
              },
              {
                type: 'text',
                text: 'พิมพ์คำสั่งต่อไปนี้เพื่อใช้งาน:',
                margin: 'md',
                wrap: true,
                size: 'sm',
                color: THEME.TEXT_DARK,
              },
              {
                type: 'text',
                text: '• "แต้ม" - ดูแต้มสะสมของคุณ',
                margin: 'sm',
                wrap: true,
                size: 'sm',
                color: THEME.TEXT_DARK,
              },
              {
                type: 'text',
                text: '• "ข้อมูล" - ดูข้อมูลสมาชิก',
                margin: 'sm',
                wrap: true,
                size: 'sm',
                color: THEME.TEXT_DARK,
              },
              {
                type: 'text',
                text: '• "เมนู" - แสดงเมนูคำสั่งทั้งหมด',
                margin: 'sm',
                wrap: true,
                size: 'sm',
                color: THEME.TEXT_DARK,
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
                action: {
                  type: 'uri',
                  label: 'ติดต่อพนักงาน',
                  uri: 'https://line.me/ti/p/~@teaVibesCafe',
                },
                style: 'secondary',
                color: THEME.PRIMARY,
              },
            ],
            backgroundColor: THEME.FOOTER_BG,
            paddingAll: '10px',
          },
        },
      ],
    },
  };
}

// สร้าง Flex Message สำหรับความช่วยเหลือ (ลบข้อความ "สะสมครบ")
function createHelpFlexMessage() {
  return {
    type: 'flex',
    altText: 'ช่วยเหลือการใช้งาน',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🤖 วิธีใช้งาน TeaVibes Cafe',
            weight: 'bold',
            size: 'lg',
            color: '#FFFFFF',
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
            text: 'สวัสดีค่ะ! คุณสามารถใช้คำสั่งต่อไปนี้:',
            margin: 'md',
            wrap: true,
            color: THEME.PRIMARY,
            weight: 'bold',
          },
          {
            type: 'separator',
            margin: 'md',
            color: THEME.TEXT_LIGHT,
          },
          {
            type: 'text',
            text: '• "แต้ม" - ดูแต้มสะสมของคุณ',
            margin: 'md',
            wrap: true,
            size: 'sm',
            color: THEME.TEXT_DARK,
          },
          {
            type: 'text',
            text: '• "ข้อมูล" - ดูข้อมูลสมาชิก',
            margin: 'sm',
            wrap: true,
            size: 'sm',
            color: THEME.TEXT_DARK,
          },
          {
            type: 'text',
            text: '• "เมนู" - แสดงเมนูคำสั่งทั้งหมด',
            margin: 'sm',
            wrap: true,
            size: 'sm',
            color: THEME.TEXT_DARK,
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
            action: {
              type: 'message',
              label: 'แสดงเมนู',
              text: 'เมนู',
            },
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

// เริ่มต้นเซิร์ฟเวอร์
app.listen(3001, () => {
  console.log('🚀 TeaVibes Cafe LINE Bot กำลังทำงานที่พอร์ต 3001');
});
