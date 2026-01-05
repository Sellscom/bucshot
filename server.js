const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

// --- НАСТРОЙКИ ---
const TOKEN = '8547285463:AAGlqe57F28QQxQ3zhoViNqXMTVie1JEth8';
const GAME_URL = 'https://bucshot.onrender.com';

// Раздача статических файлов (твоего index.html)
app.use(express.static(path.join(__dirname, '/')));

// --- ЛОГИКА ТЕЛЕГРАМ БОТА ---
const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Добро пожаловать в Buckshot Online! Нажми кнопку ниже, чтобы найти оппонента.", {
        reply_markup: {
            inline_keyboard: [[
                { text: "ИГРАТЬ ONLINE", url: GAME_URL }
            ]]
        }
    });
});

// --- ЛОГИКА МУЛЬТИПЛЕЕРА ---
let waitingPlayer = null;
let rooms = {};

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);

    socket.on('join_game', () => {
        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            const roomId = `room_${waitingPlayer.id}_${socket.id}`;
            const magazine = generateMagazine();
            
            const roomData = {
                id: roomId,
                players: [waitingPlayer.id, socket.id],
                magazine: magazine,
                turn: waitingPlayer.id
            };
            
            rooms[roomId] = roomData;
            socket.join(roomId);
            waitingPlayer.join(roomId);
            
            io.to(roomId).emit('start_multiplayer', roomData);
            console.log(`Комната создана: ${roomId}`);
            waitingPlayer = null;
        } else {
            waitingPlayer = socket;
            socket.emit('waiting', 'ПОИСК ОППОНЕНТА...');
        }
    });

    socket.on('make_move', (data) => {
        socket.to(data.roomId).emit('opponent_move', data);
    });

    socket.on('disconnect', () => {
        if (waitingPlayer === socket) waitingPlayer = null;
    });
});

function generateMagazine() {
    let total = Math.floor(Math.random() * 4) + 5;
    let live = Math.ceil(total / 2);
    return Array(total).fill(false).map((_, i) => i < live).sort(() => Math.random() - 0.5);
}

// Запуск сервера
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
