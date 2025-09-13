const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// CORS設定
const io = socketIo(server, {
    cors: {
        origin: ["http://localhost:3000", "https://your-frontend-domain.com"],
        methods: ["GET", "POST"],
        credentials: true
    }
});

// 静的ファイル提供
app.use(express.static('public'));
app.use(cors());

// ゲーム状態管理
let rooms = new Map();
let players = new Map();

// カードデータベース
const CARD_DATABASE = [
    { id: 1, name: '火の玉', element: 'fire', damage: 2, description: '基本的な炎攻撃' },
    { id: 2, name: '業火', element: 'fire', damage: 3, description: '強力な炎攻撃' },
    { id: 3, name: '水流', element: 'water', damage: 2, description: '基本的な水攻撃' },
    { id: 4, name: '高圧放水', element: 'water', damage: 3, description: '強力な水攻撃' },
    { id: 5, name: '突風', element: 'wind', damage: 2, description: '基本的な風攻撃' },
    { id: 6, name: '竜巻', element: 'wind', damage: 3, description: '手札シャッフル' },
    { id: 7, name: '岩石投げ', element: 'earth', damage: 2, description: '基本的な土攻撃' },
    { id: 8, name: '地震', element: 'earth', damage: 3, description: '全体攻撃' },
    { id: 9, name: '雷撃', element: 'thunder', damage: 2, description: '基本的な雷攻撃' },
    { id: 10, name: '落雷', element: 'thunder', damage: 4, description: '麻痺効果' },
    { id: 11, name: '氷の矢', element: 'ice', damage: 2, description: '基本的な氷攻撃' },
    { id: 12, name: '吹雪', element: 'ice', damage: 3, description: '行動速度低下' },
    // 追加のカード...
    ...Array.from({length: 88}, (_, i) => ({
        id: 13 + i,
        name: `スキルカード${13 + i}`,
        element: ['fire', 'water', 'wind', 'earth', 'thunder', 'ice'][i % 6],
        damage: Math.floor(Math.random() * 4) + 1,
        description: `特殊効果${13 + i}`
    }))
];

// ユーティリティ関数
function generateRoomId() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function generateInitialHand() {
    const hand = [];
    for (let i = 0; i < 5; i++) {
        const randomCard = CARD_DATABASE[Math.floor(Math.random() * CARD_DATABASE.length)];
        hand.push({
            ...randomCard,
            instanceId: Math.random().toString(36).substr(2, 9)
        });
    }
    return hand;
}

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Socket.IO接続処理
io.on('connection', (socket) => {
    console.log(`プレイヤー接続: ${socket.id}`);
    
    // プレイヤー情報を登録
    players.set(socket.id, {
        id: socket.id,
        currentRoom: null,
        isHost: false
    });

    // 部屋作成
    socket.on('createRoom', (data) => {
        console.log('部屋作成:', data);
        
        const roomId = generateRoomId();
        const player = {
            ...data.player,
            id: socket.id,
            isHost: true,
            index: 0
        };
        
        const room = {
            id: roomId,
            name: data.roomName,
            maxPlayers: data.maxPlayers,
            players: [player],
            isStarted: false,
            gameState: null
        };
        
        rooms.set(roomId, room);
        players.get(socket.id).currentRoom = roomId;
        
        socket.join(roomId);
        socket.emit('roomCreated', { room, player });
        
        // 部屋リストを更新
        io.emit('roomsList', Array.from(rooms.values()).map(r => ({
            id: r.id,
            name: r.name,
            players: r.players.length,
            maxPlayers: r.maxPlayers
        })));
    });

    // 部屋参加
    socket.on('joinRoom', (data) => {
        console.log('部屋参加:', data);
        
        const room = rooms.get(data.roomId);
        if (!room) {
            socket.emit('error', { message: '部屋が見つかりません' });
            return;
        }
        
        if (room.players.length >= room.maxPlayers) {
            socket.emit('error', { message: '部屋が満室です' });
            return;
        }
        
        const player = {
            ...data.player,
            id: socket.id,
            isHost: false,
            index: room.players.length
        };
        
        room.players.push(player);
        players.get(socket.id).currentRoom = data.roomId;
        
        socket.join(data.roomId);
        io.to(data.roomId).emit('roomJoined', { room, player });
        
        // 既存プレイヤーに部屋更新を通知
        io.to(data.roomId).emit('roomUpdated', { room });
    });

    // 部屋退出
    socket.on('leaveRoom', (data) => {
        const room = rooms.get(data.roomId);
        if (room) {
            room.players = room.players.filter(p => p.id !== socket.id);
            
            if (room.players.length === 0) {
                rooms.delete(data.roomId);
            } else {
                // ホストが退出した場合、次のプレイヤーをホストに
                if (!room.players.some(p => p.isHost)) {
                    room.players[0].isHost = true;
                }
                io.to(data.roomId).emit('roomUpdated', { room });
            }
        }
        
        socket.leave(data.roomId);
        players.get(socket.id).currentRoom = null;
        
        // 部屋リスト更新
        io.emit('roomsList', Array.from(rooms.values()).map(r => ({
            id: r.id,
            name: r.name,
            players: r.players.length,
            maxPlayers: r.maxPlayers
        })));
    });

    // 準備状態切り替え
    socket.on('toggleReady', (data) => {
        const room = rooms.get(data.roomId);
        if (room) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.isReady = !player.isReady;
                io.to(data.roomId).emit('roomUpdated', { room });
            }
        }
    });

    // ゲーム開始
    socket.on('startGame', (data) => {
        const room = rooms.get(data.roomId);
        if (!room) return;
        
        const hostPlayer = room.players.find(p => p.id === socket.id);
        if (!hostPlayer || !hostPlayer.isHost) {
            socket.emit('error', { message: 'ホストのみゲームを開始できます' });
            return;
        }
        
        if (!room.players.every(p => p.isReady)) {
            socket.emit('error', { message: '全プレイヤーが準備完了していません' });
            return;
        }
        
        // ゲーム用プレイヤーデータを作成
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
        
        // ターン順をランダム化
        const shuffledPlayers = shuffleArray(gamePlayers);
        
        room.gameState = {
            players: shuffledPlayers,
            currentPlayerIndex: 0,
            turnNumber: 1,
            isStarted: true
        };
        
        room.isStarted = true;
        
        io.to(data.roomId).emit('gameStarted', {
            players: shuffledPlayers,
            currentPlayerIndex: 0,
            turnNumber: 1
        });
    });

    // プレイヤーアクション
    socket.on('playerAction', (data) => {
        const room = rooms.get(data.roomId);
        if (!room || !room.gameState) return;
        
        const gameState = room.gameState;
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        
        if (currentPlayer.id !== socket.id) {
            socket.emit('error', { message: 'あなたのターンではありません' });
            return;
        }
        
        // アクション処理
        processAction(room, data.action, socket.id);
        
        // 全プレイヤーにアクション結果を送信
        io.to(data.roomId).emit('actionPerformed', data);
        
        // 次のターンに進む
        setTimeout(() => {
            nextTurn(room, data.roomId);
        }, 1500);
    });

    // 部屋リスト取得
    socket.on('getRooms', () => {
        socket.emit('roomsList', Array.from(rooms.values()).map(r => ({
            id: r.id,
            name: r.name,
            players: r.players.length,
            maxPlayers: r.maxPlayers
        })));
    });

    // 切断処理
    socket.on('disconnect', () => {
        console.log(`プレイヤー切断: ${socket.id}`);
        
        const playerData = players.get(socket.id);
        if (playerData && playerData.currentRoom) {
            const room = rooms.get(playerData.currentRoom);
            if (room) {
                room.players = room.players.filter(p => p.id !== socket.id);
                
                if (room.players.length === 0) {
                    rooms.delete(playerData.currentRoom);
                } else {
                    // ホストが切断した場合の処理
                    if (!room.players.some(p => p.isHost)) {
                        room.players[0].isHost = true;
                    }
                    io.to(playerData.currentRoom).emit('roomUpdated', { room });
                }
            }
        }
        
        players.delete(socket.id);
    });
});

// ゲームロジック関数
function processAction(room, action, playerId) {
    const gameState = room.gameState;
    const player = gameState.players.find(p => p.id === playerId);
    
    if (action.type === 'drawCard') {
        const randomCard = CARD_DATABASE[Math.floor(Math.random() * CARD_DATABASE.length)];
        player.hand.push({
            ...randomCard,
            instanceId: Math.random().toString(36).substr(2, 9)
        });
    } else if (action.type === 'useCard') {
        const target = gameState.players[action.targetIndex];
        
        // カードを手札から削除
        player.hand = player.hand.filter(c => c.instanceId !== action.card.instanceId);
        
        // ダメージ適用
        if (action.card.damage > 0) {
            target.hp = Math.max(0, target.hp - action.card.damage);
        }
        
        // HP0チェック
        if (target.hp <= 0 && target.isAlive) {
            target.isAlive = false;
        }
    }
}

function nextTurn(room, roomId) {
    const gameState = room.gameState;
    
    // 生存プレイヤーチェック
    const alivePlayers = gameState.players.filter(p => p.isAlive);
    if (alivePlayers.length <= 1) {
        endGame(room, roomId);
        return;
    }
    
    // 次のプレイヤーに移行
    let nextPlayerIndex = gameState.currentPlayerIndex;
    do {
        nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length;
        if (nextPlayerIndex === 0) {
            gameState.turnNumber++;
        }
    } while (!gameState.players[nextPlayerIndex].isAlive);
    
    gameState.currentPlayerIndex = nextPlayerIndex;
    
    io.to(roomId).emit('turnChanged', {
        currentPlayerIndex: nextPlayerIndex,
        turnNumber: gameState.turnNumber
    });
}

function endGame(room, roomId) {
    const gameState = room.gameState;
    const rankings = [...gameState.players].sort((a, b) => {
        if (a.isAlive && !b.isAlive) return -1;
        if (!a.isAlive && b.isAlive) return 1;
        return b.hp - a.hp;
    });
    
    io.to(roomId).emit('gameEnded', { rankings });
    
    // 部屋をリセット
    room.isStarted = false;
    room.gameState = null;
    room.players.forEach(p => p.isReady = false);
}

// サーバー起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Skill War サーバーがポート ${PORT} で起動しました！`);
});

// ヘルスチェックエンドポイント
app.get('/', (req, res) => {
    res.send(`
        <h1>🎮 Skill War Server</h1>
        <p>サーバーは正常に動作しています！</p>
        <p>接続中の部屋数: ${rooms.size}</p>
        <p>オンラインプレイヤー: ${players.size}</p>
    `);
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        rooms: rooms.size,
        players: players.size,
        timestamp: new Date().toISOString()
    });
});