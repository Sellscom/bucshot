const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const TelegramBot = require('node-telegram-bot-api');

const TOKEN = '8547285463:AAGlqe57F28QQxQ3zhoViNqXMTVie1JEth8';
const bot = new TelegramBot(TOKEN, { polling: true });

app.use(express.static(__dirname));

let waitingPlayer = null;
let rooms = {};

const ITEMS = ['Beer', 'Knife', 'Cigaretes', 'Handclifs', 'Lighter'];

io.on('connection', (socket) => {
    socket.on('join_game', () => {
        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            const roomId = `room_${waitingPlayer.id}_${socket.id}`;
            const gameData = generateRoundData();
            
            rooms[roomId] = {
                players: [waitingPlayer.id, socket.id],
                magazine: gameData.magazine,
                turn: waitingPlayer.id
            };

            socket.join(roomId);
            waitingPlayer.join(roomId);

            io.to(waitingPlayer.id).emit('start_multiplayer', {
                id: roomId, magazine: gameData.magazine, turn: waitingPlayer.id, myInv: generateItems(2), oppInv: generateItems(2)
            });
            io.to(socket.id).emit('start_multiplayer', {
                id: roomId, magazine: gameData.magazine, turn: waitingPlayer.id, myInv: generateItems(2), oppInv: generateItems(2)
            });
            waitingPlayer = null;
        } else {
            waitingPlayer = socket;
            socket.emit('waiting', 'ПОИСК ИГРОКА...');
        }
    });

    socket.on('make_move', (data) => {
        const room = rooms[data.roomId];
        if (!room) return;

        // Если патроны кончились, сервер генерирует новые и отправляет событие перезарядки
        room.magazine.shift();
        
        socket.to(data.roomId).emit('opponent_move', data);

        if (room.magazine.length === 0) {
            const newData = generateRoundData();
            room.magazine = newData.magazine;
            setTimeout(() => {
                io.to(data.roomId).emit('reload_magazine', {
                    magazine: room.magazine,
                    newItems: generateItems(2)
                });
            }, 1500);
        }
    });
});

function generateRoundData() {
    let total = Math.floor(Math.random() * 4) + 3;
    let live = Math.ceil(total / 2);
    let mag = Array(total).fill(false).map((_, i) => i < live).sort(() => Math.random() - 0.5);
    return { magazine: mag };
}

function generateItems(n) {
    return Array(n).fill(null).map(() => ITEMS[Math.floor(Math.random() * ITEMS.length)]);
}

http.listen(process.env.PORT || 3000, () => console.log('Server OK'));
