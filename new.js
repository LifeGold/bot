const TelegramBot = require('node-telegram-bot-api');
const mysql = require('mysql');
const request = require('request');
const clc = require('cli-color');
const TOKEN = '';
const bot = new TelegramBot(TOKEN, { polling: true });
const db = mysql.createConnection({
  host: 'localhost',
  user: '',
  password: '',
  database: ''
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    return;
  }
  console.log(clc.green(new Date().toLocaleTimeString()), clc.green(`Connected to MySQL database.`));
});

// Начало проверки сообщений от пользователей 
const groupInfo = {
    'PhotoGroup': '',     // Группа для проверки отчетов пользователя
	'TiketGroup': '',     // Группа для проверки тикетов назначеных пользователю.
};

bot.on('message', (msg) => {
	if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
		const username = msg.from.username;
		const chatId = msg.chat.id;  // Получаем ID группы
		const currentTime = Date.now();
        console.log(clc.yellow(new Date().toLocaleTimeString()), clc.green(`Received a message from: ${username} in group: ${chatId}`)); // Выводим ID группы в консоль
		// Получаем имена пользователей для проверки из базы данных
		getUsersToCheckFromDatabase((usernamesToCheck) => {
			if (usernamesToCheck.includes(username)) {
				if (msg.chat.id.toString() === groupInfo['TiketGroup']) {
					if (msg.text && msg.text.startsWith('+')) {
                        console.log(clc.yellow(new Date().toLocaleTimeString()), clc.green(`User sent + from Tiket: ${username}`));
                        updateLastMessageTimeInDatabase(username, currentTime);
						updateMessageTiket(username);
					}
				}
				// Проверяем сообщение в группе "CheckGroup" - (ОТЧЕТЫ СКАУТОВ)
				if (msg.chat.id.toString() === groupInfo['PhotoGroup']) {
					updateLastMessageTimeInDatabase(username, currentTime);
					// Проверяем, является ли сообщение фотографией с подписью
					if (msg.photo && msg.photo.length > 0) {
						// Получаем подпись к фотографии (если есть)
						const caption = msg.caption ? msg.caption.toLowerCase() : '';
						// Проверка на наличие текста "Поправил" в подписи к фотографии
						if (caption.includes('поправил')) {
							// Обновляем счетчик "Поправлено"
							updateMessagePop(username);
							updateMessageCount(username);
						}
					} 
					if (msg.caption) {
						const words = msg.caption.trim().split(' ');
                        console.log(clc.yellow(new Date().toLocaleTimeString()), clc.green(`Words from caption:`), words);
						if (words.length >= 1) {
							const firstWord = words[0];
                            console.log(clc.yellow(new Date().toLocaleTimeString()), clc.magenta(`First word:`), firstWord);
							if (!isNaN(firstWord)) {
								const numberFromFirstWord = parseInt(firstWord, 10);
                                console.log(clc.yellow(new Date().toLocaleTimeString()), clc.magenta(`Number from first word:`), numberFromFirstWord);
								if (words.length >= 2 && words[1].toLowerCase() === 'тс') {
                                    console.log(clc.yellow(new Date().toLocaleTimeString()), clc.magenta(`Updating TS count in the database`));
									// Обновляем счетчик сообщений "ТС"
									updateMessageTs(username, numberFromFirstWord);
									updateMessageCount(username);
								} else {
                                    console.log(clc.yellow(new Date().toLocaleTimeString()), clc.red(`Caption does not match the expected format`));
								}
							} else {
                                console.log(clc.yellow(new Date().toLocaleTimeString()), clc.red(`First word is not a number`));
							}
						} else {
                            console.log(clc.yellown(new Date().toLocaleTimeString()), clc.red(`Caption does not contain any words`));
						}
					} else {
						// Обновляем счетчик сообщений
						updateMessageCount(username);
					}
				}
			}
		});
	}
});

// Функция проверки пользователей в DB
function getUsersToCheckFromDatabase(callback) {
    const query = 'SELECT username FROM users';
    db.query(query, (err, results) => {
      if (err) {
        console.error('Error fetching usernames from database:', err);
        callback([]);
      } else {
        const usernames = results.map(result => result.username);
        callback(usernames);
      }
    });
  }

// Обновляем дату последнего отчета от пользователя
function updateLastMessageTimeInDatabase(username, timestamp) {
    const query = `UPDATE users SET last_message_time = ? WHERE username = ?`;
    db.query(query, [timestamp, username], (err) => {
      if (err) {
        console.error('Error updating data in database:', err);
      }
    });
  }

  //Функция обновления счетчика парковок (Поправил)
  function updateMessagePop(username) {
    const querySelect = `SELECT pop FROM users WHERE username = ?`;
    // Получаем текущее значение счетчика "Поправлено"
    db.query(querySelect, [username], (err, results) => {
      if (err) {
        console.error('Error fetching data from database:', err);
        return;
      }
      if (results.length > 0) {
        const currentCount = results[0].pop;
        const newCount = currentCount + 1;
        // Обновляем значение счетчика "Поправлено"
        const queryUpdate = `UPDATE users SET pop = ? WHERE username = ?`;
        db.query(queryUpdate, [newCount, username], (err) => {
          if (err) {
            console.error('Error updating pop in database:', err);
          } else {
            console.log(clc.yellow(new Date().toLocaleTimeString()), clc.magenta(`Count updated to ${newCount} for user ${username}`));
          }
        });
      } else {
        console.log(`User ${username} not found in the database.`);
      }
    });
  }

// Функция для обновления счетчика (Всего отчетов)
function updateMessageCount(username) {
    const querySelect = `SELECT count FROM users WHERE username = ?`;
    // Получаем текущее значение счетчика
    db.query(querySelect, [username], (err, results) => {
      if (err) {
        console.error('Error fetching data from database:', err);
        return;
      }
      if (results.length > 0) {
        const currentCount = results[0].count;
        const newCount = currentCount + 1;
        // Обновляем значение счетчика
        const queryUpdate = `UPDATE users SET count = ? WHERE username = ?`;
        db.query(queryUpdate, [newCount, username], (err) => {
          if (err) {
            console.error('Error updating count in database:', err);
          } else {
            console.log(clc.yellow(new Date().toLocaleTimeString()), clc.magenta(`Count updated to ${newCount} for user ${username}`));
          }
        });
      } else {
        console.log(`User ${username} not found in the database.`);
      }
    });
  }

// Функция обновления счетчиков Тикеты (реакция на +)
  function updateMessageTiket(username) {
    const querySelect = `SELECT tiket FROM users WHERE username = ?`;
    // Получаем текущее значение счетчика "tiket"
    db.query(querySelect, [username], (err, results) => {
      if (err) {
        console.error('Error fetching data from database:', err);
        return;
      }
      if (results.length > 0) {
        const currentCount = results[0].tiket;
        const newCount = currentCount + 1;
        // Обновляем значение счетчика "tiket"
        const queryUpdate = `UPDATE users SET tiket = ? WHERE username = ?`;
        db.query(queryUpdate, [newCount, username], (err) => {
          if (err) {
            console.error('Error updating tiket in database:', err);
          } else {
            console.log(clc.yellow(new Date().toLocaleTimeString()), clc.magenta(`Count updated to ${newCount} for user ${username}`));
          }
        });
      } else {
        console.log(clc.yellow(new Date().toLocaleTimeString()), clc.red(`User ${username} not found in the database.`));
      }
    });
  }

// Функция обновления счетчика ТС
function updateMessageTs(username, number) {
  const querySelect = `SELECT ts FROM users WHERE username = ?`;
  // Получаем текущее значение счетчика "ТС"
  db.query(querySelect, [username], (err, results) => {
    if (err) {
      console.error('Error fetching data from database:', err);
      return;
    }
    if (results.length > 0) {
      const currentCount = results[0].ts;
      const newCount = currentCount + number;
      // Обновляем значение счетчика "ТС"
      const queryUpdate = `UPDATE users SET ts = ? WHERE username = ?`;
      db.query(queryUpdate, [newCount, username], (err) => {
        if (err) {
          console.error('Error updating ts in database:', err);
        } else {
            console.log(clc.yellow(new Date().toLocaleTimeString()), clc.magenta(`Count updated to ${newCount} for user ${username}`));
        }
      });
    } else {
        console.log(clc.yellow(new Date().toLocaleTimeString()), clc.red(`User ${username} not found in the database.`));
    }
  });
}

if (TOKEN) {
    console.log(clc.yellow(new Date().toLocaleTimeString()), clc.blue(`Bot is running...`));
} else {
  console.error("Bot token is missing!");
}