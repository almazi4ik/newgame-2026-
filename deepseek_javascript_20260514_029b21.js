const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Размер мира
const WORLD_SIZE = 3000;
let camX = 0, camY = 0;
let canvasW, canvasH;

function resize() {
    canvasW = Math.min(window.innerWidth - 40, 1300);
    canvasH = Math.min(window.innerHeight - 40, 800);
    canvas.width = canvasW;
    canvas.height = canvasH;
}
resize();
window.addEventListener('resize', resize);

// ------ ИГРОК ------
let player = {
    x: WORLD_SIZE/2,
    y: WORLD_SIZE/2,
    radius: 18,
    hp: 100,
    maxHp: 100,
    invincibleFrames: 0,
    blocks: 0
};

// ------ ПОСТРОЙКИ ------
let buildings = [];
let nextId = 1;

// Типы построек
const BUILDING_TYPES = {
    TURRET: { name: 'Пушка', cost: 5, radius: 22, color: '#b84c4c', shootCooldown: 0, range: 200, damage: 18, cooldownMax: 35 },
    TOWER: { name: 'Башня', cost: 8, radius: 24, color: '#6c5b7b', range: 310, scanOnly: true },
    WALL: { name: 'Стена', cost: 3, radius: 15, color: '#5a6e6f', hp: 60, maxHp: 60 }
};

// ------ ВРАГИ (бродят и атакуют игрока и стены) ------
let enemies = [];
const ENEMY_COUNT = 9;

function spawnEnemy() {
    let side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = Math.random() * WORLD_SIZE; y = -30; }
    else if (side === 2) { x = Math.random() * WORLD_SIZE; y = WORLD_SIZE + 30; }
    else if (side === 1) { x = WORLD_SIZE + 30; y = Math.random() * WORLD_SIZE; }
    else { x = -30; y = Math.random() * WORLD_SIZE; }
    
    let radius = 14 + Math.random() * 8;
    enemies.push({
        id: Math.random(),
        x: x, y: y,
        radius: radius,
        hp: 30 + radius * 1.2,
        maxHp: 30 + radius * 1.2,
        damage: 12,
        speed: 1.1 + Math.random() * 0.8,
        color: `hsl(${20 + Math.random() * 30}, 70%, 45%)`
    });
}

// Инициализация мира
function initGame() {
    player.x = WORLD_SIZE/2;
    player.y = WORLD_SIZE/2;
    player.hp = player.maxHp;
    player.blocks = 0;
    player.invincibleFrames = 0;
    buildings = [];
    enemies = [];
    for (let i = 0; i < ENEMY_COUNT; i++) spawnEnemy();
    updateUI();
}

// UI обновление
function updateUI() {
    document.getElementById('resources').innerText = Math.floor(player.blocks);
    document.getElementById('hp').innerText = Math.max(0, player.hp);
}

// ------ СБОР РЕСУРСОВ (синие блоки) ------
let resources = [];
const RESOURCE_COUNT = 45;

function spawnResource() {
    resources.push({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        radius: 9,
        value: 1
    });
}
for (let i = 0; i < RESOURCE_COUNT; i++) spawnResource();

// ------ ПОСТРОЙКА ------
function tryBuild(typeKey) {
    let type = BUILDING_TYPES[typeKey];
    if (!type) return false;
    if (player.blocks < type.cost) return false;
    
    // Строим под игроком? Нет, чуть спереди по направлению мыши
    let angle = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x);
    let buildX = player.x + Math.cos(angle) * (player.radius + type.radius + 5);
    let buildY = player.y + Math.sin(angle) * (player.radius + type.radius + 5);
    
    // Проверка на столкновение с другими постройками
    let collide = false;
    for (let b of buildings) {
        let dist = Math.hypot(buildX - b.x, buildY - b.y);
        if (dist < b.radius + type.radius + 10) collide = true;
    }
    if (collide) return false;
    
    let building = {
        id: nextId++,
        type: typeKey,
        x: buildX,
        y: buildY,
        radius: type.radius,
        hp: type.hp || 9999,
        maxHp: type.maxHp || 9999,
        shootCooldown: 0
    };
    buildings.push(building);
    player.blocks -= type.cost;
    updateUI();
    return true;
}

// ------ СИСТЕМА МЫШИ ------
let mouseWorldX = player.x, mouseWorldY = player.y;
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    let canvasX = (e.clientX - rect.left) * (canvasW / rect.width);
    let canvasY = (e.clientY - rect.top) * (canvasH / rect.height);
    mouseWorldX = camX + canvasX;
    mouseWorldY = camY + canvasY;
    mouseWorldX = Math.min(Math.max(mouseWorldX, 0), WORLD_SIZE);
    mouseWorldY = Math.min(Math.max(mouseWorldY, 0), WORLD_SIZE);
});

// ------ ДВИЖЕНИЕ ИГРОКА К МЫШИ ------
function movePlayer() {
    let dx = mouseWorldX - player.x;
    let dy = mouseWorldY - player.y;
    let dist = Math.hypot(dx, dy);
    let speed = 5.6;
    if (dist > 3) {
        let move = Math.min(speed, dist - 3);
        let angle = Math.atan2(dy, dx);
        player.x += Math.cos(angle) * move;
        player.y += Math.sin(angle) * move;
    }
    // границы
    player.x = Math.min(Math.max(player.x, player.radius), WORLD_SIZE - player.radius);
    player.y = Math.min(Math.max(player.y, player.radius), WORLD_SIZE - player.radius);
    
    if (player.invincibleFrames > 0) player.invincibleFrames--;
}

// ------ СБОР РЕСУРСОВ ------
function collectResources() {
    for (let i=0; i<resources.length; i++) {
        let r = resources[i];
        let dist = Math.hypot(player.x - r.x, player.y - r.y);
        if (dist < player.radius + r.radius) {
            player.blocks += r.value;
            resources[i] = { x: Math.random() * WORLD_SIZE, y: Math.random() * WORLD_SIZE, radius: 9, value: 1 };
            updateUI();
        }
    }
}

// ------ ОБНОВЛЕНИЕ ПОСТРОЕК (стрельба, обновление кулдаунов)------
function updateBuildings() {
    for (let b of buildings) {
        if (b.type === 'TURRET') {
            if (b.shootCooldown > 0) { b.shootCooldown--; continue; }
            // ищем ближайшего врага в радиусе
            let closest = null;
            let minDist = Infinity;
            for (let e of enemies) {
                let d = Math.hypot(b.x - e.x, b.y - e.y);
                if (d < BUILDING_TYPES.TURRET.range && e.hp > 0) {
                    if (d < minDist) { minDist = d; closest = e; }
                }
            }
            if (closest) {
                // выстрел
                closest.hp -= BUILDING_TYPES.TURRET.damage;
                b.shootCooldown = BUILDING_TYPES.TURRET.cooldownMax;
                // визуальный эффект потом в draw
            }
        }
    }
}

// ------ ДВИЖЕНИЕ ВРАГОВ (к игроку и стенам)------
function moveEnemies() {
    for (let i=0; i<enemies.length; i++) {
        let e = enemies[i];
        if (e.hp <= 0) {
            // враг умер, даём ресурсы игроку
            player.blocks += 3;
            updateUI();
            enemies.splice(i,1);
            spawnEnemy();
            continue;
        }
        // AI: идём к игроку
        let dx = player.x - e.x;
        let dy = player.y - e.y;
        let distToPlayer = Math.hypot(dx, dy);
        if (distToPlayer > 1) {
            let angle = Math.atan2(dy, dx);
            let move = Math.min(e.speed, distToPlayer - 5);
            e.x += Math.cos(angle) * move;
            e.y += Math.sin(angle) * move;
        }
        // границы мира
        e.x = Math.min(Math.max(e.x, 5), WORLD_SIZE-5);
        e.y = Math.min(Math.max(e.y, 5), WORLD_SIZE-5);
        
        // столкновение с игроком (урон)
        let d = Math.hypot(player.x - e.x, player.y - e.y);
        if (d < player.radius + e.radius && player.invincibleFrames <= 0) {
            player.hp -= e.damage;
            player.invincibleFrames = 20;
            updateUI();
            if (player.hp <= 0) {
                alert("💀 Вас уничтожили! Игра перезапущена.");
                initGame();
                return;
            }
        }
        // столкновение со стенами (урон стенам)
        for (let b of buildings) {
            if (b.type === 'WALL') {
                let distWall = Math.hypot(e.x - b.x, e.y - b.y);
                if (distWall < e.radius + b.radius) {
                    b.hp -= e.damage * 0.9;
                    // откидываем врага
                    let angle = Math.atan2(e.y - b.y, e.x - b.x);
                    e.x += Math.cos(angle) * 8;
                    e.y += Math.sin(angle) * 8;
                    if (b.hp <= 0) {
                        buildings = buildings.filter(w => w.id !== b.id);
                    }
                }
            }
        }
    }
}

// камера
function updateCamera() {
    camX = player.x - canvasW/2;
    camY = player.y - canvasH/2;
    camX = Math.min(Math.max(camX, 0), WORLD_SIZE - canvasW);
    camY = Math.min(Math.max(camY, 0), WORLD_SIZE - canvasH);
}

// ------ ОТРИСОВКА (с камерой)------
function draw() {
    updateCamera();
    ctx.clearRect(0,0,canvasW,canvasH);
    
    // ресурсы (синие блоки)
    for (let r of resources) {
        ctx.beginPath();
        ctx.arc(r.x - camX, r.y - camY, r.radius, 0, Math.PI*2);
        ctx.fillStyle = '#3b82f6';
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('⚡', r.x-camX-5, r.y-camY+5);
    }
    
    // постройки
    for (let b of buildings) {
        ctx.beginPath();
        ctx.arc(b.x - camX, b.y - camY, b.radius, 0, Math.PI*2);
        if (b.type === 'TURRET') ctx.fillStyle = '#c44545';
        else if (b.type === 'TOWER') ctx.fillStyle = '#9b6b9b';
        else ctx.fillStyle = '#5a7a6e';
        ctx.fill();
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px monospace';
        if (b.type === 'TURRET') ctx.fillText('🔫', b.x-camX-7, b.y-camY+6);
        else if (b.type === 'TOWER') ctx.fillText('🗼', b.x-camX-6, b.y-camY+6);
        else ctx.fillText('🧱', b.x-camX-6, b.y-camY+6);
        
        // полоска хп для стены
        if (b.type === 'WALL' && b.hp < b.maxHp) {
            ctx.fillStyle = '#aa2e2e';
            ctx.fillRect(b.x-camX-12, b.y-camY-12, 24, 5);
            ctx.fillStyle = '#5f9e6e';
            ctx.fillRect(b.x-camX-12, b.y-camY-12, 24 * (b.hp/b.maxHp), 4);
        }
    }
    
    // враги
    for (let e of enemies) {
        ctx.beginPath();
        ctx.arc(e.x - camX, e.y - camY, e.radius, 0, Math.PI*2);
        ctx.fillStyle = e.color;
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.fillText('👾', e.x-camX-8, e.y-camY+6);
        // хп врага
        let hpPercent = e.hp/e.maxHp;
        ctx.fillStyle = '#aa2e2e';
        ctx.fillRect(e.x-camX-12, e.y-camY-15, 24, 4);
        ctx.fillStyle = '#4caf50';
        ctx.fillRect(e.x-camX-12, e.y-camY-15, 24 * hpPercent, 4);
    }
    
    // игрок
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(player.x - camX, player.y - camY, player.radius, 0, Math.PI*2);
    ctx.fillStyle = '#62b86f';
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#2c3e2f';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('⚙️', player.x-camX-11, player.y-camY+8);
    // полоска хп игрока
    let hpPercent = player.hp/player.maxHp;
    ctx.fillStyle = '#6b2e2e';
    ctx.fillRect(player.x-camX-20, player.y-camY-22, 40, 6);
    ctx.fillStyle = '#63c963';
    ctx.fillRect(player.x-camX-20, player.y-camY-22, 40 * hpPercent, 6);
    
    ctx.shadowBlur = 0;
}

// ------ ОСНОВНОЙ ЦИКЛ ------
function gameUpdate() {
    movePlayer();
    collectResources();
    updateBuildings();
    moveEnemies();
    draw();
    requestAnimationFrame(gameUpdate);
}

// ----- УПРАВЛЕНИЕ ПОСТРОЙКОЙ (клавиши и кнопки)
window.addEventListener('keydown', (e) => {
    if (e.key === '1') tryBuild('TURRET');
    if (e.key === '2') tryBuild('TOWER');
    if (e.key === '3') tryBuild('WALL');
});
document.getElementById('btnTurret').onclick = () => tryBuild('TURRET');
document.getElementById('btnTower').onclick = () => tryBuild('TOWER');
document.getElementById('btnWall').onclick = () => tryBuild('WALL');

// ------ СТАРТ ------
initGame();
gameUpdate();