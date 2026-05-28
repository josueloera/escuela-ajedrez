
        // --- LOGICA DE COMPRA SECUENCIAL (V15.7) ---
        function abrirPrecios() {
            $('#pricing-modal').css('display', 'flex');
            // Reiniciar botones al abrir
            $('#btn-prem-paypal').show();
            $('#btn-prem-wsp').hide();
            $('#btn-light-paypal').show();
            $('#btn-light-wsp').hide();
        }

        function cerrarPrecios() {
            $('#pricing-modal').hide();
            localStorage.setItem('jlChessSeenPricing', 'true');
        }

        function irAPaypal(plan) {
            let link = (plan === 'premium') ? "https://www.paypal.com/ncp/payment/Z6E9QH8PKMTB8" : "https://www.paypal.com/ncp/payment/AV2W79HUUPMRC";
            window.open(link, '_blank');

            // Ocultar botón de PayPal y mostrar el de WhatsApp del plan correspondiente
            if (plan === 'premium') {
                $('#btn-prem-paypal').hide();
                $('#btn-prem-wsp').show();
            } else {
                $('#btn-light-paypal').hide();
                $('#btn-light-wsp').show();
            }
        }

        function irAWhatsapp(plan) {
            let mensaje = (plan === 'premium') ?
                "Hola Josue, estoy comprando el Plan PREMIUM de JL Chess ($500 MXN). Aquí enviaré mi comprobante de pago." :
                "Hola Josue, estoy comprando el Plan LIGHT de JL Chess ($300 MXN). Aquí enviaré mi comprobante de pago.";

            var urlWsp = "https://wa.me/5216271073044?text=" + encodeURIComponent(mensaje);
            window.open(urlWsp, '_blank');
        }

        $(document).ready(function () {
            if (!localStorage.getItem('jlChessSeenPricing')) {
                setTimeout(abrirPrecios, 1000);
            }
        });

        // --- CÓDIGO JS DEL JUEGO (Mismo que versiones anteriores) ---
        var socket = null;
        try {
            socket = io({
                transports: ['websocket', 'polling']
            });
        } catch (e) {
            console.error("Socket error", e);
        }

        var game = new Chess();
        var board = null;
        var currentMode = 'none';
        var currentCategory = '';
        var currentRoom = "";
        var globalChatRoom = "";
        var currentSchoolId = localStorage.getItem('jlSchoolId') || "";
        var playerColor = 'w';
        var isSpectator = false;
        var selectedSquare = null;
        var botTimeout = null;
        var academyTimeouts = [];
        var currentLessonId = null;
        var userProfile = {
            name: "",
            avatar: "♟️",
            stars: 0,
            elo: 400,
            skin: 'classic',
            premiumUnlocked: false
        };
        const avatars = ["🦁", "🐯", "🤖", "👽", "🦄", "🐲", "🦸‍♂️", "🥷", "🐼", "🦊", "👑", "🚀"];
        var timeWhite = 600;
        var timeBlack = 600;
        var timerInterval = null;

        // --- HELPER PARA RENDERIZAR AVATAR ---
        function renderAvatar(avatar) {
            if (!avatar) return "👤";
            if (avatar.startsWith('/uploads/')) {
                return `<img src="${avatar}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:4px;">`;
            }
            return avatar;
        }
        var selectedAvatarTemp = avatars[0];

        var finalTournamentData = null;
        var currentMatches = [];
        var currentStandings = [];
        var tournamentMode = 'virtual';

        const piezasDB = {
            'p': {
                name: "Peón (P)",
                t: "El Peón: Avanza una casilla hacia adelante. Come en diagonal.",
                pos: '8/8/8/8/4P3/8/8/8 w - - 0 1',
                h: ['e5']
            },
            'n': {
                name: "Caballo (C)",
                t: "El Caballo: Se mueve en forma de L. Salta sobre otras.",
                pos: '8/8/8/4N3/8/8/8/8 w - - 0 1',
                h: ['d3', 'f3', 'c4', 'g4', 'c6', 'g6', 'd7', 'f7']
            },
            'b': {
                name: "Alfil (A)",
                t: "El Alfil: Diagonales de su color.",
                pos: '8/8/8/3B4/8/8/8/8 w - - 0 1',
                h: ['a2', 'b3', 'c4', 'e6', 'f7', 'g8', 'a8', 'b7', 'c6', 'e4', 'f3', 'g2', 'h1']
            },
            'r': {
                name: "Torre (T)",
                t: "La Torre: Línea recta, horizontal o vertical.",
                pos: '8/8/8/3R4/8/8/8/8 w - - 0 1',
                h: ['d1', 'd2', 'd3', 'd5', 'd6', 'd7', 'd8', 'a5', 'b5', 'c5', 'e5', 'f5', 'g5', 'h5']
            },
            'q': {
                name: "Dama (D)",
                t: "La Dama: La más poderosa. Torre + Alfil.",
                pos: '8/8/8/3Q4/8/8/8/8 w - - 0 1',
                h: ['d1', 'd2', 'd3', 'd6', 'd7', 'd8', 'a5', 'b5', 'c5', 'e5', 'f5', 'g5', 'h5', 'a2', 'b3', 'c4', 'e6', 'f7', 'g8', 'a8', 'b7', 'c6', 'e4', 'f3', 'g2', 'h1']
            },
            'k': {
                name: "Rey (R)",
                t: "El Rey: Un paso a cualquier lado. ¡Protégelo!",
                pos: '8/8/8/4K3/8/8/8/8 w - - 0 1',
                h: ['d4', 'e4', 'f4', 'd5', 'f5', 'd6', 'e6', 'f6']
            }
        };
        const aperturasDB = {
            'italiana': {
                name: "Italiana",
                moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
                texts: ["Controlamos el centro.", "Respuesta simétrica.", "Caballo ataca.", "Defiende.", "Alfil apunta al punto débil f7."]
            },
            'siciliana': {
                name: "Siciliana",
                moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4'],
                texts: ["Centro.", "Lucha asimétrica.", "Caballo.", "Control.", "Rompemos el centro.", "Cambio de peones.", "Juego abierto."]
            },
            'pastor': {
                name: "Pastor",
                moves: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'],
                texts: ["Peón de Rey.", "Respuesta negra.", "Alfil apunta a f7.", "Caballo defiende.", "¡La Dama ataca!", "Error fatal...", "¡Jaque Mate!"]
            },
            'pastor': {
                name: "Pastor",
                moves: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'],
                texts: ["Peón de Rey.", "Respuesta negra.", "Alfil apunta a f7.", "Caballo defiende.", "¡La Dama ataca!", "Error fatal...", "¡Jaque Mate!"]
            },
            'espanola': {
                name: "Española",
                moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
                texts: ["Salida clásica.", "Respuesta clásica.", "Caballo ataca.", "Defiende.", "Ruy López: Presión directa."]
            },
            'francesa': {
                name: "Francesa",
                moves: ['e4', 'e6', 'd4', 'd5', 'Nc3'],
                texts: ["Peón Rey.", "Defensa sólida.", "Ocupamos el centro.", "Contraataque central.", "Desarrollo del caballo."]
            },
            'carokann': {
                name: "Caro-Kann",
                moves: ['e4', 'c6', 'd4', 'd5', 'Nc3'],
                texts: ["Apertura.", "Soporte sólido.", "Centro fuerte.", "Desafío al centro.", "Defensa rocosa."]
            },
            'londres': {
                name: "S. Londres",
                moves: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'c5'],
                texts: ["Peón Dama.", "Control central.", "El Alfil de Londres.", "Desarrollo.", "La Pirámide.", "Contraataque."]
            },
            'gambito_dama': {
                name: "Gambito Dama",
                moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6'],
                texts: ["Peón Dama.", "Igualdad.", "¡El Gambito! Ofrecemos un peón.", "Se defiende.", "Presión.", "Desarrollo."]
            }
        };
        const matesDB = {
            'pasillo': {
                name: "Pasillo",
                fen: "6k1/5ppp/8/8/8/8/4R3/4K3 w - - 0 1",
                moves: ['Re8#'],
                texts: ["¡Jaque Mate en la última fila!"]
            },
            'beso': {
                name: "Beso",
                fen: "7k/5K2/8/6Q1/8/8/8/8 w - - 0 1",
                moves: ['Qg7#'],
                texts: ["El Beso de la Muerte."]
            },
            'escalera': {
                name: "Escalera",
                fen: "8/8/8/5k2/8/8/4R3/3R3K w - - 0 1",
                moves: ['Rf1+', 'Kg5', 'Rg2+', 'Kh5', 'Rh1#'],
                texts: ["Una Torre corta.", "El Rey sube.", "La otra golpea.", "El Rey sube.", "¡Mate final!"]
            },
            'arabe': {
                name: "Mate Árabe",
                fen: "7k/2R5/5N2/8/8/8/8/7K w - - 0 1",
                moves: ['Rh7#'],
                texts: ["Torre y Caballo cooperan."]
            },
            'anastasia': {
                name: "Anastasia",
                fen: "5rk1/5ppp/2N5/8/8/R7/2Q5/6K1 w - - 0 1",
                moves: ['Ne7+', 'Kh8', 'Qxh7+', 'Kxh7', 'Rh3#'],
                texts: ["Caballo a e7, jaque.", "El Rey huye al rincón.", "¡SACRIFICIO DE DAMA!", "El Rey debe comer.", "¡La Torre remata!"]
            },
            'boden': {
                name: "Boden",
                fen: "r1kr4/p1pp4/8/8/3B4/8/8/5B1K w - - 0 1",
                moves: ['Ba6+', 'Kb8', 'Be5#'],
                texts: ["Primer Alfil da Jaque.", "El Rey huye.", "¡El segundo Alfil da Mate!"]
            }
        };
        const finalesDB = {
            'reypeon': {
                name: "Rey y Peón",
                fen: "8/8/8/8/8/4k3/4P3/4K3 w - - 0 1",
                moves: ['Kd1', 'Kf4', 'e4'],
                texts: ["Oposición.", "Espera.", "Avanza."]
            },
            'dostorres': {
                name: "Dos Torres",
                fen: "8/8/4k3/R7/8/8/7R/6K1 w - - 0 1",
                moves: ['Rh6+', 'Kd7', 'Ra7+', 'Kc8', 'Rh8#'],
                texts: ["Jaque con Torre h6.", "El Rey sube.", "Jaque con Torre a7.", "El Rey sube.", "¡Mate!"]
            },
            'rey_dama': {
                name: "Rey y Dama",
                fen: "8/k7/2K5/8/1Q6/8/8/8 w - - 0 1",
                moves: ['Qa5+', 'Kb8', 'Qb7#'],
                texts: ["Jaque.", "Única casilla.", "¡Mate con apoyo!"]
            },
            'rey_torre': {
                name: "Rey y Torre",
                fen: "k7/8/K7/8/1R6/8/8/8 w - - 0 1",
                moves: ['Rh4', 'Kb8', 'Rh8#'],
                texts: ["Prepara el mate.", "El Rey espera.", "¡Mate al fondo!"]
            },
            'coronacion': {
                name: "Coronación",
                fen: "8/P7/2k5/8/2K5/8/8/8 w - - 0 1",
                moves: ['a8=Q+', 'Kb6', 'Qb7+', 'Ka5', 'Qa7#'],
                texts: ["¡Nueva Dama!", "El Rey huye.", "Jaque.", "Única.", "¡Mate!"]
            }
        };
        var currentPuzzleIndex = 0;
        var puzzleMistakes = 0;
        const retosDB = [{
            fen: "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2",
            from: 'd8',
            to: 'h4',
            title: "Mate del Loco",
            hint: "¡La Dama negra tiene vía libre hacia el Rey!"
        }, {
            fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1",
            from: 'f3',
            to: 'f7',
            title: "Mate Pastor",
            hint: "La Dama blanca apunta a f7."
        }, {
            fen: "6k1/5ppp/8/8/8/8/4R3/4K3 w - - 0 1",
            from: 'e2',
            to: 'e8',
            title: "Pasillo (Torre)",
            hint: "El Rey está atrapado por sus peones. ¡Usa la Torre!"
        }, {
            fen: "7k/5K2/8/6Q1/8/8/8/8 w - - 0 1",
            from: 'g5',
            to: 'g7',
            title: "Beso de la Muerte",
            hint: "Ponte frente al Rey con la Dama."
        }, {
            fen: "k7/2Q5/1K6/8/8/8/8/8 w - - 0 1",
            from: 'c7',
            to: 'b7',
            title: "Dama y Rey",
            hint: "Corta el paso al Rey en la esquina."
        }, {
            fen: "6k1/5ppp/8/8/8/2Q5/8/6K1 w - - 0 1",
            from: 'c3',
            to: 'c8',
            title: "Pasillo (Dama)",
            hint: "Igual que el pasillo, pero con la Dama."
        }, {
            fen: "6rk/6pp/7N/8/8/8/8/7K w - - 0 1",
            from: 'h6',
            to: 'f7',
            title: "Mate de la Coz",
            hint: "¡El Caballo puede saltar y encerrar al Rey!"
        }, {
            fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
            from: 'g1',
            to: 'f3',
            title: "Desarrollo Caballo",
            hint: "Saca el Caballo para controlar el centro."
        }, {
            fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
            from: 'f1',
            to: 'b5',
            title: "Apertura Española",
            hint: "El Alfil ataca al caballo defensor."
        }, {
            fen: "k7/8/1K6/8/8/8/8/3R4 w - - 0 1",
            from: 'd1',
            to: 'd8',
            title: "Mate de Torre",
            hint: "El Rey negro está atrapado en la banda. ¡Remata con la Torre!"
        }, {
            fen: "r1b1k1nr/pppp1ppp/2n5/2b1N3/2B1P2q/8/PPPP1PPP/RNBQK2R w KQkq - 1 5",
            from: 'c4',
            to: 'f7',
            title: "Ataque f7",
            hint: "El punto f7 es el más débil. ¡Atácalo con el Alfil!"
        }, {
            fen: "rnbqkbnr/ppp2ppp/8/3pp3/4P3/5Q2/PPPP1PPP/RNB1KBNR w KQkq - 0 3",
            from: 'e4',
            to: 'd5',
            title: "Captura Central",
            hint: "Gana control del centro comiendo el peón."
        }, {
            fen: "rnb1kbnr/pppp1ppp/8/4p3/7q/5P2/PPPPP1PP/RNBQKBNR w KQkq - 1 3",
            from: 'g2',
            to: 'g3',
            title: "Evitar Mate",
            hint: "¡Te están dando jaque! Cubre con el peón g2."
        }, {
            fen: "4k3/8/8/1r6/8/8/2Q5/4K3 w - - 0 1",
            from: 'c2',
            to: 'c6',
            title: "Doble Ataque",
            hint: "Da jaque y ataca la torre al mismo tiempo."
        }, {
            fen: "3k4/8/3n4/8/8/8/8/7R w - - 0 1",
            from: 'h1',
            to: 'd1',
            title: "Clavada",
            hint: "Coloca la torre en la columna 'd' para inmovilizar al caballo."
        }];

        function detenerAnimacion() {
            if (academyTimeouts) {
                academyTimeouts.forEach(x => clearTimeout(x));
                academyTimeouts = [];
            }
            if (window.speechSynthesis) window.speechSynthesis.cancel();
        }

        function inicioPizarra() {
            iniciarPizarra();
        }

        $(document).ready(function () {
            checkRole();
            initAvatarSelector();
            var config = {
                draggable: false,
                position: 'start',
                pieceTheme: getPieceImg,
                showNotation: true
            };
            board = Chessboard('board', config);
            $(window).resize(board.resize);

            $('#board-overlay').on('mousedown touchstart', function (e) {
                if (e.type === 'touchstart' && e.cancelable) e.preventDefault();
                var offset = $(this).offset();
                var width = $(this).width();
                if (!width) return;
                var clientX = (e.type === 'touchstart') ? e.originalEvent.touches[0].pageX : e.pageX;
                var clientY = (e.type === 'touchstart') ? e.originalEvent.touches[0].pageY : e.pageY;
                var x = clientX - offset.left;
                var y = clientY - offset.top;
                var squareSize = width / 8;
                var col = Math.floor(x / squareSize);
                var row = Math.floor(y / squareSize);
                if (col >= 0 && col <= 7 && row >= 0 && row <= 7) {
                    var files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
                    var ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
                    if (board && board.orientation() === 'black') {
                        files.reverse();
                        ranks.reverse();
                    }
                    var square = files[col] + ranks[row];
                    if (currentMode === 'online' || currentMode === 'tournament') handleTapClick(square);
                    else if (currentMode === 'puzzle') handlePuzzleClick(square);
                    else if (currentMode === 'teacher') handleTeacherClick(square);
                    else if (currentMode === 'bot') handleBotClick(square);
                }
            });
        });

        function initAvatarSelector() {
            const s = document.getElementById('avatar-selector');
            if (s) {
                s.innerHTML = '';
                avatars.forEach(av => {
                    let div = document.createElement('div');
                    div.className = 'avatar-option';
                    div.innerText = av;
                    div.onclick = function () {
                        $('.avatar-option').removeClass('selected');
                        div.classList.add('selected');
                        selectedAvatarTemp = av;
                    };
                    s.appendChild(div);
                });
                $('.avatar-option').first().addClass('selected');
            }
        }

        function getPieceImg(piece) {
            const symbols = {
                wP: '♙', wN: '♘', wB: '♗', wR: '♖', wQ: '♕', wK: '♔',
                bP: '♟', bN: '♞', bB: '♝', bR: '♜', bQ: '♛', bK: '♚'
            };
            const isWhite = piece.charAt(0) === 'w';
            const fill = isWhite ? '#f8f1dc' : '#1d2733';
            const stroke = isWhite ? '#1d2733' : '#f8f1dc';
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">
                <text x="22.5" y="34" text-anchor="middle" font-size="34" font-family="Georgia, serif" fill="${fill}" stroke="${stroke}" stroke-width="0.7">${symbols[piece] || ''}</text>
            </svg>`;
            return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
        }

        function aplicarPlan() {
            const plan = localStorage.getItem('jlLicenseType') || 'premium';
            if (plan === 'light') {
                $('#edu-buttons-container').hide();
                $('#btn-honor').hide();
                $('#btn-pizarra').hide();
                $('#btn-style').hide();
            } else {
                $('#edu-buttons-container').show();
                $('#btn-honor').show();
                $('#btn-pizarra').show();
                $('#btn-style').show();
            }
        }

        function ocultarTodo() {
            $('#role-selection-view, #teacher-login-view, #teacher-dashboard-view, #teacher-lobby-view, #setup-view, #student-menu-view, #student-lobby-view, #game-controls, #board-wrapper, #academy-main-menu, #ranking-view, #mesas-area, #chat-area, #online-header, #bot-header, #puzzle-header, #teacher-header, #academy-header, #final-results-view, #library-view').hide();
            $('#ai-assistant-container').hide();
            game = new Chess();
            selectedSquare = null;
            removeHighlights();
            playerColor = 'w';
            isSpectator = false;
            detenerAnimacion();
            detenerReloj();
        }

        function checkRole() {
            var r = localStorage.getItem('jlUserRole');
            if (r) {
                ocultarTodo();
                if (r === 'teacher') {
                    $('#teacher-dashboard-view').show();
                    $('#teacher-premium-btn').show();
                    var activeTour = localStorage.getItem('activeTournament');
                    if (activeTour) $('#recover-section').show();
                } else {
                    loadProfile();
                    aplicarPlan();
                }
            }
        }

        function seleccionarRol(r) {
            if (r === 'alumno') {
                localStorage.setItem('jlUserRole', 'student');
                checkRole();
            } else {
                $('#role-selection-view').hide();
                $('#teacher-login-view').show();
            }
        }

        function loginProfesor() {
            const key = $('#teacher-key').val().trim();
            const school = $('#teacherSchoolKeyInput').val().trim();
            if (!key) return Swal.fire('Error', 'Ingresa una licencia', 'warning');

            window.tempTeacherSchool = school; // Store for post-validation
            socket.emit('validateLicense', key);
        }

        function crearTorneo() {
            Swal.fire({
                title: 'Selecciona Modo',
                showDenyButton: true,
                showCancelButton: true,
                confirmButtonText: '📱 Virtual',
                denyButtonText: '♟️ Presencial',
                cancelButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) {
                    socket.emit('createTournament', 'virtual');
                } else if (result.isDenied) {
                    socket.emit('createTournament', 'presencial');
                }
            });
        }

        function agregarJugadorManual() {
            const name = $('#manualName').val().trim();
            if (!name) return;
            const code = $('#lobby-code').text();
            socket.emit('addManualPlayer', {
                code: code,
                name: name
            });
            $('#manualName').val('');
        }

        function reportarResultadoManual(room, winner) {
            const code = $('#lobby-code').text();
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 1500
            });
            Toast.fire({
                icon: 'success',
                title: 'Guardando...'
            });
            socket.emit('reportResult', {
                code: code,
                room: room,
                winner: winner
            });
        }

        function borrarRol() {
            if (confirm("¿Salir?")) {
                localStorage.removeItem('jlUserRole');
                localStorage.removeItem('jlLicenseType');
                localStorage.removeItem('activeTournament');
                location.reload();
            }
        }

        
        let pendingRetoId = null;

        $(document).ready(function() {
            const urlParams = new URLSearchParams(window.location.search);
            const reto = urlParams.get('reto');
            if (reto) {
                pendingRetoId = reto;
            }
        });

        async function compartirEnlaceReto() {
            const idReto = 'reto_' + Math.random().toString(36).substr(2, 9);
            const basePath = window.location.origin + window.location.pathname;
            const link = basePath + '?reto=' + idReto;
            
            try {
                await navigator.clipboard.writeText(link);
            } catch(e){}

            if (navigator.share) {
                navigator.share({
                    title: '¡Reto de Ajedrez!',
                    text: '¡Únete a mi partida de ajedrez ahora mismo!',
                    url: link
                }).catch(err => console.log('Error sharing:', err));
            } else {
                Swal.fire('Enlace Copiado', 'Se ha copiado el enlace de reto al portapapeles:\n' + link, 'success');
            }

            entrarRetoPorEnlace(idReto);
        }

        function entrarRetoPorEnlace(room) {
            currentRoom = room;
            ocultarTodo();
            currentMode = 'online';
            $('#game-controls').show();
            $('#online-header').show();
            $('#chat-area').show();
            $('#board-wrapper').show();
            $('#tournament-actions').hide();
            $('#btn-reset-online').show();
            $('#btn-salir-game').show();
            $('#btn-volver-profe').hide();
            configurarTablero('start');
            socket.emit('updateProfile', userProfile);
            socket.emit('join', { room: room });
            socket.emit('requestBoardState', room);
        }

        function volverMenu() {
            ocultarTodo();
            if (pendingRetoId && userProfile && userProfile.name) {
                const r = pendingRetoId;
                pendingRetoId = null;
                entrarRetoPorEnlace(r);
                return;
            }

            var r = localStorage.getItem('jlUserRole');
            if (r === 'teacher') { $('#teacher-dashboard-view').show(); $('#teacher-premium-btn').show(); }
            else if (userProfile.name) {
                $('#student-menu-view').show();
                updateCardUI();
                updateStudentMenuAIButton();
            } else $('#setup-view').show();
            if (currentRoom) {
                if (socket) socket.emit('leave', currentRoom);
                currentRoom = "";
            }
            if (globalChatRoom) {
                socket.emit('leave', globalChatRoom);
                globalChatRoom = "";
            }
            board.clear();
        }

        
        function loadProfile() {
            const s = localStorage.getItem('jlChessProfile');
            if (s) {
                userProfile = {
                    ...userProfile,
                    ...JSON.parse(s)
                };
                
                if (pendingRetoId) {
                    const r = pendingRetoId;
                    pendingRetoId = null;
                    if (socket) socket.emit('updateProfile', userProfile);
                    entrarRetoPorEnlace(r);
                    return;
                }

                $('#student-menu-view').show();
                updateCardUI();
                updateStudentMenuAIButton();
                applySkin();
                if (socket) socket.emit('updateProfile', userProfile);
                $('#chat-area').show(); // Enable Global Chat
                socket.emit('join', { room: 'general' }); // Join Global Lobby
            } else {
                $('#setup-view').show();
                loadRecentSchools(); // Load chips
                $('#chat-area').show();

                let roomName = (currentSchoolId && currentSchoolId !== '') ? `${currentSchoolId}_general` : 'general';
                socket.emit('join', { room: roomName });
            }
        }

        function saveProfile() {
            localStorage.setItem('jlChessProfile', JSON.stringify(userProfile));
            updateCardUI();
            applySkin();
            if (socket) socket.emit('updateProfile', userProfile);
        }

        
        async function registerUser() {
            const username = $('#newPlayerName').val();
            const password = $('#playerPassword').val();
            if(!username || !password) return Swal.fire('Error', 'Debes poner nombre y contraseña', 'error');

            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);
            const fileInput = document.getElementById('avatarFile');
            if(fileInput.files.length > 0) {
                formData.append('avatarFile', fileInput.files[0]);
            } else if (selectedAvatarTemp) {
                // Not standard form data, but let's ignore emojis for register if not strictly needed
                // It will default to emoji in server if no file
            }

            try {
                const res = await fetch('/api/register', { method: 'POST', body: formData });
                const data = await res.json();
                if(data.success) {
                    userProfile = data.user;
                    saveProfile();
                    subscribeToPush();
                    volverMenu();
                    socket.emit('updateProfile', userProfile);
                } else {
                    Swal.fire('Error', data.error, 'error');
                }
            } catch(e) {
                Swal.fire('Error', 'Error de conexión', 'error');
            }
        }

        async function loginUser() {
            const username = $('#newPlayerName').val();
            const password = $('#playerPassword').val();
            if(!username || !password) return Swal.fire('Error', 'Faltan datos', 'error');

            try {
                const res = await fetch('/api/login', { 
                    method: 'POST', 
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({username, password}) 
                });
                const data = await res.json();
                if(data.success) {
                    userProfile = data.user;
                    saveProfile();
                    subscribeToPush();
                    volverMenu();
                    socket.emit('updateProfile', userProfile);
                } else {
                    Swal.fire('Error', data.error, 'error');
                }
            } catch(e) {
                Swal.fire('Error', 'Error de conexión', 'error');
            }
        }

        async function subscribeToPush() {
            if ('serviceWorker' in navigator && 'PushManager' in window) {
                try {
                    const reg = await navigator.serviceWorker.ready;
                    const sub = await reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: 'BP0E6v9iIvVnTh9tZz3tGOUkTABUUq-G0Z0_lHTs5Mu-5b3sS3fUOzN7WBpUMws64FJj4hx12AeFpT4MxI3RW3E'
                    });
                    await fetch('/api/save-subscription', {
                        method: 'POST',
                        headers:{'Content-Type':'application/json'},
                        body: JSON.stringify({ username: userProfile.name, subscription: sub })
                    });
                } catch(e) {
                    console.log('Push no activado por el usuario.');
                }
            }
        }

        // Overwrite updateCardUI
        function updateCardUI() {
            $('#card-name').text(userProfile.name);
            if(userProfile.avatar && userProfile.avatar.startsWith('/uploads/')) {
                $('#card-avatar').html(`<img src="${userProfile.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`);
            } else {
                $('#card-avatar').text(userProfile.avatar || "👤");
            }
            $('#card-elo').text(userProfile.elo || 400);
        }

        function crearPerfilLegacy() {
            userProfile.name = $('#newPlayerName').val() || "Jugador";
            userProfile.avatar = selectedAvatarTemp;
            saveProfile();
            volverMenu();
        }

        function toggleSkin() {
            if (userProfile.premiumUnlocked) {
                userProfile.skin = (userProfile.skin === 'classic') ? 'artist' : 'classic';
                saveProfile();
                Swal.fire({
                    title: "Estilo Actualizado",
                    text: "Modo: " + (userProfile.skin === 'artist' ? 'PREMIUM 🌟' : 'CLÁSICO'),
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            } else {
                Swal.fire("Bloqueado", "Completa todos los RETOS para desbloquear el estilo Premium.", "warning");
            }
        }

        function applySkin() {
            document.body.className = (userProfile.skin === 'artist') ? 'artist-skin' : 'classic-skin';
        }

        function iniciarReloj() {
            detenerReloj();
            timeWhite = 600;
            timeBlack = 600;
            actualizarRelojUI();
            timerInterval = setInterval(() => {
                if (game.turn() === 'w') {
                    timeWhite--;
                    if (timeWhite <= 0) declararFin("Tiempo. Ganan Negras", 'b');
                } else {
                    timeBlack--;
                    if (timeBlack <= 0) declararFin("Tiempo. Ganan Blancas", 'w');
                }
                actualizarRelojUI();
            }, 1000);
        }

        function detenerReloj() {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
        }

        function actualizarRelojUI() {
            $('#time-w').text(fmt(timeWhite));
            $('#time-b').text(fmt(timeBlack));
            $('.clock-box').removeClass('clock-active');
            if (game.turn() === 'w') $('#clock-w').addClass('clock-active');
            else $('#clock-b').addClass('clock-active');
        }

        function fmt(s) {
            var m = Math.floor(s / 60);
            var ss = s % 60;
            return m + ":" + (ss < 10 ? "0" + ss : ss);
        }

        function declararFin(msg, winnerColor) {
            detenerReloj();
            Swal.fire('Fin', msg, 'info').then(() => {
                if (currentMode === 'tournament' && !isSpectator) {
                    $('#game-controls').hide();
                    $('#board-wrapper').hide();
                    $('#student-lobby-view').show();
                    $('#student-status-msg').text("Esperando siguiente ronda...");
                }
            });
            if (winnerColor && currentMode === 'tournament' && !isSpectator) socket.emit('reportResult', {
                room: currentRoom,
                winner: winnerColor,
                reason: 'Tiempo'
            });
        }

        function verificarArbitro() {
            if (game.in_checkmate()) {
                var winner = (game.turn() === 'w') ? 'b' : 'w';
                declararFin("Jaque Mate. Ganan " + (winner === 'w' ? 'Blancas' : 'Negras'), winner);
                if (currentMode === 'tournament' && !isSpectator) socket.emit('reportResult', {
                    room: currentRoom,
                    winner: winner,
                    reason: 'Mate'
                });
            } else if (game.in_draw()) {
                declararFin("Tablas");
                if (currentMode === 'tournament' && !isSpectator) socket.emit('reportResult', {
                    room: currentRoom,
                    winner: 'draw',
                    reason: 'Reglas'
                });
            } else if (game.in_check()) {
                playSound('error');
                const Toast = Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 2000
                });
                Toast.fire({
                    icon: 'warning',
                    title: '¡JAQUE!'
                });
            }
        }

        function recuperarTorneoLocal() {
            var c = localStorage.getItem('activeTournament');
            if (c) socket.emit('recoverTournament', c);
        }

        function finalizarTorneo() {
            if (confirm("¿Terminar torneo y ver resultados?")) {
                var code = $('#lobby-code').text();
                socket.emit('finishTournament', code);
                localStorage.removeItem('activeTournament');
            }
        }

        function cerrarResultados() {
            volverMenu();
        }

        function verSeleccionMesas() {
            ocultarTodo();
            $('#mesas-area').show();
            $('#mesas-area').show();
            $('#chat-area').show();

            // Namespace: schoolId + "_general" or just "general"
            let roomName = (currentSchoolId && currentSchoolId !== '') ? `${currentSchoolId}_general` : 'general';
            socket.emit('join', { room: roomName });

            socket.emit('getPublicRoomsStatus', currentSchoolId);
            $('#newPlayerName').val('');
            $('#schoolKeyInput').val(''); // Clear school key

            loadRecentSchools(); // Load chips
        }

        function loadRecentSchools() {
            let recent = JSON.parse(localStorage.getItem('jlRecentSchools') || "[]");
            let container = $('#recent-schools-list');
            container.empty();

            recent.forEach(code => {
                let btn = $(`<button class="recent-school-pill">${code}</button>`);
                btn.click(() => $('#schoolKeyInput').val(code));
                container.append(btn);
            });
        }

        function saveRecentSchool(code) {
            if (!code || code.trim() === '') return;
            let recent = JSON.parse(localStorage.getItem('jlRecentSchools') || "[]");
            if (!recent.includes(code)) {
                recent.unshift(code);
                if (recent.length > 5) recent.pop();
                localStorage.setItem('jlRecentSchools', JSON.stringify(recent));
            }
        }

        function enviarMensajeConPerfil() {
            var msg = $('#chat-input').val();
            if (msg.trim() === '') return;
            var msg = $('#chat-input').val();
            if (msg.trim() === '') return;

            // Default to namespaced general if no specific room
            var defaultRoom = (currentSchoolId && currentSchoolId !== '') ? `${currentSchoolId}_general` : 'general';
            var room = currentRoom || globalChatRoom || defaultRoom;

            var senderName = userProfile.name || "Anónimo"; // Handle anonymous users
            var senderAvatar = userProfile.avatar || "👤"; // Default avatar for anonymous
            
            var formattedMsg = `${renderAvatar(senderAvatar)} ${senderName}: ${msg}`;
            socket.emit('chat', { room: room, msg: formattedMsg });
            $('#chat-input').val('');
        }

        if (socket) {
            socket.on('connect', function () {
                // Namespace: schoolId + "_general" or just "general"
                let roomName = (currentSchoolId && currentSchoolId !== '') ? `${currentSchoolId}_general` : 'general';
                socket.emit('join', { room: roomName });
            });

            function unirsePartidaConCodigo(roomCode) {
                let prefix = (currentSchoolId && currentSchoolId !== '') ? `${currentSchoolId}_` : "";
                let finalRoom = prefix + roomCode;

                socket.emit('join', { room: finalRoom });
                verTablero(finalRoom);
            }
            socket.on('licenseResult', function (data) {
                if (data.valid) {
                    localStorage.setItem('jlUserRole', 'teacher');
                    localStorage.setItem('jlLicenseType', data.type);

                    // Handle School Isolation for Teacher
                    if (window.tempTeacherSchool) {
                        localStorage.setItem('jlSchoolId', window.tempTeacherSchool);
                        currentSchoolId = window.tempTeacherSchool;
                        // Switch rooms immediately
                        socket.emit('leave', 'general');
                        socket.emit('join', { room: `${currentSchoolId}_general` });
                    } else {
                        // If empty, clear it? Or keep previous? 
                        // Better clear to allow switching back to "Global"
                        localStorage.removeItem('jlSchoolId');
                        currentSchoolId = "";
                        socket.emit('join', { room: 'general' });
                    }

                    let capacityMsg = "";
                    if (data.activeRooms !== undefined) {
                        capacityMsg = ` (Salas: ${data.activeRooms}/20)`;
                    }

                    Swal.fire({
                        title: `¡Bienvenido ${data.school}!`,
                        text: `Modo: ${data.type.toUpperCase()}${capacityMsg}`,
                        icon: 'success',
                        timer: 3000,
                        showConfirmButton: false
                    });
                    checkRole();
                } else {
                    Swal.fire('Error', data.msg, 'error');
                }
            });

            socket.on('tournamentCreated', function (data) {
                ocultarTodo();
                $('#teacher-lobby-view').show();
                $('#chat-area').show(); // Show Global Chat
                globalChatRoom = 'lobby_' + data.code; // Set Global Chat
                $('#lobby-code').text(data.code);
                $('#mode-display').text("Modo: " + data.mode.toUpperCase());
                tournamentMode = data.mode;
                $('#lobby-players').empty();
                $('#player-count').text("0");
                $('#lobby-content').show();
                $('#matches-content').hide();
                if (data.mode === 'presencial') $('#manual-add-section').show();
                else $('#manual-add-section').hide();
                localStorage.setItem('activeTournament', data.code);
            });

            socket.on('tournamentRecovered', function (data) {
                // DETECTAR MODO TV
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('mode') === 'tv') {
                    initTvMode(data.code, data.matches, currentStandings);
                    return;
                }

                ocultarTodo();
                $('#teacher-lobby-view').show();
                $('#chat-area').show(); // Show Global Chat
                globalChatRoom = 'lobby_' + data.code; // Set Global Chat
                $('#lobby-code').text(data.code);
                $('#mode-display').text("Modo: " + data.mode.toUpperCase());
                tournamentMode = data.mode;
                if (data.mode === 'presencial') $('#manual-add-section').show();
                else $('#manual-add-section').hide();
                if (data.matches.length > 0) {
                    $('#lobby-content').hide();
                    $('#matches-content').show();
                    renderMatches(data.matches);
                } else {
                    $('#lobby-content').show();
                    $('#matches-content').hide();
                }
            });

            socket.on('updatePlayerList', function (players) {
                // Update Teacher View
                $('#lobby-players').empty();
                players.forEach(p => $('#lobby-players').append(`<span class="player-chip">${renderAvatar(p.avatar)} ${p.name}</span>`));
                $('#player-count').text(players.length);

                // Update Sidebar List
                $('#online-users-list').empty();
                players.forEach(p => {
                    $('#online-users-list').append(`
                        <div class="online-user-item">
                            <span class="online-dot"></span>
                            <span>${renderAvatar(p.avatar)} ${p.name}</span>
                        </div>
                    `);
                });
            });

            socket.on('updateMatches', function (matches) {
                currentMatches = matches;
                $('#lobby-content').hide();
                $('#matches-content').show();
                renderMatches(matches);
                if ($('#tv-dashboard-view').is(':visible')) renderTvMatches(matches);
            });

            socket.on('updateStandings', function (players) {
                currentStandings = players; // Guardamos para PDF
                var tbody = $('#standings-body');
                tbody.empty();
                var studentBody = $('#student-standings-body');
                studentBody.empty();

                players.forEach((p, index) => {
                    var cls = index === 0 ? 'podium-gold' : (index === 1 ? 'podium-silver' : (index === 2 ? 'podium-bronze' : ''));
                    var row = `<tr class="${cls}"><td>${index + 1}</td><td>${renderAvatar(p.avatar)} ${p.name}</td><td>${p.score}</td><td>${p.buchholz}</td></tr>`;
                    if (tbody.length) tbody.append(row);
                    if (studentBody.length) studentBody.append(row);
                });
                if ($('#tv-dashboard-view').is(':visible')) updateTvStandings(players);
            });

            socket.on('showFinalResults', function (players) {
                ocultarTodo();
                $('#final-results-view').show();
                $('#final-standings-body').empty();
                if (localStorage.getItem('jlUserRole') === 'teacher') {
                    $('#btn-pdf').show();
                } else {
                    $('#btn-pdf').hide();
                }
                if (players.length > 0 && players[0].name === userProfile.name) {
                    Swal.fire({
                        title: '¡CAMPEÓN!',
                        text: '¡Felicidades!',
                        icon: 'success'
                    });
                }
                players.forEach((p, index) => {
                    var cls = index === 0 ? 'podium-gold' : (index === 1 ? 'podium-silver' : (index === 2 ? 'podium-bronze' : ''));
                    $('#final-standings-body').append(`<tr class="${cls}"><td>${index + 1}º</td><td>${renderAvatar(p.avatar)} ${p.name}</td><td>${p.score}</td><td>${p.buchholz}</td></tr>`);
                });
                localStorage.removeItem('activeTournament');
            });

            socket.on('tournamentEndedData', function (data) {
                finalTournamentData = data;
            });
            socket.on('spectateStart', function (room) {
                ocultarTodo();
                currentMode = 'online';
                currentRoom = room;
                isSpectator = true;
                $('#game-controls').show();
                $('#online-header').show();
                $('#board-wrapper').show();
                $('#chat-area').show();
                // Ensure sidebar is visible for teacher
                if (localStorage.getItem('jlUserRole') === 'teacher') {
                    $('#chat-left-col').show();
                    $('#chat-right-col').show();
                }
                $('#status-display').text("Espectador");
                $('#btn-salir-game').hide();
                $('#btn-volver-profe').show();
                $('#tournament-actions').hide();
                socket.emit('requestBoardState', room);

                // Robust resize for teacher view
                setTimeout(() => {
                    if (board) {
                        board.resize();
                        // Force redraw
                        board.position(game.fen());
                    }
                }, 300);
                setTimeout(() => { if (board) board.resize(); }, 1000);
            });
            socket.on('joinedTournament', function (data) {
                ocultarTodo();
                $('#student-lobby-view').show();
                $('#chat-area').show();
                globalChatRoom = 'lobby_' + data.code;
            });
            socket.on('matchStarted', function (data) {
                ocultarTodo();
                currentMode = 'tournament';
                currentRoom = data.room;
                playerColor = data.color;
                isSpectator = false;
                $('#game-controls').show();
                $('#online-header').show();
                $('#board-wrapper').show();
                $('#chat-area').show();
                $('#status-display').text("VS " + data.opponent);
                $('#btn-salir-game').hide();
                $('#btn-reset-online').hide();
                $('#tournament-actions').show();
                configurarTablero('start', playerColor === 'w' ? 'white' : 'black');
                Swal.fire('¡A Jugar!', 'Tu rival es: ' + data.opponent, 'success');
                // iniciarReloj() removed to start on first move
            });
            socket.on('tournamentBye', function (msg) {
                Swal.fire('Descanso', msg, 'info');
            });
            socket.on('opponentResigned', function () {
                declararFin("¡Ganaste! Rival se rindió.");
                socket.emit('reportResult', {
                    room: currentRoom,
                    winner: playerColor,
                    reason: 'Rendición'
                });
            });
            socket.on('drawOffered', function () {
                Swal.fire({
                    title: '¿Tablas?',
                    text: 'El rival ofrece empate.',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Aceptar'
                }).then((result) => {
                    if (result.isConfirmed) socket.emit('acceptDraw', currentRoom);
                });
            });
            socket.on('drawAccepted', function () {
                declararFin("Tablas acordadas.");
                socket.emit('reportResult', {
                    room: currentRoom,
                    winner: 'draw',
                    reason: 'Acuerdo'
                });
            });
            socket.on('boardState', function (fen) {
                if (fen) {
                    if (fen === 'start') {
                        game = new Chess();
                        board.start();
                    } else {
                        game.load(fen);
                        board.position(fen);
                    }
                    if (isSpectator) actualizarRelojUI();
                    setTimeout(() => board.resize(), 100);
                }
            });
            socket.on('tournamentError', function (msg) {
                Swal.fire('Error', msg, 'error');
            });

            socket.on('updateClientElo', function (newElo) {
                const oldElo = userProfile.elo || 400;
                userProfile.elo = newElo;
                saveProfile();
                $('#card-elo').text(newElo);
                const diff = newElo - oldElo;
                if (diff !== 0) {
                    const msg = diff > 0 ? `+${diff} puntos` : `${diff} puntos`;
                    const icon = diff > 0 ? 'success' : 'info';
                    const Toast = Swal.mixin({
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000
                    });
                    Toast.fire({
                        icon: icon,
                        title: `Ranking: ${msg}`
                    });
                }
            });
            socket.on('move', function (data) {
                if (data.reset) {
                    game = new Chess();
                    board.start();
                    removeHighlights();
                    return;
                }
                game.move(data.move);
                board.position(game.fen());
                playSound(data.move.captured ? 'capture' : 'move');
                verificarArbitro();
                if (game.history().length === 1 && !timerInterval) iniciarReloj();
                actualizarRelojUI();
            });
            socket.on('playerRole', function (role) {
                playerColor = (role === 'spectator') ? 'w' : role;
                isSpectator = (role === 'spectator');
                board.orientation(playerColor === 'b' ? 'black' : 'white');
                if (!isSpectator && currentMode === 'online') {
                    if (game.history().length > 0 && !timerInterval) iniciarReloj();
                }
            });
            socket.on('chat', (m) => {
                var box = $('#chat-box');
                box.append(`<p>${m}</p>`);
                box.scrollTop(box[0].scrollHeight);
            });

            socket.on('publicRoomsStatus', function (status) {
                var select = $('#roomSelect');
                select.empty();
                for (let i = 1; i <= 20; i++) {
                    let r = "Mesa " + i;
                    let count = status[r] || 0;
                    let icon = "🟢"; // Libre
                    if (count === 1) icon = "🟡"; // Esperando
                    if (count >= 2) icon = "🔴"; // Ocupado

                    select.append(`<option value="${r}">${icon} ${r} (${count}/2)</option>`);
                }
            });

            socket.on('premiumCodeCreated', function (code) {
                Swal.fire({
                    title: 'Código IA Premium',
                    html: `Comparte este código de 4 dígitos con tus alumnos:<br><br><b style="font-size: 2.5rem; color: #f1c40f; letter-spacing: 2px;">${code}</b>`,
                    icon: 'success'
                });
            });

            socket.on('premiumCodeResult', function (data) {
                if (data.valid) {
                    localStorage.setItem('jlChessPremiumAI', 'true');
                    updateStudentMenuAIButton();
                    Swal.fire({
                        title: '¡Activado!',
                        text: 'El Entrenador IA se ha activado para esta sesión. Ahora puedes ir a "🤖 VS BOT" y solicitar consejos durante tu juego.',
                        icon: 'success'
                    });
                } else {
                    Swal.fire('Código Incorrecto', 'El código ingresado no es válido. Consulta con tu profesor.', 'error');
                }
            });
        }

        function renderMatches(matches) {
            $('#matches-list').empty();
            if (matches.length === 0) $('#matches-list').text("Esperando...");

            matches.forEach(m => {
                let statusHtml = "";

                if (m.status === 'bye' || m.black === "LIBRE (Bye)" || m.black === "DESCANSO (Bye)") {
                    $('#matches-list').append(`
                        <div class="match-item" style="background: rgba(46, 204, 113, 0.2); border: 2px solid #2ecc71;">
                            <div class="match-title" style="justify-content:center; color:#2ecc71;">${m.white}</div>
                            <span style="font-size:0.9rem; color: #fff; font-weight:bold;">TIENE BYE (LIBRE)</span>
                            <span style="font-size:0.8rem; font-style:italic;">+1 Punto Automático</span>
                        </div>
                    `);
                    return;
                }

                if (m.status !== 'playing' && tournamentMode === 'virtual') {
                    statusHtml = `<span style="color:#e74c3c;">🔴 ${m.result}</span>`;
                } else if (tournamentMode === 'virtual') {
                    statusHtml = `<button class="btn-watch" onclick="espectarPartida('${m.room}')">👁️ Ver</button>`;
                } else {
                    let btnStyle = "padding:10px; font-size:12px; border-radius:6px; font-weight:bold;";
                    let currentRes = m.status === 'finished' ? `<div style='margin-bottom:8px; color:#f1c40f; font-weight:bold; border-bottom:1px solid #555; padding-bottom:5px; width:100%; text-align:center;'>Resultado: ${m.result}</div>` : "";

                    statusHtml = `
                        ${currentRes}
                        <div class="manual-result-row">
                            <button class="btn-green btn-res" style="${btnStyle}" onclick="reportarResultadoManual('${m.room}', 'w')">🏆 ${m.white}</button>
                            <button class="btn-yellow btn-res" style="${btnStyle}" onclick="reportarResultadoManual('${m.room}', 'draw')">🤝 Tablas</button>
                            <button class="btn-red btn-res" style="${btnStyle}" onclick="reportarResultadoManual('${m.room}', 'b')">🏆 ${m.black}</button>
                        </div>
                    `;
                }

                $('#matches-list').append(`
                    <div class="match-item">
                        <div class="match-title">
                            <span>⚪ ${m.white}</span>
                            <span style="font-size:0.8em; color:#bdc3c7;">VS</span>
                            <span>⚫ ${m.black}</span>
                        </div>
                        ${statusHtml}
                    </div>
                `);
            });
        }

        // --- GENERADOR PDF REPORTE FINAL ---
        function generarReporteFinalPDF() {
            if (!finalTournamentData) return Swal.fire('Error', 'No hay datos del torneo.', 'error');
            const {
                jsPDF
            } = window.jspdf;
            const doc = new jsPDF();
            const players = finalTournamentData.players;
            const rounds = finalTournamentData.totalRounds;

            doc.setFontSize(22);
            doc.setTextColor(44, 62, 80);
            doc.text("Reporte Final - JL Chess Escolar", 105, 20, null, null, "center");
            doc.setFontSize(12);
            doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 105, 30, null, null, "center");

            const headers = [
                ['#', 'Jugador']
            ];
            for (let i = 1; i <= rounds; i++) headers[0].push(`R${i}`);
            headers[0].push('Pts Total');
            headers[0].push('Buchholz');

            const body = players.map((p, index) => {
                const row = [(index + 1).toString(), p.name];
                for (let r = 1; r <= rounds; r++) row.push(p.history && p.history[`R${r}`] ? p.history[`R${r}`] : "-");
                row.push(p.score.toString());
                row.push(p.buchholz.toString());
                return row;
            });

            doc.autoTable({
                head: headers,
                body: body,
                startY: 40,
                theme: 'grid',
                headStyles: {
                    fillColor: [44, 62, 80],
                    textColor: 255
                },
                styles: {
                    halign: 'center'
                },
                columnStyles: {
                    1: {
                        halign: 'left'
                    }
                }
            });
            doc.save("Reporte_Final.pdf");
        }

        // --- GENERADOR PDF TABLA ACTUAL ---
        function generarTablaPDF() {
            if (!currentStandings || currentStandings.length === 0) return Swal.fire('Info', 'No hay datos aún.', 'info');
            const {
                jsPDF
            } = window.jspdf;
            const doc = new jsPDF();

            doc.setFontSize(22);
            doc.setTextColor(44, 62, 80);
            doc.text("Tabla de Posiciones", 105, 20, null, null, "center");
            doc.setFontSize(10);
            doc.text(`JL Chess Escolar - ${new Date().toLocaleTimeString()}`, 105, 28, null, null, "center");

            const headers = [
                ['#', 'Jugador', 'Puntos', 'Buchholz']
            ];
            const body = currentStandings.map((p, index) => {
                return [(index + 1).toString(), p.name, p.score.toString(), p.buchholz.toString()];
            });

            doc.autoTable({
                head: headers,
                body: body,
                startY: 35,
                theme: 'striped',
                styles: {
                    fontSize: 12,
                    cellPadding: 3,
                    halign: 'center'
                },
                headStyles: {
                    fillColor: [52, 73, 94],
                    textColor: 255
                },
                columnStyles: {
                    1: {
                        halign: 'left'
                    }
                }
            });
            doc.save("Tabla_Posiciones.pdf");
        }

        // --- GENERADOR PDF EMPAREJAMIENTOS ---
        function generarEmparejamientosPDF() {
            if (!currentMatches || currentMatches.length === 0) return Swal.fire('Info', 'No hay emparejamientos activos.', 'info');
            const {
                jsPDF
            } = window.jspdf;
            const doc = new jsPDF();
            const ronda = currentMatches[0].round || "?";
            doc.setFontSize(20);
            doc.setTextColor(44, 62, 80);
            doc.text(`Emparejamientos - Ronda ${ronda}`, 105, 20, null, null, "center");
            doc.setFontSize(10);
            doc.text("JL Chess Escolar", 105, 28, null, null, "center");

            const headers = [
                ['Mesa', 'Blancas', 'Negras', 'Resultado']
            ];
            const body = currentMatches.map((m, index) => {
                let res = "";
                if (m.status !== 'playing') res = m.result || "Fin";
                return [(index + 1).toString(), m.white, m.black, res];
            });

            doc.autoTable({
                head: headers,
                body: body,
                startY: 35,
                theme: 'striped',
                styles: {
                    fontSize: 12,
                    cellPadding: 3,
                    halign: 'center'
                },
                headStyles: {
                    fillColor: [52, 73, 94],
                    textColor: 255
                },
                columnStyles: {
                    3: {
                        cellWidth: 40
                    }
                }
            });
            doc.save(`Emparejamientos_Ronda_${ronda}.pdf`);
        }

        function iniciarRonda() {
            var code = $('#lobby-code').text();
            socket.emit('startRound', code);
        }

        function espectarPartida(room) {
            socket.emit('spectateMatch', room);
        }

        function ingresarTorneo() {
            Swal.fire({
                title: 'Código',
                input: 'text',
                showCancelButton: true
            }).then((result) => {
                if (result.isConfirmed) {
                    socket.emit('updateProfile', userProfile);
                    socket.emit('joinTournament', result.value);
                }
            });
        }

        function rendirse() {
            if (confirm("¿Rendirse?")) {
                socket.emit('resign', currentRoom);
                socket.emit('reportResult', {
                    room: currentRoom,
                    winner: (playerColor === 'w' ? 'b' : 'w'),
                    reason: 'Rendición'
                });
                declararFin("Te has rendido.");
            }
        }

        function pedirTablas() {
            if (confirm("¿Pedir tablas?")) {
                socket.emit('offerDraw', currentRoom);
                Swal.fire('Enviado', 'Esperando...', 'info');
            }
        }

        function forzarReinicioOnline() {
            if (confirm("¿Reiniciar partida?")) {
                socket.emit('move', {
                    room: currentRoom,
                    reset: true
                });
                game = new Chess();
                board.start();
                removeHighlights();
            }
        }

        function verCuadroHonor() {
            Swal.fire('Ranking', 'Próximamente', 'info');
        }

        function iniciarPizarra() {
            ocultarTodo();
            currentMode = 'teacher';
            $('#game-controls').show();
            $('#teacher-header').show();
            $('#board-wrapper').show();
            $('#btn-salir-game').hide();
            configurarTablero('start');
        }

        function limpiarPizarra() {
            game = new Chess();
            board.start();
            removeHighlights();
            selectedSquare = null;
        }

        function unirsePartida() {
            var r = document.getElementById('roomSelect').value;
            currentRoom = r;
            ocultarTodo();
            currentMode = 'online';
            $('#game-controls').show();
            $('#online-header').show();
            $('#chat-area').show();
            $('#board-wrapper').show();
            $('#tournament-actions').hide();
            $('#btn-reset-online').show();
            $('#btn-salir-game').show();
            $('#btn-volver-profe').hide();
            configurarTablero('start');
            socket.emit('updateProfile', userProfile); // Ensure profile is sent
            socket.emit('join', { room: r });
            socket.emit('requestBoardState', r); // Solicitar historial previo
        }

        function verSeleccionMesasSimple() {
            ocultarTodo();
            $('#mesas-area').show();
            $('#chat-area').show(); // Enable Global Chat
            socket.emit('getPublicRoomsStatus');
        }

        function enviarMensaje() {
            var t = $('#chat-input').val();
            if (t) {
                var defaultRoom = (currentSchoolId && currentSchoolId !== '') ? `${currentSchoolId}_general` : 'general';
                var r = globalChatRoom || ((currentRoom && currentRoom !== "") ? currentRoom : defaultRoom);
                const senderName = (userProfile && userProfile.name) ? userProfile.name : "Invitado " + socket.id.substr(0, 4);
                const senderAvatar = (userProfile && userProfile.avatar) ? userProfile.avatar : "👤";
                socket.emit('chat', {
                    room: r,
                    msg: `${renderAvatar(senderAvatar)} ${senderName}: ${t}`
                });
                $('#chat-input').val('');
            }
        }

        function playSound(t) {
            try {
                var audio = document.getElementById('snd-' + t);
                if (audio) {
                    audio.play().catch(function (e) { });
                    return;
                }

                var AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return;
                var ctx = new AudioContext();
                var oscillator = ctx.createOscillator();
                var gain = ctx.createGain();
                var tones = { move: 440, capture: 330, win: 660, error: 220 };
                oscillator.frequency.value = tones[t] || 440;
                oscillator.type = t === 'error' ? 'square' : 'sine';
                gain.gain.setValueAtTime(0.04, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
                oscillator.connect(gain);
                gain.connect(ctx.destination);
                oscillator.start();
                oscillator.stop(ctx.currentTime + 0.12);
            } catch (e) { }
        }

        function configurarTablero(fen, orientation) {
            if (!board) return;
            var orientacion = orientation || 'white';
            board.orientation(orientacion);
            if (fen === 'start') {
                board.start();
            } else {
                board.position(fen);
            }
            setTimeout(function () {
                board.resize();
            }, 200);
        }

        function handleTapClick(s) {
            if (game.game_over() || isSpectator) return;
            if ((game.turn() === 'w' && playerColor === 'b') || (game.turn() === 'b' && playerColor === 'w')) return;
            movimientoComun(s, (m) => {
                socket.emit('move', {
                    room: currentRoom,
                    move: m,
                    fen: game.fen()
                });
                verificarArbitro();
                if (game.history().length === 1 && !timerInterval) iniciarReloj();
                actualizarRelojUI();
            });
        }

        function handleTeacherClick(s) {
            if (!selectedSquare) {
                if (board.position()[s]) {
                    selectedSquare = s;
                    highlightSelected(s);
                }
            } else if (selectedSquare === s) {
                selectedSquare = null;
                removeHighlights();
            } else {
                var p = board.position();
                p[s] = p[selectedSquare];
                delete p[selectedSquare];
                board.position(p);
                playSound('move');
                selectedSquare = null;
                removeHighlights();
            }
        }

        function movimientoComun(s, cb) {
            if (!selectedSquare) {
                var p = game.get(s);
                if (p && p.color === game.turn()) {
                    selectedSquare = s;
                    highlightSelected(s);
                    showPossibleMoves(s);
                }
                return;
            }
            var m = game.move({
                from: selectedSquare,
                to: s,
                promotion: 'q'
            });
            if (m === null) {
                var p = game.get(s);
                if (p && p.color === game.turn()) {
                    selectedSquare = s;
                    highlightSelected(s);
                    showPossibleMoves(s);
                } else {
                    selectedSquare = null;
                    removeHighlights();
                }
            } else {
                $('#ai-assistant-container').fadeOut(200);
                board.position(game.fen());
                removeHighlights();
                highlightLastMove(m);
                playSound(m.captured ? 'capture' : 'move');
                selectedSquare = null;
                if (cb) cb(m);
            }
        }

        function removeHighlights() {
            $('.square-55d63').removeClass('highlight-selected highlight-hint highlight-capture highlight-move');
        }

        function highlightSelected(s) {
            $('.square-' + s).addClass('highlight-selected');
        }

        function highlightLastMove(m) {
            $('.square-55d63').removeClass('highlight-move');
            if (m) {
                $('.square-' + m.from).addClass('highlight-move');
                $('.square-' + m.to).addClass('highlight-move');
            }
        }

        function showPossibleMoves(s) {
            var m = game.moves({
                square: s,
                verbose: true
            });
            m.forEach(x => $('.square-' + x.to).addClass(x.flags.includes('c') ? 'highlight-capture' : 'highlight-hint'));
        }

        function iniciarBot() {
            ocultarTodo();
            currentMode = 'bot';
            $('#game-controls').show();
            $('#bot-header').show();
            $('#board-wrapper').show();
            game = new Chess();
            configurarTablero('start');
            
            if (localStorage.getItem('jlChessPremiumAI') === 'true') {
                $('#bot-ai-hint-btn').show();
            } else {
                $('#bot-ai-hint-btn').hide();
            }
        }

        // --- PREMIUM AI COACH CLIENT FUNCTIONS ---
        function generarCodigoPremium() {
            if (socket) socket.emit('createPremiumCode');
        }

        function clickAICoach() {
            const isPremium = localStorage.getItem('jlChessPremiumAI') === 'true';
            if (isPremium) {
                Swal.fire({
                    title: 'Entrenador IA Activo',
                    text: 'El Entrenador IA ya está activado. Ve a la sección "🤖 VS BOT" para jugar contra la computadora y solicitar sugerencias en tiempo real.',
                    icon: 'success'
                });
            } else {
                Swal.fire({
                    title: 'Activar Entrenador IA',
                    text: 'Ingresa el código premium de 4 dígitos proporcionado por tu profesor:',
                    input: 'text',
                    inputPlaceholder: 'Código de 4 dígitos',
                    showCancelButton: true,
                    confirmButtonText: 'Activar',
                    cancelButtonText: 'Cancelar',
                    inputValidator: (value) => {
                        if (!value || value.trim().length !== 4) {
                            return 'Debes ingresar un código de 4 dígitos';
                        }
                    }
                }).then((result) => {
                    if (result.isConfirmed) {
                        const code = result.value.trim();
                        if (socket) socket.emit('verifyPremiumCode', code);
                    }
                });
            }
        }

        function updateStudentMenuAIButton() {
            const isPremium = localStorage.getItem('jlChessPremiumAI') === 'true';
            if (isPremium) {
                $('#btn-ai-coach').text('🤖 ENTRENADOR IA (ACTIVO)');
                $('#btn-ai-coach').css('background', '#27ae60'); // Green
            } else {
                $('#btn-ai-coach').text('🤖 ENTRENADOR IA (PREMIUM)');
                $('#btn-ai-coach').css('background', '#8e44ad'); // Purple
            }
        }

        function solicitarIA() {
            if (typeof game === 'undefined' || game.game_over()) return;
            
            // Mostrar asistente pensando
            $('#ai-assistant-text').html('<i>Analizando posición...</i>');
            $('#ai-assistant-container').css({ display: 'flex' }).hide().fadeIn(300);

            setTimeout(() => {
                try {
                    // Crear copia del juego para analizar
                    var tempGame = new Chess(game.fen());
                    
                    // Usar minimax a profundidad 4 para mejor análisis
                    var possibleMoves = tempGame.moves({ verbose: true });
                    var bestMove = null;
                    var bestValue = -99999;

                    for (var i = 0; i < possibleMoves.length; i++) {
                        tempGame.move(possibleMoves[i].san);
                        // Evaluar desde la perspectiva del oponente (negro), negar para obtener valor para blancas
                        var boardValue = -minimax(tempGame, 3, -10000, 10000, true);
                        tempGame.undo();
                        if (boardValue > bestValue) {
                            bestValue = boardValue;
                            bestMove = possibleMoves[i];
                        }
                    }

                    if (bestMove) {
                        $('#ai-assistant-text').html(`Sugiero mover:<br><b style="font-size:1.4rem; color:#8e44ad;">${bestMove.from} ➔ ${bestMove.to}</b><br><span style="font-size:0.9rem; color:#7f8c8d;">(${bestMove.san})</span>`);

                        // Resaltar la jugada en el tablero
                        removeHighlights();
                        $('#board .square-' + bestMove.from).addClass('highlight-move');
                        $('#board .square-' + bestMove.to).addClass('highlight-move');
                        
                        // Ocultar asistente después de 5 segundos
                        setTimeout(() => {
                            $('#ai-assistant-container').fadeOut(500);
                        }, 5000);
                    } else {
                        $('#ai-assistant-text').text('No encontré jugadas útiles.');
                        setTimeout(() => {
                            $('#ai-assistant-container').fadeOut(500);
                        }, 3000);
                    }
                } catch (err) {
                    console.error('Error IA:', err);
                    $('#ai-assistant-text').text('Ocurrió un error al analizar.');
                    setTimeout(() => {
                        $('#ai-assistant-container').fadeOut(500);
                    }, 3000);
                }
            }, 500);
        }

        
        var botDifficulty = 1; // 0=Random, 1=Medium, 2=Hard

        function handleBotClick(s) {
            if (game.game_over() || game.turn() === 'b') return;
            
            movimientoComun(s, () => {
                verificarArbitro(); // Check if User mated Bot
                
                if (!game.game_over()) {
                    $('#status-display').text("Pensando...");
                    
                    botTimeout = setTimeout(() => {
                        var bestMove = null;
                        
                        if (botDifficulty === 0) {
                            // Random
                            var m = game.moves();
                            bestMove = m[Math.floor(Math.random() * m.length)];
                        } else {
                            // Minimax
                            var depth = (botDifficulty === 1) ? 2 : 3;
                            bestMove = getBestMove(game, depth);
                        }

                        if (bestMove) {
                            game.move(bestMove);
                            board.position(game.fen());
                            playSound('move');
                            verificarArbitro(); // Check if Bot mated User
                        }
                        $('#status-display').text("");
                    }, 500);
                }
            });
        }

        // --- MINIMAX AI ---
        function getBestMove(game, depth) {
            var possibleMoves = game.moves();
            var bestMove = null;
            var bestValue = -9999;

            // Simple optimization: Shuffle to vary play
            possibleMoves.sort(() => Math.random() - 0.5);

            for (var i = 0; i < possibleMoves.length; i++) {
                game.move(possibleMoves[i]);
                var boardValue = minimax(game, depth - 1, -10000, 10000, false);
                game.undo();
                if (boardValue > bestValue) {
                    bestValue = boardValue;
                    bestMove = possibleMoves[i];
                }
            }
            return bestMove;
        }

        function minimax(game, depth, alpha, beta, isMaximizing) {
            if (depth === 0 || game.game_over()) {
                return -evaluateBoard(game.board());
            }

            var possibleMoves = game.moves();
            if (isMaximizing) {
                var bestMove = -9999;
                for (var i = 0; i < possibleMoves.length; i++) {
                    game.move(possibleMoves[i]);
                    bestMove = Math.max(bestMove, minimax(game, depth - 1, alpha, beta, !isMaximizing));
                    game.undo();
                    alpha = Math.max(alpha, bestMove);
                    if (beta <= alpha) return bestMove;
                }
                return bestMove;
            } else {
                var bestMove = 9999;
                for (var i = 0; i < possibleMoves.length; i++) {
                    game.move(possibleMoves[i]);
                    bestMove = Math.min(bestMove, minimax(game, depth - 1, alpha, beta, !isMaximizing));
                    game.undo();
                    beta = Math.min(beta, bestMove);
                    if (beta <= alpha) return bestMove;
                }
                return bestMove;
            }
        }

        function evaluateBoard(board) {
            var totalEvaluation = 0;
            for (var i = 0; i < 8; i++) {
                for (var j = 0; j < 8; j++) {
                    totalEvaluation = totalEvaluation + getPieceValue(board[i][j]);
                }
            }
            return totalEvaluation;
        }

        function getPieceValue(piece) {
            if (piece === null) return 0;
            var getAbsoluteValue = function (piece) {
                if (piece.type === 'p') return 10;
                if (piece.type === 'r') return 50;
                if (piece.type === 'n') return 30;
                if (piece.type === 'b') return 30;
                if (piece.type === 'q') return 90;
                if (piece.type === 'k') return 900;
                return 0;
            };
            var absoluteValue = getAbsoluteValue(piece);
            return piece.color === 'w' ? absoluteValue : -absoluteValue;
        }
function iniciarRetos() {
            currentPuzzleIndex = 0;
            cargarReto(currentPuzzleIndex);
        }

        function cargarReto(index) {
            ocultarTodo();
            currentMode = 'puzzle';
            $('#game-controls').show();
            $('#puzzle-header').show();
            $('#board-wrapper').show();
            if (index >= retosDB.length) {
                userProfile.premiumUnlocked = true;
                userProfile.skin = 'artist';
                saveProfile();
                Swal.fire({
                    title: '¡Misión Cumplida!',
                    text: '¡Has desbloqueado el estilo PREMIUM! 🎨',
                    icon: 'success'
                }).then(() => volverMenu());
                return;
            }
            var reto = retosDB[index];
            game = new Chess(reto.fen);
            configurarTablero(reto.fen, (game.turn() === 'w' ? 'white' : 'black'));
            $('#puzzle-title').text("Reto " + (index + 1) + ": " + reto.title);
            $('#puzzle-desc').text(game.turn() === 'w' ? "Blancas juegan y ganan" : "Negras juegan y ganan");
            puzzleMistakes = 0;
        }

        function handlePuzzleClick(s) {
            if (!selectedSquare) {
                var p = game.get(s);
                if (p && p.color === game.turn()) {
                    selectedSquare = s;
                    highlightSelected(s);
                }
                return;
            }
            var reto = retosDB[currentPuzzleIndex];
            if (selectedSquare === reto.from && s === reto.to) {
                playSound('win');
                game.move({
                    from: selectedSquare,
                    to: s,
                    promotion: 'q'
                });
                board.position(game.fen());
                if (userProfile.stars <= currentPuzzleIndex) {
                    userProfile.stars++;
                    userProfile.elo += 15;
                    saveProfile();
                }
                Swal.fire({
                    title: '¡Correcto!',
                    icon: 'success',
                    timer: 1000,
                    showConfirmButton: false
                }).then(() => {
                    currentPuzzleIndex++;
                    cargarReto(currentPuzzleIndex);
                });
            } else {
                playSound('error');
                selectedSquare = null;
                removeHighlights();
                puzzleMistakes++;
                if (puzzleMistakes >= 3) Swal.fire({
                    title: '💡 Pista',
                    text: reto.hint,
                    icon: 'question'
                });
                else {
                    const Toast = Swal.mixin({
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 1000
                    });
                    Toast.fire({
                        icon: 'error',
                        title: 'Incorrecto'
                    });
                }
            }
        }

        function entrarAcademia() {
            ocultarTodo();
            $('#academy-main-menu').show();
            var menu = $('#academy-main-menu');
            menu.empty();
            menu.append('<h3>🎓 Academia de Ajedrez</h3><div class="academy-menu">' +
                '<button class="academy-btn btn-blue" onclick="cargarCategoria(\'piezas\')"><span>♟️</span>Piezas</button>' +
                '<button class="academy-btn btn-green" onclick="cargarCategoria(\'aperturas\')"><span>📖</span>Aperturas</button>' +
                '<button class="academy-btn btn-red" onclick="cargarCategoria(\'mates\')"><span>⚔️</span>Mates</button>' +
                '<button class="academy-btn btn-purple" onclick="cargarCategoria(\'finales\')"><span>🏁</span>Finales</button>' +
                '</div><button class="btn-red" onclick="volverMenu()">Volver</button>');
        }

        function cargarCategoria(cat) {
            currentCategory = cat;
            ocultarTodo();
            $('#academy-main-menu').show();
            var menu = $('#academy-main-menu');
            menu.empty();
            var db = (cat === 'piezas' ? piezasDB : (cat === 'aperturas' ? aperturasDB : (cat === 'mates' ? matesDB : finalesDB)));
            var html = `<h3>${cat.toUpperCase()}</h3><div class="academy-menu">`;
            for (var key in db) {
                var item = db[key];
                var name = item.name || key.toUpperCase();
                html += `<button class="academy-btn btn-teal" onclick="cargarLeccion('${key}')"><span>🎓</span>${name}</button>`;
            }
            html += '</div><button class="btn-yellow" onclick="entrarAcademia()">🔙 Atrás</button>';
            menu.html(html);
        }

        function cargarLeccion(id) {
            currentLessonId = id;
            ocultarTodo();
            $('#game-controls').show();
            $('#academy-header').show();
            $('#board-wrapper').show();
            $('#academy-controls').show();
            var db = (currentCategory === 'piezas' ? piezasDB : (currentCategory === 'aperturas' ? aperturasDB : (currentCategory === 'mates' ? matesDB : finalesDB)));
            var leccion = db[id];
            $('#academy-title').text(leccion.name || (leccion.t ? leccion.t.split(':')[0] : "Lección"));
            var fen = leccion.pos || leccion.fen || 'start';
            if (fen === 'start') {
                game = new Chess();
            } else {
                game = new Chess(fen);
            }
            configurarTablero(fen);
            detenerAnimacion();
            var texts = leccion.texts || (leccion.t ? [leccion.t] : ["Observa."]);
            var moves = leccion.moves || [];
            ejecutarSecuenciaDidactica(texts, moves, leccion.h);
        }

        function ejecutarSecuenciaDidactica(texts, moves, highlights) {
            var step = 0;

            function nextStep() {
                if (step >= texts.length && (!moves || step >= moves.length)) return;
                if (texts[step]) {
                    $('#academy-text').text(texts[step]);
                    hablar(texts[step]);
                }
                if (moves && moves[step]) {
                    setTimeout(() => {
                        game.move(moves[step]);
                        board.position(game.fen());
                        playSound('move');
                        step++;
                        academyTimeouts.push(setTimeout(nextStep, 2500));
                    }, 1000);
                } else if (highlights) {
                    setTimeout(() => {
                        removeHighlights();
                        highlights.forEach(sq => $('.square-' + sq).addClass('highlight-hint'));
                    }, 350);
                }
            }
            nextStep();
        }

        function volverAlPanelProfe() {
            ocultarTodo();
            var code = localStorage.getItem('activeTournament');
            if (code) {
                // Recuperar estado del torneo sin recargar todo si es posible, 
                // o simplemente mostrar la vista de lobby
                $('#teacher-lobby-view').show();
                $('#chat-area').show();
                // socket.emit('recoverTournament', code); // Opcional: refrescar datos
            } else {
                $('#teacher-dashboard-view').show();
                $('#teacher-premium-btn').show();
            }
        }

        function repetirLeccion() {
            cargarLeccion(currentLessonId);
        }

        function resetMainMenu() {
            entrarAcademia();
        }

        function abrirBiblioteca() {
            ocultarTodo();
            $('#library-view').show();
            cargarListaLibros();
        }

        function cargarListaLibros() {
            $('#library-list').html('<p>Cargando libros...</p>');
            $.get('/api/libros', function(files) {
                var list = $('#library-list');
                list.empty();
                if (files.length === 0) {
                    list.append('<p>No hay libros disponibles.</p>');
                    return;
                }
                files.forEach(function(f) {
                    var btn = $('<a target="_blank" style="text-decoration:none; display:block; background:rgba(0,0,0,0.2); padding:10px; border-radius:5px; border:1px solid #3498db; color:#ecf0f1;"></a>');
                    btn.attr('href', '/libros/' + encodeURIComponent(f));
                    btn.text('📄 ' + f.replace('.pdf', ''));
                    list.append(btn);
                });
            }).fail(function() {
                $('#library-list').html('<p style="color:red;">Error al cargar la biblioteca.</p>');
            });
        }

        

        function hablar(t) {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                var u = new SpeechSynthesisUtterance(t);
                u.lang = 'es-ES';
                window.speechSynthesis.speak(u);
            }
        }

        if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

        // --- TV MODE LOGIC (PHASE 4) ---
        var tvAutoSwitch = true;
        var currentTvRoom = "";

        // --- TV MODE FUNCTIONS ---
        // (Button removed per user request)

        function initTvMode(code, matches, standings) {
            ocultarTodo();
            $('#tv-dashboard-view').show();
            $('#tv-tournament-code').text(code);

            // Configurar tablero para TV
            var config = {
                position: 'start',
                pieceTheme: getPieceImg,
                showNotation: true
            };
            if (board && board.destroy) board.destroy(); // Ensure destroy exists
            board = Chessboard('tv-board-container', config);
            $(window).resize(board.resize);

            if (standings) updateTvStandings(standings);
            if (matches) renderTvMatches(matches);

            // Unirse como espectador silencioso
            socket.emit('join', { room: 'lobby_' + code });
            // Si hay matches, el renderTvMatches inicial ya intentará espectar uno
        }

        function updateTvStandings(players) {
            const tbody = $('#tv-standings-body');
            tbody.empty();
            // Mostrar Top 10
            players.slice(0, 10).forEach((p, index) => {
                let icon = "";
                if (index === 0) icon = "🥇";
                else if (index === 1) icon = "🥈";
                else if (index === 2) icon = "🥉";

                const row = `
            <tr style="${index < 3 ? 'background:rgba(241, 196, 15, 0.1);' : ''}">
                <td>${icon || (index + 1)}</td>
                <td>${renderAvatar(p.avatar)} ${p.name}</td>
                <td style="font-weight:bold; color:#f1c40f;">${p.score}</td>
            </tr>
        `;
                tbody.append(row);
            });
        }

        function renderTvMatches(matches) {
            const list = $('#tv-matches-list');
            list.empty();

            const active = matches.filter(m => m.status === 'playing');

            if (active.length === 0) {
                list.html('<div style="padding:10px; color:#95a5a6; text-align:center;">Esperando partidas...</div>');
                return;
            }

            // Smart Auto-Select (Solo si no se ha seleccionado manualmente o si la sala actual ya terminó)
            if (tvAutoSwitch && active.length > 0) {
                let topMatch = null;
                if (currentStandings.length > 0) {
                    const leaderId = currentStandings[0].id;
                    topMatch = active.find(m => m.whiteId === leaderId || m.blackId === leaderId);
                }
                if (!topMatch) topMatch = active[0];

                if (currentTvRoom !== topMatch.room) {
                    spectateTvMatch(topMatch.room);
                }
            }

            active.forEach(m => {
                const isSelected = (m.room === currentTvRoom);
                const item = `
            <div class="match-item" onclick="forceTvMatch('${m.room}')" style="cursor:pointer; border-left:4px solid ${isSelected ? '#f1c40f' : 'transparent'}; background:${isSelected ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.2)'};">
                <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                    <span>⚪ ${m.white}</span>
                    <span>vs</span>
                    <span>⚫ ${m.black}</span>
                </div>
            </div>
        `;
                list.append(item);
            });
        }

        function spectateTvMatch(room) {
            if (currentTvRoom === room) return;

            // Salir de la anterior
            if (currentTvRoom) socket.emit('leave', currentTvRoom);

            currentTvRoom = room;
            socket.emit('spectateMatch', room);

            // Actualizar nombres en UI
            const match = currentMatches.find(m => m.room === room);
            if (match) {
                $('#tv-white-name').text("⚪ " + match.white);
                $('#tv-black-name').text("⚫ " + match.black);
                $('#tv-match-status').text("En vivo");
            }
        }

        function forceTvMatch(room) {
            tvAutoSwitch = false;
            spectateTvMatch(room);
            renderTvMatches(currentMatches);
        }

