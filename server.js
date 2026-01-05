const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let waitingPlayer = null;
let rooms = {};
const ITEMS_POOL = ['Beer', 'Knife', 'Cigaretes', 'Handclifs', 'Lighter'];

io.on('connection', (socket) => {
    socket.on('join_game', (userData) => {
        const playerName = userData?.name || "Игрок";
        if (waitingPlayer && waitingPlayer.socket.id !== socket.id) {
            const roomId = `room_${waitingPlayer.socket.id}_${socket.id}`;
            const mag = generateMagazine();
            const p1Inv = generateItems(4);
            const p2Inv = generateItems(4);

            rooms[roomId] = {
                players: [waitingPlayer.socket.id, socket.id],
                round: 1,
                magazine: mag,
                hp: { [waitingPlayer.socket.id]: 3, [socket.id]: 3 },
                inv: { [waitingPlayer.socket.id]: p1Inv, [socket.id]: p2Inv }
            };

            const p1 = waitingPlayer;
            const p2 = { socket, name: playerName };
            p1.socket.join(roomId); p2.socket.join(roomId);

            io.to(p1.socket.id).emit('start_game', { id: roomId, mag, turn: true, myInv: p1Inv, oppInv: p2Inv, oppName: p2.name });
            io.to(p2.socket.id).emit('start_game', { id: roomId, mag, turn: false, myInv: p2Inv, oppInv: p1Inv, oppName: p1.name });
            waitingPlayer = null;
        } else {
            waitingPlayer = { socket, name: playerName };
        }
    });

    socket.on('game_action', (data) => {
        const room = rooms[data.roomId];
        if (!room) return;

        if (data.type === 'shoot') {
            room.magazine.shift();
            if (data.bullet) {
                const targetId = data.target === 'self' ? socket.id : room.players.find(p => p !== socket.id);
                room.hp[targetId] -= (data.dmg || 1);
            }
        } else if (data.type === 'item') {
            const myIdx = room.inv[socket.id].indexOf(data.item);
            if (myIdx > -1) room.inv[socket.id].splice(myIdx, 1);
            if (data.item === 'Beer') room.magazine.shift();
        }

        socket.to(data.roomId).emit('opponent_action', data);

        // Проверка смерти и раундов
        const deadPlayer = room.players.find(p => room.hp[p] <= 0);
        if (deadPlayer) {
            room.round++;
            if (room.round > 3) {
                const winnerId = room.players.find(p => p !== deadPlayer);
                io.to(data.roomId).emit('game_over', { winner: winnerId });
                delete rooms[data.roomId];
            } else {
                room.hp = { [room.players[0]]: 3, [room.players[1]]: 3 };
                const newMag = generateMagazine();
                room.magazine = newMag;
                io.to(data.roomId).emit('next_round', { round: room.round, mag: newMag });
            }
        } else if (room.magazine.length === 0) {
            const newMag = generateMagazine();
            const newItems = generateItems(2);
            room.magazine = newMag;
            room.players.forEach(p => room.inv[p] = [...room.inv[p], ...newItems].slice(0, 8));
            io.to(data.roomId).emit('reload', { mag: newMag, newItems });
        }
    });
});

function generateMagazine() {
    let t = Math.floor(Math.random() * 4) + 3;
    let l = Math.ceil(t / 2);
    return Array(t).fill(false).map((_, i) => i < l).sort(() => Math.random() - 0.5);
}
function generateItems(n) { return Array(n).fill(0).map(() => ITEMS_POOL[Math.floor(Math.random() * ITEMS_POOL.length)]); }
http.listen(process.env.PORT || 3000);
