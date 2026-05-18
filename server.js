const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const path = require('path');
// Si el servidor falla aquí con "Cannot find module", es porque falta package.json actualizado
const axios = require('axios');

const multer = require('multer');
const webpush = require('web-push');

const upload = multer({ dest: 'uploads/' });

// VAPID Keys para Notificaciones Push
const publicVapidKey = 'BP0E6v9iIvVnTh9tZz3tGOUkTABUUq-G0Z0_lHTs5Mu-5b3sS3fUOzN7WBpUMws64FJj4hx12AeFpT4MxI3RW3E';
const privateVapidKey = 'Lw9mdXJ06bjHaUxj80Ywk5XTLfpcls5Snj9vF2Fi5Cg';
webpush.setVapidDetails('mailto:test@jlchess.com', publicVapidKey, privateVapidKey);

const onlineUsers = {}; // username -> socket.id


const { JsonDB, Config } = require('node-json-db');
const db = new JsonDB(new Config("database", true, true, '/'));

app.use(express.static(path.join(__dirname, '/')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- USER AUTH ENDPOINTS ---
app.post('/api/register', upload.single('avatarFile'), async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });
        
        try {
            await db.getData('/users/' + username);
            return res.status(400).json({ error: 'Usuario ya existe' });
        } catch(e) {
            // User doesn't exist, proceed
        }

        const userObj = {
            password,
            elo: 400,
            stars: 0,
            avatar: req.file ? '/uploads/' + req.file.filename : '👤',
            pushSubscription: null
        };
        await db.push('/users/' + username, userObj);
        res.json({ success: true, user: { name: username, elo: userObj.elo, avatar: userObj.avatar } });
    } catch (e) {
        res.status(500).json({ error: 'Error del servidor' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await db.getData('/users/' + username);
        if (user.password === password) {
            res.json({ success: true, user: { name: username, elo: user.elo, avatar: user.avatar } });
        } else {
            res.status(401).json({ error: 'Contraseña incorrecta' });
        }
    } catch(e) {
        res.status(404).json({ error: 'Usuario no encontrado' });
    }
});

app.post('/api/save-subscription', async (req, res) => {
    try {
        const { username, subscription } = req.body;
        await db.push('/users/' + username + '/pushSubscription', subscription);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'Error guardando subscripción' });
    }
});



app.get('/api/libros', (req, res) => {
    const fs = require('fs');
    const librosPath = path.join(__dirname, 'libros');
    if (fs.existsSync(librosPath)) {
        const files = fs.readdirSync(librosPath).filter(f => f.toLowerCase().endsWith('.pdf'));
        res.json(files);
    } else {
        res.json([]);
    }
});

let tournaments = {};
let publicRooms = {}; // Phase 5: Public Rooms Status

// La inicialización de la BD ahora es asíncrona en initServer() al final del archivo.

// --- CONFIGURACIÓN GUMROAD (OPCIONAL) ---
const GUMROAD_PRODUCT_PREMIUM = 'jlchesspremium';
const GUMROAD_PRODUCT_LIGHT = 'jlchesslight';

// --- BASE DE DATOS DE LICENCIAS (100 Claves Cargadas) ---
const localLicenses = {
    // CLAVES MAESTRAS
    'ADMIN': { type: 'premium', school: 'Administrador JL', expires: '2030-01-01' },
    'DEMO': { type: 'premium', school: 'Escuela Demo', expires: '2026-12-31' },

    // --- LOTE PREMIUM (50) ---
    'JL-PREM-LFT9-2026': { type: 'premium', school: 'Cliente PREM 1', expires: '2026-12-31' },
    'JL-PREM-RZEM-2026': { type: 'premium', school: 'Cliente PREM 2', expires: '2026-12-31' },
    'JL-PREM-V4F7-2026': { type: 'premium', school: 'Cliente PREM 3', expires: '2026-12-31' },
    'JL-PREM-1REV-2026': { type: 'premium', school: 'Cliente PREM 4', expires: '2026-12-31' },
    'JL-PREM-RBQN-2026': { type: 'premium', school: 'Cliente PREM 5', expires: '2026-12-31' },
    'JL-PREM-OOTY-2026': { type: 'premium', school: 'Cliente PREM 6', expires: '2026-12-31' },
    'JL-PREM-ZWVS-2026': { type: 'premium', school: 'Cliente PREM 7', expires: '2026-12-31' },
    'JL-PREM-QW70-2026': { type: 'premium', school: 'Cliente PREM 8', expires: '2026-12-31' },
    'JL-PREM-WBRP-2026': { type: 'premium', school: 'Cliente PREM 9', expires: '2026-12-31' },
    'JL-PREM-362C-2026': { type: 'premium', school: 'Cliente PREM 10', expires: '2026-12-31' },
    'JL-PREM-4P79-2026': { type: 'premium', school: 'Cliente PREM 11', expires: '2026-12-31' },
    'JL-PREM-HJZT-2026': { type: 'premium', school: 'Cliente PREM 12', expires: '2026-12-31' },
    'JL-PREM-0WYJ-2026': { type: 'premium', school: 'Cliente PREM 13', expires: '2026-12-31' },
    'JL-PREM-WZ21-2026': { type: 'premium', school: 'Cliente PREM 14', expires: '2026-12-31' },
    'JL-PREM-YFEJ-2026': { type: 'premium', school: 'Cliente PREM 15', expires: '2026-12-31' },
    'JL-PREM-APE5-2026': { type: 'premium', school: 'Cliente PREM 16', expires: '2026-12-31' },
    'JL-PREM-7QZZ-2026': { type: 'premium', school: 'Cliente PREM 17', expires: '2026-12-31' },
    'JL-PREM-6AYI-2026': { type: 'premium', school: 'Cliente PREM 18', expires: '2026-12-31' },
    'JL-PREM-4R3H-2026': { type: 'premium', school: 'Cliente PREM 19', expires: '2026-12-31' },
    'JL-PREM-SM5Q-2026': { type: 'premium', school: 'Cliente PREM 20', expires: '2026-12-31' },
    'JL-PREM-SQTV-2026': { type: 'premium', school: 'Cliente PREM 21', expires: '2026-12-31' },
    'JL-PREM-A8RO-2026': { type: 'premium', school: 'Cliente PREM 22', expires: '2026-12-31' },
    'JL-PREM-344E-2026': { type: 'premium', school: 'Cliente PREM 23', expires: '2026-12-31' },
    'JL-PREM-0ZE4-2026': { type: 'premium', school: 'Cliente PREM 24', expires: '2026-12-31' },
    'JL-PREM-KU3G-2026': { type: 'premium', school: 'Cliente PREM 25', expires: '2026-12-31' },
    'JL-PREM-7RF1-2026': { type: 'premium', school: 'Cliente PREM 26', expires: '2026-12-31' },
    'JL-PREM-QIPT-2026': { type: 'premium', school: 'Cliente PREM 27', expires: '2026-12-31' },
    'JL-PREM-XK6S-2026': { type: 'premium', school: 'Cliente PREM 28', expires: '2026-12-31' },
    'JL-PREM-WFNG-2026': { type: 'premium', school: 'Cliente PREM 29', expires: '2026-12-31' },
    'JL-PREM-487R-2026': { type: 'premium', school: 'Cliente PREM 30', expires: '2026-12-31' },
    'JL-PREM-1XTG-2026': { type: 'premium', school: 'Cliente PREM 31', expires: '2026-12-31' },
    'JL-PREM-GHI5-2026': { type: 'premium', school: 'Cliente PREM 32', expires: '2026-12-31' },
    'JL-PREM-ZZH9-2026': { type: 'premium', school: 'Cliente PREM 33', expires: '2026-12-31' },
    'JL-PREM-M9MK-2026': { type: 'premium', school: 'Cliente PREM 34', expires: '2026-12-31' },
    'JL-PREM-XUWA-2026': { type: 'premium', school: 'Cliente PREM 35', expires: '2026-12-31' },
    'JL-PREM-97GU-2026': { type: 'premium', school: 'Cliente PREM 36', expires: '2026-12-31' },
    'JL-PREM-9DR8-2026': { type: 'premium', school: 'Cliente PREM 37', expires: '2026-12-31' },
    'JL-PREM-ODG4-2026': { type: 'premium', school: 'Cliente PREM 38', expires: '2026-12-31' },
    'JL-PREM-TG4J-2026': { type: 'premium', school: 'Cliente PREM 39', expires: '2026-12-31' },
    'JL-PREM-QFQV-2026': { type: 'premium', school: 'Cliente PREM 40', expires: '2026-12-31' },
    'JL-PREM-9HXX-2026': { type: 'premium', school: 'Cliente PREM 41', expires: '2026-12-31' },
    'JL-PREM-VWDX-2026': { type: 'premium', school: 'Cliente PREM 42', expires: '2026-12-31' },
    'JL-PREM-A6LO-2026': { type: 'premium', school: 'Cliente PREM 43', expires: '2026-12-31' },
    'JL-PREM-XBMI-2026': { type: 'premium', school: 'Cliente PREM 44', expires: '2026-12-31' },
    'JL-PREM-65KV-2026': { type: 'premium', school: 'Cliente PREM 45', expires: '2026-12-31' },
    'JL-PREM-13BY-2026': { type: 'premium', school: 'Cliente PREM 46', expires: '2026-12-31' },
    'JL-PREM-GP9X-2026': { type: 'premium', school: 'Cliente PREM 47', expires: '2026-12-31' },
    'JL-PREM-CIMC-2026': { type: 'premium', school: 'Cliente PREM 48', expires: '2026-12-31' },
    'JL-PREM-A5N8-2026': { type: 'premium', school: 'Cliente PREM 49', expires: '2026-12-31' },
    'JL-PREM-SAVU-2026': { type: 'premium', school: 'Cliente PREM 50', expires: '2026-12-31' },

    // --- LOTE LIGHT (50) ---
    'JL-LIGH-MPGS-2026': { type: 'light', school: 'Cliente LIGH 1', expires: '2026-12-31' },
    'JL-LIGH-E4PB-2026': { type: 'light', school: 'Cliente LIGH 2', expires: '2026-12-31' },
    'JL-LIGH-ZX3L-2026': { type: 'light', school: 'Cliente LIGH 3', expires: '2026-12-31' },
    'JL-LIGH-E3QR-2026': { type: 'light', school: 'Cliente LIGH 4', expires: '2026-12-31' },
    'JL-LIGH-AH8D-2026': { type: 'light', school: 'Cliente LIGH 5', expires: '2026-12-31' },
    'JL-LIGH-OEWH-2026': { type: 'light', school: 'Cliente LIGH 6', expires: '2026-12-31' },
    'JL-LIGH-H2G6-2026': { type: 'light', school: 'Cliente LIGH 7', expires: '2026-12-31' },
    'JL-LIGH-TINL-2026': { type: 'light', school: 'Cliente LIGH 8', expires: '2026-12-31' },
    'JL-LIGH-DFSJ-2026': { type: 'light', school: 'Cliente LIGH 9', expires: '2026-12-31' },
    'JL-LIGH-G4SJ-2026': { type: 'light', school: 'Cliente LIGH 10', expires: '2026-12-31' },
    'JL-LIGH-I5VM-2026': { type: 'light', school: 'Cliente LIGH 11', expires: '2026-12-31' },
    'JL-LIGH-A0LP-2026': { type: 'light', school: 'Cliente LIGH 12', expires: '2026-12-31' },
    'JL-LIGH-7WBQ-2026': { type: 'light', school: 'Cliente LIGH 13', expires: '2026-12-31' },
    'JL-LIGH-4KRH-2026': { type: 'light', school: 'Cliente LIGH 14', expires: '2026-12-31' },
    'JL-LIGH-OGC1-2026': { type: 'light', school: 'Cliente LIGH 15', expires: '2026-12-31' },
    'JL-LIGH-ZNST-2026': { type: 'light', school: 'Cliente LIGH 16', expires: '2026-12-31' },
    'JL-LIGH-Y5G9-2026': { type: 'light', school: 'Cliente LIGH 17', expires: '2026-12-31' },
    'JL-LIGH-CHZK-2026': { type: 'light', school: 'Cliente LIGH 18', expires: '2026-12-31' },
    'JL-LIGH-R90F-2026': { type: 'light', school: 'Cliente LIGH 19', expires: '2026-12-31' },
    'JL-LIGH-2W2S-2026': { type: 'light', school: 'Cliente LIGH 20', expires: '2026-12-31' },
    'JL-LIGH-O14T-2026': { type: 'light', school: 'Cliente LIGH 21', expires: '2026-12-31' },
    'JL-LIGH-UKWA-2026': { type: 'light', school: 'Cliente LIGH 22', expires: '2026-12-31' },
    'JL-LIGH-FN8Q-2026': { type: 'light', school: 'Cliente LIGH 23', expires: '2026-12-31' },
    'JL-LIGH-E1IG-2026': { type: 'light', school: 'Cliente LIGH 24', expires: '2026-12-31' },
    'JL-LIGH-LOJ3-2026': { type: 'light', school: 'Cliente LIGH 25', expires: '2026-12-31' },
    'JL-LIGH-JI57-2026': { type: 'light', school: 'Cliente LIGH 26', expires: '2026-12-31' },
    'JL-LIGH-FBGV-2026': { type: 'light', school: 'Cliente LIGH 27', expires: '2026-12-31' },
    'JL-LIGH-YKZI-2026': { type: 'light', school: 'Cliente LIGH 28', expires: '2026-12-31' },
    'JL-LIGH-GULM-2026': { type: 'light', school: 'Cliente LIGH 29', expires: '2026-12-31' },
    'JL-LIGH-PK4N-2026': { type: 'light', school: 'Cliente LIGH 30', expires: '2026-12-31' },
    'JL-LIGH-8WBW-2026': { type: 'light', school: 'Cliente LIGH 31', expires: '2026-12-31' },
    'JL-LIGH-GVLD-2026': { type: 'light', school: 'Cliente LIGH 32', expires: '2026-12-31' },
    'JL-LIGH-3OLR-2026': { type: 'light', school: 'Cliente LIGH 33', expires: '2026-12-31' },
    'JL-LIGH-WFSS-2026': { type: 'light', school: 'Cliente LIGH 34', expires: '2026-12-31' },
    'JL-LIGH-ITGE-2026': { type: 'light', school: 'Cliente LIGH 35', expires: '2026-12-31' },
    'JL-LIGH-TSMU-2026': { type: 'light', school: 'Cliente LIGH 36', expires: '2026-12-31' },
    'JL-LIGH-3POZ-2026': { type: 'light', school: 'Cliente LIGH 37', expires: '2026-12-31' },
    'JL-LIGH-ARBL-2026': { type: 'light', school: 'Cliente LIGH 38', expires: '2026-12-31' },
    'JL-LIGH-AQ8X-2026': { type: 'light', school: 'Cliente LIGH 39', expires: '2026-12-31' },
    'JL-LIGH-JN9R-2026': { type: 'light', school: 'Cliente LIGH 40', expires: '2026-12-31' },
    'JL-LIGH-EABU-2026': { type: 'light', school: 'Cliente LIGH 41', expires: '2026-12-31' },
    'JL-LIGH-ORGN-2026': { type: 'light', school: 'Cliente LIGH 42', expires: '2026-12-31' },
    'JL-LIGH-L0OQ-2026': { type: 'light', school: 'Cliente LIGH 43', expires: '2026-12-31' },
    'JL-LIGH-6FRF-2026': { type: 'light', school: 'Cliente LIGH 44', expires: '2026-12-31' },
    'JL-LIGH-F6AL-2026': { type: 'light', school: 'Cliente LIGH 45', expires: '2026-12-31' },
    'JL-LIGH-Q2YY-2026': { type: 'light', school: 'Cliente LIGH 46', expires: '2026-12-31' },
    'JL-LIGH-HXWK-2026': { type: 'light', school: 'Cliente LIGH 47', expires: '2026-12-31' },
    'JL-LIGH-PUZ9-2026': { type: 'light', school: 'Cliente LIGH 48', expires: '2026-12-31' },
    'JL-LIGH-TZ7B-2026': { type: 'light', school: 'Cliente LIGH 49', expires: '2026-12-31' },
    'JL-LIGH-ARG8-2026': { type: 'light', school: 'Cliente LIGH 50', expires: '2026-12-31' }
};

function generarCodigo() { return Math.floor(1000 + Math.random() * 9000).toString(); }
function generarIdManual() { return 'man_' + Math.random().toString(36).substr(2, 9); }

function calcularNuevoElo(eloA, eloB, puntajeRealA) {
    const K = 32;
    const puntajeEsperadoA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
    return Math.round(eloA + K * (puntajeRealA - puntajeEsperadoA));
}

function actualizarRanking(tournament) {
    tournament.players.forEach(p => {
        let bh = 0;
        p.opponents.forEach(opId => {
            const opponent = tournament.players.find(x => x.id === opId);
            if (opponent) bh += opponent.score;
        });
        p.buchholz = bh;
    });
    tournament.players.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
        return b.elo - a.elo;
    });
}

function emitirRanking(code, players) {
    io.to('teacher_' + code).emit('updateStandings', players);
    io.to('lobby_' + code).emit('updateStandings', players);
}

io.on('connection', (socket) => {

    
    socket.on('updateProfile', (data) => { 
        socket.userData = data; 
        if (data.name) {
            onlineUsers[data.name] = socket.id;
            io.emit('onlineUsersUpdate', Object.keys(onlineUsers));
        }
    });

    socket.on('challengePlayer', async (targetUsername) => {
        if(!socket.userData || !socket.userData.name) return;
        const targetSocketId = onlineUsers[targetUsername];
        if (targetSocketId && targetSocketId !== socket.id) {
            io.to(targetSocketId).emit('incomingChallenge', { from: socket.userData.name });
        } else {
            try {
                const user = await db.getData('/users/' + targetUsername);
                if (user && user.pushSubscription) {
                    webpush.sendNotification(user.pushSubscription, JSON.stringify({
                        title: '¡Reto de Ajedrez!',
                        body: `${socket.userData.name} te ha retado a una partida.`
                    })).catch(err => console.error('Push error:', err));
                    socket.emit('challengeSentPush', targetUsername);
                } else {
                    socket.emit('challengeError', 'El usuario no está en línea y no tiene notificaciones activas.');
                }
            } catch(e) {
                socket.emit('challengeError', 'Usuario no encontrado.');
            }
        }
    });

    socket.on('acceptChallenge', (targetUsername) => {
        if(!socket.userData || !socket.userData.name) return;
        const targetSocketId = onlineUsers[targetUsername];
        if (targetSocketId) {
            const room = 'pvp_' + Math.random().toString(36).substr(2, 9);
            socket.join(room);
            const opponentSocket = io.sockets.sockets.get(targetSocketId);
            if(opponentSocket) opponentSocket.join(room);
            
            const colors = Math.random() > 0.5 ? ['w', 'b'] : ['b', 'w'];
            io.to(socket.id).emit('matchStarted', { opponent: targetUsername, color: colors[0], room: room });
            io.to(targetSocketId).emit('matchStarted', { opponent: socket.userData.name, color: colors[1], room: room });
        }
    });

    socket.on('declineChallenge', (targetUsername) => {
        if(!socket.userData || !socket.userData.name) return;
        const targetSocketId = onlineUsers[targetUsername];
        if (targetSocketId) {
            io.to(targetSocketId).emit('challengeDeclined', socket.userData.name);
        }
    });


    // --- VALIDACIÓN HÍBRIDA (LOCAL + GUMROAD) ---
    socket.on('validateLicense', async (key) => {
        const cleanKey = key.trim();

        const activeRooms = Object.values(tournaments).filter(t => t.active).length;

        // 1. Verificar claves locales (Maestras o Lotes)
        if (localLicenses[cleanKey.toUpperCase()]) {
            const license = localLicenses[cleanKey.toUpperCase()];
            socket.emit('licenseResult', { valid: true, type: license.type, school: license.school, activeRooms: activeRooms });
            return;
        }

        // 2. Verificar API Gumroad
        try {
            const response = await axios.post('https://api.gumroad.com/v2/licenses/verify', {
                product_permalink: GUMROAD_PRODUCT_PREMIUM,
                license_key: cleanKey
            });

            if (response.data.success && !response.data.purchase.refunded) {
                socket.emit('licenseResult', { valid: true, type: 'premium', school: 'Cliente Premium', activeRooms: activeRooms });
                return;
            }
        } catch (error) {
            try {
                const responseLight = await axios.post('https://api.gumroad.com/v2/licenses/verify', {
                    product_permalink: GUMROAD_PRODUCT_LIGHT,
                    license_key: cleanKey
                });

                if (responseLight.data.success && !responseLight.data.purchase.refunded) {
                    socket.emit('licenseResult', { valid: true, type: 'light', school: 'Cliente Light' });
                    return;
                }
            } catch (err2) {
                socket.emit('licenseResult', { valid: false, msg: 'Licencia no válida o expirada.' });
            }
        }
    });

    socket.on('createTournament', (mode) => {
        // --- FASE 3: LIMITE DE SALAS (20) ---
        const activeCount = Object.values(tournaments).filter(t => t.active).length;
        if (activeCount >= 20) {
            socket.emit('tournamentError', '⚠️ Servidor Lleno (20/20). Intenta más tarde.');
            return;
        }

        const code = generarCodigo();
        tournaments[code] = {
            teacher: socket.id,
            mode: mode || 'virtual',
            players: [],
            matches: [],
            round: 0,
            active: true,
            school: socket.userData ? socket.userData.school : 'Escuela'
        };
        socket.join('teacher_' + code);
        socket.join('lobby_' + code); // Teacher joins global chat

        socket.emit('tournamentCreated', { code: code, mode: mode });
        saveData();
    });

    socket.on('addManualPlayer', (data) => {
        const t = tournaments[data.code];
        if (t) {
            const newPlayer = {
                id: generarIdManual(),
                name: data.name,
                avatar: "👤",
                elo: 400,
                score: 0, buchholz: 0, opponents: [], history: {}
            };
            t.players.push(newPlayer);
            io.to('teacher_' + data.code).emit('updatePlayerList', t.players);
            io.to('lobby_' + data.code).emit('updatePlayerList', t.players); // Broadcast to all
            emitirRanking(data.code, t.players);
            saveData();
        }
    });

    socket.on('finishTournament', (code) => {
        const t = tournaments[code];
        if (t) {
            t.active = false;
            actualizarRanking(t);
            io.to('teacher_' + code).emit('tournamentEndedData', { players: t.players, totalRounds: t.round });
            io.to('teacher_' + code).emit('showFinalResults', t.players);
            if (t.mode === 'virtual') io.to('lobby_' + code).emit('showFinalResults', t.players);
            saveData();
        }
    });

    socket.on('recoverTournament', (code) => {
        const t = tournaments[code];
        if (t && t.active) {
            t.teacher = socket.id;
            socket.join('teacher_' + code);
            socket.join('lobby_' + code); // Re-join global chat
            socket.emit('tournamentRecovered', {
                code: code,
                mode: t.mode,
                players: t.players,
                matches: t.matches,
                round: t.round
            });
            emitirRanking(code, t.players);
        } else {
            socket.emit('tournamentError', 'No se pudo recuperar.');
        }
    });

    socket.on('joinTournament', (code) => {
        const t = tournaments[code];
        if (t && t.active) {
            if (t.mode === 'presencial') {
                socket.emit('tournamentError', 'Torneo PRESENCIAL. El profesor te registrará.');
                return;
            }
            socket.join('lobby_' + code);
            socket.tournamentId = code;

            const playerInfo = {
                id: socket.id,
                name: socket.userData ? socket.userData.name : "Anónimo",
                avatar: socket.userData ? socket.userData.avatar : "👤",
                elo: (socket.userData && socket.userData.elo) ? socket.userData.elo : 400,
                score: 0, buchholz: 0, opponents: [], history: {}
            };

            const existing = t.players.find(p => p.name === playerInfo.name);
            if (existing) { existing.id = socket.id; existing.avatar = playerInfo.avatar; existing.elo = playerInfo.elo; }
            else { t.players.push(playerInfo); }

            socket.emit('joinedTournament', { code: code });
            io.to('teacher_' + code).emit('updatePlayerList', t.players);
            io.to('lobby_' + code).emit('updatePlayerList', t.players); // Broadcast to all
            emitirRanking(code, t.players);
            saveData();
        } else {
            socket.emit('tournamentError', 'Código no válido.');
        }
    });

    socket.on('startRound', (code) => {
        const t = tournaments[code];
        if (!t || t.players.length < 2) return;

        t.round++;
        t.matches = [];
        actualizarRanking(t);

        let available = [...t.players];
        let matchIndex = 1;

        while (available.length >= 2) {
            const p1 = available.shift();
            let p2Index = 0;
            for (let i = 0; i < available.length; i++) {
                if (!p1.opponents.includes(available[i].id)) { p2Index = i; break; }
            }
            const p2 = available.splice(p2Index, 1)[0];
            p1.opponents.push(p2.id); p2.opponents.push(p1.id);

            const matchRoom = `tour_${code}_R${t.round}_M${matchIndex}`;
            matchIndex++;

            if (t.mode === 'virtual') {
                const s1 = io.sockets.sockets.get(p1.id);
                const s2 = io.sockets.sockets.get(p2.id);
                if (s1) s1.join(matchRoom); if (s2) s2.join(matchRoom);
            }

            t.matches.push({
                room: matchRoom,
                white: p1.name, black: p2.name,
                whiteId: p1.id, blackId: p2.id,
                round: t.round,
                status: 'playing', result: null, scoreWhite: null, scoreBlack: null
            });

            if (t.mode === 'virtual') {
                if (t.round % 2 === 0) {
                    io.to(p1.id).emit('matchStarted', { opponent: p2.name, color: 'b', room: matchRoom });
                    io.to(p2.id).emit('matchStarted', { opponent: p1.name, color: 'w', room: matchRoom });
                } else {
                    io.to(p1.id).emit('matchStarted', { opponent: p2.name, color: 'w', room: matchRoom });
                    io.to(p2.id).emit('matchStarted', { opponent: p1.name, color: 'b', room: matchRoom });
                }
            }
        }

        if (available.length === 1) {
            const byePlayer = available[0];
            byePlayer.score += 1;
            byePlayer.history[`R${t.round}`] = "1 (Bye)";

            t.matches.push({
                room: `bye_${t.round}_${byePlayer.id}`,
                white: byePlayer.name,
                black: "LIBRE (Bye)",
                whiteId: byePlayer.id,
                blackId: null,
                round: t.round,
                status: 'bye',
                result: '1 Pts (Bye)'
            });

            if (t.mode === 'virtual') {
                const socketBye = io.sockets.sockets.get(byePlayer.id);
                if (socketBye) socketBye.emit('tournamentBye', "Número impar. Descansas y ganas 1 punto.");
            }
        }

        io.to('teacher_' + code).emit('updateMatches', t.matches);
        actualizarRanking(t);
        emitirRanking(code, t.players);
        saveData();
    });

    socket.on('reportResult', (data) => {
        let tournamentCode = socket.tournamentId;
        if (!tournamentCode && data.code) tournamentCode = data.code;

        if (tournamentCode && tournaments[tournamentCode]) {
            const t = tournaments[tournamentCode];
            const match = t.matches.find(m => m.room === data.room);

            if (match) {
                if (match.status === 'finished') {
                    if (t.mode === 'virtual') return;

                    const oldWhite = t.players.find(p => p.id === match.whiteId);
                    const oldBlack = t.players.find(p => p.id === match.blackId);

                    if (typeof match.scoreWhite === 'number' && typeof match.scoreBlack === 'number') {
                        if (oldWhite) oldWhite.score -= match.scoreWhite;
                        if (oldBlack) oldBlack.score -= match.scoreBlack;
                    }
                }

                match.status = 'finished';
                let scoreW = 0, scoreB = 0;
                let txtW = "0", txtB = "0";

                if (data.winner === 'w') {
                    match.result = 'Gana ' + match.white;
                    scoreW = 1; scoreB = 0; txtW = "1"; txtB = "0";
                }
                else if (data.winner === 'b') {
                    match.result = 'Gana ' + match.black;
                    scoreW = 0; scoreB = 1; txtW = "0"; txtB = "1";
                }
                else {
                    match.result = 'Tablas';
                    scoreW = 0.5; scoreB = 0.5; txtW = "½"; txtB = "½";
                }

                match.scoreWhite = scoreW;
                match.scoreBlack = scoreB;

                const pWhite = t.players.find(p => p.id === match.whiteId);
                const pBlack = t.players.find(p => p.id === match.blackId);

                if (pWhite) { pWhite.score += scoreW; pWhite.history[`R${match.round}`] = txtW; }
                if (pBlack) { pBlack.score += scoreB; pBlack.history[`R${match.round}`] = txtB; }

                const eloW = (pWhite) ? pWhite.elo : 400;
                const eloB = (pBlack) ? pBlack.elo : 400;
                const nuevoEloW = calcularNuevoElo(eloW, eloB, scoreW);
                const nuevoEloB = calcularNuevoElo(eloB, eloW, 1 - scoreW);

                if (pWhite) pWhite.elo = nuevoEloW;
                if (pBlack) pBlack.elo = nuevoEloB;

                if (t.mode === 'virtual') {
                    if (pWhite && !match.whiteId.startsWith('man_')) io.to(match.whiteId).emit('updateClientElo', nuevoEloW);
                    if (pBlack && !match.blackId.startsWith('man_')) io.to(match.blackId).emit('updateClientElo', nuevoEloB);
                }

                actualizarRanking(t);
                io.to('teacher_' + tournamentCode).emit('updateMatches', t.matches);
                emitirRanking(tournamentCode, t.players);
                saveData();
            }
        }
    });

    socket.on('move', (data) => {
        socket.to(data.room).emit('move', data);

        // Update Tournament History
        const parts = data.room.split('_');
        if (parts[0] === 'tour' && parts[1] && tournaments[parts[1]]) {
            const match = tournaments[parts[1]].matches.find(m => m.room === data.room);
            if (match) match.lastFen = data.fen;
        }
        // Update Public Room History
        else {
            if (!publicRooms[data.room]) publicRooms[data.room] = { fen: 'start', players: 0, playersList: [] };
            publicRooms[data.room].fen = data.fen;
        }
    });

    socket.on('resign', (room) => { socket.to(room).emit('opponentResigned'); });
    socket.on('offerDraw', (room) => { socket.to(room).emit('drawOffered'); });
    socket.on('acceptDraw', (room) => { io.to(room).emit('drawAccepted'); });
    socket.on('spectateMatch', (room) => { socket.join(room); socket.emit('spectateStart', room); });

    socket.on('requestBoardState', (room) => {
        // Check Tournaments
        for (const code in tournaments) {
            const match = tournaments[code].matches.find(m => m.room === room);
            if (match && match.lastFen) {
                socket.emit('boardState', match.lastFen);
                return;
            }
        }
        // Check Public Rooms
        if (publicRooms[room] && publicRooms[room].fen) {
            socket.emit('boardState', publicRooms[room].fen);
        }
    });

    socket.on('chat', (data) => { if (data.room && data.msg) io.to(data.room).emit('chat', data.msg); });

    socket.on('join', async (data) => {
        await socket.join(data.room);
        const clients = io.sockets.adapter.rooms.get(data.room);
        const num = clients ? clients.size : 0;

        // Public Room State Tracking
        if (!data.room.startsWith('tour_')) {
            // Ensure room exists in memory
            if (!publicRooms[data.room]) publicRooms[data.room] = { fen: 'start', players: 0, playersList: [] };
            if (!publicRooms[data.room].playersList) publicRooms[data.room].playersList = []; // Safety check

            // Auto Update Players Count
            publicRooms[data.room].players = num;

            // Add Player to List
            const pInfo = {
                id: socket.id,
                name: socket.userData ? socket.userData.name : "Anónimo",
                avatar: socket.userData ? socket.userData.avatar : "👤"
            };
            // Avoid duplicates
            if (!publicRooms[data.room].playersList.some(p => p.id === socket.id)) {
                publicRooms[data.room].playersList.push(pInfo);
            }
            io.to(data.room).emit('updatePlayerList', publicRooms[data.room].playersList);
        }

        if (num === 1) socket.emit('playerRole', 'w');
        else if (num === 2) socket.emit('playerRole', 'b');
        else socket.emit('playerRole', 'spectator');
    });

    
    socket.on('disconnect', () => {
        if(socket.userData && socket.userData.name) {
            delete onlineUsers[socket.userData.name];
            io.emit('onlineUsersUpdate', Object.keys(onlineUsers));
        }

        // Remove from Public Rooms
        for (const room in publicRooms) {
            const index = publicRooms[room].playersList.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                publicRooms[room].playersList.splice(index, 1);
                publicRooms[room].players = publicRooms[room].playersList.length; // Sync count
                io.to(room).emit('updatePlayerList', publicRooms[room].playersList);
            }
        }
    });

    socket.on('getPublicRoomsStatus', (schoolId) => {
        // Return status for "Mesa 1" to "Mesa 20"
        let status = {};
        let prefix = (schoolId && schoolId.trim() !== '') ? `${schoolId}_` : "";

        for (let i = 1; i <= 20; i++) {
            let roomName = "Mesa " + i;
            let realRoomName = prefix + roomName;

            let count = 0;
            const clients = io.sockets.adapter.rooms.get(realRoomName);
            if (clients) count = clients.size;
            status[roomName] = count; // Return with simple key for UI
        }
        socket.emit('publicRoomsStatus', status);
    });
});

const PORT = process.env.PORT || 3000;

async function initServer() {
    // Cargar Torneos al iniciar
    try {
        tournaments = await db.getData("/tournaments");
        console.log("📦 Torneos cargados de la base de datos.");
    } catch (error) {
        console.log("🆕 Base de datos nueva o vacía. Inicializando...");
        await db.push("/tournaments", {});
        await db.push("/users", {});
    }

    http.listen(PORT, () => console.log(`Servidor JL Chess V15.1 Listo`));
}

async function saveData() {
    try {
        await db.push("/tournaments", tournaments);
    } catch (error) {
        console.error("Error guardando datos:", error);
    }
}

initServer();