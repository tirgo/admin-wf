const { Bot, InlineKeyboard } = require("grammy");
const database = require("../Database/database");

// Create an instance of the Bot class and pass your bot token to it.
const bot = new Bot("7058770363:AAHZAcPHrUPMaJBuj6Pcwsdojo4IRHOV38s"); // <-- put your bot token between the ""
bot.command("start", onCommandStart);


// Handle incoming messages
bot.on('message', async (ctx) => {
  const message = ctx.message;

  // Check if the message contains contact information
  if (message.contact) {
    await onContactReceived(ctx)
  }

});

bot.on('callback_query', async (ctx) => {
  const callbackData = ctx.callbackQuery.data;

  if (callbackData === '#services') {
      // Handle 'Типы услуг' button click here
     await onServicesClick(ctx);
  } else if(callbackData.startsWith('#service_')) {
    await ctx.reply(`you choosed.` + callbackData );
  }
});

bot.start();

function onCommandStart(ctx) {
  const chatFirstName = ctx.message.chat.first_name;
  const chatLastName = ctx.message.chat.last_name;

  let replyOptions = {
    reply_markup: {
      resize_keyboard: true,
      one_time_keyboard: true,
      force_reply: true,
      keyboard: [[{ text: "📱Отправить номер", request_contact: true }]],
    },
  };
  const text = `Добро пожаловать, ${chatFirstName ? chatFirstName : '@' + msg.from.username} ${chatLastName ? chatLastName : ''} ! \nПожалуйста отправьте свой номер телефона !`;

  // Reply to the user with the message
  ctx.reply(text, replyOptions);
}

async function onContactReceived(ctx) {
  const chatId = ctx.message.chat.id;
  const phoneNumber = ctx.message.contact?.phone_number.toString().replace('+', '');
  const chatFirstName = ctx.message.chat.first_name;
  const chatLastName = ctx.message.chat.last_name;
  const username = ctx.message.chat.username;
  const connection = await database.connection.getConnection();
  try {
    console.log(`Received contact information from ${chatFirstName}: ${phoneNumber}`);
     // Create an inline keyboard with menu options


 // Send the message with the menu
    await ctx.reply(`Thank you, ${chatFirstName}! We've received your contact information.`);


    const user = await connection.query(`
      SELECT * FROM users_contacts WHERE text = ?
    `, [phoneNumber]);

    const userChat = await connection.query(`
      SELECT * FROM services_bot_users WHERE phone_number = ?
    `, [phoneNumber]);

    let res;
    if(!userChat.length) {
      res = await connection.query(`
        INSERT INTO services_bot_users set first_name = ?, last_name = ?, phone_number = ?, tg_username = ?, chat_id = ?
        `, [chatFirstName, chatLastName, phoneNumber, username, chatId]);
    } else {
      res = await connection.query(
        "UPDATE services_bot_users set first_name = ?, last_name = ?, phone_number = ?, tg_username = ?, chat_id = ?",
        [chatFirstName, chatLastName, phoneNumber, username, chatId]
      );
    }

    // Send a notification to the user
    if (res) {
      if(user[0]) {
        const keyboard = new InlineKeyboard()
        .text('Типы услуг', '#services')
        await ctx.reply(`Дорогой ${chatFirstName}! Вы успешно зарегистрировались.`, { reply_markup: keyboard });
      } else {
       await bot.api.sendMessage(
            ctx.message.chat.id,
            `Дорогой ${chatFirstName}! Пожалуйста, зарегистрируйтесь в приложении по <a href="YOUR_LINK_HERE">ссылке</a>.`,
            { parse_mode: "HTML" },
          );
      }
    } else {
      await ctx.reply(`Дорогой ${chatFirstName}! Регистрация не удалась. Пожалуйста, попробуйте позднее.`);
    }
  } catch (err) {
    console.log(err)
    await ctx.reply(`Дорогой ${chatFirstName}! Регистрация не удалась. Пожалуйста, попробуйте позднее.`);
  } finally {
    // Release the connection back to the pool
    if (connection) {
      connection.release();
    }
  }
}

// Function to handle 'Типы услуг' button click
async function onServicesClick(ctx) {
  const connection = await database.connection.getConnection();
  
  try {
      const services = await connection.query('SELECT * FROM services');
      if (services && services.length > 0) {
          const keyboard = new InlineKeyboard();
          for (let service of services[0]) {
            const serviceNameWithLineBreak = service.name.replace(/\\n/g, '\n');
              keyboard.text(serviceNameWithLineBreak, `#service_${service.id}`);
              keyboard.row()
          }

          await ctx.reply(`Choose a service:`, { reply_markup: keyboard });
      } else {
          await ctx.reply(`No services available.`);
      }
  } catch (err) {
      console.log('BOT Error while getting services list: ', err);
      await ctx.reply(`Error while getting services list.`);
  } finally {
      // Release the connection back to the pool
      if (connection) {
          connection.release();
      }
  }
}