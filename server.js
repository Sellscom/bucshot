const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let waitingPlayer = null; 
let rooms = {};
let onlineCount = 0;

io.on('connection', (socket) => {
    onlineCount++;
    io.emit('update_online', onlineCount);
    console.log(`Игрок подключен: ${socket.id}. Всего: ${onlineCount}`);

    socket.on('join_game', () => {
        console.log(`Запрос на игру от: ${socket.id}`);

        // 1. Проверяем, есть ли кто-то в очереди и не мы ли это сами
        // И самое важное: проверяем, не отключился ли ждущий игрок
        if (waitingPlayer && waitingPlayer.id !== socket.id && waitingPlayer.connected) {
            const roomId = `room_${waitingPlayer.id}_${socket.id}`;
            const p1 = waitingPlayer;
            const p2 = socket;

            rooms[roomId] = {
                players: [p1.id, p2.id],
                round: 1,
                magazine: generateMagazine(),
                hp: { [p1.id]: 3, [p2.id]: 3 },
                inv: { [p1.id]: generateItems(4), [p2.id]: generateItems(4) },
                turn: p1.id,
                dmg: 1
            };

            p1.join(roomId);
            p2.join(roomId);

            io.to(p1.id).emit('init_game', { roomId, myInv: rooms[roomId].inv[p1.id], oppInv: rooms[roomId].inv[p2.id], turn: true });
            io.to(p2.id).emit('init_game', { roomId, myInv: rooms[roomId].inv[p2.id], oppInv: rooms[roomId].inv[p1.id], turn: false });
            
            console.log(`Матч создан в комнате: ${roomId}`);
            waitingPlayer = null; // Очищаем очередь
        } else {
            // 2. Если никого нет, становимся ждущим
            waitingPlayer = socket;
            socket.emit('waiting', "ПОИСК ОППОНЕНТА...");
            console.log(`Игрок ${socket.id} добавлен в очередь`);
        }
    });

    socket.on('disconnect', () => {
        onlineCount--;
        io.emit('update_online', onlineCount);
        
        // Если отключился тот, кто ждал игру — очищаем переменную
        if (waitingPlayer && waitingPlayer.id === socket.id) {
            waitingPlayer = null;
            console.log("Ждущий игрок отключился, очередь пуста.");
        }
    });

    // ... остальной код (game_action, checkState и т.д.) остается прежним
});

// Вспомогательные функции (Magazine, Items) должны быть здесь
function generateMagazine() {
    const s = Math.floor(Math.random() * 4) + 3;
    return Array(s).fill(false).map((_, i) => i < Math.ceil(s/2)).sort(() => Math.random() - 0.5);
}
function generateItems(n) {
    const pool = ['Beer', 'Knife', 'Cigaretes', 'Handclifs', 'Lighter'];
    return Array(n).fill(0).map(() => pool[Math.floor(Math.random() * pool.length)]);
}

http.listen(process.env.PORT || 3000, () => {
    console.log("СЕРВЕР ЗАПУЩЕН НА ПОРТУ 3000");
});
