const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let waitingPlayer = null;
let rooms = {};
let onlineCount = 0;
const ITEMS_POOL = ['Beer', 'Knife', 'Cigaretes', 'Handclifs', 'Lighter'];

io.on('connection', (socket) => {
    onlineCount++;
    io.emit('update_online', onlineCount);

    socket.on('join_game', () => {
        // Если уже есть ждущий игрок и это не мы сами
        if (waitingPlayer && waitingPlayer.id !== socket.id) {
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

            io.to(p1.id).emit('init_game', { roomId, myInv: rooms[roomId].inv[p1.id], oppInv: rooms[roomId].inv[p2.id], turn: true, mode: 'multi' });
            io.to(p2.id).emit('init_game', { roomId, myInv: rooms[roomId].inv[p2.id], oppInv: rooms[roomId].inv[p1.id], turn: false, mode: 'multi' });
            waitingPlayer = null;
        } else {
            waitingPlayer = socket;
            socket.emit('waiting', "ПОИСК ИГРОКА...");
        }
    });

    socket.on('game_action', (data) => {
        const room = rooms[data.roomId];
        if (!room || room.turn !== socket.id) return;
        processAction(data.roomId, socket.id, data);
    });

    socket.on('disconnect', () => {
        onlineCount--;
        io.emit('update_online', onlineCount);
        if (waitingPlayer && waitingPlayer.id === socket.id) waitingPlayer = null;
    });
});

function processAction(roomId, playerId, data) {
    const room = rooms[roomId];
    if (data.type === 'shoot') {
        const isLive = room.magazine.shift();
        let nextTurn = room.turn;
        if (isLive) {
            const victimId = data.target === 'self' ? playerId : room.players.find(id => id !== playerId);
            room.hp[victimId] -= room.dmg;
            nextTurn = room.players.find(id => id !== playerId);
        } else {
            if (data.target === 'opp') nextTurn = room.players.find(id => id !== playerId);
        }
        room.dmg = 1; room.turn = nextTurn;
        io.to(roomId).emit('action_result', { type: 'shoot', actor: playerId, target: data.target, isLive, hp: room.hp, nextTurn });
        checkState(roomId);
    } else if (data.type === 'item') {
        const idx = room.inv[playerId].indexOf(data.item);
        if (idx > -1) {
            room.inv[playerId].splice(idx, 1);
            let logData = { item: data.item, actor: playerId };
            if (data.item === 'Beer') logData.extra = room.magazine.shift();
            if (data.item === 'Knife') room.dmg = 2;
            if (data.item === 'Cigaretes') room.hp[playerId] = Math.min(3, room.hp[playerId] + 1);
            io.to(roomId).emit('action_result', { type: 'item', logData, hp: room.hp });
        }
    }
}

function checkState(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    const dead = room.players.find(id => room.hp[id] <= 0);
    if (dead) {
        room.round++;
        if (room.round > 3) {
            io.to(roomId).emit('game_over', { winner: room.players.find(id => id !== dead) });
            delete rooms[roomId];
        } else {
            room.hp = { [room.players[0]]: 3, [room.players[1]]: 3 };
            room.magazine = generateMagazine();
            io.to(roomId).emit('next_round', { round: room.round, hp: room.hp });
        }
    } else if (room.magazine.length === 0) {
        room.magazine = generateMagazine();
        io.to(roomId).emit('reload', { mag: room.magazine });
    }
}

function generateMagazine() {
    const s = Math.floor(Math.random() * 4) + 3;
    return Array(s).fill(false).map((_, i) => i < Math.ceil(s/2)).sort(() => Math.random() - 0.5);
}
function generateItems(n) { return Array(n).fill(0).map(() => ITEMS_POOL[Math.floor(Math.random() * ITEMS_POOL.length)]); }

http.listen(process.env.PORT || 3000);
