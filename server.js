const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let waitingPlayer = null;
let rooms = {};

io.on('connection', (socket) => {
    socket.on('find_game', () => {
        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            const roomId = `room_${waitingPlayer.id}_${socket.id}`;
            const magazine = generateMagazine();
            
            rooms[roomId] = {
                players: [waitingPlayer.id, socket.id],
                magazine: magazine,
                hp: [3, 3],
                turn: 0 
            };

            socket.join(roomId);
            waitingPlayer.join(roomId);

            io.to(roomId).emit('game_ready', {
                roomId,
                magazineInfo: {
                    live: magazine.filter(b => b).length,
                    blank: magazine.filter(b => !b).length
                },
                turnId: waitingPlayer.id
            });
            waitingPlayer = null;
        } else {
            waitingPlayer = socket;
            socket.emit('status', 'ПОИСК СОПЕРНИКА...');
        }
    });

    socket.on('shoot_action', (data) => {
        const room = rooms[data.roomId];
        if (!room) return;

        const bullet = room.magazine.shift();
        io.to(data.roomId).emit('shoot_result', {
            shooter: socket.id,
            target: data.target,
            isLive: bullet,
            magazineEmpty: room.magazine.length === 0
        });
    });
});

function generateMagazine() {
    let total = Math.floor(Math.random() * 4) + 3;
    let live = Math.ceil(total / 2);
    return Array(total).fill(false).map((_, i) => i < live).sort(() => Math.random() - 0.5);
}

server.listen(process.env.PORT || 3000);