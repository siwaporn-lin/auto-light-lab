/**
 * Educational 12 V DC circuit models. Coordinates refer to a 900 × 460 board.
 * Relay terminal reference: HELLA, “Eliminating Voltage Spikes”:
 * https://www.hella.co.nz/en/about-us/technology/relays-and-flasher-units/elimating-voltage-spikes/
 * 30 = positive supply, 87 = switched load, 85 = coil ground, 86 = coil positive.
 * Fuse continuity reference: Fluke, “How to Check a Fuse with a Multimeter”:
 * https://www.fluke.com/en-ph/learn/blog/digital-multimeters/how-to-check-fuse-with-multimeter
 * An isolated fuse with OL across its blades has an open circuit. The 12 V / 0 V
 * measurements below are an idealized diagnostic example with a connected load.
 * These exercises teach a specified wiring plan; validation is exact edge matching,
 * not a general circuit simulator or a claim that other equivalent wiring is invalid.
 */

const svg = (drawing) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${drawing}</svg>`;

export const COMPONENTS = {
  battery: {
    name: 'แบตเตอรี่', english: 'Battery',
    description: 'แหล่งจ่ายไฟกระแสตรง 12 V ขั้วบวกจ่ายไฟเข้าวงจร และขั้วลบเชื่อมกับกราวด์ของรถ',
    symbol: svg('<path d="M5 32h17m0-18v36m7-27v18m10-27v36m7-27v18m0-9h13M9 12h8m-4-4v8M49 12h8"/>'),
  },
  fuse: {
    name: 'ฟิวส์', english: 'Fuse',
    description: 'ตัดวงจรเมื่อกระแสสูงเกินพิกัด ช่วยป้องกันสายไฟและอุปกรณ์ โดยอยู่บนทางจ่ายไฟก่อนโหลด',
    symbol: svg('<path d="M5 32h54"/><rect x="17" y="24" width="30" height="16" rx="1"/>'),
  },
  switch: {
    name: 'สวิตช์', english: 'Switch',
    description: 'เปิดหรือปิดเส้นทางกระแสไฟ ในวงจรรีเลย์ สวิตช์ควบคุมไฟที่เข้าสู่ขดลวด',
    symbol: svg('<path d="M5 41h10m35 0h9M20 39l24-22"/><circle cx="18" cy="41" r="3"/><circle cx="47" cy="41" r="3"/>'),
  },
  relay: {
    name: 'รีเลย์ 4 ขา', english: '4-pin relay',
    description: 'ขดลวด 85–86 ควบคุมหน้าสัมผัส 30–87 วงจรควบคุมกับวงจรจ่ายไฟให้หลอดแยกจากกันภายในรีเลย์',
    symbol: svg('<path d="M4 18h10m36 0h10M19 17l24-9M4 47h15m26 0h15"/><circle cx="17" cy="18" r="3"/><circle cx="47" cy="18" r="3"/><rect x="19" y="39" width="26" height="16" rx="2"/><path d="M32 22v14" stroke-dasharray="3 4"/>'),
  },
  lamp: {
    name: 'หลอดไฟ', english: 'Lamp',
    description: 'โหลดที่เปลี่ยนพลังงานไฟฟ้าเป็นแสง ต้องมีเส้นทางกระแสครบทั้งด้านรับไฟและทางกลับกราวด์',
    symbol: svg('<path d="M3 32h10m38 0h10M19 19l26 26M45 19L19 45"/><circle cx="32" cy="32" r="19"/>'),
  },
  ground: {
    name: 'กราวด์ / ตัวถัง', english: 'Chassis ground',
    description: 'จุดร่วมทางกลับของกระแสไฟ ต่อถึงขั้วลบแบตเตอรี่ผ่านตัวถังหรือสายกราวด์',
    symbol: svg('<path d="M32 7v26M11 33h42M18 33L9 47m25-14-9 14m25-14-9 14"/>'),
  },
  selector: {
    name: 'สวิตช์เลือกสูง–ต่ำ', english: 'High / low selector',
    description: 'เลือกต่อขั้ว COM ไปที่ LOW หรือ HIGH ทีละทาง เพื่อให้หลอดไฟต่ำหรือไฟสูงทำงาน',
    symbol: svg('<path d="M4 32h11m36-17h9m-9 34h9M21 30l23-13"/><circle cx="18" cy="32" r="3"/><circle cx="48" cy="15" r="3"/><circle cx="48" cy="49" r="3"/>'),
  },
};

const port = (nodeId, name, label, side, offset = 0.5) => ({ id: `${nodeId}:${name}`, label, side, offset });
const battery = (x, y) => ({ id: 'battery', key: 'battery', label: 'แบตเตอรี่ 12 V', x, y, ports: [port('battery', 'positive', '+', 'right', 0.3), port('battery', 'negative', '−', 'bottom')] });
const fuse = (x, y) => ({ id: 'fuse', key: 'fuse', label: 'ฟิวส์', x, y, ports: [port('fuse', 'in', 'เข้า', 'left'), port('fuse', 'out', 'ออก', 'right')] });
const controlSwitch = (x, y) => ({ id: 'switch', key: 'switch', label: 'สวิตช์ไฟ', x, y, ports: [port('switch', 'in', 'เข้า', 'left'), port('switch', 'out', 'ออก', 'right')] });
const relay = (x, y) => ({ id: 'relay', key: 'relay', label: 'รีเลย์ 4 ขา', x, y, ports: [port('relay', '30', '30', 'top', 0.25), port('relay', '87', '87', 'top', 0.75), port('relay', '86', '86', 'left', 0.75), port('relay', '85', '85', 'bottom', 0.75)] });
const lamp = (id, label, x, y, side = 'left') => ({ id, key: 'lamp', label, x, y, ports: [port(id, 'positive', '+', side), port(id, 'negative', '−', 'bottom')] });
const ground = (x, y) => ({ id: 'ground', key: 'ground', label: 'กราวด์ร่วม', x, y, ports: [port('ground', 'body', 'ตัวถัง', 'top')] });

export const LEVELS = [
  {
    id: 1, title: 'รู้จักสัญลักษณ์', subtitle: 'เริ่มจากภาษาของวงจร', type: 'match', minutes: 3, difficulty: 'เริ่มต้น',
    description: 'จับคู่ชื่ออุปกรณ์กับสัญลักษณ์ไฟฟ้าให้ถูกต้อง ลากการ์ดชื่อไปวาง หรือเลือกชื่อแล้วแตะสัญลักษณ์',
    items: ['battery', 'fuse', 'switch', 'relay', 'lamp', 'ground'],
    hint: 'แบตเตอรี่ใช้เส้นยาว–สั้น หลอดไฟใช้วงกลมมีกากบาท และรีเลย์มีขดลวดแยกจากหน้าสัมผัส',
    lesson: 'สัญลักษณ์แสดงหน้าที่ของอุปกรณ์ จึงอ่านวงจรได้แม้รูปร่างจริงของอุปกรณ์จะแตกต่างกัน',
  },
  {
    id: 2, title: 'ต่อวงจรไฟหรี่', subtitle: 'ให้แสงแรกสว่างขึ้น', type: 'circuit', minutes: 4, difficulty: 'พื้นฐาน',
    description: 'ต่อขั้วบวกแบตเตอรี่ → ฟิวส์ → สวิตช์ → หลอดไฟหรี่ แล้วต่อทางกลับของหลอดและขั้วลบแบตเตอรี่เข้ากราวด์ร่วมตามผังฝึก',
    hint: 'เริ่มที่ขั้ว + ของแบตเตอรี่ ต่อฟิวส์ก่อนสวิตช์ และอย่าลืมสายจากขั้ว − แบตเตอรี่สู่กราวด์',
    lesson: 'หลอดไฟสว่างเมื่อวงจรครบและปิดสวิตช์ กระแสไหลจากแบตเตอรี่ผ่านฟิวส์ สวิตช์ และหลอด กลับไปยังขั้วลบ',
    nodes: [battery(105, 220), fuse(280, 115), controlSwitch(485, 115), lamp('lamp', 'หลอดไฟหรี่', 715, 220, 'top'), ground(445, 350)],
    required: [['battery:positive', 'fuse:in'], ['fuse:out', 'switch:in'], ['switch:out', 'lamp:positive'], ['lamp:negative', 'ground:body'], ['battery:negative', 'ground:body']],
  },
  {
    id: 3, title: 'ควบคุมด้วยรีเลย์', subtitle: 'แยกวงจรควบคุมและวงจรกำลัง', type: 'circuit', minutes: 6, difficulty: 'ท้าทาย',
    description: 'จ่ายไฟหลังฟิวส์ไปขา 30 และสวิตช์ ต่อสวิตช์ออกไปขา 86 ขา 85 ลงกราวด์ และขา 87 ไปหลอดไฟ ต่อทางกลับของหลอดและแบตเตอรี่ให้ครบ',
    hint: '30 รับไฟกำลัง, 87 จ่ายไปหลอด, 86 รับไฟจากสวิตช์, 85 ลงกราวด์ จุดออกฟิวส์ต้องแยกสายไปทั้งขา 30 และสวิตช์',
    lesson: 'เมื่อขา 86–85 ได้รับแรงดัน ขดลวดจะดึงหน้าสัมผัส 30–87 ให้ต่อกัน กระแสหลอดจึงไม่ต้องไหลผ่านสวิตช์ควบคุม',
    nodes: [battery(100, 170), fuse(285, 100), controlSwitch(285, 330), relay(505, 220), lamp('lamp', 'หลอดไฟหน้า', 750, 105), ground(750, 350)],
    required: [['battery:positive', 'fuse:in'], ['fuse:out', 'relay:30'], ['fuse:out', 'switch:in'], ['switch:out', 'relay:86'], ['relay:85', 'ground:body'], ['relay:87', 'lamp:positive'], ['lamp:negative', 'ground:body'], ['battery:negative', 'ground:body']],
  },
  {
    id: 4, title: 'เลือกไฟสูง–ไฟต่ำ', subtitle: 'จัดเส้นทางแสงให้ตรงหน้าที่', type: 'circuit', minutes: 7, difficulty: 'ท้าทาย',
    description: 'ต่อรีเลย์เหมือนด่านก่อน แล้วต่อขา 87 เข้าขั้ว COM ของสวิตช์เลือกสูง–ต่ำ ต่อ LOW ไปหลอดไฟต่ำและ HIGH ไปหลอดไฟสูง ทั้งสองหลอดใช้กราวด์ร่วม แบบฝึกนี้เลือกทำงานครั้งละหนึ่งหลอด',
    hint: 'ขั้ว COM รับไฟจากรีเลย์ 87 ขั้ว LOW และ HIGH แยกไปคนละหลอด สวิตช์เลือกต่อ COM กับทางใดทางหนึ่งเท่านั้น',
    lesson: 'นี่คือวงจรย่อเพื่อเรียนรู้สวิตช์เลือก: COM → LOW หรือ COM → HIGH ทีละทาง ส่วนรถจริงอาจใช้รีเลย์แยกหรือกล่องควบคุมตามรุ่น',
    nodes: [battery(90, 170), fuse(265, 85), controlSwitch(265, 320), relay(450, 205), { id: 'selector', key: 'selector', label: 'เลือกสูง–ต่ำ', x: 645, y: 90, ports: [port('selector', 'common', 'COM', 'left'), port('selector', 'low', 'LOW', 'right', 0.2), port('selector', 'high', 'HIGH', 'right', 0.8)] }, lamp('low', 'หลอดไฟต่ำ', 805, 205), lamp('high', 'หลอดไฟสูง', 805, 350), ground(550, 380)],
    required: [['battery:positive', 'fuse:in'], ['fuse:out', 'relay:30'], ['fuse:out', 'switch:in'], ['switch:out', 'relay:86'], ['relay:85', 'ground:body'], ['relay:87', 'selector:common'], ['selector:low', 'low:positive'], ['selector:high', 'high:positive'], ['low:negative', 'ground:body'], ['high:negative', 'ground:body'], ['battery:negative', 'ground:body']],
  },
  {
    id: 5, title: 'ตามหาจุดขัดข้อง', subtitle: 'ใช้หลักฐาน แทนการเดา', type: 'analysis', minutes: 4, difficulty: 'นักวิเคราะห์',
    description: 'ไฟหน้าไม่ติดแม้เปิดสวิตช์และต่อโหลดไว้ วัดแรงดันที่ขาโลหะของฟิวส์โดยตรง เทียบกับขั้วลบแบตเตอรี่ที่ตรวจแล้วว่าปกติ จากนั้นตัดไฟและถอดฟิวส์ออกมาตรวจความต่อเนื่อง หลักฐานนี้ชี้ไปที่อุปกรณ์ใด?',
    hint: 'ไฟมาถึงขาเข้าฟิวส์ แต่ขาออกไม่มีแรงดัน และฟิวส์ที่ถอดแยกออกมาอ่านค่า OL แสดงว่าเส้นทางภายในขาด',
    lesson: '12 V ที่ขาเข้ากับ 0 V ที่ขาออกขณะต่อโหลด ชี้ว่ามีวงจรเปิดคั่นอยู่ และค่า OL ของฟิวส์ที่ถอดแยกแล้วช่วยยืนยันว่าฟิวส์ขาด ต้องหาสาเหตุที่ทำให้ขาดก่อนเปลี่ยนด้วยพิกัดเดิม',
    measurements: [
      { label: 'แบตเตอรี่ (+ เทียบ −)', value: '12.0 V', status: 'normal' },
      { label: 'ขาโลหะด้านเข้าฟิวส์', value: '12.0 V', status: 'normal' },
      { label: 'ขาโลหะด้านออกฟิวส์', value: '0.0 V', status: 'fault' },
      { label: 'ฟิวส์ที่ถอดออก (ตัดไฟแล้ว)', value: 'OL · วงจรเปิด', status: 'fault' },
    ],
    options: [
      { id: 'battery', label: 'แบตเตอรี่หมด', explanation: 'แบตเตอรี่ยังวัดได้ 12 V และไฟไปถึงขาเข้าฟิวส์ได้ จึงไม่สอดคล้องกับหลักฐานทั้งหมด' },
      { id: 'fuse', label: 'ฟิวส์ขาด', explanation: 'ถูกต้อง! ขาเข้ามี 12 V แต่ขาออก 0 V และค่า OL จากฟิวส์ที่ถอดแยกแล้ว ยืนยันว่าฟิวส์มีวงจรเปิด' },
      { id: 'lamp', label: 'หลอดไฟเสีย', explanation: 'หลอดเสียอย่างเดียวไม่อธิบายค่า OL ที่วัดจากตัวฟิวส์ซึ่งถอดแยกออกมาแล้ว' },
      { id: 'switch', label: 'สวิตช์ไฟเสีย', explanation: 'ข้อมูลยืนยันวงจรเปิดภายในฟิวส์โดยตรง จึงควรแก้ที่ฟิวส์และหาสาเหตุที่ทำให้ขาดก่อน' },
    ],
    answer: 'fuse',
  },
];

/** Position of a terminal on a card centered at node.x / node.y. */
export function portPosition(node, terminal) {
  const offset = Number.isFinite(terminal.offset) ? Math.max(0, Math.min(1, terminal.offset)) : 0.5;
  const left = node.x - 56;
  const top = node.y - 41;
  switch (terminal.side) {
    case 'left': return { x: left, y: top + 82 * offset };
    case 'right': return { x: left + 112, y: top + 82 * offset };
    case 'top': return { x: left + 112 * offset, y: top };
    case 'bottom': return { x: left + 112 * offset, y: top + 82 };
    default: throw new TypeError(`Unknown terminal side: ${terminal.side}`);
  }
}

/** An undirected connection has the same key regardless of drawing direction. */
export function normalizePair(a, b) {
  return [a, b].sort().join('|');
}

/**
 * Compare terminal edges to the lesson's specified wiring plan. Extra edges,
 * repeated/reversed duplicates, self connections, and unknown terminals fail.
 * missing and extra contain endpoint pairs for accessible feedback in the UI.
 */
export function validateCircuit(level, connections) {
  if (!level || level.type !== 'circuit' || !Array.isArray(level.required) || !Array.isArray(level.nodes)) {
    return { correct: false, missing: [], extra: [] };
  }
  const terminals = new Set(level.nodes.flatMap((node) => node.ports.map((terminal) => terminal.id)));
  const expected = new Set(level.required.map(([a, b]) => normalizePair(a, b)));
  const seen = new Set();
  const extra = [];
  const malformedInput = !Array.isArray(connections);
  for (const pair of Array.isArray(connections) ? connections : []) {
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some((endpoint) => typeof endpoint !== 'string')) {
      extra.push(Array.isArray(pair) ? [...pair] : []);
      continue;
    }
    const [a, b] = pair;
    const key = normalizePair(a, b);
    if (a === b || !terminals.has(a) || !terminals.has(b) || seen.has(key) || !expected.has(key)) {
      extra.push([...pair]);
      continue;
    }
    seen.add(key);
  }
  const missing = level.required.filter(([a, b]) => !seen.has(normalizePair(a, b))).map((pair) => [...pair]);
  return { correct: !malformedInput && missing.length === 0 && extra.length === 0, missing, extra };
}

/** No time bonus: learners may use touch, keyboard, or take their own pace. */
export function calculateScore({ wrongAttempts = 0, hintsUsed = 0 } = {}) {
  const count = (value) => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return Math.max(0, 100 - count(wrongAttempts) * 10 - count(hintsUsed) * 5);
}
