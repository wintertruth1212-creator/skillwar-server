const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

console.log('🚀 Starting Skill War Server...');

const app = express();
const server = http.createServer(app);

// CORS設定
app.use(cors({
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
}));

// Socket.IO設定
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: false
    },
    transports: ['websocket', 'polling']
});

// ゲーム状態管理
let rooms = new Map();
let players = new Map();

// カードデータベース（100種類）
const CARD_DATABASE = [
    // 炎属性カード (16種)
    { id: 1, name: '火の玉', element: 'fire', damage: 2, description: '基本的な炎攻撃' },
    { id: 2, name: '業火', element: 'fire', damage: 3, description: '強力な炎攻撃' },
    { id: 3, name: '火炎放射', element: 'fire', damage: 4, description: '範囲攻撃、隣接プレイヤーにも1ダメージ' },
    { id: 4, name: '爆炎', element: 'fire', damage: 5, description: '最強の炎攻撃' },
    { id: 5, name: '炎の壁', element: 'fire', damage: 1, description: '次のターン、このプレイヤーへの攻撃-1' },
    { id: 6, name: '炎の剣', element: 'fire', damage: 3, description: '連続攻撃可能' },
    { id: 7, name: '火炎竜巻', element: 'fire', damage: 4, description: '全プレイヤーに1ダメージ' },
    { id: 8, name: '溶岩噴出', element: 'fire', damage: 3, description: '地形ダメージ付与' },
    { id: 9, name: '炎の矢', element: 'fire', damage: 2, description: '貫通効果' },
    { id: 10, name: '大火球', element: 'fire', damage: 4, description: '爆発範囲拡大' },
    { id: 11, name: '火炎嵐', element: 'fire', damage: 3, description: '手札1枚破棄' },
    { id: 12, name: '炎帝剣', element: 'fire', damage: 5, description: '究極炎攻撃' },
    { id: 13, name: '煉獄', element: 'fire', damage: 4, description: '継続ダメージ' },
    { id: 14, name: '火の鳥', element: 'fire', damage: 3, description: '復活効果' },
    { id: 15, name: '灼熱波', element: 'fire', damage: 2, description: '全体攻撃' },
    { id: 16, name: '火神召喚', element: 'fire', damage: 6, description: '最上級炎魔法' },

    // 水属性カード (17種)
    { id: 17, name: '水流', element: 'water', damage: 2, description: '基本的な水攻撃' },
    { id: 18, name: '高圧放水', element: 'water', damage: 3, description: '強力な水攻撃' },
    { id: 19, name: '津波', element: 'water', damage: 4, description: '全プレイヤーに1ダメージ、対象に追加2ダメージ' },
    { id: 20, name: '水の癒し', element: 'water', damage: 0, description: 'HP2回復（対象を味方にも設定可能）' },
    { id: 21, name: '凍結', element: 'water', damage: 1, description: '対象は次のターン行動不可' },
    { id: 22, name: '水の盾', element: 'water', damage: 0, description: '次の攻撃を半減' },
    { id: 23, name: '氷刃', element: 'water', damage: 3, description: '凍結効果付き' },
    { id: 24, name: '大洪水', element: 'water', damage: 3, description: '地形変化' },
    { id: 25, name: '水竜巻', element: 'water', damage: 2, description: '手札シャッフル' },
    { id: 26, name: '治癒の泉', element: 'water', damage: 0, description: '全体HP1回復' },
    { id: 27, name: '氷の槍', element: 'water', damage: 4, description: '確定凍結' },
    { id: 28, name: '水神の加護', element: 'water', damage: 0, description: '状態異常全回復' },
    { id: 29, name: '絶対零度', element: 'water', damage: 5, description: '最強氷攻撃' },
    { id: 30, name: '蒸気爆発', element: 'water', damage: 3, description: '炎と反応で強化' },
    { id: 31, name: '水鏡', element: 'water', damage: 0, description: '攻撃反射' },
    { id: 32, name: '海神召喚', element: 'water', damage: 6, description: '最上級水魔法' },
    { id: 33, name: '氷河期', element: 'water', damage: 2, description: '全体凍結' },

    // 風属性カード (17種)
    { id: 34, name: '突風', element: 'wind', damage: 2, description: '基本的な風攻撃' },
    { id: 35, name: '竜巻', element: 'wind', damage: 3, description: '対象の手札をシャッフル' },
    { id: 36, name: '嵐', element: 'wind', damage: 4, description: '全プレイヤーの手札から1枚ランダム破棄' },
    { id: 37, name: '疾風', element: 'wind', damage: 1, description: 'カードを1枚追加で引く' },
    { id: 38, name: '風の加護', element: 'wind', damage: 0, description: '属性状態を1つ除去' },
    { id: 39, name: '風刃', element: 'wind', damage: 3, description: '貫通攻撃' },
    { id: 40, name: '台風', element: 'wind', damage: 4, description: '手札全シャッフル' },
    { id: 41, name: '真空波', element: 'wind', damage: 3, description: '防御無視' },
    { id: 42, name: '風神拳', element: 'wind', damage: 2, description: '連続攻撃' },
    { id: 43, name: '飛翔', element: 'wind', damage: 0, description: '次のターン攻撃回避' },
    { id: 44, name: '風の壁', element: 'wind', damage: 0, description: '遠距離攻撃無効' },
    { id: 45, name: '神風', element: 'wind', damage: 5, description: '自爆攻撃' },
    { id: 46, name: '大嵐', element: 'wind', damage: 3, description: '全体混乱' },
    { id: 47, name: '風遁術', element: 'wind', damage: 1, description: 'カード2枚ドロー' },
    { id: 48, name: '天空剣', element: 'wind', damage: 4, description: '空中攻撃' },
    { id: 49, name: '風神召喚', element: 'wind', damage: 6, description: '最上級風魔法' },
    { id: 50, name: 'ハリケーン', element: 'wind', damage: 5, description: '超大型嵐' },

    // 土属性カード (17種)
    { id: 51, name: '岩石投げ', element: 'earth', damage: 2, description: '基本的な土攻撃' },
    { id: 52, name: '地震', element: 'earth', damage: 3, description: '全プレイヤーに1ダメージ' },
    { id: 53, name: '落石', element: 'earth', damage: 4, description: '対象のカード使用を1ターン封印' },
    { id: 54, name: '土の壁', element: 'earth', damage: 0, description: 'HP+3増加（最大15まで）' },
    { id: 55, name: '砂嵐', element: 'earth', damage: 1, description: '全プレイヤーの視界を1ターン遮る' },
    { id: 56, name: '巨石落下', element: 'earth', damage: 5, description: '確率でスタン' },
    { id: 57, name: '地割れ', element: 'earth', damage: 3, description: '移動封印' },
    { id: 58, name: '土流', element: 'earth', damage: 2, description: '継続ダメージ' },
    { id: 59, name: '大地の怒り', element: 'earth', damage: 4, description: '全体地震' },
    { id: 60, name: '石化', element: 'earth', damage: 1, description: '2ターン行動不可' },
    { id: 61, name: '山崩れ', element: 'earth', damage: 4, description: '範囲攻撃' },
    { id: 62, name: '地盤沈下', element: 'earth', damage: 2, description: '地形変化' },
    { id: 63, name: '隕石落下', element: 'earth', damage: 6, description: '最強土攻撃' },
    { id: 64, name: '鉄壁', element: 'earth', damage: 0, description: '物理攻撃完全防御' },
    { id: 65, name: '大地復活', element: 'earth', damage: 0, description: 'HP大幅回復' },
    { id: 66, name: '地神召喚', element: 'earth', damage: 6, description: '最上級土魔法' },
    { id: 67, name: '地核変動', element: 'earth', damage: 5, description: 'マップ全体攻撃' },

    // 雷属性カード (17種)  
    { id: 68, name: '雷撃', element: 'thunder', damage: 2, description: '基本的な雷攻撃' },
    { id: 69, name: '落雷', element: 'thunder', damage: 4, description: '確率で対象を麻痺させる' },
    { id: 70, name: '稲妻', element: 'thunder', damage: 3, description: '連鎖して隣のプレイヤーにも1ダメージ' },
    { id: 71, name: '電撃網', element: 'thunder', damage: 1, description: '全プレイヤーに1ダメージ' },
    { id: 72, name: '充電', element: 'thunder', damage: 0, description: '次に使うカードのダメージ+2' },
    { id: 73, name: '電光石火', element: 'thunder', damage: 3, description: '先制攻撃' },
    { id: 74, name: '雷雲召喚', element: 'thunder', damage: 2, description: '継続雷ダメージ' },
    { id: 75, name: '電磁パルス', element: 'thunder', damage: 1, description: '全体麻痺' },
    { id: 76, name: '雷神の怒り', element: 'thunder', damage: 5, description: '確定麻痺' },
    { id: 77, name: 'プラズマ球', element: 'thunder', damage: 4, description: '貫通攻撃' },
    { id: 78, name: '電撃バリア', element: 'thunder', damage: 0, description: '攻撃者にダメージ反射' },
    { id: 79, name: '雷鳴', element: 'thunder', damage: 1, description: '全体スタン' },
    { id: 80, name: '神雷', element: 'thunder', damage: 6, description: '最強雷攻撃' },
    { id: 81, name: '電子分解', element: 'thunder', damage: 3, description: '装備破壊' },
    { id: 82, name: '雷帝降臨', element: 'thunder', damage: 5, description: '連続雷撃' },
    { id: 83, name: '雷神召喚', element: 'thunder', damage: 6, description: '最上級雷魔法' },
    { id: 84, name: '終末の雷', element: 'thunder', damage: 7, description: '究極雷魔法' },

    // 氷属性カード (16種)
    { id: 85, name: '氷の矢', element: 'ice', damage: 2, description: '基本的な氷攻撃' },
    { id: 86, name: '吹雪', element: 'ice', damage: 3, description: '全プレイヤーの行動速度-1' },
    { id: 87, name: '氷河', element: 'ice', damage: 4, description: '対象を2ターン凍結' },
    { id: 88, name: '霜', element: 'ice', damage: 1, description: '対象の次のカードダメージ-1' },
    { id: 89, name: '氷の盾', element: 'ice', damage: 0, description: '次の攻撃を無効化' },
    { id: 90, name: '氷柱落とし', element: 'ice', damage: 4, description: '頭上攻撃' },
    { id: 91, name: '氷結界', element: 'ice', damage: 0, description: '範囲防御' },
    { id: 92, name: '氷山', element: 'ice', damage: 3, description: '隠れた威力' },
    { id: 93, name: '氷の薔薇', element: 'ice', damage: 2, description: '美しき氷攻撃' },
    { id: 94, name: '氷竜召喚', element: 'ice', damage: 5, description: '氷竜の咆哮' },
    { id: 95, name: 'ダイヤモンドダスト', element: 'ice', damage: 3, description: '美麗な氷攻撃' },
    { id: 96, name: '氷の女王', element: 'ice', damage: 4, description: '支配効果' },
    { id: 97, name: '永久凍土', element: 'ice', damage: 2, description: '地形凍結' },
    { id: 98, name: '氷神召喚', element: 'ice', damage: 6, description: '最上級氷魔法' },
    { id: 99, name: 'アイスエイジ', element: 'ice', damage: 5, description: '氷河期到来' },
    { id: 100, name: '絶対零度・改', element: 'ice', damage: 8, description: '伝説の氷魔法' }
];

// 属性相性システム
const ELEMENT_REACTIONS = {
    'fire,water': { name: '蒸発', effect: 'steam' },
    'water,fire': { name: '蒸発', effect: 'steam' },
    'thunder,water': { name: '感電', effect: 'shock' },
    'water,thunder': { name: '感電', effect: 'shock' },
    'fire,wind': { name: '燃焼', effect: 'burn' },
    'wind,fire': { name: '燃焼', effect: 'burn' },
    'thunder,fire': { name: '過剰反応', effect: 'overreaction' },
    'fire,thunder': { name: '過剰反応', effect: 'overreaction' },
    'ice,fire': { name: '溶解', effect: 'melt' },
    'fire,ice': { name: '溶解', effect: 'melt' },
    'water,earth': { name: '溶解', effect: 'dissolve' },
    'earth,water': { name: '溶解', effect: 'dissolve' },
    'earth,wind': { name: '風化', effect: 'erosion' },
    'wind,earth': { name: '風化', effect: 'erosion' }
};

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

function broadcastRoomsList() {
    const roomsList = Array.from(rooms.values())
        .filter(room => !room.isStarted)
        .map(room => ({
            id: room.id,
            name: room.name,
            players: room.players.length,
            maxPlayers: room.maxPlayers,
            isStarted: room.isStarted
        }));
    io.emit('roomsList', roomsList);
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

    // 接続成功メッセージ
    socket.emit('welcome', {
        message: 'Skill War サーバーに接続されました！',
        playerId: socket.id
    });

    // 部屋作成
    socket.on('createRoom', (data) => {
        console.log('部屋作成:', data);
        
        const roomId = generateRoomId();
        const player = {
            ...data.player,
            id: socket.id,
            isHost: true,
            index: 0,
            isReady: false
        };
        
        const room = {
            id: roomId,
            name: data.roomName,
            maxPlayers: data.maxPlayers,
            players: [player],
            isStarted: false,
            gameState: null,
            createdAt: new Date()
        };
        
        rooms.set(roomId, room);
        players.get(socket.id).currentRoom = roomId;
        players.get(socket.id).isHost = true;
        
        socket.join(roomId);
        socket.emit('roomCreated', { room, player });
        
        broadcastRoomsList();
        console.log(`部屋作成完了: ${roomId} by ${player.name}`);
    });

    // 部屋参加
    socket.on('joinRoom', (data) => {
        console.log('部屋参加試行:', data);
        
        const room = rooms.get(data.roomId);
        if (!room) {
            socket.emit('error', { message: '部屋が見つかりません' });
            return;
        }
        
        if (room.players.length >= room.maxPlayers) {
            socket.emit('error', { message: '部屋が満室です' });
            return;
        }
        
        if (room.isStarted) {
            socket.emit('error', { message: 'ゲームが既に開始されています' });
            return;
        }
        
        const player = {
            ...data.player,
            id: socket.id,
            isHost: false,
            index: room.players.length,
            isReady: false
        };
        
        room.players.push(player);
        players.get(socket.id).currentRoom = data.roomId;
        
        socket.join(data.roomId);
        io.to(data.roomId).emit('roomJoined', { room, player });
        io.to(data.roomId).emit('roomUpdated', { room });
        
        broadcastRoomsList();
        console.log(`プレイヤー ${player.name} が部屋 ${data.roomId} に参加`);
    });

    // 部屋退出
    socket.on('leaveRoom', (data) => {
        console.log('部屋退出:', data);
        handlePlayerLeave(socket.id, data.roomId);
    });

    // 準備状態切り替え
    socket.on('toggleReady', (data) => {
        const room = rooms.get(data.roomId);
        if (room) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.isReady = !player.isReady;
                io.to(data.roomId).emit('roomUpdated', { room });
                console.log(`${player.name} の準備状態: ${player.isReady}`);
            }
        }
    });

    // ゲーム開始
    socket.on('startGame', (data) => {
        const room = rooms.get(data.roomId);
        if (!room) {
            socket.emit('error', { message: '部屋が見つかりません' });
            return;
        }
        
        const hostPlayer = room.players.find(p => p.id === socket.id);
        if (!hostPlayer || !hostPlayer.isHost) {
            socket.emit('error', { message: 'ホストのみゲームを開始できます' });
            return;
        }
        
        if (room.players.length < 2) {
            socket.emit('error', { message: '最低2人必要です' });
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
            isStarted: true,
            startedAt: new Date()
        };
        
        room.isStarted = true;
        
        io.to(data.roomId).emit('gameStarted', {
            players: shuffledPlayers,
            currentPlayerIndex: 0,
            turnNumber: 1
        });
        
        broadcastRoomsList();
        console.log(`ゲーム開始: 部屋 ${data.roomId}`);
    });

    // プレイヤーアクション
    socket.on('playerAction', (data) => {
        const room = rooms.get(data.roomId);
        if (!room || !room.gameState || !room.gameState.isStarted) {
            socket.emit('error', { message: 'ゲームが開始されていません' });
            return;
        }
        
        const gameState = room.gameState;
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        
        if (currentPlayer.id !== socket.id) {
            socket.emit('error', { message: 'あなたのターンではありません' });
            return;
        }
        
        if (!currentPlayer.isAlive) {
            socket.emit('error', { message: '死亡しているプレイヤーは行動できません' });
            return;
        }
        
        // アクション処理
        const actionResult = processAction(room, data.action, socket.id);
        
        if (actionResult.error) {
            socket.emit('error', { message: actionResult.error });
            return;
        }
        
        // 全プレイヤーにアクション結果を送信
        io.to(data.roomId).emit('actionPerformed', {
            playerId: socket.id,
            action: data.action,
            result: actionResult
        });
        
        // 次のターンに進む
        setTimeout(() => {
            nextTurn(room, data.roomId);
        }, 1500);
        
        console.log(`アクション実行: ${currentPlayer.name} - ${data.action.type}`);
    });

    // 部屋リスト取得
    socket.on('getRooms', () => {
        broadcastRoomsList();
    });

    // 切断処理
    socket.on('disconnect', () => {
        console.log(`プレイヤー切断: ${socket.id}`);
        handlePlayerDisconnect(socket.id);
    });
});

// ゲームロジック関数
function processAction(room, action, playerId) {
    const gameState = room.gameState;
    const player = gameState.players.find(p => p.id === playerId);
    
    if (!player) {
        return { error: 'プレイヤーが見つかりません' };
    }
    
    if (action.type === 'drawCard') {
        const randomCard = CARD_DATABASE[Math.floor(Math.random() * CARD_DATABASE.length)];
        const newCard = {
            ...randomCard,
            instanceId: Math.random().toString(36).substr(2, 9)
        };
        player.hand.push(newCard);
        
        return {
            success: true,
            message: `${player.name}がカードを1枚引きました`,
            drawnCard: newCard
        };
        
    } else if (action.type === 'useCard') {
        if (!action.card || action.targetIndex >= gameState.players.length) {
            return { error: '無効なアクションデータです' };
        }
        
        const target = gameState.players[action.targetIndex];
        const cardIndex = player.hand.findIndex(c => c.instanceId === action.card.instanceId);
        
        if (cardIndex === -1) {
            return { error: 'カードが手札に存在しません' };
        }
        
        // カードを手札から削除
        player.hand.splice(cardIndex, 1);
        
        // ダメージ適用
        let damageDealt = 0;
        if (action.card.damage > 0) {
            damageDealt = action.card.damage;
            target.hp = Math.max(0, target.hp - damageDealt);
        }
        
        // 特殊効果処理
        const effectResults = processCardEffects(action.card, target, player, gameState);
        
        // HP0チェック
        let isKilled = false;
        if (target.hp <= 0 && target.isAlive) {
            target.isAlive = false;
            isKilled = true;
        }
        
        return {
            success: true,
            message: `${player.name}が${target.name}に${action.card.name}を使用！`,
            damageDealt,
            isKilled,
            effectResults,
            usedCard: action.card
        };
    }
    
    return { error: '無効なアクションです' };
}

function processCardEffects(card, target, attacker, gameState) {
    const effects = [];
    
    switch (card.name) {
        case '水の癒し':
            const healAmount = 2;
            const oldHp = target.hp;
            target.hp = Math.min(target.maxHp, target.hp + healAmount);
            const actualHeal = target.hp - oldHp;
            if (actualHeal > 0) {
                effects.push(`${target.name}のHPが${actualHeal}回復！`);
            }
            break;
            
        case '疾風':
            const randomCard = CARD_DATABASE[Math.floor(Math.random() * CARD_DATABASE.length)];
            const newCard = {
                ...randomCard,
                instanceId: Math.random().toString(36).substr(2, 9)
            };
            attacker.hand.push(newCard);
            effects.push(`${attacker.name}が追加でカードを1枚引いた！`);
            break;
            
        case '土の壁':
            const hpBoost = 3;
            target.maxHp = Math.min(15, target.maxHp + hpBoost);
            target.hp = Math.min(target.maxHp, target.hp + hpBoost);
            effects.push(`${target.name}の最大HPが増加！`);
            break;
            
        case '充電':
            attacker.chargeBoost = 2;
            effects.push(`${attacker.name}の次の攻撃が強化される！`);
            break;
    }
    
    return effects;
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
    let attempts = 0;
    
    do {
        nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length;
        if (nextPlayerIndex === 0) {
            gameState.turnNumber++;
        }
        attempts++;
    } while (!gameState.players[nextPlayerIndex].isAlive && attempts < gameState.players.length);
    
    if (attempts >= gameState.players.length) {
        endGame(room, roomId);
        return;
    }
    
    gameState.currentPlayerIndex = nextPlayerIndex;
    
    io.to(roomId).emit('turnChanged', {
        currentPlayerIndex: nextPlayerIndex,
        turnNumber: gameState.turnNumber
    });
    
    console.log(`ターン変更: ${gameState.players[nextPlayerIndex].name} のターン (${gameState.turnNumber})`);
}

function endGame(room, roomId) {
    const gameState = room.gameState;
    const rankings = [...gameState.players].sort((a, b) => {
        if (a.isAlive && !b.isAlive) return -1;
        if (!a.isAlive && b.isAlive) return 1;
        return b.hp - a.hp;
    });
    
    io.to(roomId).emit('gameEnded', { 
        rankings,
        gameStats: {
            totalTurns: gameState.turnNumber,
            gameDuration: Date.now() - gameState.startedAt,
            winner: rankings[0]
        }
    });
    
    // 部屋をリセット
    room.isStarted = false;
    room.gameState = null;
    room.players.forEach(p => {
        p.isReady = false;
        delete p.hp;
        delete p.maxHp;
        delete p.hand;
        delete p.statusEffects;
        delete p.isAlive;
        delete p.possessedBy;
        delete p.stunned;
    });
    
    broadcastRoomsList();
    console.log(`ゲーム終了: 部屋 ${roomId}, 勝者: ${rankings[0].name}`);
}

function handlePlayerLeave(playerId, roomId) {
    const playerData = players.get(playerId);
    if (!playerData) return;
    
    const room = rooms.get(roomId || playerData.currentRoom);
    if (!room) return;
    
    // プレイヤーを部屋から削除
    room.players = room.players.filter(p => p.id !== playerId);
    
    if (room.players.length === 0) {
        rooms.delete(room.id);
        console.log(`部屋削除: ${room.id}`);
    } else {
        // ホストが退出した場合、次のプレイヤーをホストに
        if (!room.players.some(p => p.isHost)) {
            room.players[0].isHost = true;
            console.log(`新ホスト: ${room.players[0].name} in room ${room.id}`);
        }
        
        io.to(room.id).emit('roomUpdated', { room });
        
        // ゲーム中の場合の処理
        if (room.isStarted && room.gameState) {
            const gameState = room.gameState;
            const playerIndex = gameState.players.findIndex(p => p.id === playerId);
            
            if (playerIndex !== -1) {
                gameState.players[playerIndex].isAlive = false;
                
                // 現在のターンプレイヤーが退出した場合
                if (gameState.currentPlayerIndex === playerIndex) {
                    nextTurn(room, room.id);
                }
                
                io.to(room.id).emit('playerDisconnected', {
                    playerId,
                    playerName: gameState.players[playerIndex].name
                });
            }
        }
    }
    
    broadcastRoomsList();
}

function handlePlayerDisconnect(playerId) {
    const playerData = players.get(playerId);
    if (playerData && playerData.currentRoom) {
        handlePlayerLeave(playerId, playerData.currentRoom);
    }
    players.delete(playerId);
}

// 基本的なルート
app.get('/', (req, res) => {
    const stats = {
        activeRooms: rooms.size,
        onlinePlayers: players.size,
        totalGames: Array.from(rooms.values()).filter(r => r.isStarted).length,
        availableRooms: Array.from(rooms.values()).filter(r => !r.isStarted).length
    };
    
    res.json({
        message: '🎮 Skill War Server is running!',
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        stats
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
        rooms: rooms.size,
        players: players.size
    });
});

app.get('/stats', (req, res) => {
    const roomsList = Array.from(rooms.values()).map(room => ({
        id: room.id,
        name: room.name,
        players: room.players.length,
        maxPlayers: room.maxPlayers,
        isStarted: room.isStarted,
        createdAt: room.createdAt
    }));
    
    res.json({
        totalRooms: rooms.size,
        totalPlayers: players.size,
        rooms: roomsList
    });
});

// エラーハンドリング
app.use((err, req, res, next) => {
    console.error('Express error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// サーバー起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Skill War Server running on port ${PORT}`);
    console.log(`🌍 Server URL: http://localhost:${PORT}`);
    console.log(`🎯 WebSocket ready for connections`);
});

// 定期的なクリーンアップ（1時間ごと）
setInterval(() => {
    const now = Date.now();
    const oldRooms = [];
    
    rooms.forEach((room, roomId) => {
        // 作成から6時間経過した空の部屋を削除
        if (!room.isStarted && room.players.length === 0 && 
            (now - room.createdAt.getTime()) > 6 * 60 * 60 * 1000) {
            oldRooms.push(roomId);
        }
    });
    
    oldRooms.forEach(roomId => {
        rooms.delete(roomId);
        console.log(`古い部屋を削除: ${roomId}`);
    });
    
    if (oldRooms.length > 0) {
        broadcastRoomsList();
    }
    
    console.log(`クリーンアップ完了: ${rooms.size} rooms, ${players.size} players`);
}, 60 * 60 * 1000);