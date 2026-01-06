// server.js
const io = require('socket.io')(process.env.PORT || 3000, {
    cors: { origin: "*" }
});

let rooms = {};

io.on('connection', (socket) => {
    socket.on('joinRoom', (roomId) => {
        if (!rooms[roomId]) {
            rooms[roomId] = { players: [socket.id], gameState: null };
            socket.join(roomId);
            socket.emit('waiting', 'Ожидание второго игрока...');
        } else if (rooms[roomId].players.length === 1) {
            rooms[roomId].players.push(socket.id);
            socket.join(roomId);
            io.to(roomId).emit('startGame', { firstTurn: rooms[roomId].players[0] });
        }
    });

    socket.on('action', (data) => {
        // Пересылка действий игрока оппоненту в комнате
        socket.to(data.roomId).emit('opponentAction', data);
    });
});
