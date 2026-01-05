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

const ITEM_LIST = ['Beer', 'Knife', 'Cigaretes', 'Handclifs', 'Lighter'];

io.on('connection', (socket) => {
    socket.on('join_game', () => {
        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            const roomId = `room_${waitingPlayer.id}_${socket.id}`;
            const magazine = generateMagazine();
            const p1Inv = generateItems(3);
            const p2Inv = generateItems(3);
            
            rooms[roomId] = { 
                players: [waitingPlayer.id, socket.id], 
                magazine: magazine, 
                turn: waitingPlayer.id 
            };
            
            socket.join(roomId);
            waitingPlayer.join(roomId);

            // Отправляем начальные данные обоим
            io.to(waitingPlayer.id).emit('start_multiplayer', { 
                id: roomId, magazine, turn: waitingPlayer.id, myInv: p1Inv, oppInv: p2Inv 
            });
            io.to(socket.id).emit('start_multiplayer', { 
                id: roomId, magazine, turn: waitingPlayer.id, myInv: p2Inv, oppInv: p1Inv 
            });
            
            waitingPlayer = null;
        } else {
            waitingPlayer = socket;
            socket.emit('waiting', 'ПОИСК СОПЕРНИКА...');
        }
    });

    socket.on('make_move', (data) => {
        // Пересылаем ход оппоненту
        socket.to(data.roomId).emit('opponent_move', data);
    });

    socket.on('disconnect', () => { if (waitingPlayer === socket) waitingPlayer = null; });
});

function generateMagazine() {
    let total = Math.floor(Math.random() * 4) + 4;
    let live = Math.ceil(total / 2);
    return Array(total).fill(false).map((_, i) => i < live).sort(() => Math.random() - 0.5);
}

function generateItems(count) {
    return Array(count).fill(null).map(() => ITEM_LIST[Math.floor(Math.random() * ITEM_LIST.length)]);
}

http.listen(process.env.PORT || 3000, () => console.log('Server running'));
