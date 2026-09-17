import { COMPONENTS, LEVELS, portPosition, normalizePair, validateCircuit, calculateScore } from './circuits.js';
import { store } from './storage.js';
import { wirePath } from './wire-routing.js';

const $ = (selector, root = document) => root.querySelector(selector);
const main = $('#main');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',back:'<path d="M19 12H5m5-5-5 5 5 5"/>',user:'<circle cx="12" cy="8" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>',book:'<path d="M12 5v15M3 4h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v14h-5a5 5 0 0 0-4 2 5 5 0 0 0-4-2H3Z"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',bolt:'<path d="m14 2-9 12h7l-2 8 9-12h-7Z"/>',check:'<path d="m5 12 4 4L19 6"/>',award:'<circle cx="12" cy="9" r="6"/><path d="m8 14-2 8 6-3 6 3-2-8"/>',download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',undo:'<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12h-3"/>',bulb:'<path d="M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0l-1 3H9Z"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',reset:'<path d="M3 10a9 9 0 1 1 2 8M3 3v7h7"/>'})[name] || ''}</svg>`;
const time = seconds => `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
let game = null;
let ticker = null;
let currentRoute = '';
let requestedLevel = 0;
let drag = null;
let suppressClickUntil = 0;

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => $('#toast').classList.remove('show'), 3500);
}
function modal(html) {
  $('#modal-body').innerHTML = html;
  if (!$('#modal').open) $('#modal').showModal();
}
function closeModal() { $('#modal').close(); }
function go(route) { if (location.hash === `#${route}`) renderRoute(); else location.hash = route; }
function seconds() { return Math.floor(((game?.elapsed || 0) + (game?.runningSince ? Date.now() - game.runningSince : 0)) / 1000); }
function pauseTimer() {
  if (game?.runningSince) { game.elapsed += Date.now() - game.runningSince; game.runningSince = null; }
  clearInterval(ticker); ticker = null;
}
function runTimer() {
  if (!game || game.complete || document.hidden) return;
  game.runningSince = Date.now();
  ticker = setInterval(() => { if ($('#timer')) $('#timer').textContent = time(seconds()); }, 1000);
}
function score() { return calculateScore({wrongAttempts:game.wrong,hintsUsed:game.hints}); }
function updateScore() { if ($('#score')) $('#score').textContent = score(); }
function currentLevel() { return LEVELS[game.index]; }
function completedLevels(player = store.getName()) { return new Set(store.getResults().filter(r => r.player === player).map(r => r.level)); }

function renderHome() {
  const name = store.getName();
  const done = completedLevels(name);
  const canResume = game && !game.complete;
  main.innerHTML = `<div class="section-heading"><div><h1>ห้องทดลองของนักสร้างสรรค์<span class="brand-dot">.</span></h1><p>เปลี่ยนเรื่องวงจรไฟฟ้า ให้เป็นเรื่องที่เข้าใจได้ด้วยการลงมือทำ</p></div><div class="date-pill"><i></i> พร้อมเรียนรู้ได้ทุกวัน</div></div>
    <div class="hero-row"><section class="hero"><img class="hero-image" src="./assets/hero-car.webp" alt="รถสีเงินในห้องทดลองสีเขียว พร้อมไฟหน้าส่องสว่างและลายวงจรบนพื้น" width="1536" height="1024" fetchpriority="high"><span class="hero-tag">INTERACTIVE LEARNING EXPERIENCE</span><h2>ต่อวงจรความคิด<br><em>จุดติดทุกการเรียนรู้</em></h2><p>สวมบทช่างยนต์รุ่นใหม่ สำรวจระบบไฟรถยนต์<br>ผ่าน 5 ภารกิจสนุก ตั้งแต่สัญลักษณ์<br>ไปจนถึงการวิเคราะห์วงจรด้วยตัวเอง</p><div class="hero-foot"><div class="hero-tags"><span><b>↗</b> เรียนรู้ทีละขั้น</span><span><b>⊕</b> ลองทำได้จริง</span><span><b>✓</b> รู้ผลทันที</span></div><span class="hero-code">12V / LEARNING LAB</span></div></section>
    <section class="start-card"><div class="small-icon">${icon('user')}</div><h2>${canResume?'กลับมาลุยกันต่อ':'พร้อมจุดประกายแล้วหรือยัง?'}</h2><p>${canResume?`ภารกิจ ${game.index+1} กำลังรอคุณอยู่`:'ใส่ชื่อเล่น แล้วออกเดินทางสู่ภารกิจแรก'}</p><form id="start-form"><label for="player-name">ชื่อผู้เรียน</label><input class="text-input" id="player-name" name="player" placeholder="ชื่อเล่นของคุณ" value="${escape(name)}" maxlength="40" autocomplete="off" required><p id="name-error" class="form-error" role="alert" hidden></p><button class="button primary block" type="submit">เริ่มเรียนรู้ ${icon('arrow')}</button></form>${canResume?'<button class="button block" data-action="resume">ทำภารกิจเดิมต่อ →</button>':''}<p class="start-foot">ไม่ต้องสมัครสมาชิก • เรียนรู้ได้ตามจังหวะของตัวเอง</p></section></div>
    <section class="overview-strip" aria-label="ภาพรวมบทเรียน"><div class="overview-item"><div class="stat-icon">${icon('book')}</div><div><strong>5<small>ภารกิจการเรียนรู้</small></strong><p>จากพื้นฐาน สู่การวิเคราะห์</p></div></div><div class="overview-item"><div class="stat-icon">${icon('clock')}</div><div><strong>20–30<small>นาที</small></strong><p>เรียนได้สบาย ๆ ไม่จำกัดเวลา</p></div></div><div class="overview-item"><div class="stat-icon">${icon('award')}</div><div><strong>${done.size}<small>/ 5 ภารกิจสำเร็จ</small></strong><p>${name?`ความก้าวหน้าของ ${escape(name)}`:'เริ่มต้นเก็บความสำเร็จของคุณ'}</p></div></div></section>
    <section><div class="missions-heading"><div><h2>เส้นทางนักต่อวงจร</h2><p>ค่อย ๆ ฝึก ค่อย ๆ เข้าใจ เลือกภารกิจที่อยากลองได้เลย</p></div><a class="button ghost" href="#learn">ดูคลังความรู้ ${icon('arrow')}</a></div><div class="mission-grid">${LEVELS.map((level,index)=>`<button class="mission-card ${index===0?'featured':''}" data-action="mission" data-level="${index}"><div class="mission-top"><span class="mission-number">MISSION 0${level.id}</span><span class="difficulty ${index>1?'mid':''}">${done.has(level.id)?'✓ ผ่านแล้ว':level.difficulty}</span></div><div class="mission-art">${index===4?icon('search'):COMPONENTS[['battery','lamp','relay','selector'][index]].symbol}</div><h3>${level.title}</h3><p>${level.subtitle}</p><div class="mission-bottom"><span>◷ ประมาณ ${level.minutes} นาที</span><b aria-hidden="true">↗</b></div></button>`).join('')}</div></section>
    <div class="learning-note"><p><strong>ความผิดพลาดคือส่วนหนึ่งของการเรียนรู้</strong> ลองต่อ ลองคิด แล้วค้นพบคำตอบด้วยตัวเอง</p><span>EXPLORE · CONNECT · DISCOVER</span></div>`;
}

function start(index, player) {
  pauseTimer();
  const safeName = player.trim().slice(0,40);
  if (!safeName) return;
  store.saveName(safeName);
  game = {id:globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,index,player:safeName,wrong:0,hints:0,elapsed:0,runningSince:null,matched:new Set(),connections:[],selected:null,answer:null,complete:false,beam:'low',feedback:null};
  closeModal(); go('lab');
}
function chooseMission(index) {
  requestedLevel = index;
  if (game && !game.complete) {
    modal(`<p class="eyebrow">CONTINUE LEARNING</p><h2>เริ่มภารกิจใหม่?</h2><p>งานที่ยังไม่ผ่านในภารกิจปัจจุบันจะเริ่มใหม่ ผลที่ผ่านและบันทึกไว้แล้วจะยังอยู่</p><div class="modal-actions"><button class="button" data-action="close-modal">ทำต่อก่อน</button><button class="button primary" data-action="confirm-start">เริ่มภารกิจ ${index+1}</button></div>`);
  } else if (store.getName()) start(index,store.getName());
  else showNameModal(index);
}
function showNameModal(index) {
  requestedLevel = index;
  modal(`<p class="eyebrow">LET’S GET STARTED</p><h2>เรียกคุณว่าอะไรดี?</h2><p>ใช้ชื่อเล่นสำหรับบันทึกผลการเรียนในอุปกรณ์นี้</p><form id="mission-form"><label for="modal-name">ชื่อผู้เรียน</label><input id="modal-name" class="text-input" maxlength="40" required autocomplete="off" placeholder="ชื่อเล่นของคุณ"><button type="submit" class="button primary block">เริ่มภารกิจ ${index+1} ${icon('arrow')}</button></form>`);
}

function carGraphic() {
  return `<svg viewBox="0 0 180 95" aria-hidden="true"><path d="m29 45 13-28q2-4 8-4h80q6 0 8 4l13 28 9 9v24H20V54Z" fill="#6f8d78" stroke="#b8c8b0" stroke-width="2"/><path d="m42 42 9-20h78l9 20Z" fill="#1b3b31" stroke="#b8c8b0"/><rect x="23" y="75" width="24" height="14" rx="4" fill="#071e18"/><rect x="133" y="75" width="24" height="14" rx="4" fill="#071e18"/><path d="m29 52 36 6-2 9H30ZM151 52l-36 6 2 9h33Z" class="car-light"/><path d="M73 59h34m-36 7h38m-57 8h76" stroke="#244a37" stroke-width="3"/></svg>`;
}
function renderLab() {
  if (!game) { renderHome(); showNameModal(0); return; }
  const level=currentLevel();
  main.innerHTML = `<a class="back-link" href="#home">${icon('back')} กลับหน้าหลัก</a><div class="lab-head"><div><h1>${level.title}</h1><p>${level.description}</p></div><span class="level-counter">MISSION 0${level.id} / 05</span></div><div class="stepper" aria-label="ภารกิจที่ ${level.id} จาก 5">${LEVELS.map((l,i)=>`<div class="step ${i===game.index?'current':completedLevels(game.player).has(l.id)?'done':''}"></div>`).join('')}</div>
    <div class="lab-toolbar"><div class="learner"><span class="avatar">${escape(game.player.slice(0,1))}</span><div><small>นักต่อวงจร</small><strong>${escape(game.player)}</strong></div></div><div class="lab-stats"><span>คะแนน <b id="score">${score()}</b><span>/ 100</span></span><span>เวลาเรียน <b id="timer">${time(seconds())}</b></span></div></div>
    <div class="lab-layout"><aside class="lab-aside ${level.type==='circuit'?'circuit-aside':''}">${level.type==='match'?`<section class="panel"><h2>กล่องอุปกรณ์</h2><p class="panel-caption">ลากชื่อ หรือแตะเลือกแล้วแตะช่อง</p><div class="equipment-list">${level.items.map(key=>`<button class="equipment ${game.matched.has(key)?'matched':''}" data-equipment="${key}" aria-pressed="false" ${game.matched.has(key)||game.complete?'disabled':''}><span class="grip" aria-hidden="true">⠿</span><span><strong>${COMPONENTS[key].name}</strong><small>${COMPONENTS[key].english}</small></span><span class="check">${game.matched.has(key)?'✓':''}</span></button>`).join('')}</div></section>`:`<div class="car-status ${game.complete&&level.type==='circuit'?'is-on':''}" id="car-status">${carGraphic()}<p id="lamp-status">${game.complete?'ทดสอบสำเร็จ':'รอการตรวจคำตอบ'}</p></div>${level.id===4?'<div class="beam-toggle" aria-label="เลือกไฟสำหรับการทดสอบ"><button data-action="beam" data-beam="low" class="active" aria-pressed="true">ไฟต่ำ</button><button data-action="beam" data-beam="high" aria-pressed="false">ไฟสูง</button></div>':''}<section class="panel"><h2>${level.type==='circuit'?'วิธีต่อสาย':'อ่านค่าก่อนตอบ'}</h2><p class="lesson-note">${level.type==='circuit'?'แตะขั้วต้นทาง แล้วแตะขั้วปลายทาง หรือลากระหว่างขั้ว<br><br>ลบสายได้จากรายการใต้แผง และกด Esc เพื่อยกเลิกขั้วที่เลือก':'พิจารณาผลการวัดทั้งแรงดันและความต่อเนื่อง แล้วเลือกคำตอบที่สอดคล้องกับหลักฐาน'}</p></section>`}<section class="panel lesson-panel"><p class="lesson-note"><strong>เรียนรู้ได้ ไม่ต้องรีบ</strong>เริ่มที่ 100 คะแนน<br>ตรวจผิด −10 · ใช้คำใบ้ −5<br>เวลาไม่มีผลต่อคะแนน</p></section></aside>
    <section class="panel board-panel"><div class="board-top"><h2>${level.type==='match'?'จับคู่สัญลักษณ์':level.type==='circuit'?'แผงทดลองวงจร':'แฟ้มวิเคราะห์ปัญหา'}</h2><span id="board-count"></span></div><div id="board-content"></div><div class="board-footer"><i class="status-dot ${game.complete?'on':''}" id="status-dot"></i><span id="board-status">${game.complete?'ภารกิจสำเร็จแล้ว':'พร้อมให้คุณทดลอง'}</span></div></section></div>
    <div id="feedback" role="status" aria-live="polite" hidden></div><div id="hint" class="feedback hint" ${game.hints?'':'hidden'}>💡 ${level.hint}</div><div class="lab-actions"><div class="action-group"><button class="button" data-action="reset">${icon('reset')} เริ่มใหม่</button>${level.type==='circuit'?`<button class="button" id="undo" data-action="undo" ${game.complete?'disabled':''}>${icon('undo')} ย้อนกลับ</button>`:''}<button class="button" data-action="hint" ${game.complete?'disabled':''}>${icon('bulb')} คำใบ้ ${game.hints?'(เปิดแล้ว)':'−5'}</button></div><button class="button primary" id="test-button" data-action="${game.complete?'result':'test'}">${game.complete?'ดูผลภารกิจ':'ตรวจคำตอบ'} ${icon('arrow')}</button></div>${level.type==='circuit'?'<p class="board-help">แบบฝึกตรวจตามผังที่กำหนด • สวิตช์ไฟจะอยู่ที่ ON เมื่อทดสอบ • จอเล็กเลื่อนแผงแนวนอน หรือเลือกขั้วจากรายชื่อได้</p>':''}`;
  if(level.type==='match') renderMatch();
  else if(level.type==='circuit') renderCircuit();
  else renderDiagnosis();
  if(game.feedback) feedback(game.feedback.message,game.feedback.success);
}

function renderMatch() {
  const order = ['relay','battery','lamp','ground','fuse','switch'];
  const shapes = {relay:'รูปหน้าสัมผัสด้านบนและขดลวดสี่เหลี่ยมด้านล่าง เชื่อมกันด้วยเส้นประ',battery:'เส้นแนวตั้งยาวสลับสั้น พร้อมเครื่องหมายบวกและลบ',lamp:'วงกลมมีกากบาทภายใน',ground:'เส้นลงสู่เส้นนอนที่มีขีดเฉียงด้านล่าง',fuse:'สี่เหลี่ยมผืนผ้ามีเส้นผ่านกลาง',switch:'หน้าสัมผัสสองจุด มีคันโยกเอียงเปิดอยู่'};
  $('#board-content').innerHTML = `<div class="match-board board-grid">${order.map((key,i)=>`<button class="drop-zone ${game.matched.has(key)?'matched':''}" data-target="${key}" aria-label="ช่องสัญลักษณ์ ${i+1} ${game.matched.has(key)?COMPONENTS[key].name:shapes[key]}" ${game.matched.has(key)||game.complete?'disabled':''}>${COMPONENTS[key].symbol}<span>${game.matched.has(key)?'✓ '+COMPONENTS[key].name:`วางอุปกรณ์ช่อง ${i+1}`}</span></button>`).join('')}</div>`;
  $('#board-count').textContent = `${game.matched.size} / 6 คู่`;
}
function match(key,target) {
  if(game.complete || !key || game.matched.has(target) || game.matched.has(key)) return;
  if(key===target){
    game.matched.add(key);game.selected=null;
    document.querySelectorAll('.equipment.selected').forEach(button=>{button.classList.remove('selected');button.setAttribute('aria-pressed','false');});
    const source = $(`[data-equipment="${key}"]`);
    source.classList.add('matched'); source.classList.remove('selected');source.setAttribute('aria-pressed','false');source.disabled=true;$('.check',source).textContent='✓';
    renderMatch();feedback(`ถูกต้อง! ${COMPONENTS[key].name}${game.matched.size===6?' จับคู่ครบแล้ว กดตรวจคำตอบเพื่อบันทึกผล':''}`,true);
    $('#board-status').textContent=game.matched.size===6?'จับคู่ครบแล้ว พร้อมตรวจคำตอบ':'เลือกอุปกรณ์ชิ้นถัดไปได้เลย';
    const next = $('.equipment:not(:disabled)') || $('#test-button');
    next?.focus({preventScroll:true});
  } else { game.wrong++;updateScore();feedback('ยังไม่ตรงกัน ลองดูรูปร่างของสัญลักษณ์อีกครั้ง (−10 คะแนน)',false); }
}

function portMap() {
  return new Map(currentLevel().nodes.flatMap(node=>node.ports.map(port=>[port.id,{...port,...portPosition(node,port),node,label:`${node.label} · ${port.label}`}])));
}
function renderCircuit() {
  const level=currentLevel(), ports=portMap();
  $('#board-content').innerHTML = `<details class="terminal-picker"><summary>ต่อสายด้วยรายชื่อขั้ว (มือถือ / คีย์บอร์ด)</summary><form id="wire-form"><label>จาก<select id="wire-from" ${game.complete?'disabled':''}><option value="">เลือกขั้วต้นทาง</option>${[...ports].map(([id,p])=>`<option value="${id}">${p.label}</option>`).join('')}</select></label><label>ไป<select id="wire-to" ${game.complete?'disabled':''}><option value="">เลือกขั้วปลายทาง</option>${[...ports].map(([id,p])=>`<option value="${id}">${p.label}</option>`).join('')}</select></label><button class="button small" ${game.complete?'disabled':''}>ต่อสาย +</button></form></details><div class="circuit-scroll" tabindex="0" role="region" aria-label="แผงวงจร เลื่อนแนวนอนได้"><div class="circuit-board board-grid" id="circuit-board"><svg class="wires" viewBox="0 0 900 480" aria-hidden="true"><g id="wire-lines"></g><path id="wire-preview" class="wire-preview"/></svg>${level.nodes.map(node=>`<div class="circuit-node" data-node="${node.id}" style="left:${node.x-56}px;top:${node.y-41}px">${COMPONENTS[node.key].symbol}<span class="node-label">${node.label}</span>${node.ports.map(p=>{const pos=portPosition(node,p);return `<button class="terminal" style="left:${pos.x-node.x+56}px;top:${pos.y-node.y+41}px" data-port="${p.id}" data-side="${p.side}" aria-label="${node.label} ขั้ว ${p.label}" aria-pressed="false" ${game.complete?'disabled':''}><span class="terminal-label">${p.label}</span></button>`;}).join('')}</div>`).join('')}</div></div><div id="connection-list" class="connection-list"></div>`;
  drawWires();
  if(game.complete){
    level.nodes.filter(node=>node.key==='lamp').forEach(node=>$(`[data-node="${node.id}"]`)?.classList.add('lit'));
    const switchPath=$('[data-node="switch"] svg path');
    if(switchPath)switchPath.setAttribute('d','M5 41h10m35 0h9M20 41h24');
    const relayPath=$('[data-node="relay"] svg path');
    if(relayPath)relayPath.setAttribute('d','M4 18h10m36 0h10M19 18h25M4 47h15m26 0h15');
  }
  updateBeam();
}
function drawWires() {
  const ports=portMap();
  $('#wire-lines').innerHTML=game.connections.map(([a,b])=>`<path class="wire ${game.complete?'wire-live':''}" data-wire="${escape(normalizePair(a,b))}" d="${wirePath(ports.get(a),ports.get(b),currentLevel().nodes)}"/>`).join('');
  const connected=new Set(game.connections.flat());
  document.querySelectorAll('[data-port]').forEach(button=>{button.classList.toggle('connected',connected.has(button.dataset.port));button.classList.toggle('selected',game.selected===button.dataset.port);button.setAttribute('aria-pressed',String(game.selected===button.dataset.port));});
  $('#connection-list').innerHTML=game.connections.length?game.connections.map(([a,b],i)=>`<button class="wire-chip" data-action="remove-wire" data-index="${i}" aria-label="ลบสาย ${escape(ports.get(a).label)} ไป ${escape(ports.get(b).label)}" ${game.complete?'disabled':''}>${ports.get(a).label} ↔ ${ports.get(b).label} <b>×</b></button>`).join(''):'<span class="board-help">ยังไม่มีสายไฟ · เลือกขั้วแรกเพื่อเริ่มต่อ</span>';
  $('#board-count').textContent=`${game.connections.length} / ${currentLevel().required.length} สาย`;
  if($('#undo')) $('#undo').disabled=!game.connections.length||game.complete;
}
function connect(a,b) {
  if(game.complete)return;
  const ports=portMap();
  if(!ports.has(a)||!ports.has(b))return;
  if(a===b){game.selected=null;drawWires();return;}
  if(game.connections.some(pair=>normalizePair(...pair)===normalizePair(a,b))){toast('มีสายนี้แล้ว เลือกขั้วอื่นได้เลย');game.selected=null;drawWires();return;}
  game.connections.push([a,b]);game.selected=null;drawWires();
  $('#board-status').textContent=`ต่อสายแล้ว: ${ports.get(a).label} → ${ports.get(b).label}`;
}
function selectPort(id) {
  if(game.complete)return;
  if(game.selected)connect(game.selected,id);
  else {game.selected=id;drawWires();$('#board-status').textContent=`เลือก ${portMap().get(id).label} แล้ว เลือกปลายทาง`;}
}
function updateBeam() {
  if(currentLevel().id!==4)return;
  const selectorPath=$('[data-node="selector"] svg path');
  if(selectorPath)selectorPath.setAttribute('d',`M4 32h11m36-17h9m-9 34h9M21 32L45 ${game.beam==='low'?15:49}`);
  document.querySelectorAll('[data-beam]').forEach(button=>{button.classList.toggle('active',button.dataset.beam===game.beam);button.setAttribute('aria-pressed',String(button.dataset.beam===game.beam));});
  for(const id of ['low','high']){
    const node=$(`[data-node="${id}"]`);if(node)node.classList.toggle('lit',game.complete&&game.beam===id);
  }
  if(game.complete){
    $('#lamp-status').textContent=game.beam==='low'?'ไฟต่ำทำงาน':'ไฟสูงทำงาน';
    document.querySelectorAll('[data-wire]').forEach(wire=>{const ids=wire.dataset.wire;const inactive=game.beam==='low'?'high':'low';wire.classList.toggle('wire-live',!ids.includes(`${inactive}:`)&&!ids.includes(`selector:${inactive}`));});
  }
}
function renderDiagnosis() {
  const level=currentLevel();
  $('#board-content').innerHTML=`<div class="diagnosis"><h3>ไฟหน้าไม่ติดทั้งสองข้าง</h3><div class="case">ช่างวัดค่าโดยเทียบกับขั้วลบแบตเตอรี่ที่ปกติ ขณะเปิดสวิตช์และต่อโหลดไว้ จากนั้นตัดไฟและถอดฟิวส์ออกมาตรวจ ได้ผลดังนี้</div><div class="measurements">${level.measurements.map(m=>`<div class="measurement"><span>${m.label}</span><b ${m.status==='fault'?'style="color:#a05e36"':''}>${m.value}</b></div>`).join('')}</div><p>อุปกรณ์ใดขัดข้องตามหลักฐานที่พบ?</p><div class="answer-grid">${level.options.map((o,i)=>`<button class="answer ${game.answer===o.id?'selected':''}" data-answer="${o.id}" aria-pressed="${game.answer===o.id}" ${game.complete?'disabled':''}>${String.fromCharCode(65+i)}. ${o.label}</button>`).join('')}</div></div>`;
  $('#board-count').textContent='วิเคราะห์จากหลักฐาน';
}

function feedback(message,success) {
  game.feedback={message,success};
  const box=$('#feedback');if(!box)return;
  box.hidden=false;box.className=`feedback ${success?'success':'error'}`;box.textContent=message;
}
function test() {
  if(!game||game.complete)return;
  const level=currentLevel();
  let correct=false, message='';
  if(level.type==='match'){correct=game.matched.size===level.items.length;message=`ยังเหลืออีก ${level.items.length-game.matched.size} คู่ ลองจับคู่ให้ครบก่อนนะ`;} 
  else if(level.type==='analysis'){
    if(!game.answer){feedback('เลือกคำตอบก่อนตรวจได้เลย ยังไม่หักคะแนน',false);return;}
    correct=game.answer===level.answer;message=level.options.find(o=>o.id===game.answer).explanation;
  } else {
    const result=validateCircuit(level,game.connections);correct=result.correct;
    message=result.extra.length?`มีสาย ${result.extra.length} เส้นที่ไม่ตรงผัง ลบสายที่เชื่อมผิดแล้วลองใหม่`:`ยังขาดสาย ${result.missing.length} เส้น ตรวจทั้งทางจ่ายไฟและทางกลับกราวด์`;
  }
  if(!correct){game.wrong++;updateScore();feedback(`${message} (−10 คะแนน)`,false);return;}
  game.complete=true;pauseTimer();game.selected=null;
  const persisted=store.saveResult({id:game.id,player:game.player,level:level.id,score:score(),seconds:seconds(),wrong:game.wrong,hints:game.hints,date:new Date().toISOString()});
  renderLab();
  feedback(level.type==='circuit'?'ต่อถูกต้อง! ปิดสวิตช์แล้ววงจรครบ หลอดไฟทำงานตามผัง':'ยอดเยี่ยม! ผ่านภารกิจนี้แล้ว กดดูผลภารกิจเพื่อเรียนรู้ต่อ',true);
  $('#board-status').textContent=persisted?'ภารกิจสำเร็จ · บันทึกผลในอุปกรณ์นี้แล้ว':'ภารกิจสำเร็จ · เก็บผลชั่วคราวในหน้านี้';
  if(!persisted)toast('เบราว์เซอร์ไม่อนุญาตให้บันทึกถาวร ส่งออกผลก่อนปิดหน้าได้');
  if(level.type==='circuit'){
    $('#car-status').classList.add('is-on');$('#lamp-status').textContent='หลอดไฟทำงาน';
    currentLevel().nodes.filter(n=>n.key==='lamp').forEach(n=>$(`[data-node="${n.id}"]`)?.classList.add('lit'));
    updateBeam();
  }
}
function useHint() {
  if(game.complete)return;
  if(game.hints){$('#hint').hidden=!$('#hint').hidden;return;}
  game.hints=1;updateScore();$('#hint').hidden=false;
  $('[data-action="hint"]').innerHTML=`${icon('bulb')} คำใบ้ (เปิดแล้ว)`;
}

function renderResult() {
  if(!game?.complete){renderHome();return;}
  const level=currentLevel(), all=completedLevels(game.player).size===5;
  main.innerHTML=`<section class="result-card"><div class="result-top"><div class="result-icon">${icon(all?'award':'check')}</div><p class="eyebrow" style="justify-content:center;color:#d6e8bb">MISSION COMPLETE</p><h1>${all?'นักต่อวงจรคนใหม่ ทำได้แล้ว!':'อีกก้าวที่เก่งขึ้น ยอดเยี่ยมเลย!'}</h1><p>${escape(game.player)} · ผ่านภารกิจ ${level.id}: ${level.title}</p></div><div class="result-body"><div class="result-score">${score()}<small> / 100 คะแนน</small></div><p class="panel-caption">${all?'คุณเรียนรู้ครบทั้ง 5 ภารกิจแล้ว':'เรียนรู้จากทุกครั้งที่ลงมือทำ'}</p><div class="result-stats"><div><p>เวลาเรียน</p><b>${time(seconds())}</b></div><div><p>ลองผิด</p><b>${game.wrong} ครั้ง</b></div><div><p>ใช้คำใบ้</p><b>${game.hints} ครั้ง</b></div></div><div class="result-lesson"><b>สิ่งที่เราได้เรียนรู้</b>${level.lesson}</div><div class="result-actions">${game.index<4?`<button class="button primary" data-action="next">ไปภารกิจถัดไป ${icon('arrow')}</button>`:'<a class="button primary" href="#history">ดูผลการเรียนรู้ทั้งหมด →</a>'}<a class="button" href="#home">กลับหน้าหลัก</a><button class="button ghost" data-action="print">พิมพ์ผลการเรียน</button></div></div></section>`;
}
function renderLearn() {
  main.innerHTML=`<div class="page-title"><p class="eyebrow">THE COMPONENT LIBRARY</p><h1>รู้จักอุปกรณ์ ก่อนลงมือเชื่อมต่อ<span class="brand-dot">.</span></h1><p>สัญลักษณ์เล็ก ๆ ที่ช่วยให้เราอ่านและเข้าใจการทำงานของวงจร</p></div><div class="knowledge-grid">${Object.values(COMPONENTS).map(c=>`<article class="knowledge-card"><div class="knowledge-symbol">${c.symbol}</div><h2>${c.name}</h2><small>${c.english}</small><p>${c.description}</p></article>`).join('')}</div><section class="callout"><h2>มองวงจรให้เป็นเส้นทาง</h2><p>ด้านจ่ายไฟ → อุปกรณ์ควบคุม → หลอดไฟ → ทางกลับกราวด์ → ขั้วลบแบตเตอรี่ เมื่อครบเส้นทางจึงมีกระแสไหล</p><p>รีเลย์: ขา 30 รับไฟ, ขา 87 ไปโหลด, ขา 86 รับไฟควบคุม และขา 85 ลงกราวด์ วงจรในบทเรียนเป็นผังย่อ 12 V สำหรับฝึกอ่านวงจร รูปแบบและขั้วจริงต้องอ้างอิงคู่มือรถแต่ละรุ่น</p><p>แบบฝึกนี้ตรวจสายตามผังที่ระบุ ไม่ใช่เครื่องจำลองค่ากระแส แรงดัน หรือวงจรลัดวงจรทั่วไป</p><p>อ้างอิง: <a href="https://www.hella.co.nz/en/about-us/technology/relays-and-flasher-units/elimating-voltage-spikes/" target="_blank" rel="noopener noreferrer">HELLA — ขั้วและการทำงานของรีเลย์ ↗</a> · <a href="https://www.fluke.com/en-ph/learn/blog/digital-multimeters/how-to-check-fuse-with-multimeter" target="_blank" rel="noopener noreferrer">Fluke — การตรวจฟิวส์ ↗</a></p></section><div class="result-actions"><button class="button primary" data-action="${game&&!game.complete?'resume':'mission'}" data-level="0">${game&&!game.complete?'กลับไปทำภารกิจต่อ':'พร้อมแล้ว ไปลองทำกัน'} ${icon('arrow')}</button></div>`;
}
function renderHistory() {
  const records=store.getResults().sort((a,b)=>new Date(b.date)-new Date(a.date));
  const avg=records.length?Math.round(records.reduce((sum,r)=>sum+r.score,0)/records.length):0;
  const totalTime=records.reduce((sum,r)=>sum+r.seconds,0);
  main.innerHTML=`<div class="section-heading history-heading"><div><p class="eyebrow">YOUR LEARNING JOURNEY</p><h1>ทุกความพยายาม มีความหมาย<span class="brand-dot">.</span></h1><p>ประวัติในเบราว์เซอร์และอุปกรณ์นี้ • ยังไม่มีการส่งข้อมูลไปเซิร์ฟเวอร์</p></div><div class="history-actions"><button class="button" data-action="export" ${records.length?'':'disabled'}>${icon('download')} ส่งออก CSV</button><button class="button" data-action="print" ${records.length?'':'disabled'}>พิมพ์ผล</button></div></div><div class="stats-grid"><div class="history-stat"><p>ผู้เรียนในอุปกรณ์นี้</p><b>${new Set(records.map(r=>r.player)).size}<small> คน</small></b></div><div class="history-stat"><p>ภารกิจที่ผ่าน (รวมการฝึกซ้ำ)</p><b>${records.length}<small> ครั้ง</small></b></div><div class="history-stat"><p>คะแนนเฉลี่ยต่อภารกิจ</p><b>${avg}<small> / 100</small></b></div><div class="history-stat"><p>เวลาเรียนสะสม</p><b>${Math.floor(totalTime/60)}<small> นาที ${totalTime%60} วิ</small></b></div></div>${records.length?`<div class="table-scroll"><table><caption class="sr-only">ประวัติภารกิจที่ผ่านในอุปกรณ์นี้</caption><thead><tr><th>ผู้เรียน</th><th>ภารกิจ</th><th>คะแนน</th><th>เวลา</th><th>ผิด / คำใบ้</th><th>วันที่เรียน</th><th>ผลการเรียน</th></tr></thead><tbody>${records.map(r=>`<tr><td><strong>${escape(r.player)}</strong></td><td>${r.level}. ${LEVELS[r.level-1].title}</td><td><strong>${r.score}</strong> / 100</td><td>${time(r.seconds)}</td><td>${r.wrong} / ${r.hints}</td><td>${escape(new Date(r.date).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'}))}</td><td><span class="success-pill">✓ ผ่านแล้ว</span></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty-state"><h2>การเดินทางของคุณเริ่มได้วันนี้</h2><p>เมื่อผ่านภารกิจ ผลการเรียนจะปรากฏที่นี่</p><a class="button primary" href="#home">ไปเลือกภารกิจ ${icon('arrow')}</a></div>`}<div class="callout">${store.available()?'ผลจะอยู่เมื่อเปิดเว็บเดิมด้วยเบราว์เซอร์เดิม การล้างข้อมูลเว็บไซต์หรือใช้โหมดส่วนตัวอาจทำให้ประวัติหาย ควรส่งออก CSV เพื่อเก็บผลงาน':'เบราว์เซอร์ปิดการบันทึกข้อมูล ผลในขณะนี้จะอยู่เพียงชั่วคราว กรุณาส่งออก CSV ก่อนปิดหน้า'}</div>`;
}
function exportCSV() {
  const rows=[['ผู้เรียน','ภารกิจ','คะแนน','เวลา(วินาที)','จำนวนผิด','คำใบ้','วันที่'],...store.getResults().map(r=>[r.player,LEVELS[r.level-1].title,r.score,r.seconds,r.wrong,r.hints,r.date])];
  const csv='\uFEFF'+rows.map(row=>row.map(value=>{let s=String(value);if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a');a.href=url;a.download=`auto-light-lab-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('ส่งออกผลการเรียนแล้ว');
}
function showHelp() {
  modal(`<p class="eyebrow">SMALL STEPS, BRIGHT IDEAS</p><h2>ห้องทดลองนี้เล่นอย่างไร?</h2><ol><li>ใส่ชื่อเล่น แล้วเลือกหนึ่งใน 5 ภารกิจ</li><li><strong>จับคู่:</strong> ลากชื่อไปวางบนสัญลักษณ์ หรือแตะชื่อแล้วแตะช่อง สำหรับคีย์บอร์ดใช้ Tab และ Enter</li><li><strong>ต่อสาย:</strong> ลากระหว่างขั้ว หรือแตะต้นทางแล้วแตะปลายทาง ใช้รายชื่อขั้วช่วยต่อบนมือถือได้</li><li>กดตรวจคำตอบเมื่อพร้อม ลบสายผิดจากรายการ หรือกดย้อนกลับได้</li><li>ผ่านแล้วดูผลและเรียนต่อ คะแนนเริ่มที่ 100 ผิด −10 คำใบ้ −5 ไม่หักคะแนนตามเวลา</li></ol><p>เวลาเรียนจะหยุดเมื่อออกจากหน้าภารกิจหรือสลับแท็บ ผลที่ผ่านแล้วเก็บในเบราว์เซอร์นี้</p><button class="button primary block" data-action="close-modal">เข้าใจแล้ว ไปเรียนรู้กัน</button>`);
}

function renderRoute() {
  cancelDrag();pauseTimer();
  if(game)game.selected=null;
  const route=location.hash.slice(1)||'home';
  currentRoute=['home','learn','history','lab','result'].includes(route)?route:'home';
  document.querySelectorAll('[data-nav]').forEach(a=>{const active=a.dataset.nav===currentRoute;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  ({home:renderHome,learn:renderLearn,history:renderHistory,lab:renderLab,result:renderResult})[currentRoute]();
  document.title=`${({home:'ห้องทดลองวงจรไฟรถยนต์',learn:'คลังความรู้',history:'ผลการเรียนรู้',lab:game?currentLevel().title:'เริ่มเรียนรู้',result:'ภารกิจสำเร็จ'})[currentRoute]} — Auto Light Lab`;
  if(currentRoute==='lab'&&game)runTimer();
  window.scrollTo({top:0,behavior:'instant'});
  if(!$('#modal').open)main.focus({preventScroll:true});
}

document.addEventListener('submit',event=>{
  if(event.target.id==='start-form'){
    event.preventDefault();const name=$('#player-name').value.trim();
    if(!name){$('#name-error').hidden=false;$('#name-error').textContent='ใส่ชื่อเล่นก่อนเริ่มเรียนรู้';$('#player-name').focus();return;}
    if(game&&!game.complete){requestedLevel=0;store.saveName(name);chooseMission(0);}else start(0,name);
  }else if(event.target.id==='mission-form'){
    event.preventDefault();const name=$('#modal-name').value.trim();if(name)start(requestedLevel,name);else $('#modal-name').focus();
  }else if(event.target.id==='wire-form'){
    event.preventDefault();const a=$('#wire-from').value,b=$('#wire-to').value;if(a&&b)connect(a,b);else toast('เลือกขั้วต้นทางและปลายทางให้ครบ');
  }
});
document.addEventListener('click',event=>{
  if(event.target.closest('.skip-link')){event.preventDefault();main.focus();main.scrollIntoView({block:'start'});return;}
  if(Date.now()<suppressClickUntil&&(event.target.closest('[data-equipment]')||event.target.closest('[data-port]')||event.target.closest('[data-target]')))return;
  const action=event.target.closest('[data-action]');
  if(action){
    const a=action.dataset.action;
    if(a==='help')showHelp();
    if(a==='close-modal')closeModal();
    if(a==='mission')chooseMission(Number(action.dataset.level));
    if(a==='confirm-start')start(requestedLevel,store.getName()||game.player);
    if(a==='resume'){closeModal();go('lab');}
    if(a==='test')test();
    if(a==='result')go('result');
    if(a==='next')start(Math.min(4,game.index+1),game.player);
    if(a==='hint')useHint();
    if(a==='undo'&&!game.complete){game.connections.pop();game.selected=null;drawWires();}
    if(a==='remove-wire'&&!game.complete){game.connections.splice(Number(action.dataset.index),1);drawWires();}
    if(a==='reset')modal(`<h2>ลองภารกิจนี้ใหม่?</h2><p>การต่อวงจร คะแนน และเวลาของรอบนี้จะเริ่มใหม่ ผลที่ผ่านแล้วจะยังอยู่ในประวัติ</p><div class="modal-actions"><button class="button" data-action="close-modal">ทำต่อก่อน</button><button class="button primary" data-action="confirm-reset">เริ่มใหม่</button></div>`);
    if(a==='confirm-reset')start(game.index,game.player);
    if(a==='beam'){game.beam=action.dataset.beam;updateBeam();}
    if(a==='export')exportCSV();
    if(a==='print')window.print();
    return;
  }
  if(!game||game.complete||currentRoute!=='lab')return;
  const equipment=event.target.closest('[data-equipment]');
  if(equipment){game.selected=game.selected===equipment.dataset.equipment?null:equipment.dataset.equipment;document.querySelectorAll('[data-equipment]').forEach(b=>{const active=b.dataset.equipment===game.selected;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});$('#board-status').textContent=game.selected?`เลือก${COMPONENTS[game.selected].name}แล้ว แตะช่องสัญลักษณ์ที่ตรงกัน`:'เลือกชื่ออุปกรณ์เพื่อเริ่มจับคู่';}
  const zone=event.target.closest('[data-target]');if(zone){if(game.selected)match(game.selected,zone.dataset.target);else toast('เลือกชื่ออุปกรณ์จากกล่องก่อนนะ');}
  const terminal=event.target.closest('[data-port]');if(terminal)selectPort(terminal.dataset.port);
  const answer=event.target.closest('[data-answer]');if(answer){game.answer=answer.dataset.answer;document.querySelectorAll('[data-answer]').forEach(b=>{b.classList.toggle('selected',b===answer);b.setAttribute('aria-pressed',String(b===answer));});}
});

// Pointer Events work for mouse, pen and touch; click/keyboard alternatives remain available.
main.addEventListener('pointerdown',event=>{
  if(!game||game.complete||event.button!==0)return;
  const source=event.target.closest('[data-equipment],[data-port]');if(!source||source.disabled)return;
  drag={source,id:event.pointerId,x:event.clientX,y:event.clientY,moved:false,key:source.dataset.equipment||source.dataset.port,type:source.dataset.port?'wire':'match'};
  source.setPointerCapture(event.pointerId);
});
main.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>7){drag.moved=true;if(drag.type==='match'){drag.ghost=document.createElement('div');drag.ghost.className='drag-ghost';drag.ghost.textContent=COMPONENTS[drag.key].name;document.body.append(drag.ghost);}}
  if(!drag.moved)return;
  event.preventDefault();
  if(drag.ghost){drag.ghost.style.left=event.clientX+'px';drag.ghost.style.top=event.clientY-20+'px';}
  document.querySelectorAll('.drop-zone.over').forEach(z=>z.classList.remove('over'));
  document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-target]')?.classList.add('over');
  if(drag.type==='wire'){
    const rect=$('#circuit-board').getBoundingClientRect(),p=portMap().get(drag.key);
    $('#wire-preview').setAttribute('d',`M${p.x},${p.y} L${event.clientX-rect.left},${event.clientY-rect.top}`);
  }
});
main.addEventListener('pointerup',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  if(drag.moved){
    const target=document.elementFromPoint(event.clientX,event.clientY);
    if(drag.type==='match'){const zone=target?.closest('[data-target]');if(zone)match(drag.key,zone.dataset.target);}
    else {const port=target?.closest('[data-port]');if(port)connect(drag.key,port.dataset.port);}
    suppressClickUntil=Date.now()+300;
  }
  cancelDrag();
});
main.addEventListener('pointercancel',cancelDrag);
function cancelDrag(){if(drag){drag.ghost?.remove();if(drag.source.hasPointerCapture(drag.id))drag.source.releasePointerCapture(drag.id);drag=null;}document.querySelectorAll('.drop-zone.over').forEach(z=>z.classList.remove('over'));$('#wire-preview')?.setAttribute('d','');}
document.addEventListener('keydown',event=>{if(event.key==='Escape'){cancelDrag();if(game){game.selected=null;if(currentRoute==='lab'&&currentLevel().type==='circuit')drawWires();document.querySelectorAll('.equipment.selected').forEach(b=>{b.classList.remove('selected');b.setAttribute('aria-pressed','false');});}}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseTimer();else if(currentRoute==='lab'&&game&&!game.complete){pauseTimer();runTimer();}});
window.addEventListener('hashchange',renderRoute);
window.addEventListener('pagehide',pauseTimer);
window.addEventListener('storage',()=>{if(currentRoute==='history'||currentRoute==='home')renderRoute();});
renderRoute();
