const TelegramBot = require('node-telegram-bot-api');
const mysql = require('mysql');
const crypto = require('crypto-js');
const request = require('request');
const fs = require('fs');
const ExcelJS = require('exceljs');
const TOKEN = 'ТОКЕН';
const bot = new TelegramBot(TOKEN, { polling: true });
const photoHashes = new Set(); // Множество для хранения хеш-сумм фотографий
const db = mysql.createConnection({
  host: 'localhost',
  user: 'Пользователь',
  password: 'Пароль',
  database: 'База данных'
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

const checkInterval = 60; // Интервал проверки в секундах
const notificationInterval = 30 * 60 * 1000; // 30 минут в миллисекундах

bot.onText(/\/notify/, (msg) => {
  const chatId = msg.chat.id;

  if (msg.chat.type === 'private') {
    // Получить список пользователей с данными 0 в таблице graf
    const query = `SELECT userid FROM graf WHERE pn = 0 AND vt = 0 AND sr = 0 AND ct = 0 AND pt = 0 AND sb = 0 AND vs = 0`;

    db.query(query, (err, results) => {
      if (err) {
        console.error('Ошибка при получении списка пользователей:', err);
        bot.sendMessage(chatId, 'Произошла ошибка при получении списка пользователей.');
      } else {
        // Отправить уведомления каждому из найденных пользователей
        results.forEach((row) => {
          if(row.off === 1){

          } else {
            const username = row.userid;
            const message = `⚠️ Уведомление: Ваш график пуст. Заполните график для работы. 🤝 \n Для перезапуска бота используйте команду /start`;
            bot.sendMessage(username, message);
          }
        });

        bot.sendMessage(chatId, `Уведомления отправлены ${results.length} пользователям.`);
      }
    });
  }
});

// Команда для отправки уведомлений с учетом параметра
bot.onText(/send_notifications (.+)/, (msg, match) => {
  const param = match[1]; // Получить параметр из команды
if (msg.chat.type === 'private') {
  // Определите, какое поле (например, 'pn', 'vt', 'sr') использовать для выбора данных
  let fieldToCheck;
  switch (param) {
    case 'pn':
      fieldToCheck = 'pn';
      break;
    case 'vt':
      fieldToCheck = 'vt';
      break;
    case 'sr':
      fieldToCheck = 'sr';
      break;
    // Добавьте другие случаи для других параметров
  }

if (fieldToCheck) {
    // Создайте SQL-запрос с учетом выбранного поля
    const query = `SELECT userid, username FROM graf WHERE ${fieldToCheck} = 1`;

    db.query(query, (err, results) => {
      if (err) {
        console.error('Ошибка выполнения SQL-запроса:', err);
      } else {
        results.forEach((row) => {
          // Получите данные пользователя
          const chatId = row.userid;
          const chatnames = row.username;

          // Отправьте уведомление каждому пользователю
          bot.sendMessage(chatId, `‼️ @${chatnames}, напоминаю Вам, что на завтра у Вас запланирована рабочая смена.`);
        });
      }
    });
} else {
    // В случае неверного параметра
    bot.sendMessage(msg.chat.id, 'Неправильный параметр. Используйте /send_notifications [параметр]');
  }
}
});


bot.onText(/\/ganer/, (msg) => {
  const chatId = msg.chat.id;
  if (msg.chat.type === 'private') {
generateExcelFile(chatId);
  }
});
// Генерация Excel-файла
function generateExcelFile(chatId) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Расписание');

  // Получение данных из базы catalog (выберите свои столбцы)
  const catalogQuery = 'SELECT pn, vt, sr, ct, pt, sb, vs FROM catalog WHERE id = 1';
  db.query(catalogQuery, (catalogError, catalogResults) => {
    if (catalogError) {
      console.error('Ошибка при получении данных из catalog:', catalogError);
      bot.sendMessage(chatId, 'Произошла ошибка при получении данных.');
    } else {
      const catalogData = catalogResults[0];

      // Заголовки таблицы Excel
      worksheet.columns = [
        { header: 'Телеграм', key: 'telegram', width: 15 },
        { header: 'Пн', key: 'pn', width: 15 },
        { header: 'Вт', key: 'vt', width: 15 },
        { header: 'Ср', key: 'sr', width: 15 },
        { header: 'Чт', key: 'ct', width: 15 },
        { header: 'Пт', key: 'pt', width: 15 },
        { header: 'Сб', key: 'sb', width: 15 },
        { header: 'Вс', key: 'vs', width: 15 },
      ];

      // Получение данных из базы graf
      const grafQuery = 'SELECT username, pn, vt, sr, ct, pt, sb, vs FROM graf';
      db.query(grafQuery, (grafError, grafResults) => {
        if (grafError) {
          console.error('Ошибка при получении данных из graf:', grafError);
          bot.sendMessage(chatId, 'Произошла ошибка при получении данных.');
        } else {
          // Добавление данных в таблицу Excel
         grafResults.forEach((row) => {
  worksheet.addRow({
    telegram: row.username,
    pn: row.pn === 1 ? 'Раб' : 'Вых',
    vt: row.vt === 1 ? 'Раб' : 'Вых',
    sr: row.sr === 1 ? 'Раб' : 'Вых',
    ct: row.ct === 1 ? 'Раб' : 'Вых',
    pt: row.pt === 1 ? 'Раб' : 'Вых',
    sb: row.sb === 1 ? 'Раб' : 'Вых',
    vs: row.vs === 1 ? 'Раб' : 'Вых',
  });
});

          // Сохранение файла и отправка пользователю
          const filePath = 'schedule.xlsx';
          workbook.xlsx.writeFile(filePath)
            .then(() => {
              bot.sendDocument(chatId, filePath);
            })
            .catch((writeError) => {
              console.error('Ошибка при сохранении файла Excel:', writeError);
              bot.sendMessage(chatId, 'Произошла ошибка при сохранении файла Excel.');
            });
        }
      });
    }
  });
}



const scanning = async () => {
  console.log('Performing automatic check...');

  // Получаем имена пользователей для проверки из базы данных
 getUsersToCheckFromDatabase((usernamesToCheck) => {
  if (!usernamesToCheck || usernamesToCheck.length === 0) {
    console.log('No usernames to check.');
    setTimeout(scanning, checkInterval * 1000);
    return;
  }
    const currentTime = Math.floor(Date.now()); // Текущее время в миллисекундах
	const currentssTimeWithBreak = new Date();
    for (const username of usernamesToCheck) {
      const query = `SELECT last_message_time, job, status, breaks, task, break_start FROM users WHERE username = ?`;
      db.query(query, [username], (err, results) => {
        if (err) {
          console.error('Error fetching data from database:', err);
          return;
        }
  
        if (results.length > 0) {
          const userLastMessageTime = results[0].last_message_time;
          const userJob = results[0].job;
          const userBreak = results[0].breaks;
          const userTask = results[0].task;
          const userBreakStart = results[0].break_start;
          console.log(`${currentssTimeWithBreak} Checking user:`, username);
          console.log('currentTime:', currentTime);
          if (userJob === 1 && userBreak === 0 && userTask === 0 && userLastMessageTime) {
			if (currentTime - userLastMessageTime > notificationInterval) {
				console.log('Sending notification for user:', username);
				updateWarningCount(username);
				getWarningCount(username, (count) => {
				  if (count !== null) {
					const newcount = count + 1;             
					if (newcount === 3) {
					  bot.sendMessage(ID группы, `‼️ @${username}, вашего отчета не было уже более 30 минут.\n⚠️ У Вас осталось последнее предупреждение. После него Вас ожидает закрытие смены и окончание рабочего дня.\n⛔️ Всего предупреждений: ${newcount} / 4`);
					} else if (newcount === 4) {
					  bot.sendMessage(ID группы, `⛔️ @${username}, Вам было выдано последнее предупреждение. Мы вынуждены с Вами попрощаться. \n‼️ Смена закрыта.`);
					  // Обновляем статус смены и счётчик сообщений в базе данных
					  updateJobsInDatabase(username, 0);
					 //ЗДЕСЬ ДОЛЖЕН БЫТЬ КОД ЗАВЕРШЕНИя СМЕНЫ 
					} else {
					  bot.sendMessage(ID группы, `‼️ @${username}, вашего отчета не было уже более 30 минут. Укажите причину, по которой отсутствуют ваши отчеты.\n⛔️ Всего предупреждений: ${newcount} / 4`);
					}
				  } else {
					//message = `Пользователь @${username} не найден в базе данных.`;
				  }
				  updateLastMessageTimeInDatabase(username, currentTime);
				});
			  }  
          } else if(userJob === 1 && userBreak === 1 && userTask === 0){
         // Получаем время перерыва из базы данных
         getBreakTimeFromDatabase(username, (breakTime) => {
          if (breakTime !== null) {
            const remainingBreakTime = Math.max(0, breakTime - Math.floor((currentTime - userBreakStart) / 60000)); // Отнимаем прошедшее время перерыва    
            // Если осталось 10 минут до окончания перерыва, отправляем уведомление
            if (remainingBreakTime === 10) {
              const notification = `⏰ @${username}, у вас осталось 10 минут до конца перерыва.`;
              bot.sendMessage(ID группы, notification);
            }
            if (remainingBreakTime === 0) {
              // При нулевом времени перерыва обновляем статус и отправляем сообщение
              updateBreaksEndDatabase(username, 0);
              updateLastMessageTimeInDatabase(username, currentTime);
              const returnMessage = `👍 @${username} с возвращением!\n⏱  Ваш перерыв завершен.`;
              bot.sendMessage(ID группы, returnMessage);
            } else {
              // Иначе обновляем время перерыва в базе данных
              updateBreakTimeFromDatabase(username, remainingBreakTime);
              updateBreakTimeInDatabase(username, currentTime);
            }
          } else {
            console.log(`Break time not found for user ${username}`);
          }
        });
          }
        } else {
          console.log(`User ${username} not found in the database.`);
        }
      });
    }
    setTimeout(scanning, checkInterval * 1000); // Рекурсивный вызов через указанный интервал
  });
};
console.log('Starting automatic check...');
scanning(); // Запускаем первую проверку


// Начало проверки сообщений от работников - Переписать groupInfo на множество групп 
const groupInfo = {
    'CheckGroup': 'ID группы',     // Группа для проверки сообщений от пользователей (группа меняеться)
    'CheckGroupOld': 'ID группы',  // Группа для проверки отчетов. (неизменная одна для всех)
	'TiketGroup': 'ID группы',   	// Группа для проверки тикетов (неизменная одна для всех).
};

bot.on('message', (msg) => {
	if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
		const username = msg.from.username;
		const chatId = msg.chat.id;  // Получаем ID группы
		const currentTime = Date.now();
		console.log(`Received a message from: ${username} in group: ${chatId}`);  // Выводим ID группы в консоль
		// Получаем имена пользователей для проверки из базы данных
		getUsersToCheckFromDatabase((usernamesToCheck) => {
			if (usernamesToCheck.includes(username)) {
				console.log(`Received a message from: ${username}`);
				if (msg.chat.id.toString() === groupInfo['TiketGroup']) {
					updateLastMessageTimeInDatabase(username, currentTime);
					if (msg.text && msg.text.startsWith('+')) {
						console.log(`User send +: ${username}`);
						updateMessageTiket(username);
					}
				}
				
				// Проверяем сообщение в группе "CheckGroup" - (ОТЧЕТЫ СКАУТОВ)
				if (msg.chat.id.toString() === groupInfo['CheckGroup']) {
					getUsersToCheckFromDatabase((usernames) => {
						if (usernames.includes(msg.from.username)) {
							if (msg.photo) {
								// Получаем последнюю (самую большую) фотографию из сообщения
								const photo = msg.photo[msg.photo.length - 1];
								const fileId = photo.file_id;
								// Получаем информацию о файле
								bot.getFile(fileId).then((fileInfo) => {
									const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${fileInfo.file_path}`;
									// Скачиваем файл с помощью request
									request(fileUrl, { encoding: null }, (error, response, body) => {
										if (!error && response.statusCode === 200) {
											// Вычисляем хеш-сумму фотографии (SHA-256)
											const sha256 = crypto.SHA256(crypto.lib.WordArray.create(body)).toString(crypto.enc.Hex);
											// Поиск фотографии в базе данных
											const searchQuery = 'SELECT hex_date FROM energo_table WHERE hex = ?';
											db.query(searchQuery, [sha256], (err, results) => {
												if (err) {
													console.error('Error searching for photo:', err);
												} else {
													if (results.length > 0) {
														const duplicatesDate = results[0].hex_date; // Получаем дату из базы данных
														bot.sendMessage(-1001706550057, `📛 @${msg.from.username}, одна из фотографий в последнем отчете является дубликатом фотографии, которую Вы отправляли ранее. \n⚠️ Дубликат от: ${duplicatesDate}`);
													} else {
														// Фотография не является дубликатом, добавляем хеш в множество
														photoHashes.add(sha256);
														// Добавляем запись в базу данных
														const timeZone = 'Europe/Moscow';
														const currentDate = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
														const insertQuery = 'INSERT INTO energo_table (hex, hex_date) VALUES (?, ?)';
														db.query(insertQuery, [sha256, currentDate], (err, results) => {
															if (err) {
																console.error('Error inserting record:', err);
															} else {
																console.log('Фотография добавлена в базу данных.');
															}
														});
													}
												}
											});
										} else {
											console.error('Произошла ошибка при скачивании фотографии.');
										}
									});
								});
							}
						}
					});  
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
						console.log('Words from caption:', words);
						if (words.length >= 1) {
							const firstWord = words[0];
							console.log('First word:', firstWord);
							if (!isNaN(firstWord)) {
								const numberFromFirstWord = parseInt(firstWord, 10);
								console.log('Number from first word:', numberFromFirstWord);
								if (words.length >= 2 && words[1].toLowerCase() === 'тс') {
									console.log('Updating TS count in the database');
									// Обновляем счетчик сообщений "ТС"
									updateMessageTs(username, numberFromFirstWord);
									updateMessageCount(username);
								} else {
									console.log('Caption does not match the expected format');
								}
							} else {
								console.log('First word is not a number');
							}
						} else {
							console.log('Caption does not contain any words');
						}
					} else {
						// Обновляем счетчик сообщений
						updateMessageCount(username);
						updateMessageUnknowns(username);
					}
				}
		  

				// Проверяем сообщение в группе "CheckGroupOld" - (СКАУТЫ МСК) - groupInfo['CheckGroupOld'] - БУДЕТ РАЗНЫМ ДЛЯ РАЗНЫХ СУПЕРВАЙЗЕРОВ
				if (msg.chat.id.toString() === groupInfo['CheckGroupOld']) {
				
					getJobFromDatabase(username, (userJob) => {
						getTaskFromDatabase(username, (userTask) => {
							getBreaksFromDatabase(username, (userBreaks) => {
								// Взятия выполнения задачи
								if (msg.text && msg.text.startsWith('Задача')) {
									if (userJob === 1) {
										if (userBreaks === 0){
											console.log(`Received a "Задача" message from: ${username}`);
											bot.sendMessage(msg.chat.id, `✅ @${username} ваша команда принята. \n⚠️ По окончанию выполнения не забудьте отправить сообщение в чат "Выполнена.`);
											updateTaskInDatabase(username, 1);
											updateLastMessageTimeInDatabase(username, currentTime);
										} else {
											// Выводим сообщение, если job равно 0
											bot.sendMessage(msg.chat.id, `⚠️ @${username}, завершите активный перерыв.`);
										}
									} else if (userJob === 0) {
										// Выводим сообщение, если job равно 0
										bot.sendMessage(msg.chat.id, `⚠️ @${username}, сначала откройте смену.`);
									}
								}
								let shift;  // Объявляем переменную shift
								// Перемещаем блок получения данных о смене в область видимости функции
								getUserShiftFromDatabase(username, (userShift) => {
									shift = userShift;  // Присваиваем полученное значение переменной shift
									//ПЕРЕПИСАТЬ ПЕРЕРЫВ ТАК ЧТОБЫ ОН СМОТРЕЛ ЕСЛИ ЧЕЛОВЕК РАБОТАЕТ ДО 19:00 - А ПЕРЕРЫВ ПРОБУЕТ ВЗЯТЬ В 17:30 ЕГО ОТПУСКАЛО ТОЛЬКО НА 30 МИНУТ
									if (msg.text && msg.text.startsWith('Перерыв')) {
										if (userJob === 1) {
											if (userTask === 0) {
												console.log(`Received a "Перерыв" message from: ${username}`);
												// Получаем время начала перерыва из базы данных
												getBreakTimeFromDatabase(username, (breakTime) => {
													if (breakTime !== null) {
														const currentTimeWithBreak = new Date(currentTime);
														currentTimeWithBreak.setMinutes(currentTimeWithBreak.getMinutes() + breakTime);
														// Проверка на возможность взять перерыв
														const endDateMinus60Min = new Date(shift.endDate);
														endDateMinus60Min.setMinutes(endDateMinus60Min.getMinutes() - 60);
														if (currentTimeWithBreak > endDateMinus60Min) {
															bot.sendMessage(msg.chat.id, `⚠️ @${username}, Вы не можете взять перерыв, так как до конца смены с учетом вашего перерыва останется менее часа.`);
															return;
														}
														// Обновляем время начала перерыва в базе данных
														updateBreakTimeInDatabase(username, currentTime);
														const breakTimes = breakTime;
														const messageText = `🤩 @${username} приятного аппетита 🥪🌮🌯 \n⏱ У Вас осталось: ${breakTimes} мин.\n⚠️ По окончанию перерыва не забудьте отправить сообщение в чат "Завершил/Завершила".`;
														bot.sendMessage(msg.chat.id, messageText);
														updateBreaksInDatabase(username, 1);
														updateLastMessageTimeInDatabase(username, currentTime);
													} else {
														console.log(`Break time not found for user ${username}`);
													}
												});
											} else {
												// Выводим сообщение, если job равно 0
												bot.sendMessage(msg.chat.id, `⚠️ @${username}, завершите активную задачу.`);
											}
										} else if (userJob === 0) {
											// Выводим сообщение, если job равно 0
											bot.sendMessage(msg.chat.id, `⚠️ @${username}, сначала откройте смену.`);
										}
									}
								});
								
								if (msg.caption) {
									const captionLower = msg.caption.toLowerCase();
									// Проверяем на сообщения ВЗЯЛ
									if (captionLower.startsWith('взял')) {
										if (userJob === 1) {
											bot.sendMessage(msg.chat.id, `⚠️ @${username}, у вас уже открыта смена.`);
										} else {
											console.log(`Received a "Взял" message from: ${username}`);
											// Отправляем сообщение о смене
											bot.sendMessage(msg.chat.id, `✅ @${username} смена открыта \n⚠️ По окончанию смены, не забудьте отправить фото с текстом "Сдал" в чат`);
											// Обновляем статус смены и счётчик сообщений в базе данных
											updateJobInDatabase(username, 1);
											updateLastMessageTimeInDatabase(username, currentTime);
										}
									} 
									// Проверяем на сообщения СДАЛ
									if (captionLower.startsWith('сдал')) {
										if (userJob === 0) {
											bot.sendMessage(msg.chat.id, `⚠️ @${username}, у вас нет открытой смены.`);
										} else {
											console.log(`Received a "Взял" message from: ${username}`);
											// Получаем job, task и breaks из базы данных
											getTaskFromDatabase(username, (userTask) => {
												getBreaksFromDatabase(username, (userBreaks) => {
													if (userTask === 1 || userBreaks === 1) {
														bot.sendMessage(msg.chat.id, `❌ @${username} не удалось закрыть смену, у Вас имеются активные задачи.`);
													} else {
														// Отправляем сообщение о завершении смены
														bot.sendMessage(msg.chat.id, `❌ @${username} смена завершена`);
														// Обновляем статус смены и счётчик сообщений в базе данных
														updateJobsInDatabase(username, 0);
														// Получаем счетчик сообщений для указанного пользователя
														getMessageCount(username, (count) => {
															getWarningCount(username, (warning) => {
																getPopCount(username, (pop) => {
																	getTsCount(username, (ts) => {
																		//getUnknownsCount(username, (unknowns) => {
																			getTiketCount(username, (tiket) => {
																				if (count !== null && warning !== null && pop !== null && ts !== null && tiket !== null) {
																					bot.sendMessage(msg.chat.id, `📝 Статистика для @${username}:\n\n✅ Всего отчётов: ${count} шт. \n♻️ Релокация: ${ts} 🛴 \n🅿️ Поправлено: ${pop} шт. \n👻 Неизвестно: Скоро... \n⏰ Тикеты: ${tiket} шт. \n⛔️ Предупреждений: ${warning} шт.`);
																				} else {
																					bot.sendMessage(msg.chat.id, `Пользователь @${username} не найден в базе данных.`);
																				}
																			});
																		// });
																	});
																});
															});
														});
													}
												});
											});
										}
									}
								}
								// Проверяем сообщение "Завершил"
								if (msg.text && msg.text.toLowerCase().match(/^заверши[лла]/)) {
									if (userJob === 1) {
										if (userTask === 0) {
											if (userBreaks === 1) {
												console.log(`Received a "Завершил/Завершила" message from: ${username}`);
													getLastBreakStartTimeFromDatabase(username, (breakStartTime) => {
														if (breakStartTime) {
															getBreakTimeFromDatabase(username, (breakTime) => {
																if (breakTime !== null) {
																	const timeElapsedInSeconds = Math.floor((currentTime - breakStartTime) / 1000);
																	const newBreakTimeInMinutes = Math.max(0, breakTime - Math.floor(timeElapsedInSeconds / 60)); // Отнимаем прошедшее время перерыва
																	const remainingTimeMessage = newBreakTimeInMinutes === 1 ? '0 мин.' : `${newBreakTimeInMinutes} мин.`;  // Учтем случай, когда newBreakTimeInMinutes равно 1
																	// Обновляем время перерыва в базе данных
																	updateBreakTimeFromDatabase(username, newBreakTimeInMinutes);
																	updateBreaksEndDatabase(username, 0); // Обновляем статус на "Завершил"
																	updateLastMessageTimeInDatabase(username, currentTime);
																	bot.sendMessage(msg.chat.id, `👍 @${username} с возвращением!\n⏱  У Вас осталось: ${remainingTimeMessage}`);
																} else {
																	console.log(`Break time not found for user ${username}`);
																}
															});
														} else {
															console.log(`Break start time not found for user ${username}`);
														}
													});
											} else { 
												bot.sendMessage(msg.chat.id, `⚠️ @${username}, у Вас нет активного перерыва.`);
											}
										} else { 
											bot.sendMessage(msg.chat.id, `⚠️ @${username}, завершите активную задачу.`);
										}
									} else if (userJob === 0) {
										// Выводим сообщение, если job равно 0
										bot.sendMessage(msg.chat.id, `⚠️ @${username}, сначала откройте смену.`);
									}
								}
								
								// Проверяем наличие прикрепленного фото
								if (msg.caption && msg.caption.toLowerCase().includes('выполнена')) {
									// Проверяем наличие прикрепленного фото
									if (msg.photo && msg.photo.length > 0) {
										// Обработка выполнения задачи
										if (userJob === 1) {
											if (userTask === 1) {
												console.log(`Received a "Выполнена" message from: ${username}`);
												updateTaskEndDatabase(username, 0); // Обновляем статус на "Завершил"
												updateLastMessageTimeInDatabase(username, currentTime);
												bot.sendMessage(msg.chat.id, `👍 @${username} спасибо. Задача завершена`);
											} else {
												// Выводим сообщение, если task равно 0
												bot.sendMessage(msg.chat.id, `⚠️ @${username}, у Вас нет активных задач.`);
											}
										} else if (userJob === 0) {
											// Выводим сообщение, если job равно 0
											bot.sendMessage(msg.chat.id, `⚠️ @${username}, сначала откройте смену.`);
										}
									} else {
										// Выводим сообщение, если нет прикрепленного фото
										bot.sendMessage(msg.chat.id, `⚠️ @${username}, для завершения задачи прикрепите фото с подписью "Выполнена".`);
									}
								}
								if (msg.text && msg.text.trim().startsWith('Выполнена')) {
									// Проверяем наличие прикрепленного фото
									// Проверяем подпись фото
									const captionLower = msg.caption ? msg.caption.toLowerCase() : '';
									if (captionLower.includes('выполнена')) {

									} else {
										// Выводим сообщение, если подпись не соответствует
										bot.sendMessage(msg.chat.id, `⚠️ @${username}, для завершения задачи прикрепите фотографию с выполненной Вами задачей с подписью "Выполнена".`);
									}
								}
							});
						});
					});
				}  
			}
		});
	}
});


// Обработчик команды /off
bot.onText(/\/off (.+)/, (msg, match) => {
  const usernameToOff = match[1]; // Получаем имя пользователя для завершения смены

  // Обновляем значение job для указанного пользователя в базе данных
  // Предполагая, что у вас есть функция updateJobInDatabase(username, jobValue)

  // Устанавливаем jobValue = 0 для указанного пользователя
  updateJobInDatabase(usernameToOff, 0);

  // Отправляем уведомление в указанную группу
  const notificationMessage = `🚀 @${msg.from.username} завершил смену @${usernameToOff}.`;
  const notificationChatId = '-1001706550057'; // Замените на ID вашей группы

  // Отправляем уведомление
  bot.sendMessage(notificationChatId, notificationMessage);
});
// Функция для обновления значения job в базе данных
function updateJobInDatabase(username, newJobValue) {
  // Предполагаем, что у вас есть объект для работы с базой данных (например, db)
  // и имеется соответствующий метод для обновления значения в базе данных

  // Пример запроса к базе данных для обновления значения job для указанного пользователя
  const queryUpdateJob = `UPDATE users SET job = ? WHERE username = ?`;

  db.query(queryUpdateJob, [newJobValue, username], (err, result) => {
    if (err) {
      console.error('Error updating job in database:', err);
    } else {
      console.log(`Job updated to ${newJobValue} for user ${username}`);
    }
  });
}

// Проверка открыл человек смену или нет
function getJobFromDatabase(username, callback) {
  const query = `SELECT job FROM users WHERE username = ?`;
  db.query(query, [username], (err, results) => {
    if (err) {
      console.error('Error fetching job from database:', err);
      callback(null);
    } else {
      if (results.length > 0) {
        const job = results[0].job;
        callback(job);
      } else {
        callback(null);
      }
    }
  });
}
// Функция для получения данных о смене из базы данных
function getUserShiftFromDatabase(username, callback) {
  const query = `SELECT startDate, endDate FROM users WHERE username = ?`;
  db.query(query, [username], (err, results) => {
    if (err) {
      console.error('Error fetching data from database:', err);
      callback(null);
    } else {
      if (results.length > 0) {
        const shift = {
          startDate: new Date(results[0].startDate),
          endDate: new Date(results[0].endDate)
        };
        callback(shift);
      } else {
        console.log(`User ${username} not found in the database.`);
        callback(null);
      }
    }
  });
}
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
          console.log(`Count updated to ${newCount} for user ${username}`);
        }
      });
    } else {
      console.log(`User ${username} not found in the database.`);
    }
  });
}


function updateMessageTiket(username) {
  const querySelect = `SELECT tiket FROM users WHERE username = ?`;

  // Получаем текущее значение счетчика "Поправлено"
  db.query(querySelect, [username], (err, results) => {
    if (err) {
      console.error('Error fetching data from database:', err);
      return;
    }

    if (results.length > 0) {
      const currentCount = results[0].tiket;
      const newCount = currentCount + 1;

      // Обновляем значение счетчика "Поправлено"
      const queryUpdate = `UPDATE users SET tiket = ? WHERE username = ?`;
      db.query(queryUpdate, [newCount, username], (err) => {
        if (err) {
          console.error('Error updating tiket in database:', err);
        } else {
          console.log(`Count updated to ${newCount} for user ${username}`);
        }
      });
    } else {
      console.log(`User ${username} not found in the database.`);
    }
  });
}

function updateMessageUnknowns(username) {
  const querySelect = `SELECT unknowns FROM users WHERE username = ?`;

  // Получаем текущее значение счетчика "Поправлено"
  db.query(querySelect, [username], (err, results) => {
    if (err) {
      console.error('Error fetching data from database:', err);
      return;
    }

    if (results.length > 0) {
      const currentCount = results[0].unknowns;
      const newCount = currentCount + 1;

      // Обновляем значение счетчика "Поправлено"
      const queryUpdate = `UPDATE users SET unknowns = ? WHERE username = ?`;
      db.query(queryUpdate, [newCount, username], (err) => {
        if (err) {
          console.error('Error updating unknowns in database:', err);
        } else {
          console.log(`Count updated to ${newCount} for user ${username}`);
        }
      });
    } else {
      console.log(`User ${username} not found in the database.`);
    }
  });
}


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
          console.log(`Count updated to ${newCount} for user ${username}`);
        }
      });
    } else {
      console.log(`User ${username} not found in the database.`);
    }
  });
}


function getTaskFromDatabase(username, callback) {
  const query = `SELECT task FROM users WHERE username = ?`;
  db.query(query, [username], (err, results) => {
    if (err) {
      console.error('Error fetching task from database:', err);
      callback(null);
    } else {
      if (results.length > 0) {
        const userTask = results[0].task;
        callback(userTask);
      } else {
        callback(null);
      }
    }
  });
}

function getBreaksFromDatabase(username, callback) {
  const query = `SELECT breaks FROM users WHERE username = ?`;
  db.query(query, [username], (err, results) => {
    if (err) {
      console.error('Error fetching breaks from database:', err);
      callback(null);
    } else {
      if (results.length > 0) {
        const userBreaks = results[0].breaks;
        callback(userBreaks);
      } else {
        callback(null);
      }
    }
  });
}



bot.onText(/\/clear/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  // Проверяем, является ли пользователь администратором группы
  bot.getChatAdministrators(chatId).then(admins => {
    const isAdmin = admins.some(admin => admin.user.id === userId);
    if (isAdmin) {
      // Пользователь является администратором, вызываем функцию для очистки данных
      clearUserDataInDatabase();
      bot.sendMessage(chatId, 'Данные пользователей были успешно очищены.');
    } else {
      bot.sendMessage(chatId, 'Эта команда доступна только администраторам.');
    }
  }).catch(error => {
    console.error('Error getting chat administrators:', error);
    bot.sendMessage(chatId, 'Произошла ошибка при выполнении команды.');
  });
});

// Функция для обновления счетчика сообщений в базе
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
          console.log(`Count updated to ${newCount} for user ${username}`);
        }
      });
    } else {
      console.log(`User ${username} not found in the database.`);
    }
  });
}

// Функция для обновления счетчика предупреждений в базе
function updateWarningCount(username) {
  const querySelect = `SELECT warning FROM users WHERE username = ?`;

  // Получаем текущее значение счетчика
  db.query(querySelect, [username], (err, results) => {
    if (err) {
      console.error('Error fetching data from database:', err);
      return;
    }

    if (results.length > 0) {
      const currentCount = results[0].warning;
      const newCount = currentCount + 1;

      // Обновляем значение счетчика
      const queryUpdate = `UPDATE users SET warning = ? WHERE username = ?`;
      db.query(queryUpdate, [newCount, username], (err) => {
        if (err) {
          console.error('Error updating count in database:', err);
        } else {
          console.log(`Warning updated to ${newCount} for user ${username}`);
        }
      });
    } else {
      console.log(`User ${username} not found in the database.`);
    }
  });
}
bot.onText(/\/stat/, (msg) => {
  // Получаем имя пользователя из команды /stat
  const command = msg.text.split(' ');
  if (command.length !== 2) {
    bot.sendMessage(msg.chat.id, 'Используйте команду /stat <username> для получения статистики пользователя.');
    return;
  }

  const requestedUsername = command[1].replace('@', '');  // Удаляем @, если присутствует

  // Получаем счетчик сообщений для указанного пользователя
  getMessageCount(requestedUsername, (count) => {
    if (count !== null) {
      bot.sendMessage(msg.chat.id, `📝 Статистика для @${requestedUsername}:\n✅ Всего отчётов: ${count} шт.`);
    } else {
      bot.sendMessage(msg.chat.id, `Пользователь @${requestedUsername} не найден в базе данных.`);
    }
  });
});

bot.onText(/\/all/, (msg) => {
  // Проверка команды
  const command = msg.text.split(' ');
  if (command.length !== 1) {
    bot.sendMessage(msg.chat.id, 'Используйте команду /stat для получения статистики пользователей с job=1.');
    return;
  }

  // Получаем пользователей с job=1 и их счетчик
  getUsersWithJob1Count((users) => {
    if (users.length > 0) {
      let statMessage = '📝 Общая статистика:\n';
      users.forEach((user) => {
        statMessage += `✅ @${user.username}: ${user.count} шт.\n`;
      });
      bot.sendMessage(msg.chat.id, statMessage);
    } else {
      bot.sendMessage(msg.chat.id, 'Нет пользователей с job=1 в базе данных.');
    }
  });
});


function getUsersWithJob1Count(callback) {
  const query = `SELECT username, count FROM users WHERE job = 1`;
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching data from database:', err);
      return callback([]);
    }

    const usersWithCount = results.map((row) => {
      return {
        username: row.username,
        count: row.count
      };
    });

    callback(usersWithCount);
  });
}

// Отправляем значение перерыва 1 - Перерыв 0 - Отключен
function updateBreaksInDatabase(username, newStatus) {
  const query = `UPDATE users SET breaks = ? WHERE username = ?`;
  db.query(query, [newStatus, username], (err) => {
    if (err) {
      console.error('Error updating breaks in database:', err);
    } else {
      console.log(`breaks updated to ${newStatus} for user ${username}`);
    }
  });
}

// Получаем время отправленого сообщения о Перерыве
function getLastBreakStartTimeFromDatabase(username, callback) {
  const query = `SELECT break_start FROM users WHERE username = ?`;
  db.query(query, [username], (err, results) => {
    if (err) {
      console.error('Error fetching break start time from database:', err);
      callback(null);
    } else {
      if (results.length > 0) {
        const breakStartTime = results[0].break_start;
        callback(breakStartTime);
      } else {
        callback(null);
      }
    }
  });
}
function getBreaksFromDatabase(username, callback) {
  const query = `SELECT breaks FROM users WHERE username = ?`;
  db.query(query, [username], (err, results) => {
    if (err) {
      console.error('Error fetching breaks from database:', err);
      callback(null);
    } else {
      if (results.length > 0) {
        const breaks = results[0].breaks;
        callback(breaks);
      } else {
        callback(null);
      }
    }
  });
}

function getTaskFromDatabase(username, callback) {
  const query = `SELECT task FROM users WHERE username = ?`;
  db.query(query, [username], (err, results) => {
    if (err) {
      console.error('Error fetching task from database:', err);
      callback(null);
    } else {
      if (results.length > 0) {
        const task = results[0].task;
        callback(task);
      } else {
        callback(null);
      }
    }
  });
}
// Записываем время сообщения о перерыве
function updateBreakTimeInDatabase(username, breakStartTime) {
  const query = `UPDATE users SET break_start = ? WHERE username = ?`;
  db.query(query, [breakStartTime, username], (err) => {
    if (err) {
      console.error('Error updating break time in database:', err);
    } else {
      console.log(`Break time updated for user ${username}`);
    }
  });
}

// Обновляем счетчик сколько у скаута осталось времени на обед.
function updateBreakTimeFromDatabase(username, breakStartTime) {
  const query = `UPDATE users SET break_time = ? WHERE username = ?`;
  db.query(query, [breakStartTime, username], (err) => {
    if (err) {
      console.error('Error updating break time in database:', err);
    } else {
      console.log(`Break time updated for user ${username}`);
    }
  });
}

// Получаем сколько у скаута осталось времени на обед.
function getBreakTimeFromDatabase(username, callback) {
  const query = `SELECT break_time FROM users WHERE username = ?`;
  db.query(query, [username], (err, results) => {
    if (err) {
      console.error('Error fetching data from database:', err);
      callback(null);
    } else {
      if (results.length > 0) {
        const breakTime = results[0].break_time;
        callback(breakTime);
      } else {
        callback(null);
      }
    }
  });
}

// Функция для получения счетчика сообщений из базы данных
function getMessageCount(username, callback) {
  const query = `SELECT count FROM users WHERE username = ?`;

  db.query(query, [username], (err, results) => {
    if (err) {
      console.error('Error fetching data from database:', err);
      callback(null);
    } else {
      if (results.length > 0) {
        const count = results[0].count;
        callback(count);
      } else {
        callback(null);
      }
    }
  });
}
// Функция для получения счетчика сообщений из базы данных
function getWarningCount(username, callback) {
  const query = `SELECT warning FROM users WHERE username = ?`;

  db.query(query, [username], (err, results) => {
    if (err) {
      console.error('Error fetching data from database:', err);
      callback(null);
    } else {
      if (results.length > 0) {
        const warning = results[0].warning;
        callback(warning);
      } else {
        callback(null);
      }
    }
  });
}
// Функция для получения счетчика сообщений из базы данных
function getTsCount(username, callback) {
  const query = `SELECT ts FROM users WHERE username = ?`;

  db.query(query, [username], (err, results) => {
    if (err) {
      console.error('Error fetching data from database:', err);
      callback(null);
    } else {
      if (results.length > 0) {
        const ts = results[0].ts;
        callback(ts);
      } else {
        callback(null);
      }
    }
  });
}
// Функция для получения счетчика сообщений из базы данных
function getUnknownsCount(username, callback) {
  const query = `SELECT unknowns FROM users WHERE username = ?`;

  db.query(query, [username], (err, results) => {
    if (err) {
      console.error('Error fetching data from database:', err);
      callback(null);
    } else {
      if (results.length > 0) {
        const unknowns = results[0].unknowns;
        callback(unknowns);
      } else {
        callback(null);
      }
    }
  });
}

// Функция для получения счетчика сообщений из базы данных
function getTiketCount(username, callback) {
  const query = `SELECT tiket FROM users WHERE username = ?`;

  db.query(query, [username], (err, results) => {
    if (err) {
      console.error('Error fetching data from database:', err);
      callback(null);
    } else {
      if (results.length > 0) {
        const tiket = results[0].tiket;
        callback(tiket);
      } else {
        callback(null);
      }
    }
  });
}
// Функция для получения счетчика сообщений из базы данных
function getPopCount(username, callback) {
  const query = `SELECT pop FROM users WHERE username = ?`;

  db.query(query, [username], (err, results) => {
    if (err) {
      console.error('Error fetching data from database:', err);
      callback(null);
    } else {
      if (results.length > 0) {
        const pop = results[0].pop;
        callback(pop);
      } else {
        callback(null);
      }
    }
  });
}

// Функция для очистки данных пользователей в базе
function clearUserDataInDatabase() {
  const query = `UPDATE users SET task = 0, breaks = 0, job = 0, count=0, break_time=60, pop=0, ts=0, unknowns=0, warning=0, tiket=0`;
  db.query(query, (err) => {
    if (err) {
      console.error('Error updating data in database:', err);
    } else {
      console.log('User data cleared successfully.');
    }
  });
}

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

// Функция взятия Задачи
function updateTaskInDatabase(username, newStatus) {
  const query = `UPDATE users SET task = ? WHERE username = ?`;
  db.query(query, [newStatus, username], (err) => {
    if (err) {
      console.error('Error updating breaks in database:', err);
    } else {
      console.log(`breaks updated to ${newStatus} for user ${username}`);
    }
  });
}


function updateJobInDatabase(username, newJob) {
  const query = `UPDATE users SET job = ? WHERE username = ?`;
  db.query(query, [newJob, username], (err) => {
    if (err) {
      console.error('Error updating status in database:', err);
    } else {
      console.log(`Job updated to ${newJob} for user ${username}`);
    }
  });
}
function updateJobsInDatabase(username, newJobs) {
  const query = `UPDATE users SET job = ? WHERE username = ?`;
  db.query(query, [newJobs, username], (err) => {
    if (err) {
      console.error('Error updating status in database:', err);
    } else {
      console.log(`Job updated to ${newJobs} for user ${username}`);
    }
  });
}
function updateTaskEndDatabase(username, newStatusText) {
  const query = `UPDATE users SET task = ? WHERE username = ?`;
  db.query(query, [newStatusText, username], (err) => {
    if (err) {
      console.error('Error updating task in database:', err);
    } else {
      console.log(`Task updated to "${newStatusText}" for user ${username}`);
    }
  });
}

function updateBreaksEndDatabase(username, newStatusText) {
  const query = `UPDATE users SET breaks = ? WHERE username = ?`;
  db.query(query, [newStatusText, username], (err) => {
    if (err) {
      console.error('Error updating task in database:', err);
    } else {
      console.log(`Break updated to "${newStatusText}" for user ${username}`);
    }
  });
}


function getLastMessageTimeFromDatabase(username, callback) {
  const query = `SELECT last_message_time FROM users WHERE username = ?`;
  db.query(query, [username], (err, results) => {
    if (err) {
      console.error('Error fetching data from database:', err);
      return;
    }
    if (results.length > 0) {
      callback(results[0].last_message_time);
    } else {
      callback(null); // Пользователь не найден в базе данных
    }
  });
}

function updateLastMessageTimeInDatabase(username, timestamp) {
  const query = `UPDATE users SET last_message_time = ? WHERE username = ?`;
  db.query(query, [timestamp, username], (err) => {
    if (err) {
      console.error('Error updating data in database:', err);
    }
  });
}

if (TOKEN) {
  console.log('Bot is running...');
} else {
  console.error("Bot token is missing!");
}
