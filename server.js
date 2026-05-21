const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const path = require('path');

app.use(express.static(path.join(__dirname, '/')));

// MEMORIA DEL SERVIDOR
const playersData = {};
const tournaments = {}; // Aquí guardaremos los torneos activos

// Generador de códigos de 4 dígitos
function generarCodigo() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

io.on('connection', (socket) => {
    
    // --- GESTIÓN DE PERFILES ---
    socket.on('updateProfile', (data) => {
        if(data.name) {
            socket.userData = data; // Guardamos datos en el socket
            playersData[data.name] = data;
            // Si está en un torneo, avisar actualización
            if(socket.tournamentId) {
                io.to('teacher_' + socket.tournamentId).emit('playerUpdate', data);
            }
        }
    });

    // --- LÓGICA DE TORNEOS (NUEVO) ---
    
    // 1. Profesor crea torneo
    socket.on('createTournament', () => {
        const code = generarCodigo();
        tournaments[code] = {
            teacherSocket: socket.id,
            players: [],
            status: 'waiting' // waiting, active, finished
        };
        
        socket.join('teacher_' + code); // Sala exclusiva del profe
        socket.emit('tournamentCreated', code);
        console.log(`Torneo creado: ${code}`);
    });

    // 2. Alumno se une
    socket.on('joinTournament', (code) => {
        const torneo = tournaments[code];
        if (torneo && torneo.status === 'waiting') {
            socket.join('tour_' + code); // Sala de jugadores
            socket.tournamentId = code;
            
            // Añadir a la lista
            const playerInfo = socket.userData || { name: "Anónimo", avatar: "❓" };
            torneo.players.push(playerInfo);
            
            // Avisar al alumno que entró
            socket.emit('joinedTournament', { code: code });
            
            // Avisar al profesor que llegó alguien
            io.to('teacher_' + code).emit('newPlayer', playerInfo);
        } else {
            socket.emit('tournamentError', 'Código inválido o torneo ya iniciado.');
        }
    });

    // 3. Profesor inicia el torneo (Emparejamiento Simple)
    socket.on('startTournament', (code) => {
        if(tournaments[code]) {
            tournaments[code].status = 'active';
            io.to('tour_' + code).emit('tournamentStarted');
            // Aquí iría la lógica de emparejamiento (Paso 3)
        }
    });

    // --- LÓGICA DE JUEGO NORMAL ---
    socket.on('join', (data) => {
        const room = data.room;
        socket.join(room);
        const clients = io.sockets.adapter.rooms.get(room);
        const num = clients ? clients.size : 0;

        if (num === 1) socket.emit('playerRole', 'w');
        else if (num === 2) socket.emit('playerRole', 'b');
        else socket.emit('playerRole', 'spectator');
    });

    socket.on('move', (data) => {
        socket.to(data.room).emit('move', data);
    });

    socket.on('chat', (data) => {
        io.to(data.room).emit('chat', data.msg);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Servidor JL Chess V5.2 corriendo en puerto ${PORT}`));