const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const TelegramBot = require('node-telegram-bot-api');

const TOKEN = '8547285463:AAGlqe57F28QQxQ3zhoViNqXMTVie1JEth8';
const GAME_URL = 'https://bucshot.onrender.com';
const bot = new TelegramBot(TOKEN, { polling: true });

app.use(express.static(__dirname));

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "💀 Buckshot Online 💀", {
        reply_markup: { inline_keyboard: [[{ text: "ИГРАТЬ", url: GAME_URL }]] }
    });
});

let waitingPlayer = null;
let rooms = {};
const ITEMS_POOL = ['Beer', 'Knife', 'Cigaretes', 'Handclifs', 'Lighter'];

io.on('connection', (socket) => {
    // Отправляем текущий онлайн всем
    io.emit('online_count', io.engine.clientsCount);

    socket.on('disconnect', () => {
        if (waitingPlayer && waitingPlayer.socket === socket) waitingPlayer = null;
        io.emit('online_count', io.engine.clientsCount);
    });

    socket.on('join_game', (userData) => {
        const playerName = userData?.name || "Игрок";

        if (waitingPlayer && waitingPlayer.socket.id !== socket.id) {
            // Нашли пару
            const roomId = `room_${waitingPlayer.socket.id}_${socket.id}`;
            const mag = generateMagazine();
            
            const p1 = waitingPlayer;
            const p2 = { socket, name: playerName };

            rooms[roomId] = {
                players: [p1.socket.id, p2.socket.id],
                magazine: mag,
                turn: p1.socket.id
            };

            p1.socket.join(roomId);
            p2.socket.join(roomId);

            // Отправляем старт
            io.to(p1.socket.id).emit('start_multiplayer', {
                id: roomId, magazine: mag, turn: p1.socket.id, 
                myInv: generateItems(3), oppInv: generateItems(3),
                oppName: p2.name, myName: p1.name
            });
            
            io.to(p2.socket.id).emit('start_multiplayer', {
                id: roomId, magazine: mag, turn: p1.socket.id, 
                myInv: generateItems(3), oppInv: generateItems(3),
                oppName: p1.name, myName: p2.name
            });

            waitingPlayer = null;
        } else {
            waitingPlayer = { socket, name: playerName };
            socket.emit('waiting', 'ПОИСК СОПЕРНИКА...');
        }
    });

    socket.on('game_action', (data) => {
        // data: { roomId, type: 'shoot'|'item', target, item, bullet? }
        const room = rooms[data.roomId];
        if (!room) return;

        if (data.type === 'shoot') {
            room.magazine.shift();
            socket.to(data.roomId).emit('opponent_action', data);
            
            // Если патроны кончились - перезарядка
            if (room.magazine.length === 0) {
                setTimeout(() => {
                    const newMag = generateMagazine();
                    room.magazine = newMag;
                    io.to(data.roomId).emit('reload_magazine', {
                        magazine: newMag,
                        newItems: generateItems(2)
                    });
                }, 2500);
            }
        } 
        else if (data.type === 'item') {
            // Если пиво - удаляем патрон на сервере
            if (data.item === 'Beer') room.magazine.shift();
            socket.to(data.roomId).emit('opponent_action', data);
        }
    });
});

function generateMagazine() {
    let total = Math.floor(Math.random() * 4) + 4;
    let live = Math.ceil(total / 2);
    return Array(total).fill(false).map((_, i) => i < live).sort(() => Math.random() - 0.5);
}

function generateItems(n) {
    return Array(n).fill(null).map(() => ITEMS_POOL[Math.floor(Math.random() * ITEMS_POOL.length)]);
}

http.listen(process.env.PORT || 3000);
