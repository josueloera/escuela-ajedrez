const fs = require('fs');

console.log("Applying Bot and Chat fixes to index.html...");

let html = fs.readFileSync('index.html', 'utf8');

// 1. FIX CSS (Chat Focus)
// Look for input, select { ... }
const cssRegex = /(input,\s*select\s*\{[^}]*background: #ecf0f1;[^}]*\})/g;
const cssReplacement = `input,
        select {
            display: block;
            width: 90%;
            margin: 10px auto;
            padding: 12px;
            border-radius: 8px;
            border: none;
            background: #ecf0f1;
            color: #2c3e50;
            font-size: 16px;
            touch-action: auto !important; /* Fix focus on mobile */
            user-select: text !important;
        }`;

if (cssRegex.test(html)) {
    html = html.replace(cssRegex, cssReplacement);
    console.log("CSS Fixed.");
} else {
    console.log("WARNING: CSS block not found.");
}

// 2. FIX BOT HEADER (Difficulty Selector)
const headerRegex = /<div id="bot-header"[\s\S]*?<\/div>/;
const headerReplacement = `<div id="bot-header" style="display: none;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0;">🤖 Bot</h3>
                    <select id="bot-diff" onchange="botDifficulty = parseInt(this.value)" style="width:auto; margin:0; padding:5px; font-size:12px;">
                        <option value="0">Fácil (Azar)</option>
                        <option value="1" selected>Medio</option>
                        <option value="2">Difícil</option>
                    </select>
                    <button onclick="iniciarBot()" style="width:auto; margin:0; padding:5px 10px;">🔄</button>
                    <button class="btn-red" onclick="volverMenu()" style="width:auto; padding:5px 10px; font-size:12px; margin:0 0 0 5px;">✖</button>
                </div>
            </div>`;

if (headerRegex.test(html)) {
    html = html.replace(headerRegex, headerReplacement);
    console.log("Bot Header Updated.");
} else {
    console.log("WARNING: Bot Header not found.");
}

// 3. FIX BOT LOGIC (Minimax + Checkmate Fix)
// Match function handleBotClick(s) { ... }
// We use a regex that captures the function body until the closing brace before "function iniciarRetos"
const botLogicRegex = /function handleBotClick\(s\) \{[\s\S]*?\}\s*(?=function iniciarRetos)/;

const botVar = `var botDifficulty = 1; // 0=Random, 1=Medium, 2=Hard`;

const newBotLogic = `
        ${botVar}

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
`;

if (botLogicRegex.test(html)) {
    html = html.replace(botLogicRegex, newBotLogic);
    console.log("Bot Logic Injected.");
} else {
    console.log("WARNING: Bot Logic function not found.");
}

fs.writeFileSync('index.html', html);
console.log("Done.");
