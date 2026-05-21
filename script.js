var socket = io({ transports: ['websocket', 'polling'] });

var game = new Chess();
var board = null;
var playerColor = 'w'; 
var isSpectator = false;
var currentRoom = "";
var timerInterval = null;
var timeWhite = 600; 
var timeBlack = 600;

var currentMode = 'none'; 
var selectedSquare = null;

var userProfile = { name: "", avatar: "♟️", stars: 0, elo: 400, skin: 'classic' }; 
const avatars = ["🦁", "🐯", "🤖", "👽", "🦄", "🐲", "🦸‍♂️", "🥷", "🐼", "🦊", "👑", "🚀"];
var selectedAvatarTemp = avatars[0];

$(document).ready(function() {
    loadProfile();
    const selector = document.getElementById('avatar-selector');
    avatars.forEach(av => {
        let div = document.createElement('div');
        div.className = 'avatar-option'; div.innerText = av;
        div.onclick = function() { $('.avatar-option').removeClass('selected'); div.classList.add('selected'); selectedAvatarTemp = av; };
        selector.appendChild(div);
    });

    // SISTEMA DE TOQUE PARA TODOS LOS DISPOSITIVOS
    $(document).on('click touchstart', '.square-55d63', function(e) {
        // Permitimos que el evento fluya normalmente para que detecte el DIV
        if (e.type === 'touchstart') {
            // No hacemos stopPropagation para que no mate el click si el navegador lo emula, 
            // pero controlamos la lógica en el handler
        }
        
        var square = $(this).attr('data-square');
        if(!square) return;

        if (currentMode === 'online') handleOnlineClick(square);
        else if (currentMode === 'puzzle') handlePuzzleClick(square);
        else if (currentMode === 'teacher') handleTeacherClick(square);
    });
});

function getPieceImg(piece) {
    if (userProfile.skin === 'artist') {
        return 'piezas/' + piece + '.png';
    }
    return 'https://chessboardjs.com/img/chesspieces/wikipedia/' + piece + '.png';
}

function loadProfile() {
    const saved = localStorage.getItem('jlChessProfile');
    if (saved) {
        try {
            var temp = JSON.parse(saved);
            userProfile = { ...userProfile, ...temp };
            mostrarMenuPrincipal();
            syncProfileWithServer();
        } catch(e) { document.getElementById('setup-view').style.display = 'block'; }
    } else {
        document.getElementById('setup-view').style.display = 'block';
        document.getElementById('login-view').style.display = 'none';
    }
}
function crearPerfil() {
    const name = document.getElementById('newPlayerName').value.trim();
    if (!name) { Swal.fire('Falta nombre', 'Escribe tu nombre', 'warning'); return; }
    userProfile.name = name; userProfile.avatar = selectedAvatarTemp;
    saveProfile(); mostrarMenuPrincipal(); syncProfileWithServer();
}
function saveProfile() { localStorage.setItem('jlChessProfile', JSON.stringify(userProfile)); updateCardUI(); syncProfileWithServer(); }
function syncProfileWithServer() { if(userProfile.name) { socket.emit('updateProfile', userProfile); } }

window.borrarPerfil = function() {
    if(confirm("¿Borrar perfil y empezar de cero?")) {
        localStorage.removeItem('jlChessProfile');
        location.reload();
    }
};

function mostrarMenuPrincipal() { document.getElementById('setup-view').style.display = 'none'; document.getElementById('login-view').style.display = 'block'; updateCardUI(); }
function updateCardUI() {
    document.getElementById('card-name').innerText = userProfile.name;
    document.getElementById('card-avatar').innerText = userProfile.avatar;
    document.getElementById('card-stars').innerText = userProfile.stars;
    document.getElementById('card-elo').innerText = userProfile.elo;
    var btn = document.getElementById('btn-skin');
    if (userProfile.stars >= 10) {
        btn.classList.add('skin-unlocked');
        btn.innerHTML = (userProfile.skin === 'artist') ? "🎨 Usando: <b>Piezas Maestras</b> (Clic para quitar)" : "🔓 ¡Desbloqueado! Clic para usar <b>Piezas Maestras</b>";
    } else {
        btn.classList.remove('skin-unlocked');
        btn.innerHTML = `🔒 Consigue 10 ⭐ para desbloquear piezas (${userProfile.stars}/10)`;
    }
}
function toggleSkin() {
    if (userProfile.stars < 10) { Swal.fire('Bloqueado', 'Necesitas 10 estrellas.', 'info'); return; }
    userProfile.skin = (userProfile.skin === 'classic') ? 'artist' : 'classic';
    saveProfile();
    Swal.fire('¡Cambio Exitoso!', 'Configuración actualizada.', 'success');
    setTimeout(() => location.reload(), 1000); 
}

// --- VISUALES ---
function removeHighlights() { $('.square-55d63').removeClass('highlight-selected highlight-move highlight-hint highlight-capture'); }
function highlightSelected(square) { $('.square-' + square).addClass('highlight-selected'); }
function highlightLastMove(move) {
    $('.square-55d63').removeClass('highlight-move');
    if (move) { $('.square-' + move.from).addClass('highlight-move'); $('.square-' + move.to).addClass('highlight-move'); }
}
function showPossibleMoves(square) {
    var moves = game.moves({ square: square, verbose: true });
    if (moves.length === 0) return;
    for (var i = 0; i < moves.length; i++) {
        var move = moves[i];
        if (move.flags.includes('c')) {
            $('.square-' + move.to).addClass('highlight-capture');
        } else {
            $('.square-' + move.to).addClass('highlight-hint');
        }
    }
}

// --- ONLINE ---
function unirsePartida() {
    var room = document.getElementById('roomSelect').value;
    currentRoom = room; ocultarVistas(); document.getElementById('game-view').style.display = 'block';
    currentMode = 'online'; selectedSquare = null;
    game = new Chess();
    setTimeout(() => { 
        if(board) board.destroy();
        socket.emit('join', { room: room, name: userProfile.name, avatar: userProfile.avatar, stars: userProfile.stars, elo: userProfile.elo, reset: true });
    }, 200);
}
socket.on('playerRole', function(role) {
    if (role === 'spectator') { isSpectator = true; playerColor = 'w'; document.getElementById('status-display').innerText = "Espectador (Mesa Llena)"; } 
    else { isSpectator = false; playerColor = role; document.getElementById('status-display').innerText = "Eres: " + (role === 'w' ? "BLANCAS ⚪" : "NEGRAS ⚫"); }
    initBoard();
});
function initBoard() {
    var config = { draggable: false, position: 'start', orientation: (playerColor === 'b') ? 'black' : 'white', pieceTheme: getPieceImg };
    board = Chessboard('board', config); 
    socket.emit('requestBoardState', currentRoom); 
    setTimeout(board.resize, 200);
}
function handleOnlineClick(square) {
    if (game.game_over() || isSpectator) return;
    if ((game.turn() === 'w' && playerColor === 'b') || (game.turn() === 'b' && playerColor === 'w')) return;

    if (!selectedSquare) {
        var piece = game.get(square);
        if (piece && piece.color === game.turn()) { 
            selectedSquare = square; 
            removeHighlights(); 
            highlightSelected(square);
            showPossibleMoves(square);
        }
        return;
    }
    var move = game.move({ from: selectedSquare, to: square, promotion: 'q' });
    if (move === null) {
        var piece = game.get(square);
        if (piece && piece.color === game.turn()) { 
            selectedSquare = square; 
            removeHighlights(); 
            highlightSelected(square);
            showPossibleMoves(square);
        } else { selectedSquare = null; removeHighlights(); }
    } else {
        board.position(game.fen()); removeHighlights(); highlightLastMove(move);
        if (move.captured) playSound('capture'); else playSound('move');
        socket.emit('move', { room: currentRoom, move: move, fen: game.fen(), timeW: timeWhite, timeB: timeBlack });
        updateStatus(); selectedSquare = null;
    }
}
socket.on('move', function(data) {
    var move = game.move(data.move); board.position(game.fen());
    if (move && move.captured) playSound('capture'); else playSound('move');
    if(data.timeW) { timeWhite = data.timeW; timeBlack = data.timeB; } updateStatus();
});
socket.on('boardState', function(fen) { if (fen) { game.load(fen); board.position(fen); updateStatus(); } });

// --- PUZZLES ---
var currentPuzzleIndex = 0;
const puzzles = [
    { name: "Reto 1: Mate del Loco", fen: "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2", from: 'd8', to: 'h4', msg: "Negras ganan en 1." },
    { name: "Reto 2: Mate del Pastor", fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 2 4", from: 'f3', to: 'f7', msg: "Blancas ganan en 1." },
    { name: "Reto 3: Pasillo Mortal", fen: "6k1/3R4/6K1/8/8/8/8/8 w - - 0 1", from: 'd7', to: 'd8', msg: "El rey negro no tiene escape." },
    { name: "Reto 4: Defensa Vital", fen: "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3", from: 'd1', to: 'e2', msg: "¡Jaquemate en contra! Sálvate." }, 
    { name: "Reto 5: Ataque Doble", fen: "rnbqkbnr/ppp2ppp/8/3pp3/3P4/5P2/PPP1P1PP/RNBQKBNR w KQkq - 0 3", from: 'f3', to: 'e5', msg: "Gana un peón central." },
    { name: "Reto 6: Mate de Torre", fen: "8/8/8/8/8/4k3/2R5/r2K4 b - - 0 1", from: 'a1', to: 'c1', msg: "Negras dan mate." },
    { name: "Reto 7: Salvar la Torre", fen: "7k/8/8/8/1r6/8/3R4/K7 w - - 0 1", from: 'd2', to: 'b2', msg: "Evita el mate interponiendo." },
    { name: "Reto 8: Sacrificio", fen: "r1b2rk1/pp1p1pp1/1b1p2B1/n1q5/8/1Q6/P4PPP/4RRK1 w - - 0 1", from: 'b3', to: 'f7', msg: "Sacrifica para ganar." }, 
    { name: "Reto 9: Mate Ahogado", fen: "6rk/5Npp/8/8/8/8/8/7K w - - 0 1", from: 'f7', to: 'h6', msg: "Jaque doble de caballo." },
    { name: "Reto 10: Coronación", fen: "8/P7/8/8/8/8/k7/7K w - - 0 1", from: 'a7', to: 'a8', msg: "Corona y gana." }
];

function iniciarRetos() {
    isPuzzleMode = true; currentMode = 'puzzle'; selectedSquare = null;
    ocultarVistas(); document.getElementById('puzzle-view').style.display = 'block'; 
    if(board) board.destroy();
    
    var nivel = userProfile.stars; if(nivel >= puzzles.length) nivel = 0;
    setTimeout(() => { 
        cargarReto(nivel); 
        window.dispatchEvent(new Event('resize')); 
    }, 300);
}

function cargarReto(index) {
    currentPuzzleIndex = index; var puzzle = puzzles[index]; game.load(puzzle.fen);
    document.getElementById('puzzle-title').innerText = puzzle.name; document.getElementById('puzzle-desc').innerText = puzzle.msg;
    var config = { draggable: false, position: puzzle.fen, orientation: (game.turn() === 'w') ? 'white' : 'black', pieceTheme: getPieceImg };
    board = Chessboard('board-puzzle', config); selectedSquare = null; removeHighlights();
}
function handlePuzzleClick(square) {
    if (!selectedSquare) {
        var piece = game.get(square);
        if (piece && piece.color === game.turn()) { 
            selectedSquare = square; 
            removeHighlights(); 
            highlightSelected(square);
            showPossibleMoves(square);
        }
        return;
    }
    var puzzle = puzzles[currentPuzzleIndex];
    if (selectedSquare === puzzle.from && square === puzzle.to) {
        playSound('win'); game.move({ from: selectedSquare, to: square, promotion: 'q' }); board.position(game.fen()); removeHighlights(); selectedSquare = null;
        if (userProfile.stars <= currentPuzzleIndex) {
            userProfile.stars++; userProfile.elo += 15; saveProfile();
            Swal.fire({ title: '¡Correcto!', icon: 'success', timer: 1500, showConfirmButton: false }).then(nextPuzzle);
        } else { Swal.fire({ title: '¡Bien!', icon: 'success', timer: 1000, showConfirmButton: false }).then(nextPuzzle); }
    } else {
        var piece = game.get(square);
        if (piece && piece.color === game.turn()) { 
            selectedSquare = square; 
            removeHighlights(); 
            highlightSelected(square);
            showPossibleMoves(square);
        } else { playSound('error'); removeHighlights(); selectedSquare = null; }
    }
}
function nextPuzzle() { if (currentPuzzleIndex < puzzles.length - 1) cargarReto(currentPuzzleIndex + 1); else Swal.fire('¡Maestro!', 'Completaste todos los retos.', 'success').then(volverMenu); }

// --- PROFE ---
function iniciarPizarra() {
    ocultarVistas(); currentMode = 'teacher'; selectedSquare = null;
    document.getElementById('teacher-view').style.display = 'block';
    if(board) board.destroy();
    var config = { draggable: false, position: 'start', pieceTheme: getPieceImg };
    setTimeout(() => { board = Chessboard('board-teacher', config); window.dispatchEvent(new Event('resize')); }, 200);
}
function handleTeacherClick(square) {
    if (!selectedSquare) {
        var pos = board.position();
        if (pos.hasOwnProperty(square)) { selectedSquare = square; removeHighlights(); highlightSelected(square); }
        return;
    }
    if (selectedSquare === square) { selectedSquare = null; removeHighlights(); } 
    else {
        var pos = board.position(); var piece = pos[selectedSquare]; delete pos[selectedSquare]; pos[square] = piece;
        board.position(pos, false); playSound('move'); selectedSquare = null; removeHighlights();
    }
}
function limpiarPizarra() { board.clear(); selectedSquare = null; removeHighlights(); }
function inicioPizarra() { board.start(); selectedSquare = null; removeHighlights(); }

function ocultarVistas() {
    document.getElementById('setup-view').style.display = 'none'; document.getElementById('login-view').style.display = 'none';
    document.getElementById('game-view').style.display = 'none'; document.getElementById('ranking-view').style.display = 'none';
    document.getElementById('puzzle-view').style.display = 'none'; document.getElementById('teacher-view').style.display = 'none';
    currentMode = 'none';
}
function volverMenu() {
    ocultarVistas();
    if(userProfile.name) { document.getElementById('login-view').style.display = 'block'; updateCardUI(); } else { document.getElementById('setup-view').style.display = 'block'; }
    if(board) board.destroy();
    if(currentRoom) { socket.emit('leave', currentRoom); currentRoom = ""; }
}
function enviarMensaje() { var input = document.getElementById('chat-input'); if(input.value) { var fullMsg = `${userProfile.avatar} <b>${userProfile.name}:</b> ${input.value}`; socket.emit('chat', { room: currentRoom, msg: fullMsg }); input.value = ''; } }
socket.on('chat', function(data) { var msgTexto = (typeof data === 'object') ? data.msg : data; var box = document.getElementById('chat-box'); box.innerHTML += `<p>${msgTexto}</p>`; box.scrollTop = box.scrollHeight; });
function updateStatus() {
    var turn = game.turn();
    document.getElementById('clock-w').className = turn === 'w' ? 'clock-box active-turn' : 'clock-box';
    document.getElementById('clock-b').className = turn === 'b' ? 'clock-box active-turn' : 'clock-box';
    if (!timerInterval && !game.game_over()) timerInterval = setInterval(gameTimer, 1000);
    if (game.game_over()) { clearInterval(timerInterval); playSound('win'); Swal.fire('Fin del Juego', 'Partida terminada', 'info'); }
}
function gameTimer() { if (game.turn() === 'w') { timeWhite--; document.getElementById('time-w').innerText = fmt(timeWhite); } else { timeBlack--; document.getElementById('time-b').innerText = fmt(timeBlack); } if (timeWhite <= 0 || timeBlack <= 0) clearInterval(timerInterval); }
function fmt(s) { var m = Math.floor(s / 60); var sc = s % 60; return m + ':' + (sc < 10 ? '0' : '') + sc; }
function playSound(type) { var id = 'snd-move'; if (type === 'capture') id = 'snd-capture'; if (type === 'win') id = 'snd-win'; if (type === 'error') id = 'snd-error'; var audio = document.getElementById(id); if(audio) { audio.currentTime = 0; audio.play().catch(e => {}); } }
function verCuadroHonor() { ocultarVistas(); document.getElementById('ranking-view').style.display = 'block'; socket.emit('requestRanking'); }
function verSeleccionMesas() { var area = document.getElementById('mesas-area'); area.style.display = area.style.display === 'none' ? 'block' : 'none'; }
socket.on('rankingUpdate', function(playersList) { playersList.sort((a, b) => b.stars - a.stars); const grid = document.getElementById('ranking-grid'); grid.innerHTML = ""; if(playersList.length === 0) { grid.innerHTML = "<p>Nadie conectado aún.</p>"; return; } playersList.forEach(p => { grid.innerHTML += `<div class=\"honor-card\"><div class=\"honor-avatar\">${p.avatar}</div><span class=\"honor-name\">${p.name}</span><span class=\"honor-stars\">⭐ ${p.stars} | ELO ${p.elo}</span></div>`; }); });var socket = io({ transports: ['websocket', 'polling'] });

var game = new Chess();
var board = null;
var playerColor = 'w'; 
var isSpectator = false;
var currentRoom = "";
var timerInterval = null;
var timeWhite = 600; 
var timeBlack = 600;

var currentMode = 'none'; 
var selectedSquare = null;

var userProfile = { name: "", avatar: "♟️", stars: 0, elo: 400, skin: 'classic' }; 
const avatars = ["🦁", "🐯", "🤖", "👽", "🦄", "🐲", "🦸‍♂️", "🥷", "🐼", "🦊", "👑", "🚀"];
var selectedAvatarTemp = avatars[0];

$(document).ready(function() {
    loadProfile();
    const selector = document.getElementById('avatar-selector');
    avatars.forEach(av => {
        let div = document.createElement('div');
        div.className = 'avatar-option'; div.innerText = av;
        div.onclick = function() { $('.avatar-option').removeClass('selected'); div.classList.add('selected'); selectedAvatarTemp = av; };
        selector.appendChild(div);
    });

    // SISTEMA DE TOQUE PARA TODOS LOS DISPOSITIVOS
    $(document).on('click touchstart', '.square-55d63', function(e) {
        // Permitimos que el evento fluya normalmente para que detecte el DIV
        if (e.type === 'touchstart') {
            // No hacemos stopPropagation para que no mate el click si el navegador lo emula, 
            // pero controlamos la lógica en el handler
        }
        
        var square = $(this).attr('data-square');
        if(!square) return;

        if (currentMode === 'online') handleOnlineClick(square);
        else if (currentMode === 'puzzle') handlePuzzleClick(square);
        else if (currentMode === 'teacher') handleTeacherClick(square);
    });
});

function getPieceImg(piece) {
    if (userProfile.skin === 'artist') {
        return 'piezas/' + piece + '.png';
    }
    return 'https://chessboardjs.com/img/chesspieces/wikipedia/' + piece + '.png';
}

function loadProfile() {
    const saved = localStorage.getItem('jlChessProfile');
    if (saved) {
        try {
            var temp = JSON.parse(saved);
            userProfile = { ...userProfile, ...temp };
            mostrarMenuPrincipal();
            syncProfileWithServer();
        } catch(e) { document.getElementById('setup-view').style.display = 'block'; }
    } else {
        document.getElementById('setup-view').style.display = 'block';
        document.getElementById('login-view').style.display = 'none';
    }
}
function crearPerfil() {
    const name = document.getElementById('newPlayerName').value.trim();
    if (!name) { Swal.fire('Falta nombre', 'Escribe tu nombre', 'warning'); return; }
    userProfile.name = name; userProfile.avatar = selectedAvatarTemp;
    saveProfile(); mostrarMenuPrincipal(); syncProfileWithServer();
}
function saveProfile() { localStorage.setItem('jlChessProfile', JSON.stringify(userProfile)); updateCardUI(); syncProfileWithServer(); }
function syncProfileWithServer() { if(userProfile.name) { socket.emit('updateProfile', userProfile); } }

window.borrarPerfil = function() {
    if(confirm("¿Borrar perfil y empezar de cero?")) {
        localStorage.removeItem('jlChessProfile');
        location.reload();
    }
};

function mostrarMenuPrincipal() { document.getElementById('setup-view').style.display = 'none'; document.getElementById('login-view').style.display = 'block'; updateCardUI(); }
function updateCardUI() {
    document.getElementById('card-name').innerText = userProfile.name;
    document.getElementById('card-avatar').innerText = userProfile.avatar;
    document.getElementById('card-stars').innerText = userProfile.stars;
    document.getElementById('card-elo').innerText = userProfile.elo;
    var btn = document.getElementById('btn-skin');
    if (userProfile.stars >= 10) {
        btn.classList.add('skin-unlocked');
        btn.innerHTML = (userProfile.skin === 'artist') ? "🎨 Usando: <b>Piezas Maestras</b> (Clic para quitar)" : "🔓 ¡Desbloqueado! Clic para usar <b>Piezas Maestras</b>";
    } else {
        btn.classList.remove('skin-unlocked');
        btn.innerHTML = `🔒 Consigue 10 ⭐ para desbloquear piezas (${userProfile.stars}/10)`;
    }
}
function toggleSkin() {
    if (userProfile.stars < 10) { Swal.fire('Bloqueado', 'Necesitas 10 estrellas.', 'info'); return; }
    userProfile.skin = (userProfile.skin === 'classic') ? 'artist' : 'classic';
    saveProfile();
    Swal.fire('¡Cambio Exitoso!', 'Configuración actualizada.', 'success');
    setTimeout(() => location.reload(), 1000); 
}

// --- VISUALES ---
function removeHighlights() { $('.square-55d63').removeClass('highlight-selected highlight-move highlight-hint highlight-capture'); }
function highlightSelected(square) { $('.square-' + square).addClass('highlight-selected'); }
function highlightLastMove(move) {
    $('.square-55d63').removeClass('highlight-move');
    if (move) { $('.square-' + move.from).addClass('highlight-move'); $('.square-' + move.to).addClass('highlight-move'); }
}
function showPossibleMoves(square) {
    var moves = game.moves({ square: square, verbose: true });
    if (moves.length === 0) return;
    for (var i = 0; i < moves.length; i++) {
        var move = moves[i];
        if (move.flags.includes('c')) {
            $('.square-' + move.to).addClass('highlight-capture');
        } else {
            $('.square-' + move.to).addClass('highlight-hint');
        }
    }
}

// --- ONLINE ---
function unirsePartida() {
    var room = document.getElementById('roomSelect').value;
    currentRoom = room; ocultarVistas(); document.getElementById('game-view').style.display = 'block';
    currentMode = 'online'; selectedSquare = null;
    game = new Chess();
    setTimeout(() => { 
        if(board) board.destroy();
        socket.emit('join', { room: room, name: userProfile.name, avatar: userProfile.avatar, stars: userProfile.stars, elo: userProfile.elo, reset: true });
    }, 200);
}
socket.on('playerRole', function(role) {
    if (role === 'spectator') { isSpectator = true; playerColor = 'w'; document.getElementById('status-display').innerText = "Espectador (Mesa Llena)"; } 
    else { isSpectator = false; playerColor = role; document.getElementById('status-display').innerText = "Eres: " + (role === 'w' ? "BLANCAS ⚪" : "NEGRAS ⚫"); }
    initBoard();
});
function initBoard() {
    var config = { draggable: false, position: 'start', orientation: (playerColor === 'b') ? 'black' : 'white', pieceTheme: getPieceImg };
    board = Chessboard('board', config); 
    socket.emit('requestBoardState', currentRoom); 
    setTimeout(board.resize, 200);
}
function handleOnlineClick(square) {
    if (game.game_over() || isSpectator) return;
    if ((game.turn() === 'w' && playerColor === 'b') || (game.turn() === 'b' && playerColor === 'w')) return;

    if (!selectedSquare) {
        var piece = game.get(square);
        if (piece && piece.color === game.turn()) { 
            selectedSquare = square; 
            removeHighlights(); 
            highlightSelected(square);
            showPossibleMoves(square);
        }
        return;
    }
    var move = game.move({ from: selectedSquare, to: square, promotion: 'q' });
    if (move === null) {
        var piece = game.get(square);
        if (piece && piece.color === game.turn()) { 
            selectedSquare = square; 
            removeHighlights(); 
            highlightSelected(square);
            showPossibleMoves(square);
        } else { selectedSquare = null; removeHighlights(); }
    } else {
        board.position(game.fen()); removeHighlights(); highlightLastMove(move);
        if (move.captured) playSound('capture'); else playSound('move');
        socket.emit('move', { room: currentRoom, move: move, fen: game.fen(), timeW: timeWhite, timeB: timeBlack });
        updateStatus(); selectedSquare = null;
    }
}
socket.on('move', function(data) {
    var move = game.move(data.move); board.position(game.fen());
    if (move && move.captured) playSound('capture'); else playSound('move');
    if(data.timeW) { timeWhite = data.timeW; timeBlack = data.timeB; } updateStatus();
});
socket.on('boardState', function(fen) { if (fen) { game.load(fen); board.position(fen); updateStatus(); } });

// --- PUZZLES ---
var currentPuzzleIndex = 0;
const puzzles = [
    { name: "Reto 1: Mate del Loco", fen: "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2", from: 'd8', to: 'h4', msg: "Negras ganan en 1." },
    { name: "Reto 2: Mate del Pastor", fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 2 4", from: 'f3', to: 'f7', msg: "Blancas ganan en 1." },
    { name: "Reto 3: Pasillo Mortal", fen: "6k1/3R4/6K1/8/8/8/8/8 w - - 0 1", from: 'd7', to: 'd8', msg: "El rey negro no tiene escape." },
    { name: "Reto 4: Defensa Vital", fen: "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3", from: 'd1', to: 'e2', msg: "¡Jaquemate en contra! Sálvate." }, 
    { name: "Reto 5: Ataque Doble", fen: "rnbqkbnr/ppp2ppp/8/3pp3/3P4/5P2/PPP1P1PP/RNBQKBNR w KQkq - 0 3", from: 'f3', to: 'e5', msg: "Gana un peón central." },
    { name: "Reto 6: Mate de Torre", fen: "8/8/8/8/8/4k3/2R5/r2K4 b - - 0 1", from: 'a1', to: 'c1', msg: "Negras dan mate." },
    { name: "Reto 7: Salvar la Torre", fen: "7k/8/8/8/1r6/8/3R4/K7 w - - 0 1", from: 'd2', to: 'b2', msg: "Evita el mate interponiendo." },
    { name: "Reto 8: Sacrificio", fen: "r1b2rk1/pp1p1pp1/1b1p2B1/n1q5/8/1Q6/P4PPP/4RRK1 w - - 0 1", from: 'b3', to: 'f7', msg: "Sacrifica para ganar." }, 
    { name: "Reto 9: Mate Ahogado", fen: "6rk/5Npp/8/8/8/8/8/7K w - - 0 1", from: 'f7', to: 'h6', msg: "Jaque doble de caballo." },
    { name: "Reto 10: Coronación", fen: "8/P7/8/8/8/8/k7/7K w - - 0 1", from: 'a7', to: 'a8', msg: "Corona y gana." }
];

function iniciarRetos() {
    isPuzzleMode = true; currentMode = 'puzzle'; selectedSquare = null;
    ocultarVistas(); document.getElementById('puzzle-view').style.display = 'block'; 
    if(board) board.destroy();
    
    var nivel = userProfile.stars; if(nivel >= puzzles.length) nivel = 0;
    setTimeout(() => { 
        cargarReto(nivel); 
        window.dispatchEvent(new Event('resize')); 
    }, 300);
}

function cargarReto(index) {
    currentPuzzleIndex = index; var puzzle = puzzles[index]; game.load(puzzle.fen);
    document.getElementById('puzzle-title').innerText = puzzle.name; document.getElementById('puzzle-desc').innerText = puzzle.msg;
    var config = { draggable: false, position: puzzle.fen, orientation: (game.turn() === 'w') ? 'white' : 'black', pieceTheme: getPieceImg };
    board = Chessboard('board-puzzle', config); selectedSquare = null; removeHighlights();
}
function handlePuzzleClick(square) {
    if (!selectedSquare) {
        var piece = game.get(square);
        if (piece && piece.color === game.turn()) { 
            selectedSquare = square; 
            removeHighlights(); 
            highlightSelected(square);
            showPossibleMoves(square);
        }
        return;
    }
    var puzzle = puzzles[currentPuzzleIndex];
    if (selectedSquare === puzzle.from && square === puzzle.to) {
        playSound('win'); game.move({ from: selectedSquare, to: square, promotion: 'q' }); board.position(game.fen()); removeHighlights(); selectedSquare = null;
        if (userProfile.stars <= currentPuzzleIndex) {
            userProfile.stars++; userProfile.elo += 15; saveProfile();
            Swal.fire({ title: '¡Correcto!', icon: 'success', timer: 1500, showConfirmButton: false }).then(nextPuzzle);
        } else { Swal.fire({ title: '¡Bien!', icon: 'success', timer: 1000, showConfirmButton: false }).then(nextPuzzle); }
    } else {
        var piece = game.get(square);
        if (piece && piece.color === game.turn()) { 
            selectedSquare = square; 
            removeHighlights(); 
            highlightSelected(square);
            showPossibleMoves(square);
        } else { playSound('error'); removeHighlights(); selectedSquare = null; }
    }
}
function nextPuzzle() { if (currentPuzzleIndex < puzzles.length - 1) cargarReto(currentPuzzleIndex + 1); else Swal.fire('¡Maestro!', 'Completaste todos los retos.', 'success').then(volverMenu); }

// --- PROFE ---
function iniciarPizarra() {
    ocultarVistas(); currentMode = 'teacher'; selectedSquare = null;
    document.getElementById('teacher-view').style.display = 'block';
    if(board) board.destroy();
    var config = { draggable: false, position: 'start', pieceTheme: getPieceImg };
    setTimeout(() => { board = Chessboard('board-teacher', config); window.dispatchEvent(new Event('resize')); }, 200);
}
function handleTeacherClick(square) {
    if (!selectedSquare) {
        var pos = board.position();
        if (pos.hasOwnProperty(square)) { selectedSquare = square; removeHighlights(); highlightSelected(square); }
        return;
    }
    if (selectedSquare === square) { selectedSquare = null; removeHighlights(); } 
    else {
        var pos = board.position(); var piece = pos[selectedSquare]; delete pos[selectedSquare]; pos[square] = piece;
        board.position(pos, false); playSound('move'); selectedSquare = null; removeHighlights();
    }
}
function limpiarPizarra() { board.clear(); selectedSquare = null; removeHighlights(); }
function inicioPizarra() { board.start(); selectedSquare = null; removeHighlights(); }

function ocultarVistas() {
    document.getElementById('setup-view').style.display = 'none'; document.getElementById('login-view').style.display = 'none';
    document.getElementById('game-view').style.display = 'none'; document.getElementById('ranking-view').style.display = 'none';
    document.getElementById('puzzle-view').style.display = 'none'; document.getElementById('teacher-view').style.display = 'none';
    currentMode = 'none';
}
function volverMenu() {
    ocultarVistas();
    if(userProfile.name) { document.getElementById('login-view').style.display = 'block'; updateCardUI(); } else { document.getElementById('setup-view').style.display = 'block'; }
    if(board) board.destroy();
    if(currentRoom) { socket.emit('leave', currentRoom); currentRoom = ""; }
}
function enviarMensaje() { var input = document.getElementById('chat-input'); if(input.value) { var fullMsg = `${userProfile.avatar} <b>${userProfile.name}:</b> ${input.value}`; socket.emit('chat', { room: currentRoom, msg: fullMsg }); input.value = ''; } }
socket.on('chat', function(data) { var msgTexto = (typeof data === 'object') ? data.msg : data; var box = document.getElementById('chat-box'); box.innerHTML += `<p>${msgTexto}</p>`; box.scrollTop = box.scrollHeight; });
function updateStatus() {
    var turn = game.turn();
    document.getElementById('clock-w').className = turn === 'w' ? 'clock-box active-turn' : 'clock-box';
    document.getElementById('clock-b').className = turn === 'b' ? 'clock-box active-turn' : 'clock-box';
    if (!timerInterval && !game.game_over()) timerInterval = setInterval(gameTimer, 1000);
    if (game.game_over()) { clearInterval(timerInterval); playSound('win'); Swal.fire('Fin del Juego', 'Partida terminada', 'info'); }
}
function gameTimer() { if (game.turn() === 'w') { timeWhite--; document.getElementById('time-w').innerText = fmt(timeWhite); } else { timeBlack--; document.getElementById('time-b').innerText = fmt(timeBlack); } if (timeWhite <= 0 || timeBlack <= 0) clearInterval(timerInterval); }
function fmt(s) { var m = Math.floor(s / 60); var sc = s % 60; return m + ':' + (sc < 10 ? '0' : '') + sc; }
function playSound(type) { var id = 'snd-move'; if (type === 'capture') id = 'snd-capture'; if (type === 'win') id = 'snd-win'; if (type === 'error') id = 'snd-error'; var audio = document.getElementById(id); if(audio) { audio.currentTime = 0; audio.play().catch(e => {}); } }
function verCuadroHonor() { ocultarVistas(); document.getElementById('ranking-view').style.display = 'block'; socket.emit('requestRanking'); }
function verSeleccionMesas() { var area = document.getElementById('mesas-area'); area.style.display = area.style.display === 'none' ? 'block' : 'none'; }
socket.on('rankingUpdate', function(playersList) { playersList.sort((a, b) => b.stars - a.stars); const grid = document.getElementById('ranking-grid'); grid.innerHTML = ""; if(playersList.length === 0) { grid.innerHTML = "<p>Nadie conectado aún.</p>"; return; } playersList.forEach(p => { grid.innerHTML += `<div class=\"honor-card\"><div class=\"honor-avatar\">${p.avatar}</div><span class=\"honor-name\">${p.name}</span><span class=\"honor-stars\">⭐ ${p.stars} | ELO ${p.elo}</span></div>`; }); });