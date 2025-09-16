const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// CORS設定
app.use(cors({
    origin: ["https://claude.ai", "http://localhost:3000", "https://skillwar-client.onrender.com"],
    methods: ["GET", "POST"],
    credentials: true
}));

const io = socketIo(server, {
    cors: {
        origin: ["https://claude.ai", "http://localhost:3000", "https://skillwar-client.onrender.com"],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

app.use(express.json());
app.use(express.static('public'));

// 静的ファイルの提供
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head><title>Skill War Online Server</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1>🎮 Skill War Online Server</h1>
                <p>サーバーは正常に動作中です！</p>
                <p>WebSocket URL: <strong>wss://${req.get('host')}</strong></p>
                <p>接続済みクライアント: <span id="clients">${io.sockets.sockets.size}</span></p>
                <p>アクティブルーム: <span id="rooms">${Object.keys(gameRooms).length}</span></p>
                <script>
                    setInterval(() => {
                        fetch('/api/status').then(r => r.json()).then(data => {
                            document.getElementById('clients').textContent = data.clients;
                            document.getElementById('rooms').textContent = data.rooms;
                        });
                    }, 5000);
                </script>
            </body>
        </html>
    `);
});

app.get('/api/status', (req, res) => {
    res.json({
        clients: io.sockets.sockets.size,
        rooms: Object.keys(gameRooms).length,
        uptime: process.uptime()
    });
});

// ゲーム状態管理
let gameRooms = {};

// 属性定数
const ELEMENTS = {
    FIRE: 'fire',
    WATER: 'water',
    WIND: 'wind',
    EARTH: 'earth',
    THUNDER: 'thunder',
    ICE: 'ice'
};

const ELEMENT_NAMES = {
    [ELEMENTS.FIRE]: '炎',
    [ELEMENTS.WATER]: '水',
    [ELEMENTS.WIND]: '風',
    [ELEMENTS.EARTH]: '土',
    [ELEMENTS.THUNDER]: '雷',
    [ELEMENTS.ICE]: '氷'
};

// 属性相性システム
const ELEMENT_REACTIONS = {
    [`${ELEMENTS.FIRE},${ELEMENTS.WATER}`]: { name: '蒸発', effect: 'steam' },
    [`${ELEMENTS.WATER},${ELEMENTS.FIRE}`]: { name: '蒸発', effect: 'steam' },
    [`${ELEMENTS.THUNDER},${ELEMENTS.WATER}`]: { name: '感電', effect: 'shock' },
    [`${ELEMENTS.WATER},${ELEMENTS.THUNDER}`]: { name: '感電', effect: 'shock' },
    [`${ELEMENTS.FIRE},${ELEMENTS.WIND}`]: { name: '燃焼', effect: 'burn' },
    [`${ELEMENTS.WIND},${ELEMENTS.FIRE}`]: { name: '燃焼', effect: 'burn' },
    [`${ELEMENTS.THUNDER},${ELEMENTS.FIRE}`]: { name: '過剰反応', effect: 'overreaction' },
    [`${ELEMENTS.FIRE},${ELEMENTS.THUNDER}`]: { name: '過剰反応', effect: 'overreaction' },
    [`${ELEMENTS.ICE},${ELEMENTS.FIRE}`]: { name: '溶解', effect: 'melt' },
    [`${ELEMENTS.FIRE},${ELEMENTS.ICE}`]: { name: '溶解', effect: 'melt' },
    [`${ELEMENTS.WATER},${ELEMENTS.EARTH}`]: { name: '溶解', effect: 'dissolve' },
    [`${ELEMENTS.EARTH},${ELEMENTS.WATER}`]: { name: '溶解', effect: 'dissolve' },
    [`${ELEMENTS.EARTH},${ELEMENTS.WIND}`]: { name: '風化', effect: 'erosion' },
    [`${ELEMENTS.WIND},${ELEMENTS.EARTH}`]: { name: '風化', effect: 'erosion' }
};

// カードデータベース
const CARD_DATABASE = [
    // 炎属性カード
    { id: 1, name: '火の玉', element: ELEMENTS.FIRE, damage: 2, description: '攻撃力2' },
    { id: 2, name: '業火', element: ELEMENTS.FIRE, damage: 3, description: '攻撃力3' },
    { id: 3, name: '火炎放射', element: ELEMENTS.FIRE, damage: 4, description: '攻撃力4' },
    { id: 4, name: '爆炎', element: ELEMENTS.FIRE, damage: 5, description: '攻撃力5' },
    { id: 5, name: '炎の壁', element: ELEMENTS.FIRE, damage: 1, description: '攻撃力1' },
    
    // 水属性カード
    { id: 6, name: '水流', element: ELEMENTS.WATER, damage: 2, description: '攻撃力2' },
    { id: 7, name: '高圧放水', element: ELEMENTS.WATER, damage: 3, description: '攻撃力3' },
    { id: 8, name: '津波', element: ELEMENTS.WATER, damage: 4, description: '攻撃力4' },
    { id: 9, name: '水の癒し', element: ELEMENTS.WATER, damage: 0, description: '回復2' },
    { id: 10, name: '凍結', element: ELEMENTS.WATER, damage: 1, description: '攻撃力1' },
    
    // 風属性カード
    { id: 11, name: '突風', element: ELEMENTS.WIND, damage: 2, description: '攻撃力2' },
    { id: 12, name: '竜巻', element: ELEMENTS.WIND, damage: 3, description: '攻撃力3' },
    { id: 13, name: '嵐', element: ELEMENTS.WIND, damage: 4, description: '攻撃力4' },
    { id: 14, name: '疾風', element: ELEMENTS.WIND, damage: 1, description: '攻撃+ドロー' },
    { id: 15, name: '風の加護', element: ELEMENTS.WIND, damage: 0, description: '攻撃力0' },
    
    // 土属性カード
    { id: 16, name: '岩石投げ', element: ELEMENTS.EARTH, damage: 2, description: '攻撃力2' },
    { id: 17, name: '地震', element: ELEMENTS.EARTH, damage: 3, description: '攻撃力3' },
    { id: 18, name: '落石', element: ELEMENTS.EARTH, damage: 4, description: '攻撃力4' },
    { id: 19, name: '土の壁', element: ELEMENTS.EARTH, damage: 0, description: '攻撃力0' },
    { id: 20, name: '砂嵐', element: ELEMENTS.EARTH, damage: 1, description: '攻撃力1' },
    
    // 雷属性カード
    { id: 21, name: '雷撃', element: ELEMENTS.THUNDER, damage: 2, description: '攻撃力2' },
    { id: 22, name: '落雷', element: ELEMENTS.THUNDER, damage: 4, description: '攻撃力4' },
    { id: 23, name: '稲妻', element: ELEMENTS.THUNDER, damage: 3, description: '攻撃力3' },
    { id: 24, name: '電撃網', element: ELEMENTS.THUNDER, damage: 1, description: '攻撃力1' },
    { id: 25, name: '充電', element: ELEMENTS.THUNDER, damage: 0, description: '攻撃力0' },
    
    // 氷属性カード
    { id: 26, name: '氷の矢', element: ELEMENTS.ICE, damage: 2, description: '攻撃力2' },
    { id: 27, name: '吹雪', element: ELEMENTS.ICE, damage: 3, description: '攻撃力3' },
    { id: 28, name: '氷河', element: ELEMENTS.ICE, damage: 4, description: '攻撃力4' },
    { id: 29, name: '霜', element: ELEMENTS.ICE, damage: 1, description: '攻撃力1' },
    { id: 30, name: '氷の盾', element: ELEMENTS.ICE, damage: 0, description: '攻撃力0' }
];

// ユーティリティ関数
function generateRoomId() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function generateInitialHand() {
    const hand = [];
    for (let i = 0; i < 5; i++) {
        const randomCard = CARD_DATABASE[Math.floor(Math.random() * CARD_DATABASE.length)];
        hand.push({...randomCard, instanceId: Math.random().toString(36).substr(2, 9)});
    }
    return hand;
}

function drawRandomCard() {
    const randomCard = CARD_DATABASE[Math.floor(Math.random() * CARD_DATABASE.length)];
    return {...randomCard, instanceId: Math.random().toString(36).substr(2, 9)};
}

// ゲームロジック関数
function applyStatusEffect(player, element) {
    // 既存の同じ属性効果を除去
    player.statusEffects = player.statusEffects.filter(effect => effect.element !== element);
    
    // 新しい効果を追加
    player.statusEffects.push({
        element: element,
        duration: 2
    });
    
    // 最大2つまでの制限
    if (player.statusEffects.length > 2) {
        player.statusEffects.shift();
    }
    
    return checkElementalReactions(player);
}

function checkElementalReactions(player) {
    if (player.statusEffects.length < 2) return null;
    
    const elements = player.statusEffects.map(effect => effect.element);
    const reactionKey = elements.join(',');
    const reverseKey = [...elements].reverse().join(',');
    
    const reaction = ELEMENT_REACTIONS[reactionKey] || ELEMENT_REACTIONS[reverseKey];
    
    if (reaction) {
        // 属性状態をクリア
        player.statusEffects = [];
        return reaction;
    }
    
    return null;
}

function applyReactionEffect(player, effect) {
    const logs = [];
    
    switch (effect) {
        case 'steam':
        case 'burn':
            player.hp = Math.max(0, player.hp - 1);
            if (player.hand.length > 0) {
                const randomIndex = Math.floor(Math.random() * player.hand.length);
                player.hand.splice(randomIndex, 1);
                logs.push(`${player.name}の手札が1枚消滅！`);
            }
            break;
        case 'shock':
        case 'melt':
        case 'dissolve':
            player.hp = Math.max(0, player.hp - 1);
            player.stunned = true;
            logs.push(`${player.name}は次のターンカードを使えません！`);
            break;
        case 'overreaction':
            player.hp = Math.max(0, player.hp - 2);
            logs.push(`${player.name}は過剰反応により2ダメージ！`);
            break;
        case 'erosion':
            for (let i = 0; i < 3 && player.hand.length > 0; i++) {
                const randomIndex = Math.floor(Math.random() * player.hand.length);
                player.hand.splice(randomIndex, 1);
            }
            logs.push(`${player.name}の手札が3枚消滅！`);
            break;
    }
    
    return logs;
}

// Socket.IO 接続処理
io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    // 部屋一覧取得
    socket.on('getRooms', () => {
        const rooms = Object.values(gameRooms)
            .filter(room => !room.isStarted && room.players.length < room.maxPlayers)
            .map(room => ({
                id: room.id,
                name: room.name,
                players: room.players.length,
                maxPlayers: room.maxPlayers
            }));
        socket.emit('roomsList', rooms);
    });

    // 部屋作成
    socket.on('createRoom', (data) => {
        try {
            const roomId = generateRoomId();
            const room = {
                id: roomId,
                name: data.roomName,
                maxPlayers: data.maxPlayers,
                players: [{...data.player, id: socket.id, index: 0}],
                isStarted: false,
                gameState: null,
                turnTimer: null
            };
            
            gameRooms[roomId] = room;
            socket.join(roomId);
            
            socket.emit('roomCreated', {
                room: room,
                player: {...data.player, id: socket.id}
            });
            
            console.log(`Room created: ${roomId} by ${socket.id}`);
        } catch (error) {
            socket.emit('error', { message: 'Failed to create room' });
        }
    });

    // 部屋参加
    socket.on('joinRoom', (data) => {
        try {
            const room = gameRooms[data.roomId];
            
            if (!room) {
                socket.emit('error', { message: 'Room not found' });
                return;
            }
            
            if (room.players.length >= room.maxPlayers) {
                socket.emit('error', { message: 'Room is full' });
                return;
            }
            
            if (room.isStarted) {
                socket.emit('error', { message: 'Game already started' });
                return;
            }
            
            const player = {
                ...data.player,
                id: socket.id,
                index: room.players.length
            };
            
            room.players.push(player);
            socket.join(data.roomId);
            
            socket.emit('roomJoined', { room, player });
            io.to(data.roomId).emit('roomUpdated', { room });
            
            console.log(`Player ${socket.id} joined room ${data.roomId}`);
        } catch (error) {
            socket.emit('error', { message: 'Failed to join room' });
        }
    });

    // 部屋退出
    socket.on('leaveRoom', (data) => {
        try {
            const room = gameRooms[data.roomId];
            if (!room) return;
            
            room.players = room.players.filter(p => p.id !== socket.id);
            socket.leave(data.roomId);
            
            if (room.players.length === 0) {
                if (room.turnTimer) clearTimeout(room.turnTimer);
                delete gameRooms[data.roomId];
                console.log(`Room ${data.roomId} deleted - no players`);
            } else {
                // 新しいホストを指定
                room.players[0].isHost = true;
                io.to(data.roomId).emit('roomUpdated', { room });
            }
        } catch (error) {
            console.error('Error leaving room:', error);
        }
    });

    // 準備状態切替
    socket.on('toggleReady', (data) => {
        try {
            const room = gameRooms[data.roomId];
            if (!room) return;
            
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.isReady = !player.isReady;
                io.to(data.roomId).emit('roomUpdated', { room });
            }
        } catch (error) {
            console.error('Error toggling ready:', error);
        }
    });

    // ゲーム開始
    socket.on('startGame', (data) => {
        try {
            const room = gameRooms[data.roomId];
            if (!room) {
                socket.emit('error', { message: 'Room not found' });
                return;
            }
            
            const host = room.players.find(p => p.isHost && p.id === socket.id);
            if (!host) {
                socket.emit('error', { message: 'Only host can start game' });
                return;
            }
            
            // 最小人数チェック（2人以上）
            if (room.players.length < 2) {
                socket.emit('error', { message: 'Need at least 2 players to start' });
                return;
            }
            
            // 準備完了チェック（ホスト以外が全員準備完了）
            const nonHostPlayers = room.players.filter(p => !p.isHost);
            const allNonHostReady = nonHostPlayers.every(p => p.isReady);
            
            console.log('Start game check:', {
                roomId: data.roomId,
                hostId: socket.id,
                totalPlayers: room.players.length,
                nonHostPlayers: nonHostPlayers.length,
                allNonHostReady: allNonHostReady,
                players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, isReady: p.isReady }))
            });
            
            if (nonHostPlayers.length > 0 && !allNonHostReady) {
                socket.emit('error', { message: 'All non-host players must be ready' });
                return;
            }
            
            // ゲーム状態初期化
            const gamePlayers = room.players.map((player, index) => ({
                ...player,
                hp: 10,
                maxHp: 10,
                hand: generateInitialHand(),
                statusEffects: [],
                isAlive: true,
                possessedBy: null,
                stunned: false
            }));
            
            room.isStarted = true;
            room.gameState = {
                players: gamePlayers,
                currentPlayerIndex: 0,
                turnNumber: 1,
                turnStartTime: Date.now()
            };
            
            io.to(data.roomId).emit('gameStarted', {
                players: gamePlayers,
                currentPlayerIndex: 0,
                turnNumber: 1
            });
            
            // ターンタイマー開始
            startTurnTimer(room, data.roomId);
            
            console.log(`Game started in room ${data.roomId} with ${room.players.length} players`);
        } catch (error) {
            console.error('Error starting game:', error);
            socket.emit('error', { message: 'Failed to start game' });
        }
    });

    // プレイヤーアクション
    socket.on('playerAction', (data) => {
        try {
            const room = gameRooms[data.roomId];
            if (!room || !room.isStarted) return;
            
            const gameState = room.gameState;
            const currentPlayer = gameState.players[gameState.currentPlayerIndex];
            
            if (currentPlayer.id !== socket.id) {
                socket.emit('error', { message: 'Not your turn' });
                return;
            }
            
            if (!currentPlayer.isAlive) {
                socket.emit('error', { message: 'Dead players cannot act' });
                return;
            }
            
            processPlayerAction(room, data.roomId, data.action);
            
        } catch (error) {
            console.error('Error processing player action:', error);
            socket.emit('error', { message: 'Failed to process action' });
        }
    });

    // 切断処理
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        
        // 全部屋から該当プレイヤーを削除
        Object.keys(gameRooms).forEach(roomId => {
            const room = gameRooms[roomId];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                
                if (room.players.length === 0) {
                    if (room.turnTimer) clearTimeout(room.turnTimer);
                    delete gameRooms[roomId];
                    console.log(`Room ${roomId} deleted - no players after disconnect`);
                } else {
                    // インデックス再調整
                    room.players.forEach((p, i) => p.index = i);
                    // 新しいホスト指定
                    room.players[0].isHost = true;
                    io.to(roomId).emit('roomUpdated', { room });
                }
            }
        });
    });
});

// ターンタイマー
function startTurnTimer(room, roomId) {
    if (room.turnTimer) clearTimeout(room.turnTimer);
    
    room.turnTimer = setTimeout(() => {
        const gameState = room.gameState;
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        
        if (currentPlayer.isAlive) {
            // 時間切れで強制的にカードドロー
            processPlayerAction(room, roomId, { type: 'drawCard' });
        } else {
            nextTurn(room, roomId);
        }
    }, 30000); // 30秒
}

// プレイヤーアクション処理
function processPlayerAction(room, roomId, action) {
    const gameState = room.gameState;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const logs = [];
    
    if (action.type === 'drawCard') {
        const newCard = drawRandomCard();
        currentPlayer.hand.push(newCard);
        logs.push(`${currentPlayer.name}がカードを1枚引きました`);
        
    } else if (action.type === 'useCard') {
        const cardIndex = currentPlayer.hand.findIndex(c => c.instanceId === action.card.instanceId);
        if (cardIndex === -1) {
            return;
        }
        
        const target = gameState.players[action.targetIndex];
        if (!target || !target.isAlive) {
            return;
        }
        
        // カードを手札から削除
        currentPlayer.hand.splice(cardIndex, 1);
        
        // ダメージ適用
        if (action.card.damage > 0) {
            target.hp = Math.max(0, target.hp - action.card.damage);
            logs.push(`${currentPlayer.name}が${target.name}に${action.card.name}を使用！${action.card.damage}ダメージ`);
        }
        
        // 特殊効果処理
        const effectLogs = processCardEffects(action.card, target, currentPlayer);
        logs.push(...effectLogs);
        
        // 属性効果適用
        if (action.card.element) {
            const reaction = applyStatusEffect(target, action.card.element);
            if (reaction) {
                logs.push(`${target.name}に${reaction.name}が発生！`);
                const reactionLogs = applyReactionEffect(target, reaction.effect);
                logs.push(...reactionLogs);
            }
        }
        
        // HP0チェック
        if (target.hp <= 0 && target.isAlive) {
            target.isAlive = false;
            logs.push(`${target.name}が倒れました！`);
            
            // ゲーム終了チェック
            const alivePlayers = gameState.players.filter(p => p.isAlive);
            if (alivePlayers.length <= 1) {
                endGame(room, roomId);
                return;
            }
        }
    }
    
    // アクション結果を全員に送信
    io.to(roomId).emit('actionPerformed', {
        playerId: currentPlayer.id,
        action: action,
        logs: logs,
        gameState: gameState
    });
    
    // 次のターンへ
    nextTurn(room, roomId);
}

// カード特殊効果処理
function processCardEffects(card, target, attacker) {
    const logs = [];
    
    switch (card.name) {
        case '水の癒し':
            target.hp = Math.min(target.maxHp, target.hp + 2);
            logs.push(`${target.name}のHPが2回復！`);
            break;
        case '疾風':
            const newCard = drawRandomCard();
            attacker.hand.push(newCard);
            logs.push(`${attacker.name}が追加でカードを1枚引いた！`);
            break;
    }
    
    return logs;
}

// 次のターン処理
function nextTurn(room, roomId) {
    const gameState = room.gameState;
    
    // スタン状態解除
    gameState.players[gameState.currentPlayerIndex].stunned = false;
    
    // 状態効果持続時間減少
    gameState.players.forEach(player => {
        player.statusEffects = player.statusEffects.map(effect => ({
            ...effect,
            duration: effect.duration - 1
        })).filter(effect => effect.duration > 0);
    });
    
    // 次のプレイヤー
    let nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    
    // 生きているプレイヤーを探す
    let attempts = 0;
    while (!gameState.players[nextPlayerIndex].isAlive && attempts < gameState.players.length) {
        nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length;
        attempts++;
    }
    
    gameState.currentPlayerIndex = nextPlayerIndex;
    
    if (nextPlayerIndex === 0) {
        gameState.turnNumber++;
    }
    
    io.to(roomId).emit('turnChanged', {
        currentPlayerIndex: nextPlayerIndex,
        turnNumber: gameState.turnNumber
    });
    
    startTurnTimer(room, roomId);
}

// ゲーム終了処理
function endGame(room, roomId) {
    if (room.turnTimer) {
        clearTimeout(room.turnTimer);
        room.turnTimer = null;
    }
    
    const rankings = [...room.gameState.players].sort((a, b) => {
        if (a.isAlive && !b.isAlive) return -1;
        if (!a.isAlive && b.isAlive) return 1;
        return b.hp - a.hp;
    });
    
    io.to(roomId).emit('gameEnded', { rankings });
    
    // ゲーム状態リセット
    room.isStarted = false;
    room.gameState = null;
    room.players.forEach(player => {
        player.isReady = false;
    });
    
    console.log(`Game ended in room ${roomId}`);
}

// ヘルスチェック
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        rooms: Object.keys(gameRooms).length,
        connections: io.sockets.sockets.size
    });
});

// 定期的な部屋クリーンアップ
setInterval(() => {
    Object.keys(gameRooms).forEach(roomId => {
        const room = gameRooms[roomId];
        if (room.players.length === 0) {
            if (room.turnTimer) clearTimeout(room.turnTimer);
            delete gameRooms[roomId];
            console.log(`Cleaned up empty room: ${roomId}`);
        }
    });
}, 60000); // 1分ごと

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`🎮 Skill War Online Server running on port ${PORT}`);
    console.log(`🌐 Server URL: http://localhost:${PORT}`);
    console.log(`🔌 WebSocket URL: ws://localhost:${PORT}`);
});

// エラーハンドリング
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});