// ---------- ПОДКЛЮЧАЕМ ЭФФЕКТЫ ----------
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Эффекты частиц
let particles = [];

// Имя игрока
let playerName = "Воин";

// Размеры мира
const WORLD_SIZE = 3400;
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

// --- ИГРОК ---
let player = {
    x: WORLD_SIZE/2,
    y: WORLD_SIZE/2,
    radius: 20,
    hp: 100,
    maxHp: 100,
    invincibleFrames: 0,
    blocks: 0,
    kills: 0
};

// --- ПОСТРОЙКИ ---
let buildings = [];
let nextId = 1;

const BUILDINGS = {
    TURRET: { name: 'Пушка', cost:5, radius:22, color:'#e05a5a', range:210, damage:21, cooldownMax:32, shootCd:0 },
    TOWER: { name: 'Башня', cost:8, radius:24, color:'#a06eaa', range:320, scanOnly:true },
    WALL: { name: 'Стена', cost:3, radius:16, color:'#618c7a', hp:70, maxHp:70 }
};

// --- РЕСУРСЫ (свечение)---
let resources = [];
const RES_COUNT = 55;

function spawnResources() {
    for(let i=0;i<RES_COUNT;i++) {
        resources.push({ x: Math.random()*WORLD_SIZE, y: Math.random()*WORLD_SIZE, radius:9, value:1, glow: Math.random()*Math.PI*2 });
    }
}
spawnResources();

// --- ВРАГИ с именами и эффектами---
let enemies = [];
const ENEMY_BASE = 10;

function spawnEnemy() {
    let side = Math.floor(Math.random()*4);
    let x,y;
    if(side===0){ x=Math.random()*WORLD_SIZE; y=-40; }
    else if(side===2){ x=Math.random()*WORLD_SIZE; y=WORLD_SIZE+40; }
    else if(side===1){ x=WORLD_SIZE+40; y=Math.random()*WORLD_SIZE; }
    else { x=-40; y=Math.random()*WORLD_SIZE; }
    let radius = 13+Math.random()*12;
    let names = ["ВИХРЬ","ТАНК","ЩИТ","ОСКОЛОК","МАРКЕР","РЕЙД"];
    enemies.push({
        id:Math.random(),
        x:x,y:y,
        radius:radius,
        hp: 38 + radius*1.2,
        maxHp:38+radius*1.2,
        damage:13,
        speed:1.0+Math.random()*0.9,
        color:`hsl(${25+Math.random()*30},70%,55%)`,
        name: names[Math.floor(Math.random()*names.length)]
    });
}
for(let i=0;i<ENEMY_BASE;i++) spawnEnemy();

// --- ПОДСВЕТКА И ЭФФЕКТЫ ---
function addParticle(x,y,color) {
    particles.push({ x,y, vx:(Math.random()-0.5)*3, vy:(Math.random()-0.5)*3, life:0.8, color });
}

// --- ПЕРЕМЕННЫЕ МЫШИ---
let mouseWorldX = player.x, mouseWorldY = player.y;
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    let canvasX = (e.clientX - rect.left) * (canvasW/rect.width);
    let canvasY = (e.clientY - rect.top) * (canvasH/rect.height);
    mouseWorldX = camX + canvasX;
    mouseWorldY = camY + canvasY;
    mouseWorldX = Math.min(Math.max(mouseWorldX,0), WORLD_SIZE);
    mouseWorldY = Math.min(Math.max(mouseWorldY,0), WORLD_SIZE);
});

function movePlayer() {
    let dx = mouseWorldX - player.x;
    let dy = mouseWorldY - player.y;
    let dist = Math.hypot(dx,dy);
    let speed = 5.2;
    if(dist>3){
        let move = Math.min(speed, dist-2);
        let ang = Math.atan2(dy,dx);
        player.x += Math.cos(ang)*move;
        player.y += Math.sin(ang)*move;
    }
    player.x = Math.min(Math.max(player.x, player.radius), WORLD_SIZE - player.radius);
    player.y = Math.min(Math.max(player.y, player.radius), WORLD_SIZE - player.radius);
    if(player.invincibleFrames>0) player.invincibleFrames--;
}

function collectResources() {
    for(let i=0;i<resources.length;i++){
        let r=resources[i];
        if(Math.hypot(player.x-r.x, player.y-r.y) < player.radius+r.radius){
            player.blocks += r.value;
            addParticle(r.x, r.y, "#ffaa44");
            resources[i] = { x:Math.random()*WORLD_SIZE, y:Math.random()*WORLD_SIZE, radius:9, value:1, glow:Math.random()*Math.PI*2 };
            updateUI();
        }
    }
}

function updateUI() {
    document.getElementById('resourcesDisplay').innerText = Math.floor(player.blocks);
    document.getElementById('hpDisplay').innerText = Math.max(0, player.hp);
    let percent = (player.hp/player.maxHp)*100;
    document.getElementById('hpFill').style.width = percent+'%';
}

function tryBuild(typeKey) {
    let type = BUILDINGS[typeKey];
    if(!type) return false;
    if(player.blocks < type.cost) return false;
    let angle = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x);
    let buildX = player.x + Math.cos(angle)*(player.radius + type.radius + 8);
    let buildY = player.y + Math.sin(angle)*(player.radius + type.radius + 8);
    for(let b of buildings){
        if(Math.hypot(buildX-b.x, buildY-b.y) < b.radius+type.radius+8) return false;
    }
    let newBuild = {
        id: nextId++,
        type: typeKey,
        x: buildX, y: buildY, radius: type.radius,
        hp: type.hp || 9999, maxHp: type.maxHp || 9999,
        shootCd: 0
    };
    buildings.push(newBuild);
    player.blocks -= type.cost;
    addParticle(buildX, buildY, "#88ffaa");
    updateUI();
    return true;
}

function updateBuildings() {
    for(let b of buildings){
        if(b.type === 'TURRET'){
            if(b.shootCd>0){ b.shootCd--; continue; }
            let closest=null; let minD=Infinity;
            for(let e of enemies){
                let d = Math.hypot(b.x-e.x, b.y-e.y);
                if(d<BUILDINGS.TURRET.range && e.hp>0 && d<minD){ minD=d; closest=e; }
            }
            if(closest){
                closest.hp -= BUILDINGS.TURRET.damage;
                b.shootCd = BUILDINGS.TURRET.cooldownMax;
                addParticle(closest.x, closest.y, "#ff6666");
                if(closest.hp<=0){
                    player.blocks += 3;
                    updateUI();
                    addParticle(closest.x, closest.y, "#ffff88");
                }
            }
        }
    }
}

function moveEnemies() {
    for(let i=0;i<enemies.length;i++){
        let e = enemies[i];
        if(e.hp<=0){
            player.blocks += 3;
            updateUI();
            enemies.splice(i,1);
            spawnEnemy();
            continue;
        }
        let dx = player.x - e.x;
        let dy = player.y - e.y;
        let distToP = Math.hypot(dx,dy);
        if(distToP>1){
            let ang = Math.atan2(dy,dx);
            let move = Math.min(e.speed, distToP-4);
            e.x += Math.cos(ang)*move;
            e.y += Math.sin(ang)*move;
        }
        e.x = Math.min(Math.max(e.x,5), WORLD_SIZE-5);
        e.y = Math.min(Math.max(e.y,5), WORLD_SIZE-5);
        
        let dP = Math.hypot(player.x-e.x, player.y-e.y);
        if(dP < player.radius+e.radius && player.invincibleFrames<=0){
            player.hp -= e.damage;
            player.invincibleFrames = 20;
            updateUI();
            addParticle(player.x, player.y, "#ffaaaa");
            if(player.hp<=0){
                alert(`💀 ${playerName} был уничтожен... Перезапуск!`);
                initGame();
                return;
            }
        }
        for(let b of buildings){
            if(b.type==='WALL'){
                let dW = Math.hypot(e.x-b.x, e.y-b.y);
                if(dW < e.radius+b.radius){
                    b.hp -= e.damage*0.8;
                    let angle = Math.atan2(e.y-b.y, e.x-b.x);
                    e.x += Math.cos(angle)*9;
                    e.y += Math.sin(angle)*9;
                    if(b.hp<=0){
                        buildings = buildings.filter(w=>w.id!==b.id);
                        addParticle(b.x, b.y, "#aa8866");
                    }
                }
            }
        }
    }
}

function updateCamera() {
    camX = player.x - canvasW/2;
    camY = player.y - canvasH/2;
    camX = Math.min(Math.max(camX,0), WORLD_SIZE-canvasW);
    camY = Math.min(Math.max(camY,0), WORLD_SIZE-canvasH);
}

// --- ОТРИСОВКА С ПОСЛЕСВЕЧЕНИЕМ И ГРАДИЕНТАМИ---
function draw() {
    updateCamera();
    ctx.clearRect(0,0,canvasW,canvasH);
    
    // декоративная сетка
    ctx.strokeStyle = "rgba(100,180,255,0.08)";
    ctx.lineWidth = 1;
    for(let i=0;i<WORLD_SIZE;i+=150){
        ctx.beginPath();
        ctx.moveTo(i-camX, 0); ctx.lineTo(i-camX, canvasH);
        ctx.moveTo(0, i-camY); ctx.lineTo(canvasW, i-camY);
        ctx.stroke();
    }
    
    // ресурсы (сияющие)
    for(let r of resources){
        let grad = ctx.createRadialGradient(r.x-camX-2, r.y-camY-2, 2, r.x-camX, r.y-camY, r.radius);
        grad.addColorStop(0, "#3b9eff");
        grad.addColorStop(1, "#1a4cbb");
        ctx.beginPath();
        ctx.arc(r.x-camX, r.y-camY, r.radius-1, 0, Math.PI*2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.fillStyle = "#ffffffdd";
        ctx.font = "bold 12px monospace";
        ctx.fillText("◆", r.x-camX-4, r.y-camY+4);
    }
    
    // постройки
    for(let b of buildings){
        ctx.shadowBlur = 12;
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.beginPath();
        ctx.arc(b.x-camX, b.y-camY, b.radius, 0, Math.PI*2);
        if(b.type==='TURRET') ctx.fillStyle = "#c44545";
        else if(b.type==='TOWER') ctx.fillStyle = "#aa77bb";
        else ctx.fillStyle = "#6e9e8a";
        ctx.fill();
        ctx.strokeStyle = "#ffcc88";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "white";
        ctx.font = "bold 16px monospace";
        if(b.type==='TURRET') ctx.fillText("⚡", b.x-camX-8, b.y-camY+7);
        if(b.type==='TOWER') ctx.fillText("🗼", b.x-camX-8, b.y-camY+8);
        if(b.type==='WALL') ctx.fillText("🧱", b.x-camX-8, b.y-camY+7);
        
        if(b.type==='WALL' && b.hp<b.maxHp){
            let percent = b.hp/b.maxHp;
            ctx.fillStyle = "#aa4a4a";
            ctx.fillRect(b.x-camX-14, b.y-camY-14, 28, 5);
            ctx.fillStyle = "#88cc88";
            ctx.fillRect(b.x-camX-14, b.y-camY-14, 28*percent, 4);
        }
    }
    
    // враги
    for(let e of enemies){
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(e.x-camX, e.y-camY, e.radius-1, 0, Math.PI*2);
        ctx.fillStyle = e.color;
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 18px monospace";
        ctx.fillText("👾", e.x-camX-10, e.y-camY+7);
        ctx.font = "bold 9px 'Orbitron'";
        ctx.fillStyle = "#ffccaa";
        ctx.fillText(e.name, e.x-camX-12, e.y-camY-10);
        let hpPercent = e.hp/e.maxHp;
        ctx.fillStyle = "#8a3a3a";
        ctx.fillRect(e.x-camX-14, e.y-camY-18, 28, 5);
        ctx.fillStyle = "#6fbf6f";
        ctx.fillRect(e.x-camX-14, e.y-camY-18, 28*hpPercent, 4);
    }
    
    // игрок с аурой
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#62ff88";
    let grad = ctx.createRadialGradient(player.x-camX-5, player.y-camY-5, 5, player.x-camX, player.y-camY, player.radius);
    grad.addColorStop(0, "#6cdf7c");
    grad.addColorStop(1, "#359f55");
    ctx.beginPath();
    ctx.arc(player.x-camX, player.y-camY, player.radius, 0, Math.PI*2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "#ffffaa";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.font = "bold 18px 'Press Start 2P'";
    ctx.fillStyle = "#ffffee";
    ctx.shadowBlur = 8;
    ctx.fillText("🛡️", player.x-camX-12, player.y-camY+8);
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = "#ffffbb";
    ctx.fillText(playerName, player.x-camX-20, player.y-camY-16);
    
    // полоска HP игрока
    let hpPercent = player.hp/player.maxHp;
    ctx.fillStyle = "#9a3a2a";
    ctx.fillRect(player.x-camX-24, player.y-camY-28, 48, 7);
    ctx.fillStyle = "#ffbb66";
    ctx.fillRect(player.x-camX-24, player.y-camY-28, 48*hpPercent, 6);
    
    // частицы
    for(let i=0;i<particles.length;i++){
        let p=particles[i];
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x-camX, p.y-camY, 3, 0, Math.PI*2);
        ctx.fill();
        p.x+=p.vx;
        p.y+=p.vy;
        p.life-=0.02;
        if(p.life<=0) particles.splice(i,1);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

function gameLoop() {
    movePlayer();
    collectResources();
    updateBuildings();
    moveEnemies();
    draw();
    requestAnimationFrame(gameLoop);
}

function initGame() {
    player.x = WORLD_SIZE/2;
    player.y = WORLD_SIZE/2;
    player.hp = player.maxHp;
    player.blocks = 0;
    player.invincibleFrames = 0;
    buildings = [];
    resources = [];
    enemies = [];
    spawnResources();
    for(let i=0;i<ENEMY_BASE;i++) spawnEnemy();
    updateUI();
}

// --- МЕНЮ И СТАРТ ---
document.getElementById('playButton').addEventListener('click', () => {
    let nick = document.getElementById('nicknameInput').value.trim();
    if(nick !== "") playerName = nick.slice(0,16);
    else playerName = "ЗАЩИТНИК";
    document.getElementById('menuOverlay').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'block';
    initGame();
    gameLoop();
});

// КНОПКИ ПОСТРОЕК В ИГРЕ
document.getElementById('btnTurretUI').onclick = () => tryBuild('TURRET');
document.getElementById('btnTowerUI').onclick = () => tryBuild('TOWER');
document.getElementById('btnWallUI').onclick = () => tryBuild('WALL');
window.addEventListener('keydown', (e) => {
    if(e.key === '1') tryBuild('TURRET');
    if(e.key === '2') tryBuild('TOWER');
    if(e.key === '3') tryBuild('WALL');
});

// --- ФОН С ЧАСТИЦАМИ (красиво)---
const particlesCanvas = document.getElementById('particles-canvas');
const pCtx = particlesCanvas.getContext('2d');
function resizeParticles() {
    particlesCanvas.width = window.innerWidth;
    particlesCanvas.height = window.innerHeight;
}
resizeParticles();
window.addEventListener('resize', resizeParticles);
let bgParticles = [];
for(let i=0;i<90;i++){
    bgParticles.push({ x:Math.random()*window.innerWidth, y:Math.random()*window.innerHeight, size:1+Math.random()*2, alpha:Math.random()*0.5 });
}
function drawBgParticles() {
    pCtx.clearRect(0,0, particlesCanvas.width, particlesCanvas.height);
    for(let p of bgParticles){
        pCtx.fillStyle = `rgba(255,200,100,${p.alpha})`;
        pCtx.beginPath();
        pCtx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        pCtx.fill();
    }
    requestAnimationFrame(drawBgParticles);
}
drawBgParticles();
