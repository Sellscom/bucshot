const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let waitingPlayer = null; 
let rooms = {};

io.on('connection', (socket) => {
    // Рассылка онлайна при входе
    io.emit('update_online', io.engine.clientsCount);

    socket.on('join_game', () => {
        // Очистка очереди от отключенных
        if (waitingPlayer && !waitingPlayer.connected) waitingPlayer = null;

        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            const roomId = `room_${waitingPlayer.id}_${socket.id}`;
            const p1 = waitingPlayer;
            const p2 = socket;

            rooms[roomId] = {
                players: [p1.id, p2.id],
                magazine: generateMagazine(),
                hp: { [p1.id]: 3, [p2.id]: 3 },
                inv: { [p1.id]: generateItems(2), [p2.id]: generateItems(2) },
                turn: p1.id,
                dmg: 1
            };

            p1.join(roomId);
            p2.join(roomId);

            io.to(p1.id).emit('init_game', { roomId, myInv: rooms[roomId].inv[p1.id], oppInv: rooms[roomId].inv[p2.id], turn: true });
            io.to(p2.id).emit('init_game', { roomId, myInv: rooms[roomId].inv[p2.id], oppInv: rooms[roomId].inv[p1.id], turn: false });
            waitingPlayer = null;
        } else {
            waitingPlayer = socket;
            socket.emit('waiting', "ПОИСК ОППОНЕНТА...");
        }
    });

    socket.on('game_action', (data) => {
        const room = rooms[data.roomId];
        if (!room || room.turn !== socket.id) return;

        if (data.type === 'shoot') {
            const isLive = room.magazine.shift();
            let nextTurn = room.turn;
            if (isLive) {
                const victimId = data.target === 'self' ? socket.id : room.players.find(id => id !== socket.id);
                room.hp[victimId] -= room.dmg;
                nextTurn = room.players.find(id => id !== socket.id);
            } else if (data.target === 'opp') {
                nextTurn = room.players.find(id => id !== socket.id);
            }
            room.dmg = 1; room.turn = nextTurn;
            io.to(data.roomId).emit('action_result', { type: 'shoot', actor: socket.id, target: data.target, isLive, hp: room.hp, nextTurn });
            
            // Проверка конца
            const dead = room.players.find(id => room.hp[id] <= 0);
            if (dead) {
                io.to(data.roomId).emit('game_over', { winner: room.players.find(id => id !== dead) });
                delete rooms[data.roomId];
            } else if (room.magazine.length === 0) {
                room.magazine = generateMagazine();
                io.to(data.roomId).emit('reload', { magCount: room.magazine.length });
            }
        }
    });

    socket.on('disconnect', () => {
        if (waitingPlayer && waitingPlayer.id === socket.id) waitingPlayer = null;
        io.emit('update_online', io.engine.clientsCount);
    });
});

function generateMagazine() {
    const s = Math.floor(Math.random() * 4) + 3;
    return Array(s).fill(false).map((_, i) => i < Math.ceil(s/2)).sort(() => Math.random() - 0.5);
}
function generateItems(n) {
    const pool = ['Beer', 'Knife', 'Cigaretes', 'Handclifs', 'Lighter'];
    return Array(n).fill(0).map(() => pool[Math.floor(Math.random() * pool.length)]);
}

http.listen(process.env.PORT || 3000);
