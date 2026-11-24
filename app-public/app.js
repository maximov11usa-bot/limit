/* ЛИМИТ — бета. Всё хранится только на этом устройстве (localStorage). Без серверов и аналитики. */
(function () {
'use strict';

const KEY = 'limit.v1';
const SOS_KEY = 'limit.sos.active';
const $app = document.getElementById('app');

/* ---------- справочники ---------- */
const SITS = {
  lonely: 'Одиночество', tired: 'Усталость', stress: 'Стресс', bored: 'Скука',
  phone: 'Телефон в руках / в постели', duty: '«Надо в этом месяце»', other: 'Другое'
};
const TODS = { morning: 'Утро', day: 'День', evening: 'Вечер', night: 'Ночь' };
const TOD_IN = { morning: 'утром', day: 'днём', evening: 'вечером', night: 'ночью' };
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

/* Действия SOS. power: 1 мягкое, 2 среднее, 3 сильное (для вечера/ночи и эскалации) */
const ACTIONS = {
  duty_notes: { t: 'Перечитай свои записи', p: 2, s: ['duty'], d: 'Это та самая мысль «надо успеть в этом месяце». Ты уже записывал, чем она заканчивается.', kind: 'duty' },
  call:       { t: 'Напиши или позвони человеку', p: 2, s: ['lonely'], d: 'Одиночество лечится контактом, а не экраном. Одно сообщение — уже действие.', kind: 'contacts' },
  outside:    { t: 'Выйди на улицу на 15 минут', p: 3, s: ['lonely', 'bored', 'phone', 'duty', 'other'], d: 'Обулся, телефон в карман. Дойди до конца улицы и обратно. Первые 5 минут — без наушников.' },
  people:     { t: 'Иди туда, где есть люди', p: 3, s: ['lonely', 'bored'], d: 'Зал, каток, кафе, магазин. Тяга слабеет рядом с людьми.' },
  sleep:      { t: 'Ложись спать прямо сейчас', p: 2, s: ['tired'], d: 'Телефон — на зарядку в другой комнате. Свет выключи. Будильник — на часах или в другой комнате.', night: true },
  phone_away: { t: 'Телефон — в другую комнату', p: 2, s: ['phone', 'bored', 'tired'], d: 'Экраном вниз, в другой комнате, на всё время таймера. Таймер посмотришь после.' },
  breath:     { t: 'Дыхание 4-7-8', p: 1, s: ['stress', 'other'], d: 'Вдох носом 4 счёта, задержка 7, выдох ртом 8. Четыре круга. Сбивает пульс и напряжение.', kind: 'breath' },
  cold:       { t: 'Холодная вода', p: 3, s: ['stress', 'tired', 'other'], d: 'Умой лицо ледяной водой 30 секунд, затем подержи запястья под холодной струёй. Резкий сброс.' },
  pushups:    { t: '20 отжиманий + 30 приседаний', p: 2, s: ['bored', 'stress', 'phone'], d: 'Прямо сейчас, без телефона. Тянет дальше — ещё один подход.' },
  leave_room: { t: 'Выйди из этой комнаты', p: 2, s: ['phone', 'bored', 'lonely', 'other'], d: 'Смени место: кухня, балкон, коридор. В кровать с телефоном не возвращайся.' },
  shower:     { t: 'Контрастный душ', p: 3, s: ['tired', 'stress', 'other'], d: '3 минуты, последние 30 секунд — холодная вода.' },
  mobility:   { t: '10 минут мобилити', p: 1, s: ['tired', 'stress'], d: 'Таз, грудной отдел, бёдра. Спокойно, под счёт, не под телефон.' },
  surf:       { t: 'Пережди волну 90 секунд', p: 1, s: ['other', 'bored', 'duty'], d: 'Тяга растёт и спадает, как волна. Сядь, скажи себе: «это просто тяга, она пройдёт». Следи за дыханием.' },
  letter:     { t: 'Письмо себе', p: 1, s: [], d: 'Прочитай, что ты написал себе в спокойный момент.', kind: 'letter' }
};

/* ---------- утилиты ---------- */
const pad = n => String(n).padStart(2, '0');
const dkey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const mkey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1);
const parseD = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d || 1); };
const today = () => dkey(new Date());
const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function todOf(date) { const h = date.getHours(); return h >= 5 && h < 12 ? 'morning' : h < 17 && h >= 12 ? 'day' : h >= 17 && h < 22 ? 'evening' : 'night'; }
function plural(n, a, b, c) { n = Math.abs(n) % 100; const m = n % 10; if (n > 10 && n < 20) return c; if (m > 1 && m < 5) return b; if (m === 1) return a; return c; }
const dn = n => n + ' ' + plural(n, 'день', 'дня', 'дней');
function fmtDate(k) { const d = parseD(k); return d.getDate() + ' ' + MONTHS_GEN[d.getMonth()]; }
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 3200); }

/* ---------- хранилище ---------- */
function fresh() {
  const H = window.SEED_HISTORY || { startDate: today(), days: {}, events: [], sos: [] };
  return {
    v: 1, created: Date.now(), startDate: H.startDate,
    settings: { limit: 1, limitUntil: '2026-12-31', why: H.why || '', letter: '', contacts: [], pinHash: null, sosMinutes: 10, riskBanner: true },
    days: H.days || {}, events: H.events || [], sos: H.sos || [], ui: {}
  };
}
let S;
function load() { try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; } if (!S || !S.v) { S = fresh(); save(); } S.ui = S.ui || {}; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Не удалось сохранить: память заполнена'); } }
let A = null; /* активная SOS-сессия */
function loadSos() { try { A = JSON.parse(localStorage.getItem(SOS_KEY)); } catch (e) { A = null; } }
function saveSos() { if (A) localStorage.setItem(SOS_KEY, JSON.stringify(A)); else localStorage.removeItem(SOS_KEY); }

/* ---------- расчёты ---------- */
function eventsSorted() { return S.events.slice().sort((a, b) => (a.date + (a.ts || 0)).localeCompare(b.date + (b.ts || 0)) || (a.ts || 0) - (b.ts || 0)); }
/* статус каждой записи: в пределах «можно» или превышение */
function eventStatus() {
  const byM = {}, st = {};
  for (const e of eventsSorted()) {
    const m = e.date.slice(0, 7); byM[m] = (byM[m] || 0) + 1;
    const inGoal = e.date <= S.settings.limitUntil;
    st[e.id] = !inGoal ? 'free' : byM[m] <= S.settings.limit ? 'used' : 'over';
  }
  return st;
}
function monthEvents(m) { return S.events.filter(e => e.date.slice(0, 7) === m); }
function monthList() {
  const out = []; const start = parseD(S.startDate); const cur = mkey(new Date());
  let d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (mkey(d) <= cur) { out.push(mkey(d)); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
  return out;
}
function monthInfo(m) {
  const n = monthEvents(m).length; const cur = mkey(new Date());
  const inGoal = (m + '-01') <= S.settings.limitUntil;
  const finished = m < cur;
  const over = Math.max(0, n - S.settings.limit);
  let status = n === 0 ? (finished ? 'win' : 'zero-now') : over ? 'over' : 'used';
  if (!inGoal) status = 'free';
  return { m, n, over, finished, status, partial: m === S.startDate.slice(0, 7) && S.startDate.slice(8) !== '01' };
}
function lastEventDate() { const e = eventsSorted(); return e.length ? e[e.length - 1].date : null; }
function streaks() {
  const ev = eventsSorted().map(e => e.date); const t = today();
  const last = ev.length ? ev[ev.length - 1] : S.startDate;
  const current = Math.max(0, daysBetween(last, t));
  let best = 0, prev = S.startDate;
  for (const d of ev) { best = Math.max(best, daysBetween(prev, d)); prev = d; }
  best = Math.max(best, current);
  return { current, best, sinceStart: !ev.length };
}
function beatenCount(m) { return S.sos.filter(s => s.beaten && (!m || (s.date || '').slice(0, 7) === m)).length; }
function winsCount() { return monthList().map(monthInfo).filter(x => x.status === 'win').length; }
function riskyTod() {
  const c = {}; let total = 0;
  for (const e of S.events) if (e.timeOfDay) { c[e.timeOfDay] = (c[e.timeOfDay] || 0) + 1; total++; }
  const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  if (!top || total < 3 || top[1] / total < 0.4) return null;
  return { tod: top[0], n: top[1], total };
}
function dutyNotes() {
  const out = [];
  for (const e of eventsSorted()) if (e.note && (e.trigger === 'duty' || /долг|надо|успе/i.test(e.note))) out.push({ date: e.date, note: e.note });
  return out;
}

/* обучение SOS: что снижает силу тяги в какой ситуации */
function learned(sit) {
  const r = {};
  for (const s of S.sos) {
    if (s.before == null || s.after == null || !s.actions || !s.actions.length) continue;
    if (sit && s.situation !== sit) continue;
    for (const a of s.actions) {
      const x = r[a] || (r[a] = { n: 0, sum: 0, beat: 0 });
      x.n++; x.sum += (s.before - s.after); if (s.beaten) x.beat++;
    }
  }
  return r;
}
function rankActions(sit, strength, exclude) {
  const L = learned(sit); const tod = todOf(new Date()); const late = tod === 'evening' || tod === 'night';
  const list = [];
  for (const [id, a] of Object.entries(ACTIONS)) {
    if (exclude && exclude.includes(id)) continue;
    let sc = a.s.includes(sit) ? 2 : 0.3;
    if (id === 'duty_notes') sc = sit === 'duty' ? 5 : -9;
    if (id === 'letter') sc = (S.settings.letter || S.settings.why) ? 0.8 : -9;
    if (id === 'call' && !S.settings.contacts.length) sc -= 0.8;
    if (id === 'sleep') sc += tod === 'night' ? 2 : tod === 'evening' ? 0.6 : -2;
    if (late) sc += (a.p - 2) * 0.6;
    if (strength >= 8) sc += (a.p - 2) * 0.6;
    const l = L[id];
    if (l) { sc += ((l.sum + 2 * 2) / (l.n + 2) - 2) * 0.8 + (l.beat / l.n) * (l.n / (l.n + 2)); }
    list.push({ id, sc, l });
  }
  return list.sort((x, y) => y.sc - x.sc);
}

/* ---------- роутер ---------- */
const views = {};
function go(r) { if (location.hash !== '#' + r) location.hash = r; else render(); }
function route() { return (location.hash || '#home').slice(1).split('/'); }
function render() {
  stopTicks();
  const [r, arg] = route();
  const v = views[r] || views.home;
  $app.innerHTML = v(arg);
  window.scrollTo(0, 0);
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.go === r));
  document.getElementById('tabbar').classList.toggle('hidden', r === 'sos');
  if (v.after) v.after(arg);
}
window.addEventListener('hashchange', render);
document.getElementById('tabbar').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
$app.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) { go(g.dataset.go); return; }
  const a = e.target.closest('[data-act]'); if (a && handlers[a.dataset.act]) handlers[a.dataset.act](a, e);
});
const handlers = {};
let ticks = [];
function stopTicks() { ticks.forEach(clearInterval); ticks = []; }

/* общие куски разметки */
function chips(name, opts, sel, multi) {
  return '<div class="chips" data-chips="' + name + '"' + (multi ? ' data-multi="1"' : '') + '>' +
    Object.entries(opts).map(([k, v]) => '<button type="button" class="chip' + ((multi ? (sel || []).includes(k) : sel === k) ? ' on' : '') + '" data-v="' + k + '">' + esc(v) + '</button>').join('') + '</div>';
}
function scale(name, sel, max) {
  max = max || 10; let h = '<div class="scale" data-scale="' + name + '" style="grid-template-columns:repeat(' + max + ',1fr)">';
  for (let i = 1; i <= max; i++) h += '<button type="button" data-v="' + i + '" class="' + (sel === i ? 'on' : sel && i < sel ? 'lit' : '') + '">' + i + '</button>';
  return h + '</div>';
}
document.addEventListener('click', e => {
  const c = e.target.closest('[data-chips] .chip');
  if (c) { const box = c.parentElement; if (box.dataset.multi) c.classList.toggle('on'); else { box.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); } box.dispatchEvent(new Event('change', { bubbles: true })); }
  const s = e.target.closest('[data-scale] button');
  if (s) { const box = s.parentElement; const v = +s.dataset.v; box.querySelectorAll('button').forEach(b => { b.className = +b.dataset.v === v ? 'on' : +b.dataset.v < v ? 'lit' : ''; }); box.dataset.val = v; box.dispatchEvent(new Event('change', { bubbles: true })); }
});
const chipVal = n => { const b = $app.querySelector('[data-chips="' + n + '"] .chip.on'); return b ? b.dataset.v : ''; };
const scaleVal = n => { const b = $app.querySelector('[data-scale="' + n + '"] button.on'); return b ? +b.dataset.v : null; };
const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

/* ---------- ГЛАВНАЯ ---------- */
views.home = function () {
  const now = new Date(); const m = mkey(now); const info = monthInfo(m); const L = S.settings.limit;
  const st = streaks(); const t = today(); const inGoal = t <= S.settings.limitUntil;
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
  const risk = riskyTod(); const showRisk = S.settings.riskBanner && risk && risk.tod === todOf(now) && S.ui.riskHidden !== t;
  let msg;
  if (!inGoal) msg = 'Цель «не больше ' + L + ' в месяц до ' + fmtDate(S.settings.limitUntil) + '» завершена. Задай новый срок в настройках.';
  else if (info.n === 0) msg = 'Можно — но не обязательно. Неиспользованное просто сгорает, а месяц с нулём — отдельная победа.';
  else if (info.n <= L) msg = 'В этом месяце уже было. Дальше просто держим курс — каждый день без этого идёт в серию.';
  else msg = 'Превышение: ' + info.over + '. Это данные, а не приговор. Посмотри в журнале, что было триггером.';
  const sinceLabel = st.sinceStart ? 'Дней с начала учёта' : 'Дней с последнего раза';
  return '' +
  '<section class="stage">' +
    '<div class="row"><div class="eyebrow">' + MONTHS[now.getMonth()] + ' ' + now.getFullYear() + ' · можно в этом месяце</div><span class="beta">бета</span></div>' +
    '<div class="hero">' + info.n + '<span class="dim"> / ' + L + '</span></div>' +
    '<div class="sub mt8">использовано из «можно»</div>' +
    '<p class="label muted mt16" style="max-width:340px">' + esc(msg) + '</p>' +
    (inGoal && info.n === 0 ? '<p class="label mt16">До чистого месяца: ' + dn(daysLeft) + '</p>' : '') +
    '<div class="mt32"><button class="btn-giallo xl" data-go="sos">SOS<span class="label" style="font-size:16px">тянет — помоги</span></button></div>' +
  '</section>' +
  (showRisk ? '<section class="risk"><div style="flex:1"><div class="label">Сейчас ' + TODS[risk.tod].toLowerCase() + ' — твоё рисковое время</div><p class="label muted mt8">' + risk.n + ' из ' + risk.total + ' записей были ' + TOD_IN[risk.tod] + '. Заранее: телефон на зарядку вне кровати, план на вечер — без экрана.</p><button class="btn-ghost noarrow mt8" data-act="hideRisk">Скрыть на сегодня</button></div></section>' : '') +
  '<section class="grid2">' +
    '<div><div class="eyebrow">' + sinceLabel + '</div><div class="display">' + st.current + '</div></div>' +
    '<div><div class="eyebrow">Рекорд серии</div><div class="display">' + st.best + '</div></div>' +
  '</section>' +
  '<section class="band">' +
    '<div class="sec-head"><div class="h-lg">Побеждённые порывы</div></div>' +
    '<div class="grid2"><div><div class="eyebrow">Этот месяц</div><div class="display">' + beatenCount(m) + '</div></div><div><div class="eyebrow">Всего</div><div class="display">' + beatenCount() + '</div></div></div>' +
    '<p class="label muted mt16">Чистых месяцев (с нулём): ' + winsCount() + '</p>' +
  '</section>' +
  (S.settings.why ? '<section class="band white"><div class="eyebrow">Зачем мне это</div><p class="sub usertext quote">' + esc(S.settings.why) + '</p></section>' : '') +
  '<section class="stage deep" style="padding-top:40px">' +
    '<div class="stack-sm">' +
      '<button class="btn-out" data-go="checkin">Отметить день</button>' +
      '<button class="btn-out" data-go="log">Записать «использовал»</button>' +
    '</div>' +
    (S.settings.why ? '' : '<button class="btn-ghost mt16" data-go="settings">Добавить своё «зачем» и письмо себе</button>') +
  '</section>';
};
handlers.hideRisk = () => { S.ui.riskHidden = today(); save(); render(); };

/* ---------- ЗАПИСЬ «ИСПОЛЬЗОВАЛ» ---------- */
views.log = function (pref) {
  const now = new Date(); const pre = A && A._logTrigger || pref || '';
  return '<section class="stage">' +
    '<div class="topbar"><button class="back" data-go="home">Назад</button><span class="beta">запись</span></div>' +
    '<div class="h-lg">Использовал</div>' +
    '<p class="label muted mt8">Честная запись — это данные для анализа, а не оценка.</p>' +
  '</section>' +
  '<section class="band stack">' +
    '<div class="btn-row"><label class="field"><span>Дата</span><input class="input" type="date" id="l-date" value="' + dkey(now) + '" max="' + dkey(now) + '"></label>' +
    '<label class="field"><span>Время</span><input class="input" type="time" id="l-time" value="' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + '"></label></div>' +
    '<div class="field"><span>Время суток</span>' + chips('tod', TODS, todOf(now)) + '</div>' +
    '<div class="field"><span>Что было триггером</span>' + chips('trig', SITS, SITS[pre] ? pre : '') + '</div>' +
    '<label class="field"><span>Коротко: что происходило</span><textarea class="input" id="l-note" placeholder="Например: устал после выезда, лежал с телефоном"></textarea></label>' +
    '<div class="field"><span>Настроение (необязательно)</span>' + scale('mood', null, 5) + '</div>' +
    '<div class="field"><span>Энергия (необязательно)</span>' + scale('energy', null, 5) + '</div>' +
    '<button class="btn-giallo" data-act="saveLog">Сохранить запись</button>' +
  '</section>';
};
views.log.after = () => {
  const t = document.getElementById('l-time');
  t.addEventListener('change', () => { const [h] = t.value.split(':').map(Number); const d = new Date(); d.setHours(h); const k = todOf(d); $app.querySelectorAll('[data-chips="tod"] .chip').forEach(c => c.classList.toggle('on', c.dataset.v === k)); });
};
handlers.saveLog = () => {
  const date = val('l-date') || today(); const time = val('l-time') || '12:00';
  const [h, mi] = time.split(':').map(Number); const d = parseD(date); d.setHours(h, mi);
  const e = { id: uid(), date, ts: d.getTime(), timeOfDay: chipVal('tod') || todOf(d), trigger: chipVal('trig') || 'other', note: val('l-note') };
  const mo = scaleVal('mood'), en = scaleVal('energy'); if (mo) e.mood = mo; if (en) e.energy = en;
  S.events.push(e); if (S.days[date]) S.days[date].clean = false; save();
  if (A) { A = null; saveSos(); }
  const st = eventStatus()[e.id];
  toast(st === 'over' ? 'Записано. В календаре — как превышение. Без оценок: главное, что дальше.' : 'Записано. Месяц учтён, дальше держим курс.');
  go('journal');
};

/* ---------- ОТМЕТКА ДНЯ ---------- */
views.checkin = function () {
  const t = today(); const d = S.days[t] || {};
  return '<section class="stage">' +
    '<div class="topbar"><button class="back" data-go="home">Назад</button><span class="beta">день</span></div>' +
    '<div class="h-lg">Отметить день</div><p class="label muted mt8">' + fmtDate(t) + ' · без срыва</p>' +
  '</section>' +
  '<section class="band stack">' +
    '<div class="field"><span>Настроение</span>' + scale('mood', d.mood || null, 5) + '</div>' +
    '<div class="field"><span>Энергия</span>' + scale('energy', d.energy || null, 5) + '</div>' +
    '<div class="field"><span>Что сегодня тянуло (если было)</span>' + chips('trig', SITS, d.trigger || '') + '</div>' +
    '<label class="field"><span>Заметка</span><textarea class="input" id="c-note">' + esc(d.note || '') + '</textarea></label>' +
    '<button class="btn-giallo" data-act="saveCheckin">Сохранить день</button>' +
  '</section>';
};
handlers.saveCheckin = () => {
  const t = today(); const d = { clean: !S.events.some(e => e.date === t) };
  const mo = scaleVal('mood'), en = scaleVal('energy'), tr = chipVal('trig'), n = val('c-note');
  if (mo) d.mood = mo; if (en) d.energy = en; if (tr) d.trigger = tr; if (n) d.note = n;
  S.days[t] = d; save(); toast('День отмечен'); go('home');
};

/* ---------- SOS ---------- */
function sosHeader(step) { return '<div class="topbar"><button class="back" data-act="sosExit">Выйти</button><span class="label muted">SOS · ' + step + '</span></div>'; }
views.sos = function () {
  if (!A) A = { id: uid(), startedAt: Date.now(), step: 'rate', actions: [], round: 0 };
  saveSos();
  const f = sosSteps[A.step] || sosSteps.rate; return f();
};
views.sos.after = () => { const f = sosAfter[A && A.step]; if (f) f(); };
const sosSteps = {}, sosAfter = {};

sosSteps.rate = () => '<section class="stage" style="min-height:100dvh">' + sosHeader('1 из 3') +
  '<div class="h-lg">Насколько сильно тянет?</div>' +
  '<div class="mt24">' + scale('before', A.before || null) + '</div>' +
  '<div class="row label muted mt8"><span>чуть-чуть</span><span>очень</span></div>' +
  '<div class="h-sm mt40">Что сейчас происходит?</div>' +
  '<div class="mt16">' + chips('sit', SITS, A.situation || '') + '</div>' +
  '<div class="mt40"><button class="btn-giallo" data-act="sosRate" id="sos-next">Что делать</button></div>' +
  (S.settings.why ? '<div class="mt40"><div class="eyebrow">Зачем</div><p class="sub usertext quote">' + esc(S.settings.why) + '</p></div>' : '') +
'</section>';
handlers.sosRate = () => {
  const b = scaleVal('before'), s = chipVal('sit');
  if (!b || !s) { toast(!b ? 'Отметь силу тяги 1–10' : 'Выбери, что сейчас происходит'); return; }
  A.before = b; A.situation = s; A.date = today(); A.timeOfDay = todOf(new Date());
  A.queue = rankActions(s, b).map(x => x.id); A.current = A.queue[0]; A.step = 'act'; saveSos(); render();
};

function actionExtra(id) {
  const a = ACTIONS[id];
  if (a.kind === 'contacts') {
    const c = S.settings.contacts;
    if (!c.length) return '<p class="label muted">Список людей пуст — добавь в настройках. Сейчас: открой любой недавний чат и напиши «как ты?».</p>';
    return '<div class="list">' + c.map(p => '<div class="row" style="align-items:center"><span class="usertext">' + esc(p.name) + '</span><span><a class="btn-ghost noarrow" href="sms:' + esc(p.phone) + '" style="color:inherit;text-decoration:none">Написать</a> &nbsp; <a class="btn-ghost noarrow" href="tel:' + esc(p.phone) + '" style="color:inherit;text-decoration:none">Позвонить</a></span></div>').join('') + '</div>';
  }
  if (a.kind === 'duty') {
    const n = dutyNotes();
    return (n.length ? n.map(x => '<div class="quote mt16"><div class="caption muted">' + fmtDate(x.date) + '</div><p class="usertext">' + esc(x.note) + '</p></div>').join('') : '') +
      '<p class="sub mt24">Лимит — это «можно», а не «надо». Если месяц закончится с нулём, ты ничего не теряешь: это победа.</p>';
  }
  if (a.kind === 'letter') {
    return (S.settings.letter ? '<p class="usertext quote">' + esc(S.settings.letter) + '</p>' : '') + (S.settings.why ? '<p class="usertext quote mt16">' + esc(S.settings.why) + '</p>' : '');
  }
  if (a.kind === 'breath') return '<div class="breath" id="breath"><div class="sq"></div><div class="txt"><div class="h" id="b-phase">Готов?</div><div class="label" id="b-count">нажми «старт»</div></div></div><button class="btn-out noarrow mt16" data-act="breathStart">Старт дыхания</button>';
  return '';
}
function learnedLine(id) {
  const l = learned(A.situation)[id];
  if (!l) return '<span class="caption muted">ещё нет твоих данных</span>';
  const avg = (l.sum / l.n).toFixed(1);
  return '<span class="caption muted">у тебя: −' + avg + ' к силе · ' + l.n + ' ' + plural(l.n, 'раз', 'раза', 'раз') + '</span>';
}
sosSteps.act = () => {
  const id = A.current; const a = ACTIONS[id]; const late = ['evening', 'night'].includes(todOf(new Date()));
  const alts = A.queue.filter(x => x !== id && !A.actions.includes(x)).slice(0, 3);
  return '<section class="stage" style="min-height:100dvh">' + sosHeader('2 из 3') +
    '<div class="eyebrow">' + esc(SITS[A.situation]) + ' · сила ' + A.before + (late ? ' · ' + TODS[todOf(new Date())].toLowerCase() + ' — сильные шаги первыми' : '') + '</div>' +
    '<div class="h-lg">' + esc(a.t) + '</div>' +
    '<p class="body muted mt16" style="text-transform:none">' + esc(a.d) + '</p>' +
    '<div class="mt8">' + learnedLine(id) + '</div>' +
    '<div class="mt24">' + actionExtra(id) + '</div>' +
    '<div class="mt32"><button class="btn-giallo" data-act="sosStart">Делаю · таймер ' + S.settings.sosMinutes + ':00</button></div>' +
    '<button class="btn-ghost mt8" data-act="sosDone">Уже отпустило</button>' +
    (alts.length ? '<div class="eyebrow mt32">Или другое</div>' + alts.map(x => '<button class="action-alt" data-act="sosPick" data-id="' + x + '"><span>' + esc(ACTIONS[x].t) + '</span>' + learnedLine(x) + '</button>').join('') : '') +
  '</section>';
};
sosAfter.act = () => {};
handlers.sosPick = b => { A.current = b.dataset.id; saveSos(); render(); };
handlers.sosStart = () => {
  if (!A.actions.includes(A.current)) A.actions.push(A.current);
  const mins = A.round ? 5 : S.settings.sosMinutes;
  A.endsAt = Date.now() + mins * 60e3; A.dur = mins * 60e3; A.step = 'timer'; saveSos(); render();
};
handlers.sosDone = () => { if (A.current && !A.actions.includes(A.current)) A.actions.push(A.current); A.step = 'after'; saveSos(); render(); };
sosSteps.timer = () => {
  const a = ACTIONS[A.current];
  return '<section class="stage black" style="min-height:100dvh">' + sosHeader(A.round ? 'усиление' : '2 из 3') +
    '<div class="eyebrow">Сейчас</div><div class="h">' + esc(a.t) + '</div>' +
    '<div class="timer mt40" id="t-left">--:--</div>' +
    '<div class="progress"><i id="t-bar" style="width:0"></i></div>' +
    '<p class="label muted mt16">Экран можно выключить — таймер досчитает.</p>' +
    '<div class="mt24">' + (a.kind && a.kind !== 'breath' ? actionExtra(A.current) : '') + '</div>' +
    '<div class="mt32"><button class="btn-giallo" data-act="sosDone">Отпустило раньше</button></div>' +
  '</section>';
};
sosAfter.timer = () => {
  const tick = () => {
    const left = Math.max(0, A.endsAt - Date.now()); const el = document.getElementById('t-left'); if (!el) return;
    el.textContent = pad(Math.floor(left / 60e3)) + ':' + pad(Math.floor(left / 1e3) % 60);
    document.getElementById('t-bar').style.width = (100 - left / A.dur * 100) + '%';
    if (left <= 0) { A.step = 'check'; saveSos(); try { navigator.vibrate && navigator.vibrate(400); } catch (e) {} render(); }
  };
  tick(); ticks.push(setInterval(tick, 1000));
};
sosSteps.check = () => '<section class="stage" style="min-height:100dvh">' + sosHeader('проверка') +
  '<div class="display">Время вышло</div><div class="h-sm mt16">Ещё тянет?</div>' +
  '<div class="mt40 stack-sm"><button class="btn-giallo" data-act="sosDone">Отпустило</button>' +
  '<button class="btn-out" data-act="sosEscalate">Ещё тянет — усилить</button></div>' +
'</section>';
handlers.sosEscalate = () => {
  A.round = (A.round || 0) + 1;
  const strong = rankActions(A.situation, 10, A.actions).filter(x => ACTIONS[x.id].p === 3);
  const next = (strong[0] || rankActions(A.situation, 10, A.actions)[0] || { id: 'outside' }).id;
  A.current = next; A.queue = [next].concat(rankActions(A.situation, 10, A.actions.concat(next)).map(x => x.id)); A.step = 'act'; saveSos(); render();
  toast('Шаг сильнее: смени обстановку. Таймер — 5 минут.');
};
sosSteps.after = () => '<section class="stage" style="min-height:100dvh">' + sosHeader('3 из 3') +
  '<div class="h-lg">Насколько тянет сейчас?</div>' +
  '<p class="label muted mt8">Было: ' + A.before + '</p>' +
  '<div class="mt24">' + scale('after', null) + '</div>' +
  '<div class="h-sm mt40">Прошло?</div>' +
  '<div class="mt16 stack-sm"><button class="btn-giallo" data-act="sosFinish" data-beaten="1">Да — порыв побеждён</button>' +
  '<button class="btn-out" data-act="sosAgain">Нет, ещё тянет</button></div>' +
  '<button class="btn-ghost mt24" data-act="sosRelapse">Не удержался — записать честно</button>' +
'</section>';
function sosRecord(beaten) {
  const after = scaleVal('after');
  const rec = { id: A.id, ts: A.startedAt, date: A.date || today(), timeOfDay: A.timeOfDay, situation: A.situation, before: A.before, after: after, actions: A.actions.slice(), rounds: A.round || 0, beaten: !!beaten };
  S.sos.push(rec); save(); return rec;
}
handlers.sosFinish = () => {
  if (!scaleVal('after')) { toast('Отметь, насколько тянет сейчас — так приложение учится, что тебе помогает'); return; }
  sosRecord(true); A = { step: 'won' }; saveSos(); render();
};
handlers.sosAgain = () => {
  if (!scaleVal('after')) { toast('Отметь силу 1–10'); return; }
  A.before = scaleVal('after'); handlers.sosEscalate();
};
handlers.sosRelapse = () => { const trig = A.situation; if (A.before) sosRecord(false); A = null; saveSos(); go('log/' + trig); };
sosSteps.won = () => '<section class="stage" style="min-height:100dvh">' +
  '<div class="eyebrow mt40">Порыв побеждён</div>' +
  '<div class="hero">' + beatenCount() + '</div><div class="sub">всего побеждённых порывов</div>' +
  '<p class="label muted mt24">В этом месяце: ' + beatenCount(mkey(new Date())) + '. Приложение запомнило, что сработало, и в следующий раз предложит это первым.</p>' +
  '<div class="mt40"><button class="btn-giallo" data-act="sosClose">На главную</button></div>' +
'</section>';
handlers.sosClose = () => { A = null; saveSos(); go('home'); };
handlers.sosExit = () => { A = null; saveSos(); go('home'); };

/* дыхание 4-7-8 */
handlers.breathStart = () => {
  const phases = [['Вдох', 4, 1], ['Задержка', 7, 1], ['Выдох', 8, 0.1]];
  let cyc = 0, ph = 0, n = 0; const sq = document.querySelector('#breath .sq');
  const P = document.getElementById('b-phase'), C = document.getElementById('b-count');
  stopTicks();
  const step = () => {
    if (!document.getElementById('breath')) return stopTicks();
    const [name, len, size] = phases[ph]; n++;
    P.textContent = name; C.textContent = n + ' / ' + len + ' · круг ' + (cyc + 1) + ' из 4';
    sq.style.transitionDuration = '1s';
    const from = ph === 0 ? 0.1 : ph === 1 ? 1 : 1; const to = size;
    const k = ph === 1 ? 1 : from + (to - from) * (n / len);
    sq.style.width = sq.style.height = (k * 100) + '%';
    if (n >= len) { n = 0; ph++; if (ph > 2) { ph = 0; cyc++; if (cyc >= 4) { stopTicks(); P.textContent = 'Готово'; C.textContent = '4 круга'; } } }
  };
  step(); ticks.push(setInterval(step, 1000));
};

/* ---------- ЖУРНАЛ ---------- */
views.journal = function (arg) {
  const cur = mkey(new Date()); const m = arg || S.ui.jm || cur; S.ui.jm = m;
  const d0 = parseD(m + '-01'); const ml = monthList();
  const st = eventStatus(); const info = monthInfo(m);
  const evByDay = {}; for (const e of S.events) if (e.date.slice(0, 7) === m) (evByDay[e.date] = evByDay[e.date] || []).push(e);
  const sosByDay = {}; for (const s of S.sos) if (s.beaten && (s.date || '').slice(0, 7) === m) sosByDay[s.date] = 1;
  const first = (d0.getDay() + 6) % 7; const dim = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate(); const t = today();
  let cal = '';
  for (let i = 0; i < first; i++) cal += '<div class="out"></div>';
  for (let i = 1; i <= dim; i++) {
    const k = m + '-' + pad(i); const ev = evByDay[k]; const c = [];
    if (ev) c.push(ev.some(e => st[e.id] === 'over') ? 'over' : 'used');
    else if (S.days[k] && S.days[k].clean) c.push('clean');
    if (!ev && sosByDay[k]) c.push('sos');
    if (k === t) c.push('today');
    if (k < S.startDate || k > t) c.push('out');
    cal += '<div class="' + c.join(' ') + '">' + i + '</div>';
  }
  for (let i = (first + dim) % 7; i && i < 7; i++) cal += '<div class="out"></div>';
  const prev = ml[ml.indexOf(m) - 1], next = ml[ml.indexOf(m) + 1];
  const statusText = { win: 'Чистый месяц — победа', 'zero-now': 'Пока ноль', used: 'В пределах «можно»', over: 'Превышение: ' + info.over, free: 'Вне срока цели' }[info.status];
  /* записи месяца */
  const items = [];
  for (const e of S.events) if (e.date.slice(0, 7) === m) items.push({ k: e.date + 'b' + (e.ts || 0), h: '<div><div class="row"><span class="label">' + fmtDate(e.date) + ' · ' + (TODS[e.timeOfDay] || '—') + '</span><span class="tag">' + (st[e.id] === 'over' ? 'превышение' : st[e.id] === 'used' ? 'можно' : 'вне цели') + '</span></div><div class="body mt8">' + esc(SITS[e.trigger] || 'Без триггера') + '</div>' + (e.note ? '<p class="usertext label muted mt8">' + esc(e.note) + '</p>' : '') + '<button class="btn-ghost noarrow" data-act="del" data-id="' + e.id + '">Удалить</button></div>' });
  for (const s of S.sos) if ((s.date || '').slice(0, 7) === m) items.push({ k: s.date + 'a' + (s.ts || 0), h: '<div><div class="row"><span class="label">' + fmtDate(s.date) + ' · SOS</span><span class="tag">' + (s.beaten ? 'побеждён' : 'не удержал') + '</span></div><div class="body mt8">' + esc(SITS[s.situation] || '') + (s.before != null ? ' · ' + s.before + ' → ' + (s.after == null ? '?' : s.after) : '') + '</div>' + (s.actions && s.actions.length ? '<p class="label muted mt8">' + s.actions.map(a => esc(ACTIONS[a] ? ACTIONS[a].t : a)).join(' · ') + '</p>' : '') + '</div>' });
  for (const [k, d] of Object.entries(S.days)) if (k.slice(0, 7) === m && (d.note || d.trigger)) items.push({ k: k + 'c', h: '<div><div class="row"><span class="label">' + fmtDate(k) + ' · день</span>' + (d.mood ? '<span class="caption muted">настр. ' + d.mood + ' · энерг. ' + (d.energy || '—') + '</span>' : '') + '</div>' + (d.trigger ? '<div class="body mt8">Тянуло: ' + esc(SITS[d.trigger] || d.trigger) + '</div>' : '') + (d.note ? '<p class="usertext label muted mt8">' + esc(d.note) + '</p>' : '') + '</div>' });
  items.sort((a, b) => b.k.localeCompare(a.k));
  return '<section class="stage">' +
    '<div class="eyebrow">Журнал</div>' +
    '<div class="row"><div class="display">' + MONTHS[d0.getMonth()] + '</div><div class="h-sm muted">' + d0.getFullYear() + '</div></div>' +
    '<div class="row mt16"><button class="btn-ghost noarrow" ' + (prev ? 'data-go="journal/' + prev + '"' : 'disabled style="opacity:.3"') + '>← Раньше</button>' +
    '<span class="label">' + statusText + '</span>' +
    '<button class="btn-ghost noarrow" ' + (next ? 'data-go="journal/' + next + '"' : 'disabled style="opacity:.3"') + '>Позже →</button></div>' +
  '</section>' +
  '<section class="band white">' +
    '<div class="cal-head">' + ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map(x => '<div>' + x + '</div>').join('') + '</div>' +
    '<div class="cal">' + cal + '</div>' +
    '<div class="legend"><span><b style="background:#fff"></b>отмечен чистым (черта)</span><span><b style="background:#494949"></b>в пределах «можно»</span><span><b style="background:#000"></b>превышение</span><span>■ SOS-победа</span></div>' +
    '<p class="caption muted mt16">Пустые дни — просто не отмеченные, они не считаются срывами.</p>' +
  '</section>' +
  '<section class="band">' +
    '<div class="sec-head"><div class="h">Записи</div><span class="label muted">' + items.length + '</span></div>' +
    (items.length ? '<div class="list">' + items.map(x => x.h).join('') + '</div>' : '<p class="label muted">В этом месяце записей нет.</p>') +
  '</section>' +
  '<section class="band white">' +
    '<div class="sec-head"><div class="h">Все месяцы</div></div>' +
    '<div class="months">' + ml.slice().reverse().map(k => { const i = monthInfo(k); const d = parseD(k + '-01');
      const tg = { win: 'победа', 'zero-now': 'пока 0', used: 'в пределах', over: 'превышение ' + i.over, free: 'вне цели' }[i.status];
      return '<button class="month' + (i.status === 'win' ? ' win' : '') + '" data-go="journal/' + k + '" style="width:100%;text-align:left"><span class="sub">' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + (i.partial ? ' <span class="caption muted">с ' + fmtDate(S.startDate) + '</span>' : '') + '</span><span class="row" style="align-items:center"><span class="label">' + i.n + ' / ' + S.settings.limit + '</span><span class="tag">' + tg + '</span></span></button>'; }).join('') + '</div>' +
  '</section>' +
  '<section class="stage deep stack-sm" style="padding-top:40px">' +
    '<button class="btn-giallo" data-go="checkin">Отметить сегодня</button>' +
    '<button class="btn-out" data-go="log">Записать «использовал»</button>' +
  '</section>';
};
handlers.del = b => {
  if (b.dataset.sure) { S.events = S.events.filter(e => e.id !== b.dataset.id); save(); toast('Удалено'); render(); return; }
  b.dataset.sure = 1; b.textContent = 'Точно удалить? Нажми ещё раз';
};

/* ---------- АНАЛИЗ ---------- */
function bars(counts, labels) {
  const max = Math.max(1, ...Object.values(counts));
  const rows = Object.entries(counts).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return '<p class="label muted">Пока нет данных.</p>';
  return '<div class="bars">' + rows.map(([k, v]) => '<div><span>' + esc(labels[k] || k) + '</span><span class="bar"><i style="width:' + (v / max * 100) + '%"></i></span><span>' + v + '</span></div>').join('') + '</div>';
}
views.stats = function () {
  const tr = {}, td = {}; for (const e of S.events) { tr[e.trigger || 'other'] = (tr[e.trigger || 'other'] || 0) + 1; if (e.timeOfDay) td[e.timeOfDay] = (td[e.timeOfDay] || 0) + 1; }
  const urgesTr = {}; for (const d of Object.values(S.days)) if (d.trigger) urgesTr[d.trigger] = (urgesTr[d.trigger] || 0) + 1;
  for (const s of S.sos) if (s.situation) urgesTr[s.situation] = (urgesTr[s.situation] || 0) + 1;
  const risk = riskyTod(); const topTr = Object.entries(tr).sort((a, b) => b[1] - a[1])[0];
  const dutyN = S.events.filter(e => e.trigger === 'duty').length;
  /* что работает */
  const L = learned(null); const work = Object.entries(L).map(([id, l]) => ({ id, avg: l.sum / l.n, n: l.n, beat: l.beat })).sort((a, b) => b.avg - a.avg);
  const sosDone = S.sos.filter(s => s.before != null); const beat = S.sos.filter(s => s.beaten).length;
  /* настроение */
  const mood = Object.values(S.days).filter(d => d.mood); const avgM = mood.length ? (mood.reduce((a, d) => a + d.mood, 0) / mood.length).toFixed(1) : '—';
  const en = Object.values(S.days).filter(d => d.energy); const avgE = en.length ? (en.reduce((a, d) => a + d.energy, 0) / en.length).toFixed(1) : '—';
  const months = monthList().map(monthInfo);
  return '<section class="stage">' +
    '<div class="eyebrow">Анализ · с ' + fmtDate(S.startDate) + '</div><div class="display">Твои паттерны</div>' +
    '<div class="stack mt32">' +
      (risk ? '<div class="quote"><div class="label muted">Рисковое время</div><div class="h-sm">' + TODS[risk.tod] + ' — ' + risk.n + ' из ' + risk.total + '</div></div>' : '') +
      (topTr ? '<div class="quote"><div class="label muted">Главный триггер</div><div class="h-sm">' + esc(SITS[topTr[0]] || topTr[0]) + ' — ' + topTr[1] + '</div></div>' : '') +
      (dutyN ? '<div class="quote"><div class="label muted">Мысль «надо в этом месяце»</div><div class="h-sm">' + dutyN + ' ' + plural(dutyN, 'раз', 'раза', 'раз') + ' привела к записи</div><p class="label muted mt8">Поэтому лимит теперь «можно», а не «положено», и нет обратного отсчёта в конце месяца.</p></div>' : '') +
    '</div>' +
  '</section>' +
  '<section class="grid2">' +
    '<div><div class="eyebrow">Месяцев в пределах</div><div class="display">' + months.filter(x => x.status === 'used' || x.status === 'win').length + '<span class="dim h-sm"> / ' + months.length + '</span></div></div>' +
    '<div><div class="eyebrow">Чистых месяцев</div><div class="display">' + months.filter(x => x.status === 'win').length + '</div></div>' +
    '<div><div class="eyebrow">SOS-сессий</div><div class="display">' + S.sos.length + '</div></div>' +
    '<div><div class="eyebrow">Порывов побеждено</div><div class="display">' + beat + '</div></div>' +
  '</section>' +
  '<section class="band white"><div class="sec-head"><div class="h">Триггеры записей</div></div>' + bars(tr, SITS) + '</section>' +
  '<section class="band"><div class="sec-head"><div class="h">Время суток</div></div>' + bars(td, TODS) + '</section>' +
  '<section class="band white"><div class="sec-head"><div class="h">Что тянуло без срыва</div></div>' + bars(urgesTr, SITS) + '<p class="caption muted mt16">Из отметок дня и SOS.</p></section>' +
  '<section class="band"><div class="sec-head"><div class="h">Что работает в SOS</div></div>' +
    (work.length ? '<div class="list">' + work.map(w => '<div class="row" style="align-items:center"><span class="body">' + esc(ACTIONS[w.id] ? ACTIONS[w.id].t : w.id) + '</span><span class="label">−' + w.avg.toFixed(1) + ' · ' + w.n + '×</span></div>').join('') + '</div><p class="caption muted mt16">Среднее снижение силы тяги (до → после). Лучшее приложение предлагает первым.</p>' :
      '<p class="label muted">Появится после первых SOS с оценкой «до/после». Сейчас действия выбираются по ситуации и времени суток.</p>') +
    (sosDone.length ? '' : '') +
  '</section>' +
  '<section class="band white"><div class="sec-head"><div class="h">Чистые дни</div></div><div class="grid2"><div><div class="eyebrow">Настроение</div><div class="h-lg">' + avgM + '<span class="dim h-sm"> / 5</span></div></div><div><div class="eyebrow">Энергия</div><div class="h-lg">' + avgE + '<span class="dim h-sm"> / 5</span></div></div></div></section>' +
  '<section class="stage deep" style="padding-top:40px"><div class="eyebrow">Напоминания — честно</div><p class="label muted">Офлайн-приложение с экрана «Домой» не может само прислать уведомление вечером: для пушей на iPhone нужен сервер, а данные у тебя только на телефоне. Поэтому вместо пуша — баннер рискового времени на главной, когда ты открываешь приложение. Можно поставить обычное напоминание в «Часах»/«Напоминаниях» на своё рисковое время.</p>' +
  '<div class="mt24"><button class="btn-giallo" data-go="sos">SOS</button></div></section>';
};

/* ---------- НАСТРОЙКИ ---------- */
views.settings = function () {
  const s = S.settings;
  return '<section class="stage"><div class="eyebrow">Настройки</div><div class="display">Твоё</div><p class="label muted mt8">Всё хранится только на этом телефоне.</p></section>' +
  '<section class="band stack">' +
    '<label class="field"><span>Зачем мне это (покажется в SOS)</span><textarea class="input" id="s-why" placeholder="Например: хочу ясную голову и энергию на льду">' + esc(s.why) + '</textarea></label>' +
    '<label class="field"><span>Письмо себе — на трудный момент</span><textarea class="input" id="s-letter" style="min-height:140px" placeholder="Напиши себе из спокойного состояния: что ты знаешь о тяге и что будет через час, если выдержишь">' + esc(s.letter) + '</textarea></label>' +
  '</section>' +
  '<section class="band white stack">' +
    '<div class="h-sm">Люди для SOS</div><p class="label muted">Кому написать или позвонить при одиночестве.</p>' +
    '<div class="list">' + (s.contacts.length ? s.contacts.map((c, i) => '<div class="row" style="align-items:center"><span class="usertext">' + esc(c.name) + ' · ' + esc(c.phone) + '</span><button class="btn-ghost noarrow" data-act="delContact" data-i="' + i + '">Убрать</button></div>').join('') : '<div class="label muted">Пока пусто</div>') + '</div>' +
    '<div class="btn-row"><input class="input" type="text" id="c-name" placeholder="Имя"><input class="input" type="tel" id="c-phone" placeholder="Телефон"></div>' +
    '<button class="btn-out" data-act="addContact">Добавить человека</button>' +
  '</section>' +
  '<section class="band stack">' +
    '<div class="h-sm">Лимит</div>' +
    '<div class="btn-row"><label class="field"><span>Можно в месяц</span><input class="input" type="number" min="0" max="9" id="s-limit" value="' + s.limit + '"></label>' +
    '<label class="field"><span>Действует до</span><input class="input" type="date" id="s-until" value="' + s.limitUntil + '"></label></div>' +
    '<div class="field"><span>Таймер SOS</span>' + chips('sosmin', { 10: '10 минут', 15: '15 минут' }, String(s.sosMinutes)) + '</div>' +
    '<div class="field"><span>Баннер рискового времени на главной</span>' + chips('risk', { on: 'Показывать', off: 'Скрыть' }, s.riskBanner ? 'on' : 'off') + '</div>' +
    '<button class="btn-giallo" data-act="saveSettings">Сохранить</button>' +
  '</section>' +
  '<section class="band white stack">' +
    '<div class="h-sm">Защита</div>' +
    '<p class="label muted">Face ID веб-приложениям на iPhone недоступен — Apple не даёт к нему доступ без App Store. Поэтому PIN-код. Он закрывает экран, но не шифрует данные.</p>' +
    (s.pinHash ? '<button class="btn-out" data-act="pinOff">Выключить PIN</button><button class="btn-out" data-act="pinSet">Сменить PIN</button>' : '<button class="btn-out" data-act="pinSet">Включить PIN</button>') +
  '</section>' +
  '<section class="band stack">' +
    '<div class="h-sm">Данные</div>' +
    '<p class="label muted">Делай резервную копию раз в пару недель: если удалить приложение с экрана или очистить Safari, данные пропадут.</p>' +
    '<button class="btn-out" data-act="export">Скачать резервную копию</button>' +
    '<label class="btn-out" style="cursor:pointer">Загрузить копию (этого приложения или 90days)<input type="file" id="imp" accept=".json,application/json" class="hidden"></label>' +
    (S.events.some(e => e.source === '90days') ? '' : '<p class="label">Перенеси историю: нажми «Загрузить копию» и выбери файл 90days-backup.json.</p>') + '<p class="caption muted">История из 90days (с ' + fmtDate(S.startDate) + '): ' + S.events.filter(e => e.source === '90days').length + ' записей и ' + Object.values(S.days).filter(d => d.source === '90days').length + ' отмеченных дней.</p>' +
    '<button class="btn-ghost noarrow" data-act="wipe">Удалить всё и начать заново</button>' +
  '</section>' +
  '<section class="stage deep" style="padding-top:40px"><p class="caption muted">Бета · работает офлайн после первого открытия · без серверов, рекламы и аналитики</p></section>';
};
views.settings.after = () => { document.getElementById('imp').addEventListener('change', importFile); };
handlers.saveSettings = () => {
  const s = S.settings; s.why = val('s-why'); s.letter = val('s-letter');
  const l = parseInt(val('s-limit'), 10); s.limit = isNaN(l) ? 1 : Math.max(0, Math.min(9, l));
  s.limitUntil = val('s-until') || '2026-12-31'; s.sosMinutes = +chipVal('sosmin') || 10; s.riskBanner = chipVal('risk') !== 'off';
  save(); toast('Сохранено');
};
handlers.addContact = () => {
  const n = val('c-name'), p = val('c-phone'); if (!n || !p) { toast('Нужны имя и телефон'); return; }
  S.settings.why = val('s-why'); S.settings.letter = val('s-letter');
  S.settings.contacts.push({ name: n, phone: p.replace(/[^\d+]/g, '') }); save(); render();
};
handlers.delContact = b => { S.settings.contacts.splice(+b.dataset.i, 1); save(); render(); };
handlers.wipe = b => {
  if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Точно? Всё, включая историю, будет удалено. Нажми ещё раз'; return; }
  localStorage.removeItem(KEY); localStorage.removeItem(SOS_KEY);
  const H = window.SEED_HISTORY; window.SEED_HISTORY = null; S = fresh(); S.startDate = today(); window.SEED_HISTORY = H; save(); A = null; toast('Всё удалено'); go('home');
};
handlers.export = async () => {
  const data = JSON.stringify({ app: 'limit', v: 1, exportedAt: new Date().toISOString(), data: Object.assign({}, S, { ui: {} }) }, null, 1);
  const name = 'limit-backup-' + today() + '.json';
  try {
    const file = new File([data], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  toast('Копия сохранена');
};

/* импорт: своя копия или экспорт 90days */
function convert90(d) {
  const TR = { 'Стресс': 'stress', 'Телефон в постели': 'phone', 'Одиночество': 'lonely', 'Усталость': 'tired', 'Скука': 'bored', 'Другое': 'other' };
  const TOD = { 'Утро': 'morning', 'День': 'day', 'Вечер': 'evening', 'Ночь': 'night' };
  const out = { startDate: d.startDate, why: d.why || '', days: {}, events: [], sos: [] };
  for (const [k, v] of Object.entries(d.entries || {})) {
    let tr = v.trigger ? (TR[v.trigger] || 'other') : ''; const note = (v.note || '').trim();
    if (v.status === 'relapse') {
      if (/долг/i.test(note)) tr = 'duty';
      const e = { id: 'imp-' + k, date: k, ts: v.ts, timeOfDay: TOD[v.timeOfDay] || '', trigger: tr || 'other', note, source: '90days' };
      if (v.mood) e.mood = v.mood; if (v.energy) e.energy = v.energy; out.events.push(e);
    } else {
      const day = { clean: true, source: '90days' }; if (v.mood) day.mood = v.mood; if (v.energy) day.energy = v.energy; if (note) day.note = note; if (tr) day.trigger = tr;
      out.days[k] = day;
      if (v.sosResolved) out.sos.push({ id: 'imp-sos-' + k, ts: v.ts, date: k, situation: tr || 'other', before: null, after: null, actions: [], beaten: true, source: '90days', timeOfDay: TOD[v.timeOfDay] || '' });
    }
  }
  return out;
}
function importFile(ev) {
  const f = ev.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    let d; try { d = JSON.parse(r.result); } catch (e) { toast('Файл не читается как JSON'); return; }
    if (d.app === 'limit' && d.data) { S = d.data; S.ui = {}; save(); toast('Копия восстановлена'); go('home'); return; }
    if (d.app === '90days' || d.entries) {
      const H = convert90(d); let added = 0;
      for (const e of H.events) if (!S.events.some(x => x.id === e.id || (x.date === e.date && x.ts === e.ts))) { S.events.push(e); added++; }
      for (const [k, v] of Object.entries(H.days)) if (!S.days[k]) { S.days[k] = v; added++; }
      for (const s of H.sos) if (!S.sos.some(x => x.id === s.id)) { S.sos.push(s); added++; }
      if (H.startDate && H.startDate < S.startDate) S.startDate = H.startDate;
      save(); toast('Импорт 90days: добавлено ' + added); render(); return;
    }
    toast('Не понял формат файла');
  };
  r.readAsText(f);
}

/* ---------- PIN ---------- */
async function hash(p) {
  const salt = 'limit-pin-v1';
  if (crypto.subtle) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + p)); return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''); }
  let h = 0; for (const c of salt + p) h = (h * 31 + c.charCodeAt(0)) | 0; return 'x' + h;
}
const $lock = document.getElementById('lock');
function lockScreen(mode, onDone) {
  /* mode: unlock | set | confirm */
  let entered = '', first = null;
  const draw = (title, sub) => {
    $lock.innerHTML = '<div style="max-width:360px;margin:0 auto;width:100%"><div class="eyebrow">Лимит</div><div class="h-lg">' + title + '</div><p class="label muted mt8">' + (sub || '') + '</p>' +
      '<div class="pin-dots">' + [0, 1, 2, 3].map(i => '<i class="' + (i < entered.length ? 'f' : '') + '"></i>').join('') + '</div>' +
      '<div class="pad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(k => '<button data-k="' + k + '"' + (k === '' ? ' disabled' : '') + '>' + k + '</button>').join('') + '</div>' +
      (mode !== 'unlock' ? '<button class="btn-ghost noarrow mt16" data-k="cancel">Отмена</button>' : '') + '</div>';
  };
  let title = mode === 'unlock' ? 'Введи PIN' : 'Новый PIN', sub = mode === 'unlock' ? '' : '4 цифры';
  draw(title, sub); $lock.classList.remove('hidden');
  $lock.onclick = async e => {
    const b = e.target.closest('[data-k]'); if (!b) return; const k = b.dataset.k;
    if (k === 'cancel') { $lock.classList.add('hidden'); return; }
    if (k === '⌫') entered = entered.slice(0, -1); else if (entered.length < 4) entered += k;
    draw(title, sub);
    if (entered.length === 4) {
      if (mode === 'unlock') {
        if (await hash(entered) === S.settings.pinHash) { $lock.classList.add('hidden'); $lock.innerHTML = ''; onDone && onDone(); }
        else { entered = ''; sub = 'Неверно, ещё раз'; draw(title, sub); }
      } else if (first === null) { first = entered; entered = ''; title = 'Повтори PIN'; sub = ''; draw(title, sub); }
      else if (first === entered) { S.settings.pinHash = await hash(entered); save(); $lock.classList.add('hidden'); toast('PIN включён'); render(); }
      else { first = null; entered = ''; title = 'Новый PIN'; sub = 'Не совпало, заново'; draw(title, sub); }
    }
  };
}
handlers.pinSet = () => lockScreen('set');
handlers.pinOff = () => { S.settings.pinHash = null; save(); toast('PIN выключен'); render(); };
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now();
  else { if (S.settings.pinHash && Date.now() - hiddenAt > 60e3) lockScreen('unlock'); if (route()[0] === 'sos') render(); }
});

/* ---------- старт ---------- */
load(); loadSos();
if (A && A.step && A.step !== 'won' && !location.hash) location.hash = 'sos';
render();
if (S.settings.pinHash) lockScreen('unlock');
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__limit = { get state() { return S; } };
})();
