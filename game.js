const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Размер мира
const WORLD_SIZE = 4000;
let camX = 0, camY = 0;
let canvasW, canvasH;

function resizeCanvas() {
    canvasW = Math.min(window.innerWidth - 48, 1400);
    canvasH = Math.min(window.innerHeight - 48, 850);
    canvas.width = canvasW;
    canvas.height = canvasH;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ========== ИГРОК (ЧЕЛОВЕК) ==========
let playerName = "Воин";
let player = {
    x: WORLD_SIZE / 2,
    y: WORLD_SIZE / 2,
    radius: 18,
    hp: 100,
    maxHp: 100,
    invincible: 0,
    level: 1,
    exp: 0,
    
    // Ресурсы
    wood: 0,
    stone: 0,
    iron: 0,
    
    // Экипировка
    weaponTier: 1,  // топор (урон по врагам + добыча дерева)
    toolTier: 1,    // кирка (добыча камня/железа)
    
    attackCd: 0,
    attackDamage: 15
};

// ========== ДЕРЕВЬЯ ==========
let trees = [];
const TREE_COUNT = 80;

function spawnTrees() {
    for(let i = 0; i < TREE_COUNT; i++) {
        trees.push({
            x: Math.random() * WORLD_SIZE,
            y: Math.random() * WORLD_SIZE,
            radius: 14,
            hp: 30,
            woodValue: 8 + Math.floor(Math.random() * 7)
        });
    }
}

// ========== КАМЕННЫЕ ЖИЛЫ ==========
let stoneNodes = [];
const STONE_COUNT = 40;

function spawnStones() {
    for(let i = 0; i < STONE_COUNT; i++) {
        stoneNodes.push({
            x: Math.random() * WORLD_SIZE,
            y: Math.random() * WORLD_SIZE,
            radius: 16,
            hp: 45,
            stoneValue: 6 + Math.floor(Math.random() * 8)
        });
    }
}

// ========== ЖЕЛЕЗНЫЕ РУДЫ ==========
let ironNodes = [];
const IRON_COUNT = 25;

function spawnIron() {
    for(let i = 0; i < IRON_COUNT; i++) {
        ironNodes.push({
            x: Math.random() * WORLD_SIZE,
            y: Math.random() * WORLD_SIZE,
            radius: 14,
            hp: 60,
            ironValue: 4 + Math.floor(Math.random() * 6)
        });
    }
}

// ========== ПОСТРОЙКИ ==========
let buildings = [];
let nextId = 1;

const BUILDING_RECIPES = {
    WALL: { wood: 10, stone: 5, iron: 0, name: 'Стена', radius: 16, hp: 120, color: '#7a6a5a' },
    TURRET: { wood: 15, stone: 10, iron: 5, name: 'Пушка', radius: 22, hp: 80, color: '#c45545', damage: 25, range: 220, cooldown: 0 },
    TOWER: { wood: 20, stone: 15, iron: 8, name: 'Башня', radius: 24, hp: 100, color: '#9b7aaa', range: 300, scanOnly: true }
};

// ========== ВРАГИ ==========
let enemies = [];
const ENEMY_BASE = 8;

function spawnEnemy() {
    let side = Math.floor(Math.random() * 4);
    let x, y;
    if(side === 0) { x = Math.random() * WORLD_SIZE; y = -50; }
    else if(side === 2) { x = Math.random() * WORLD_SIZE; y = WORLD_SIZE + 50; }
    else if(side === 1) { x = WORLD_SIZE + 50; y = Math.random() * WORLD_SIZE; }
    else { x = -50; y = Math.random() * WORLD_SIZE; }
    
    let names = ["ГУЛЬ", "СКЕЛЕТ", "ОРК", "ТРОЛЛЬ", "ПРИЗРАК"];
    let radius = 14 + Math.random() * 10;
    enemies.push({
        id: Math.random(),
        x: x, y: y,
        radius: radius,
        hp: 40 + radius,
        maxHp: 40 + radius,
        damage: 12,
        speed: 0.9 + Math.random() * 0.7,
        name: names[Math.floor(Math.random() * names.length)],
        color: `hsl(${20 + Math.random() * 40}, 65%, 48%)`
    });
}

// ========== ЭФФЕКТЫ ==========
let particles = [];

function addParticle(x, y, color) {
    for(let i = 0; i < 5; i++) {
        particles.push({
            x: x + (Math.random() - 0.5) * 10,
            y: y + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 3,
            vy: (Math.random() - 0.5) * 3 - 2,
            life: 0.6 + Math.random() * 0.4,
            color: color
        });
    }
}

// ========== МЫШЬ ==========
let mouseWorldX = player.x, mouseWorldY = player.y;
let isAttacking = false;

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    let canvasX = (e.clientX - rect.left) * (canvasW / rect.width);
    let canvasY = (e.clientY - rect.top) * (canvasH / rect.height);
    mouseWorldX = camX + canvasX;
    mouseWorldY = camY + canvasY;
    mouseWorldX = Math.min(Math.max(mouseWorldX, 0), WORLD_SIZE);
    mouseWorldY = Math.min(Math.max(mouseWorldY, 0), WORLD_SIZE);
});

// КЛИК для атаки
canvas.addEventListener('mousedown', (e) => {
    if(e.button === 0) isAttacking = true;
});
canvas.addEventListener('mouseup', () => { isAttacking = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ========== ДВИЖЕНИЕ ==========
function movePlayer() {
    let dx = mouseWorldX - player.x;
    let dy = mouseWorldY - player.y;
    let dist = Math.hypot(dx, dy);
    let speed = 4.8;
    if(dist > 5) {
        let move = Math.min(speed, dist - 3);
        let ang = Math.atan2(dy, dx);
        player.x += Math.cos(ang) * move;
        player.y += Math.sin(ang) * move;
    }
    player.x = Math.min(Math.max(player.x, player.radius), WORLD_SIZE - player.radius);
    player.y = Math.min(Math.max(player.y, player.radius), WORLD_SIZE - player.radius);
    if(player.invincible > 0) player.invincible--;
    if(player.attackCd > 0) player.attackCd--;
}

// ========== АТАКА (рубить деревья, камни, врагов) ==========
function attack() {
    if(!isAttacking) return;
    if(player.attackCd > 0) return;
    
    let attackRange = player.radius + 25;
    let damage = player.attackDamage + player.weaponTier * 3;
    
    // Атака деревьев
    for(let i = 0; i < trees.length; i++) {
        let t = trees[i];
        let dist = Math.hypot(player.x - t.x, player.y - t.y);
        if(dist < attackRange) {
            t.hp -= damage;
            addParticle(t.x, t.y, "#8B5E3C");
            player.attackCd = 12;
            if(t.hp <= 0) {
                player.wood += t.woodValue;
                trees.splice(i, 1);
                addParticle(t.x, t.y, "#4CAF50");
                gainExp(8);
                // новое дерево
                trees.push({
                    x: Math.random() * WORLD_SIZE,
                    y: Math.random() * WORLD_SIZE,
                    radius: 14,
                    hp: 30,
                    woodValue: 8 + Math.floor(Math.random() * 7)
                });
                updateUI();
            }
            return;
        }
    }
    
    // Атака камней
    for(let i = 0; i < stoneNodes.length; i++) {
        let s = stoneNodes[i];
        let dist = Math.hypot(player.x - s.x, player.y - s.y);
        if(dist < attackRange) {
            let toolBonus = player.toolTier * 4;
            s.hp -= damage + toolBonus;
            addParticle(s.x, s.y, "#aaaaaa");
            player.attackCd = 12;
            if(s.hp <= 0) {
                player.stone += s.stoneValue;
                stoneNodes.splice(i, 1);
                addParticle(s.x, s.y, "#888888");
                gainExp(10);
                spawnStones();
                updateUI();
            }
            return;
        }
    }
    
    // Атака железа
    for(let i = 0; i < ironNodes.length; i++) {
        let ir = ironNodes[i];
        let dist = Math.hypot(player.x - ir.x, player.y - ir.y);
        if(dist < attackRange) {
            let toolBonus = player.toolTier * 4;
            ir.hp -= damage + toolBonus;
            addParticle(ir.x, ir.y, "#3a6ea5");
            player.attackCd = 12;
            if(ir.hp <= 0) {
                player.iron += ir.ironValue;
                ironNodes.splice(i, 1);
                addParticle(ir.x, ir.y, "#2a4e85");
                gainExp(12);
                spawnIron();
                updateUI();
            }
            return;
        }
    }
    
    // Атака врагов
    for(let i = 0; i < enemies.length; i++) {
        let e = enemies[i];
        let dist = Math.hypot(player.x - e.x, player.y - e.y);
        if(dist < attackRange) {
            e.hp -= damage;
            addParticle(e.x, e.y, "#ff6666");
            player.attackCd = 10;
            if(e.hp <= 0) {
                player.wood += 3;
                player.stone += 2;
                gainExp(15);
                enemies.splice(i, 1);
                addParticle(e.x, e.y, "#ffaa44");
                spawnEnemy();
                updateUI();
            }
            return;
        }
    }
}

// ========== ОПЫТ И УРОВНИ ==========
function gainExp(amount) {
    player.exp += amount;
    let expNeeded = player.level * 50;
    if(player.exp >= expNeeded) {
        player.level++;
        player.exp -= expNeeded;
        player.maxHp += 15;
        player.hp = player.maxHp;
        player.attackDamage += 4;
        
        // Выбор улучшения
        let upgrade = confirm(`🏆 УРОВЕНЬ ${player.level}! Выберите улучшение:\n1 - Сила атаки +5\n2 - Макс. здоровье +20\n3 - Скорость добычи`);
        if(upgrade === true) {
            // для простоты: если OK -> сила атаки
            player.attackDamage += 5;
        } else if(upgrade === false) {
            player.maxHp += 20;
            player.hp = player.maxHp;
        }
        updateUI();
        gainExp(0);
    }
}

// ========== ПОСТРОЙКА ==========
function tryBuild(type) {
    let recipe = BUILDING_RECIPES[type];
    if(!recipe) return false;
    if(player.wood < recipe.wood || player.stone < recipe.stone || player.iron < recipe.iron) return false;
    
    let angle = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x);
    let buildX = player.x + Math.cos(angle) * (player.radius + recipe.radius + 8);
    let buildY = player.y + Math.sin(angle) * (player.radius + recipe.radius + 8);
    
    buildings.push({
        id: nextId++,
        type: type,
        x: buildX, y: buildY,
        radius: recipe.radius,
        hp: recipe.hp,
        maxHp: recipe.hp,
        shootCd: 0,
        color: recipe.color
    });
    
    player.wood -= recipe.wood;
    player.stone -= recipe.stone;
    player.iron -= recipe.iron;
    addParticle(buildX, buildY, "#ffcc88");
    updateUI();
    return true;
}

// ========== ОБНОВЛЕНИЕ ПОСТРОЕК ==========
function updateBuildings() {
    for(let b of buildings) {
        if(b.type === 'TURRET') {
            if(b.shootCd > 0) { b.shootCd--; continue; }
            let closest = null;
            let minDist = Infinity;
            for(let e of enemies) {
                let d = Math.hypot(b.x - e.x, b.y - e.y);
                if(d < BUILDING_RECIPES.TURRET.range && e.hp > 0 && d < minDist) {
                    minDist = d;
                    closest = e;
                }
            }
            if(closest) {
                closest.hp -= BUILDING_RECIPES.TURRET.damage;
                b.shootCd = 30;
                addParticle(closest.x, closest.y, "#ff8888");
            }
        }
    }
}

// ========== ДВИЖЕНИЕ ВРАГОВ И БОЙ ==========
function moveEnemies() {
    for(let i = 0; i < enemies.length; i++) {
        let e = enemies[i];
        let dx = player.x - e.x;
        let dy = player.y - e.y;
        let dist = Math.hypot(dx, dy);
        if(dist > 3) {
            let ang = Math.atan2(dy, dx);
            let move = Math.min(e.speed, dist - 5);
            e.x += Math.cos(ang) * move;
            e.y += Math.sin(ang) * move;
        }
        
        e.x = Math.min(Math.max(e.x, 5), WORLD_SIZE - 5);
        e.y = Math.min(Math.max(e.y, 5), WORLD_SIZE - 5);
        
        // Урон игроку
        let d = Math.hypot(player.x - e.x, player.y - e.y);
        if(d < player.radius + e.radius && player.invincible <= 0) {
            player.hp -= e.damage;
            player.invincible = 25;
            updateUI();
            addParticle(player.x, player.y, "#ff4444");
            if(player.hp <= 0) {
                alert(`💀 ${playerName} погиб. Перезапуск...`);
                initGame();
                return;
            }
        }
        
        // Урон стенам
        for(let b of buildings) {
            if(b.type === 'WALL') {
                let dw = Math.hypot(e.x - b.x, e.y - b.y);
                if(dw < e.radius + b.radius) {
                    b.hp -= e.damage * 0.7;
                    let ang = Math.atan2(e.y - b.y, e.x - b.x);
                    e.x += Math.cos(ang) * 12;
                    e.y += Math.sin(ang) * 12;
                    if(b.hp <= 0) {
                        buildings = buildings.filter(w => w.id !== b.id);
                        addParticle(b.x, b.y, "#aa8866");
                    }
                }
            }
        }
    }
}

// ========== КАМЕРА ==========
function updateCamera() {
    camX = player.x - canvasW / 2;
    camY = player.y - canvasH / 2;
    camX = Math.min(Math.max(camX, 0), WORLD_SIZE - canvasW);
    camY = Math.min(Math.max(camY, 0), WORLD_SIZE - canvasH);
}

// ========== UI ==========
function updateUI() {
    document.getElementById('playerNameLabel').innerText = playerName;
    document.getElementById('levelValue').innerText = player.level;
    document.getElementById('woodValue').innerText = Math.floor(player.wood);
    document.getElementById('stoneValue').innerText = Math.floor(player.stone);
    document.getElementById('hpValue').innerText = Math.max(0, player.hp);
    document.getElementById('weaponTier').innerText = player.weaponTier;
    document.getElementById('toolTier').innerText = player.toolTier;
    let percent = (player.hp / player.maxHp) * 100;
    document.getElementById('hpFill').style.width = percent + '%';
}

// ========== ОТРИСОВКА ==========
function draw() {
    updateCamera();
    ctx.clearRect(0, 0, canvasW, canvasH);
    
    // Трава/сетка
    ctx.fillStyle = "#1a3a2f";
    ctx.fillRect(0, 0, canvasW, canvasH);
    
    // Деревья
    for(let t of trees) {
        ctx.fillStyle = "#4a7a4a";
        ctx.beginPath();
        ctx.rect(t.x - camX - 6, t.y - camY - 10, 12, 20);
        ctx.fill();
        ctx.fillStyle = "#2a5a2a";
        ctx.beginPath();
        ctx.arc(t.x - camX, t.y - camY - 6, 10, 0, Math.PI * 2);
        ctx.fill();
        // полоска HP
        let percent = t.hp / 30;
        ctx.fillStyle = "#aa4444";
        ctx.fillRect(t.x - camX - 12, t.y - camY - 18, 24, 4);
        ctx.fillStyle = "#44aa44";
        ctx.fillRect(t.x - camX - 12, t.y - camY - 18, 24 * percent, 4);
    }
    
    // Камни
    for(let s of stoneNodes) {
        ctx.fillStyle = "#7a7a6a";
        ctx.beginPath();
        ctx.ellipse(s.x - camX, s.y - camY, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        let percent = s.hp / 45;
        ctx.fillStyle = "#aa4444";
        ctx.fillRect(s.x - camX - 12, s.y - camY - 12, 24, 4);
        ctx.fillStyle = "#aaaa44";
        ctx.fillRect(s.x - camX - 12, s.y - camY - 12, 24 * percent, 4);
    }
    
    // Железо
    for(let i of ironNodes) {
        ctx.fillStyle = "#5a8aaa";
        ctx.beginPath();
        ctx.ellipse(i.x - camX, i.y - camY, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        let percent = i.hp / 60;
        ctx.fillStyle = "#aa4444";
        ctx.fillRect(i.x - camX - 10, i.y - camY - 12, 20, 4);
        ctx.fillStyle = "#44aaff";
        ctx.fillRect(i.x - camX - 10, i.y - camY - 12, 20 * percent, 4);
    }
    
    // Постройки
    for(let b of buildings) {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x - camX, b.y - camY, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffcc88";
        ctx.lineWidth = 2;
        ctx.stroke();
        if(b.type === 'TURRET') ctx.fillText("🔫", b.x - camX - 8, b.y - camY + 7);
        if(b.type === 'TOWER') ctx.fillText("🗼", b.x - camX - 8, b.y - camY + 8);
        if(b.type === 'WALL') ctx.fillText("🧱", b.x - camX - 8, b.y - camY + 7);
        let hpPercent = b.hp / b.maxHp;
        ctx.fillStyle = "#aa4444";
        ctx.fillRect(b.x - camX - 14, b.y - camY - 16, 28, 4);
        ctx.fillStyle = "#88ff88";
        ctx.fillRect(b.x - camX - 14, b.y - camY - 16, 28 * hpPercent, 4);
    }
    
    // Враги
    for(let e of enemies) {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x - camX, e.y - camY, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.font = "bold 10px monospace";
        ctx.fillText(e.name, e.x - camX - 12, e.y - camY - 12);
        let hpPercent = e.hp / e.maxHp;
        ctx.fillStyle = "#aa4444";
        ctx.fillRect(e.x - camX - 14, e.y - camY - 18, 28, 4);
        ctx.fillStyle = "#ffaa44";
        ctx.fillRect(e.x - camX - 14, e.y - camY - 18, 28 * hpPercent, 4);
    }
    
    // Игрок (человек)
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#6ab06a";
    ctx.beginPath();
    ctx.arc(player.x - camX, player.y - camY, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a3a2a";
    ctx.beginPath();
    ctx.ellipse(player.x - camX - 5, player.y - camY - 5, 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(player.x - camX + 5, player.y - camY - 5, 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // оружие в руке
    let angleToMouse = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x);
    let handX = player.x + Math.cos(angleToMouse) * 16;
    let handY = player.y + Math.sin(angleToMouse) * 16;
    ctx.fillStyle = "#8B5E3C";
    ctx.fillRect(handX - camX - 3, handY - camY - 2, 20, 5);
    ctx.fillStyle = "#cc8844";
    ctx.fillRect(handX - camX + 12, handY - camY - 4, 8, 8);
    
    ctx.fillStyle = "white";
    ctx.font = "bold 10px 'Press Start 2P'";
    ctx.fillText(playerName, player.x - camX - 20, player.y - camY - 18);
    ctx.font = "bold 9px monospace";
    ctx.fillText(`Lv.${player.level}`, player.x - camX - 12, player.y - camY - 28);
    
    // Частицы
    for(let i = 0; i < particles.length; i++) {
        let p = particles[i];
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x - camX, p.y - camY, 3, 0, Math.PI * 2);
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        if(p.life <= 0) particles.splice(i, 1);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
function initGame() {
    player.x = WORLD_SIZE / 2;
    player.y = WORLD_SIZE / 2;
    player.hp = player.maxHp;
    player.wood = 20;
    player.stone = 10;
    player.iron = 5;
    player.level = 1;
    player.exp = 0;
    player.weaponTier = 1;
    player.toolTier = 1;
    player.attackDamage = 15;
    
    trees = [];
    stoneNodes = [];
    ironNodes = [];
    buildings = [];
    enemies = [];
    
    spawnTrees();
    spawnStones();
    spawnIron();
    for(let i = 0; i < ENEMY_BASE; i++) spawnEnemy();
    updateUI();
}

// ========== ЦИКЛ ==========
function gameLoop() {
    movePlayer();
    attack();
    updateBuildings();
    moveEnemies();
    draw();
    requestAnimationFrame(gameLoop);
}

// ========== ЗАПУСК ==========
document.getElementById('playButton').onclick = () => {
    let nick = document.getElementById('nicknameInput').value.trim();
    if(nick) playerName = nick.slice(0, 16);
    document.getElementById('menuOverlay').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'block';
    initGame();
    gameLoop();
};

// Кнопки построек
document.getElementById('btnWall').onclick = () => tryBuild('WALL');
document.getElementById('btnTurret').onclick = () => tryBuild('TURRET');
document.getElementById('btnTower').onclick = () => tryBuild('TOWER');

window.addEventListener('keydown', (e) => {
    if(e.key === '1') tryBuild('WALL');
    if(e.key === '2') tryBuild('TURRET');
    if(e.key === '3') tryBuild('TOWER');
});
