const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let waitingPlayer = null;
let rooms = {};
const ITEMS_POOL = ['Beer', 'Knife', 'Cigaretes', 'Handclifs', 'Lighter'];

io.on('connection', (socket) => {
    io.emit('online_count', io.engine.clientsCount);

    socket.on('join_game', (userData) => {
        const playerName = userData?.name || "Игрок";

        if (waitingPlayer && waitingPlayer.socket.id !== socket.id) {
            const roomId = `room_${waitingPlayer.socket.id}_${socket.id}`;
            const mag = generateMagazine();
            const inv1 = generateItems(4);
            const inv2 = generateItems(4);

            rooms[roomId] = {
                players: [waitingPlayer.socket.id, socket.id],
                magazine: mag,
                inventories: { [waitingPlayer.socket.id]: inv1, [socket.id]: inv2 }
            };

            const p1 = waitingPlayer;
            const p2 = { socket, name: playerName };

            p1.socket.join(roomId);
            p2.socket.join(roomId);

            io.to(p1.socket.id).emit('start_multiplayer', {
                id: roomId, magazine: mag, turn: true,
                myInv: inv1, oppInv: inv2, myName: p1.name, oppName: p2.name
            });
            io.to(p2.socket.id).emit('start_multiplayer', {
                id: roomId, magazine: mag, turn: false,
                myInv: inv2, oppInv: inv1, myName: p2.name, oppName: p1.name
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

        if (data.type === 'shoot') {
            room.magazine.shift();
        } else if (data.type === 'item') {
            const myInv = room.inventories[socket.id];
            const idx = myInv.indexOf(data.item);
            if (idx > -1) myInv.splice(idx, 1);
            if (data.item === 'Beer') room.magazine.shift();
        }

        socket.to(data.roomId).emit('opponent_action', data);

        if (room.magazine.length === 0) {
            setTimeout(() => {
                const newMag = generateMagazine();
                const newItems = generateItems(2);
                room.magazine = newMag;
                Object.keys(room.inventories).forEach(pid => {
                    room.inventories[pid] = [...room.inventories[pid], ...newItems].slice(0, 8);
                });
                io.to(data.roomId).emit('reload_magazine', { magazine: newMag, newItems });
            }, 3000);
        }
    });

    socket.on('disconnect', () => {
        if (waitingPlayer && waitingPlayer.socket === socket) waitingPlayer = null;
        io.emit('online_count', io.engine.clientsCount);
    });
});

function generateMagazine() {
    let total = Math.floor(Math.random() * 4) + 3;
    let live = Math.ceil(total / 2);
    return Array(total).fill(false).map((_, i) => i < live).sort(() => Math.random() - 0.5);
}

function generateItems(n) {
    return Array(n).fill(null).map(() => ITEMS_POOL[Math.floor(Math.random() * ITEMS_POOL.length)]);
}

http.listen(process.env.PORT || 3000, () => console.log('Server is running'));
