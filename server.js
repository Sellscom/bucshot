const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const TelegramBot = require('node-telegram-bot-api');

// УКАЖИ СВОЙ ТОКЕН
const TOKEN = '8547285463:AAGlqe57F28QQxQ3zhoViNqXMTVie1JEth8';
const GAME_URL = 'https://bucshot.onrender.com';
const bot = new TelegramBot(TOKEN, { polling: true });

app.use(express.static(__dirname));

// --- БОТ ---
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "💀 Buckshot Online\nЖми кнопку, чтобы играть:", {
        reply_markup: { inline_keyboard: [[{ text: "ИГРАТЬ", url: GAME_URL }]] }
    });
});

// --- ЛОГИКА ИГРЫ ---
let waitingPlayer = null;
let rooms = {};
const ITEMS_POOL = ['Beer', 'Knife', 'Cigaretes', 'Handclifs', 'Lighter'];

io.on('connection', (socket) => {
    // Обновляем счетчик онлайна
    io.emit('online_count', io.engine.clientsCount);

    socket.on('join_game', (userData) => {
        const playerName = userData?.name || "Незнакомец";

        if (waitingPlayer && waitingPlayer.socket.id !== socket.id) {
            // Создаем комнату
            const roomId = `room_${waitingPlayer.socket.id}_${socket.id}`;
            const mag = generateMagazine();
            
            const p1 = waitingPlayer;
            const p2 = { socket, name: playerName };

            rooms[roomId] = {
                players: [p1.socket.id, p2.socket.id],
                magazine: mag
            };

            p1.socket.join(roomId);
            p2.socket.join(roomId);

            // Генерируем предметы
            const items1 = generateItems(4);
            const items2 = generateItems(4);

            // Старт игры (P1 ходит первым)
            io.to(p1.socket.id).emit('start_multiplayer', {
                id: roomId, magazine: mag, turn: true, // true = твой ход
                myInv: items1, oppInv: items2,
                myName: p1.name, oppName: p2.name
            });
            
            io.to(p2.socket.id).emit('start_multiplayer', {
                id: roomId, magazine: mag, turn: false, // false = жди
                myInv: items2, oppInv: items1,
                myName: p2.name, oppName: p1.name
            });

            waitingPlayer = null;
        } else {
            waitingPlayer = { socket, name: playerName };
            socket.emit('waiting', 'ПОИСК СОПЕРНИКА...');
        }
    });

    socket.on('game_action', (data) => {
        const room = rooms[data.roomId];
        if (!room) return;

        // Пересылаем действие противнику
        socket.to(data.roomId).emit('opponent_action', data);

        // Серверная логика магазина
        if (data.type === 'shoot') {
            room.magazine.shift();
            
            // Если патроны кончились — перезарядка через 3 секунды
            if (room.magazine.length === 0) {
                setTimeout(() => {
                    const newMag = generateMagazine();
                    room.magazine = newMag;
                    io.to(data.roomId).emit('reload_magazine', {
                        magazine: newMag,
                        newItems: generateItems(2)
                    });
                }, 3000);
            }
        } 
        else if (data.type === 'item' && data.item === 'Beer') {
            room.magazine.shift(); // Пиво выбрасывает патрон
        }
    });

    socket.on('disconnect', () => {
        if (waitingPlayer && waitingPlayer.socket === socket) waitingPlayer = null;
        io.emit('online_count', io.engine.clientsCount);
    });
});

function generateMagazine() {
    let total = Math.floor(Math.random() * 4) + 3; // 3-6 патронов
    let live = Math.ceil(total / 2);
    return Array(total).fill(false).map((_, i) => i < live).sort(() => Math.random() - 0.5);
}

function generateItems(n) {
    return Array(n).fill(null).map(() => ITEMS_POOL[Math.floor(Math.random() * ITEMS_POOL.length)]);
}

http.listen(process.env.PORT || 3000);
