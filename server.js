const io = require('socket.io')(process.env.PORT || 3000, {
    cors: { origin: "*" }
});

let waitingPlayer = null;

io.on('connection', (socket) => {
    console.log('Новое подключение:', socket.id);

    socket.on('joinGame', () => {
        if (waitingPlayer) {
            // Если кто-то уже ждет, создаем комнату для двоих
            const roomId = 'room_' + waitingPlayer.id;
            const opponent = waitingPlayer;
            waitingPlayer = null;

            socket.join(roomId);
            opponent.join(roomId);

            // Уведомляем обоих, кто ходит первым
            io.to(roomId).emit('matchFound', {
                roomId: roomId,
                players: [opponent.id, socket.id],
                firstTurn: opponent.id 
            });
            console.log('Пара создана в комнате:', roomId);
        } else {
            // Если никого нет, ставим игрока в очередь
            waitingPlayer = socket;
            socket.emit('waiting', 'Поиск оппонента...');
            console.log('Игрок ждет в очереди:', socket.id);
        }
    });

    socket.on('action', (data) => {
        // Пробрасываем действия (выстрел, предмет) второму игроку
        socket.to(data.roomId).emit('opponentAction', data);
    });

    socket.on('disconnect', () => {
        if (waitingPlayer === socket) waitingPlayer = null;
    });
});
