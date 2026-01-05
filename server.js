const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

// --- НАСТРОЙКИ ---
const TOKEN = '8547285463:AAGlqe57F28QQxQ3zhoViNqXMTVie1JEth8';
const GAME_URL = 'https://bucshot.onrender.com';

app.use(express.static(__dirname));

// --- ТЕЛЕГРАМ БОТ ---
const bot = new TelegramBot(TOKEN, { polling: true });
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "💀 Buckshot Roulette Online 💀", {
        reply_markup: {
            inline_keyboard: [[{ text: "ИГРАТЬ ONLINE", url: GAME_URL }]]
        }
    });
});

// --- ЛОГИКА ИГРЫ ---
let waitingPlayer = null;
let rooms = {};

io.on('connection', (socket) => {
    socket.on('join_game', () => {
        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            const roomId = `room_${waitingPlayer.id}_${socket.id}`;
            const magazine = generateMagazine();
            rooms[roomId] = { players: [waitingPlayer.id, socket.id], magazine, turn: waitingPlayer.id };
            
            socket.join(roomId);
            waitingPlayer.join(roomId);
            io.to(roomId).emit('start_multiplayer', { id: roomId, magazine, turn: waitingPlayer.id });
            waitingPlayer = null;
        } else {
            waitingPlayer = socket;
            socket.emit('waiting', 'ПОИСК СОПЕРНИКА...');
        }
    });

    socket.on('make_move', (data) => {
        socket.to(data.roomId).emit('opponent_move', data);
    });

    socket.on('disconnect', () => { if (waitingPlayer === socket) waitingPlayer = null; });
});

function generateMagazine() {
    let total = Math.floor(Math.random() * 4) + 4;
    let live = Math.ceil(total / 2);
    return Array(total).fill(false).map((_, i) => i < live).sort(() => Math.random() - 0.5);
}

http.listen(process.env.PORT || 3000, () => console.log('Server is running'));
