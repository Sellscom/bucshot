const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const TOKEN = '8547285463:AAGlqe57F28QQxQ3zhoViNqXMTVie1JEth8'; // Твой токен
const bot = new TelegramBot(TOKEN, { polling: true });
const GAME_URL = 'https://bucshot.onrender.com'; // Твой URL на Render

// Важно: эта строка разрешает серверу отдавать твои картинки и звуки
app.use(express.static(__dirname));

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "💀 Buckshot Roulette Online 💀\nГотов испытать удачу с реальным соперником?", {
        reply_markup: {
            inline_keyboard: [[{ text: "ИГРАТЬ ОНЛАЙН", url: GAME_URL }]]
        }
    });
});

let waitingPlayer = null;
let rooms = {};
const ITEMS_POOL = ['Beer', 'Knife', 'Cigaretes', 'Handclifs', 'Lighter'];

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_game', () => {
        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            // Нашли пару
            const roomId = `room_${waitingPlayer.id}_${socket.id}`;
            const initialMag = generateMagazine();
            
            rooms[roomId] = {
                players: [waitingPlayer.id, socket.id],
                magazine: initialMag,
                turn: waitingPlayer.id
            };

            socket.join(roomId);
            waitingPlayer.join(roomId);

            // Отправляем старт обоим игрокам с начальными предметами
            io.to(waitingPlayer.id).emit('start_multiplayer', {
                id: roomId, magazine: initialMag, turn: waitingPlayer.id, myInv: generateItems(3), oppInv: generateItems(3)
            });
            io.to(socket.id).emit('start_multiplayer', {
                id: roomId, magazine: initialMag, turn: waitingPlayer.id, myInv: generateItems(3), oppInv: generateItems(3)
            });
            
            waitingPlayer = null;
        } else {
            // Ждем соперника
            waitingPlayer = socket;
            socket.emit('waiting', 'ПОИСК СОПЕРНИКА...');
        }
    });

    socket.on('make_move', (data) => {
        const room = rooms[data.roomId];
        if (!room) return;

        // Убираем патрон из серверного магазина
        room.magazine.shift();
        
        // Пересылаем ход другому игроку
        socket.to(data.roomId).emit('opponent_move', data);

        // Проверка на пустой магазин
        if (room.magazine.length === 0) {
            const newMag = generateMagazine();
            room.magazine = newMag;
            // Через 2 секунды (после анимаций выстрела) отправляем команду на перезарядку
            setTimeout(() => {
                io.to(data.roomId).emit('reload_magazine', {
                    magazine: newMag,
                    newItems: generateItems(2) // Выдаем по 2 новых предмета
                });
            }, 2000);
        }
    });

    socket.on('disconnect', () => {
        if (waitingPlayer === socket) waitingPlayer = null;
        // Здесь можно добавить логику оповещения второго игрока о выходе соперника
    });
});

function generateMagazine() {
    let total = Math.floor(Math.random() * 4) + 4; // от 4 до 7 патронов
    let live = Math.ceil(total / 2);
    return Array(total).fill(false).map((_, i) => i < live).sort(() => Math.random() - 0.5);
}

function generateItems(n) {
    return Array(n).fill(null).map(() => ITEMS_POOL[Math.floor(Math.random() * ITEMS_POOL.length)]);
}

http.listen(process.env.PORT || 3000, () => {
    console.log('listening on *:' + (process.env.PORT || 3000));
});
