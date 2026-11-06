// Datos cargados desde la sesión del servidor; nunca compartidos en localStorage.
(async () => {
    let initial, account;
    try { const responses = await Promise.all([fetch('/api/state'), fetch('/api/me')]); if (responses.some(r => r.status === 401)) { location.replace('/login'); return } if (responses.some(r => !r.ok)) throw Error('No se pudo cargar tu cuenta.');[initial, account] = await Promise.all(responses.map(r => r.json())) } catch (error) { document.body.hidden = false; document.querySelector('main').textContent = 'No se pudo cargar tu agenda. Revisa la conexión y recarga esta página.'; return }
    document.getElementById('account-name').textContent = account.user.name;
    let revision = initial.revision, cached = JSON.stringify(initial.state), pending = 0, failed = false, queue = Promise.resolve();
    const syncLabel = document.getElementById('sync-status');
    const serverStorage = { getItem() { return cached }, setItem(key, value) { if (failed) throw Error('Guardado detenido'); cached = value; const snapshot = JSON.parse(value); pending++; syncLabel.textContent = 'Guardando…'; queue = queue.then(async () => { if (failed) throw Error('Hay cambios pendientes sin guardar.'); const response = await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: snapshot, revision }) }); const data = await response.json(); if (!response.ok) throw Error(data.error); revision = data.revision; pending--; if (!pending) syncLabel.textContent = 'Guardado en tu cuenta' }).catch(error => { failed = true; syncLabel.textContent = 'Cambios sin guardar'; document.getElementById('download-pending').hidden = false; const warning = document.getElementById('storage-warning'); warning.textContent = error.message + ' Descarga una copia antes de cerrar o recargar.'; warning.hidden = false; throw error }); queue.catch(() => { }); }, flush() { return queue } };
    document.getElementById('download-pending').onclick = () => { const url = URL.createObjectURL(new Blob([cached], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'kids-calendar-cambios-pendientes.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) };
    window.addEventListener('beforeunload', e => { if (pending || failed) { e.preventDefault(); e.returnValue = '' } });
    document.getElementById('logout').onclick = async () => { try { await serverStorage.flush(); const response = await fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); if (!response.ok) throw Error(); location.assign('/login') } catch { syncLabel.textContent = 'No se pudo salir. Revisa los cambios pendientes y tu conexión.' } };
    syncLabel.textContent = 'Guardado en tu cuenta';

    'use strict';
    const $ = id => document.getElementById(id), KEY = 'smart-calendar-v1';
    const subjects = { math: { name: 'Matemáticas', color: '#e9edff' }, language: { name: 'Lengua', color: '#fff0d3' }, science: { name: 'Ciencias', color: '#e7f3e2' }, art: { name: 'Arte', color: '#ffebe5' }, english: { name: 'Inglés', color: '#ede6fa' } };
    const subjectPalette = [{ "name": "Azul cielo", "color": "#d8e6fa" }, { "name": "Azul lavanda", "color": "#e9edff" }, { "name": "Amarillo sol", "color": "#fff0d3" }, { "name": "Verde manzana", "color": "#e7f3e2" }, { "name": "Naranja durazno", "color": "#ffebe5" }, { "name": "Lila suave", "color": "#ede6fa" }];
    const priorities = { low: '🙂 Baja', medium: '😊 Media', high: '🤩 Alta' };
    const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const localDate = key => new Date(key + 'T12:00:00');
    const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    let state = { tasks: [], rewards: [], reminders: false, customSubjects: [] }, view = 'today', selected = dayKey(new Date()), month = new Date(new Date().getFullYear(), new Date().getMonth(), 1), editing = null, deleting = null, toastTimer;
    function warn(message) { $('storage-warning').textContent = message; $('storage-warning').hidden = false }
    // Validamos datos guardados y no sobrescribimos un archivo local dañado.
    let storageBlocked = false;
    try { const raw = serverStorage.getItem(KEY); if (raw) { const data = JSON.parse(raw); restoreSubjects(data.customSubjects); if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.rewards) || !data.tasks.every(t => t && typeof t.id === 'string' && typeof t.title === 'string' && Object.hasOwn(subjects, t.subject) && Object.hasOwn(priorities, t.priority) && Number.isFinite(new Date(t.due).getTime()) && typeof t.done === 'boolean') || !data.rewards.every(r => r && typeof r.id === 'string' && Number.isFinite(new Date(r.at).getTime()))) throw Error('invalid'); state = { tasks: data.tasks, rewards: data.rewards, reminders: data.reminders === true, spent: data.spent, records: data.records, customSubjects: data.customSubjects || [] } } } catch (e) { storageBlocked = true; warn('No pudimos leer el almacenamiento. Puedes usar la agenda en esta sesión; los datos anteriores no se sobrescribirán.') }
    function refreshSubjectOptions(selectedId = $('subject').value) { $('subject').innerHTML = Object.entries(subjects).map(([id, s]) => `<option value="${escapeHTML(id)}">${escapeHTML(s.name)}</option>`).join(''); $('subject').value = Object.hasOwn(subjects, selectedId) ? selectedId : 'math' }
    function restoreSubjects(list = []) { if (!Array.isArray(list)) throw Error('invalid subjects'); for (const s of list) { if (!s || typeof s.id !== 'string' || !/^custom-[a-z0-9-]+$/.test(s.id) || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 50 || !/^#[0-9a-f]{6}$/i.test(s.color)) throw Error('invalid subject'); subjects[s.id] = { name: s.name, color: s.color } } }
    function save() { if (storageBlocked) return; try { serverStorage.setItem(KEY, JSON.stringify(state)) } catch (e) { warn('No se pudo guardar en tu cuenta. Conserva esta pestaña abierta y revisa los cambios pendientes.') } }
    function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 4500) }
    function celebrate() { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; for (let i = 0; i < 30; i++) { const p = document.createElement('i'); p.className = 'confetti'; p.style.left = Math.random() * 100 + 'vw'; p.style.background = ['#f1c44d', '#5572e2', '#83b66c', '#f2926e'][i % 4]; p.style.animationDelay = Math.random() * .3 + 's'; document.body.append(p); setTimeout(() => p.remove(), 2100) } }
    function streak() { const days = new Set(state.rewards.map(r => dayKey(new Date(r.at)))); let d = new Date(); if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1); let n = 0; while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1) } return n }
    function renderCalendar() { $('month-label').textContent = month.toLocaleDateString('es', { month: 'long', year: 'numeric' }); let html = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(s => `<span class="weekday">${s}</span>`).join(''); const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7; html += '<span></span>'.repeat(offset); const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(); for (let n = 1; n <= count; n++) { const key = dayKey(new Date(month.getFullYear(), month.getMonth(), n)); const has = state.tasks.some(t => !t.done && dayKey(new Date(t.due)) === key); html += `<button class="day ${key === selected ? 'selected' : ''} ${key === dayKey(new Date()) ? 'today' : ''} ${has ? 'has-task' : ''}" data-day="${key}" aria-pressed="${key === selected}" aria-label="${localDate(key).toLocaleDateString('es', { dateStyle: 'full' })}${has ? ', con tareas pendientes' : ''}">${n}</button>` } $('calendar').innerHTML = html }
    function render() {
        if (window.arcadeReady) renderArcade(); const now = new Date(), today = dayKey(now); $('date-label').textContent = now.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); $('points').textContent = state.rewards.filter(reward => dayKey(new Date(reward.at)) === today).length * 10; $('streak').textContent = streak() + ' días'; const daily = state.tasks.filter(t => dayKey(new Date(t.due)) === today), done = daily.filter(t => t.done).length, pct = daily.length ? Math.round(done / daily.length * 100) : 0; $('daily-progress').textContent = `${done} / ${daily.length}`; $('progress-fill').style.width = pct + '%'; $('progressbar').setAttribute('aria-valuenow', pct);
        renderCalendar(); $('subjects').innerHTML = Object.entries(subjects).map(([id, s]) => `<div class="subject-line"><span class="subject-dot" style="background:${s.color}" aria-hidden="true"></span>${escapeHTML(s.name)}<b>${state.tasks.filter(t => t.subject === id && !t.done).length}</b></div>`).join('');
        document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('active', b.dataset.view === view); b.setAttribute('aria-pressed', b.dataset.view === view) });
        $('list-title').textContent = view === 'done' ? '¡Lo has conseguido!' : view === 'upcoming' ? 'Tus próximas aventuras' : selected === today ? 'Mis tareas de hoy' : 'Tareas del ' + localDate(selected).toLocaleDateString('es', { day: 'numeric', month: 'long' });
        let tasks = state.tasks.filter(t => view === 'done' ? t.done : view === 'upcoming' ? !t.done && dayKey(new Date(t.due)) > today : !t.done && dayKey(new Date(t.due)) === selected).sort((a, b) => new Date(a.due) - new Date(b.due));
        const overdue = state.tasks.filter(t => !t.done && new Date(t.due) < now && dayKey(new Date(t.due)) < today).length; $('overdue-note').hidden = !overdue; $('overdue-note').textContent = `Tienes ${overdue} tarea(s) de días anteriores. Las encontrarás en el calendario o en Supervisión para retomarlas.`;
        $('task-list').innerHTML = tasks.length ? tasks.map(t => { const s = subjects[t.subject], due = new Date(t.due), hours = (due - now) / 36e5, alert = !t.done && (hours < 0 ? '<span class="badge late">Entrega vencida</span>' : hours < 24 ? '<span class="badge urgent">Vence en menos de 24 h</span>' : ''); return `<article class="task ${t.done ? 'done' : ''}"><input type="checkbox" data-check="${escapeHTML(t.id)}" ${t.done ? 'checked' : ''} aria-label="${t.done ? 'Reabrir' : 'Completar'}: ${escapeHTML(t.title)}"><span class="subject-icon" style="background:${s.color}" aria-hidden="true">${escapeHTML(s.name.slice(0, 1))}</span><div class="task-body"><h3>${escapeHTML(t.title)}</h3>${t.description ? `<p class="task-description">${escapeHTML(t.description)}</p>` : ''}<div class="task-meta"><span>${escapeHTML(s.name)}</span><span>${due.toLocaleDateString('es', { day: 'numeric', month: 'short' })} · ${due.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span><span>${priorities[t.priority]}</span>${alert}</div></div><div class="actions"><button data-edit="${escapeHTML(t.id)}" aria-label="Editar ${escapeHTML(t.title)}">Editar</button><button data-delete="${escapeHTML(t.id)}" aria-label="Eliminar ${escapeHTML(t.title)}">Eliminar</button></div></article>` }).join('') : `<div class="empty"><span>${view === 'done' ? '⭐' : '🌈'}</span><strong>${view === 'done' ? 'Cada logro empieza con una tarea.' : '¡Hay espacio para nuevas aventuras!'}</strong><br>${view === 'done' ? 'Completa tu primera tarea y aparecerá aquí.' : 'Añade una tarea para organizar tu próximo paso.'}</div>`;
        const total = state.tasks.length, complete = state.tasks.filter(t => t.done).length, percent = total ? Math.round(complete / total * 100) : 0; $('parent-stats').innerHTML = `<div><strong>${percent}%</strong>completadas</div><div><strong>${total ? 100 - percent : 0}%</strong>pendientes</div><div><strong>${complete} / ${total}</strong>tareas completadas</div>`;
        $('history').innerHTML = [...state.tasks].sort((a, b) => new Date(b.due) - new Date(a.due)).map(t => `<tr><td>${escapeHTML(t.title)}${t.description ? `<p class="task-description">${escapeHTML(t.description)}</p>` : ''}</td><td>${new Date(t.due).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</td><td><button data-history-toggle="${escapeHTML(t.id)}">${t.done ? '✓ Completada · reabrir' : new Date(t.due) < now ? 'Vencida · completar' : 'Pendiente · completar'}</button></td></tr>`).join('') || '<tr><td colspan="3">Todavía no hay tareas. ¡Creemos la primera!</td></tr>';
        $('reminders').textContent = state.reminders ? '✓ Recordatorios activos · desactivar' : '♧ Activar recordatorios';
    }
    function openForm(id = null) { editing = id; const t = state.tasks.find(t => t.id === id); $('task-form').reset(); $('dialog-title').textContent = t ? 'Editar aventura ✏️' : 'Una nueva aventura ✏️'; $('title').value = t ? t.title : ''; $('description').value = t ? (t.description || '') : ''; refreshSubjectOptions(); $('subject').value = t ? t.subject : 'math'; $('due-date').value = t ? dayKey(new Date(t.due)) : selected; $('due-time').value = t ? `${String(new Date(t.due).getHours()).padStart(2, '0')}:${String(new Date(t.due).getMinutes()).padStart(2, '0')}` : '17:00'; $('priority').value = t ? t.priority : 'medium'; $('form-error').hidden = true; $('task-dialog').showModal(); $('title').focus() }
    function toggleTask(id) { const t = state.tasks.find(t => t.id === id); if (!t) return; t.done = !t.done; if (t.done) { t.completedAt = new Date().toISOString(); if (!state.rewards.some(r => r.id === id)) { state.rewards.push({ id, at: t.completedAt }); toast(new Date(t.due) >= new Date() ? '¡A tiempo! +10 estrellas = 10 turnos para jugar ⭐' : '¡Buen trabajo! +10 estrellas = 10 turnos para jugar ⭐'); if (new Date(t.due) >= new Date()) celebrate() } else toast('¡Tarea completada! Tus estrellas ya estaban guardadas ⭐') } else { t.completedAt = null; toast('Tarea reabierta. No se conceden estrellas extra por repetirla.') } save(); render() }
    // CRUD: los títulos siempre se insertan escapados, nunca como HTML de usuario.
    refreshSubjectOptions();
    $('task-form').addEventListener('submit', e => { e.preventDefault(); const title = $('title').value.trim(), due = new Date($('due-date').value + 'T' + $('due-time').value); if (!title || !Number.isFinite(due.getTime())) { $('form-error').textContent = 'Escribe un título y una fecha válida.'; $('form-error').hidden = false; return } const fields = { title, description: $('description').value.trim().slice(0, 2000), subject: $('subject').value, priority: $('priority').value, due: due.toISOString() }; if (editing) { const t = state.tasks.find(t => t.id === editing); if (!t) { toast('Esta tarea ya no existe.'); $('task-dialog').close(); return } Object.assign(t, fields); t.notifiedDue = null } else state.tasks.push({ id: globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2), ...fields, done: false, completedAt: null, notifiedDue: null }); save(); $('task-dialog').close(); render(); toast('¡Tarea guardada! Tu próximo paso ya está en la agenda.'); checkReminders() });
    ['add', 'add-top'].forEach(id => $(id).onclick = () => openForm());['close-dialog', 'cancel'].forEach(id => $(id).onclick = () => $('task-dialog').close());
    $('calendar').onclick = e => { const b = e.target.closest('[data-day]'); if (b) { selected = b.dataset.day; view = 'today'; render() } };
    document.querySelector('.tabs').onclick = e => { const b = e.target.closest('[data-view]'); if (b) { view = b.dataset.view; if (view === 'today') selected = dayKey(new Date()); render() } };
    function moveMonth(n) { month = new Date(month.getFullYear(), month.getMonth() + n, 1); renderCalendar() } $('prev').onclick = () => moveMonth(-1); $('next').onclick = () => moveMonth(1); $('today-button').onclick = () => { selected = dayKey(new Date()); month = new Date(new Date().getFullYear(), new Date().getMonth(), 1); view = 'today'; render() };
    $('task-list').onchange = e => { if (e.target.dataset.check) toggleTask(e.target.dataset.check) };
    $('task-list').onclick = e => { const edit = e.target.closest('[data-edit]'), del = e.target.closest('[data-delete]'); if (edit) openForm(edit.dataset.edit); if (del) { deleting = del.dataset.delete; $('delete-dialog').showModal() } };
    $('history').onclick = e => { const b = e.target.closest('[data-history-toggle]'); if (b) toggleTask(b.dataset.historyToggle) };
    $('delete-cancel').onclick = () => $('delete-dialog').close(); $('delete-confirm').onclick = () => { state.tasks = state.tasks.filter(t => t.id !== deleting); save(); render(); $('delete-dialog').close(); toast('Tarea eliminada.') };
    $('supervision').onclick = () => { const active = $('parent-view').hidden; $('parent-view').hidden = !active; $('child-view').hidden = active; $('supervision').setAttribute('aria-pressed', active); $('supervision').textContent = active ? '🌈 Volver a mi agenda' : '👪 Vista de supervisión' };
    // Recordatorios una vez por fecha de entrega, mientras la página esté abierta.
    async function checkReminders() { if (!state.reminders || !('Notification' in window) || Notification.permission !== 'granted') return; let changed = false; for (const t of state.tasks) { const hours = (new Date(t.due) - new Date()) / 36e5; if (!t.done && hours >= 0 && hours < 24 && t.notifiedDue !== t.due) { try { new Notification('Kids Calendar · Próxima aventura', { body: `${t.title} · ${new Date(t.due).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}`, tag: t.id }); t.notifiedDue = t.due; changed = true } catch (e) { toast('Este navegador no permite enviar avisos. Revisa las alertas de la agenda.'); break } } } if (changed) save() }
    $('reminders').onclick = async () => { if (state.reminders) { state.reminders = false; save(); render(); return } if (!('Notification' in window) || !window.isSecureContext) { toast('Para notificaciones, abre la aplicación en localhost o HTTPS con un navegador compatible.'); return } try { const permission = await Notification.requestPermission(); if (permission === 'granted') { state.reminders = true; save(); render(); toast('Recordatorios activos con la página abierta.'); checkReminders() } else toast(permission === 'denied' ? 'Permiso bloqueado. Puedes cambiarlo en los ajustes de este sitio.' : 'Puedes activar los recordatorios cuando quieras.') } catch (e) { toast('No se pudieron activar. Revisa los permisos del navegador.') } };
    window.addEventListener('storage', e => { if (e.key === KEY) toast('La agenda cambió en otra pestaña. Recarga antes de editar para ver los cambios.') });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); checkReminders() } }); setInterval(() => { render(); checkReminders() }, 60000); render(); checkReminders();
    // Una estrella = una partida. El saldo conserva las recompensas anteriores.
    const games = { runner: { name: 'Dino salto', icon: '🦖', hint: 'Toca o pulsa Espacio para saltar los obstáculos.' }, pipes: { name: 'Vuelo entre tubos', icon: '🐤', hint: 'Da toques o pulsa Espacio para volar entre los tubos.' }, catch: { name: 'Lluvia de estrellas', icon: '🧺', hint: 'Mueve el dedo o el ratón. También puedes usar ← y →.' } };
    state.spent = Number.isSafeInteger(state.spent) && state.spent >= 0 ? state.spent : 0;
    state.records = state.records && typeof state.records === 'object' ? state.records : {};
    const balance = () => Math.max(0, state.rewards.length * 10 - state.spent);
    let activeGame = null, frame = 0, lastFrame = 0, gamePaused = false, starting = false;
    const gameCanvas = $('game-canvas'), ctx = gameCanvas.getContext('2d');
    function renderArcade() { $('game-balance').textContent = balance(); $('game-earned').textContent = state.rewards.length * 10; Object.keys(games).forEach(k => { $('play-' + k).disabled = balance() < 1 || storageBlocked || starting; $('record-' + k).textContent = 'Récord: ' + (Number(state.records[k]) || 0) }); $('arcade-status').textContent = storageBlocked ? 'No se pueden iniciar partidas sin almacenamiento disponible.' : balance() ? 'Elige una aventura. Cada inicio cuesta 1 estrella.' : 'Completa una tarea para ganar 10 estrellas y desbloquear tus partidas.'; }
    function drawDinosaur(x, y) {
        ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#327447';
        // Cabeza y hocico a la derecha; cola a la izquierda. Caja de colisión: x=78..108.
        ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(-8, 10); ctx.lineTo(-5, 25); ctx.lineTo(5, 29); ctx.lineTo(5, 36); ctx.lineTo(12, 36); ctx.lineTo(12, 29); ctx.lineTo(19, 29); ctx.lineTo(19, 36); ctx.lineTo(25, 36); ctx.lineTo(25, 26); ctx.lineTo(20, 21); ctx.lineTo(20, 14); ctx.lineTo(30, 14); ctx.lineTo(30, 0); ctx.lineTo(12, 0); ctx.lineTo(12, 16); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'white'; ctx.fillRect(22, 3, 4, 4); ctx.fillStyle = '#26334a'; ctx.fillRect(24, 4, 2, 2); ctx.fillRect(24, 11, 6, 2); ctx.restore();
    }
    function drawStar(x, y, r) { ctx.save(); ctx.translate(x, y); ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, s = i % 2 ? r * .45 : r; i ? ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s) : ctx.moveTo(Math.cos(a) * s, Math.sin(a) * s) } ctx.closePath(); ctx.fillStyle = '#d59918'; ctx.fill(); ctx.restore(); }
    // La curva logarítmica aumenta suavemente la velocidad sin un límite de duración.
    function gameSpeed(seconds) { return 1 + Math.log1p(Math.max(0, seconds) / 30) * .45 }
    function drawGame() {
        const g = activeGame; if (!g) return; ctx.fillStyle = '#edf6ff'; ctx.fillRect(0, 0, 600, 340); ctx.fillStyle = '#d4e7fb'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(80 + i * 160, 55 + (i % 2) * 35, 25, 0, Math.PI * 2); ctx.fill() } ctx.fillStyle = '#37506e'; ctx.font = 'bold 18px Trebuchet MS'; ctx.fillText('Puntos: ' + Math.floor(g.score), 18, 28); ctx.fillText('Velocidad ×' + gameSpeed(g.time).toFixed(2), 405, 28);
        if (g.type === 'runner') { ctx.fillStyle = '#8ab877'; ctx.fillRect(0, 285, 600, 55); drawDinosaur(78, g.y); ctx.fillStyle = '#d8783e'; g.items.forEach(o => ctx.fillRect(o.x, 285 - o.h, 25, o.h)) }
        if (g.type === 'pipes') { ctx.fillStyle = '#6b9e57'; g.items.forEach(o => { ctx.fillRect(o.x, 0, 48, o.gap - 76); ctx.fillRect(o.x, o.gap + 76, 48, 340 - o.gap - 76) }); ctx.fillStyle = '#e3a927'; ctx.beginPath(); ctx.arc(105, g.y, 14, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#26334a'; ctx.beginPath(); ctx.arc(110, g.y - 4, 3, 0, Math.PI * 2); ctx.fill() }
        if (g.type === 'catch') { g.items.forEach(o => drawStar(o.x, o.y, 13)); ctx.fillStyle = '#6d59a7'; ctx.fillRect(g.x - 38, 290, 76, 22); ctx.fillStyle = '#26334a'; ctx.font = '14px Trebuchet MS'; ctx.fillText('Estrellas escapadas: ' + g.missed + ' / 5', 18, 326) }
        if (gamePaused) { ctx.fillStyle = '#26334abf'; ctx.fillRect(0, 0, 600, 340); ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.font = 'bold 25px Trebuchet MS'; ctx.fillText('En pausa', 300, 165); ctx.textAlign = 'left' }
    }
    function endGame(message) { if (!activeGame) return; cancelAnimationFrame(frame); const g = activeGame, score = Math.floor(g.score); state.records[g.type] = Math.max(Number(state.records[g.type]) || 0, score); save(); activeGame = null; gamePaused = false; $('game-result').textContent = message + ' Lograste ' + score + ' puntos. ¡Buen esfuerzo!'; $('game-result').hidden = false; $('game-start').disabled = balance() < 1; $('game-start').textContent = 'Otra partida · 1 estrella'; $('game-pause').disabled = true; renderArcade() }
    function stepGame(stamp) {
        if (!activeGame || gamePaused) return; const dt = Math.min((stamp - lastFrame) / 1000, .035); lastFrame = stamp; const g = activeGame; g.time += dt; g.spawn -= dt; const speed = gameSpeed(g.time);
        if (g.type === 'runner') { g.v += 1150 * dt; g.y += g.v * dt; if (g.y >= 245) { g.y = 245; g.v = 0 } if (g.spawn <= 0) { g.items.push({ x: 620, h: 28 + Math.random() * 18 }); g.spawn = (1.25 + Math.random() * .5) / speed } for (const o of g.items) { o.x -= 220 * speed * dt; if (o.x < 108 && o.x + 25 > 78 && g.y + 35 > 285 - o.h) { endGame('¡Buen salto! Vuelve a intentarlo cuando quieras.'); return } } g.items = g.items.filter(o => o.x > -30); g.score = g.time * 5 }
        if (g.type === 'pipes') { g.v += 520 * dt; g.y += g.v * dt; if (g.spawn <= 0) { g.items.push({ x: 620, gap: 105 + Math.random() * 125, passed: false }); g.spawn = 1.9 / speed } for (const o of g.items) { o.x -= 155 * speed * dt; if (o.x < 119 && o.x + 48 > 91 && (g.y - 14 < o.gap - 76 || g.y + 14 > o.gap + 76)) { endGame('¡Un vuelo lleno de práctica!'); return } if (!o.passed && o.x + 48 < 91) { o.passed = true; g.score++ } } g.items = g.items.filter(o => o.x > -50); if (g.y < 14 || g.y > 326) { endGame('¡Un vuelo lleno de práctica!'); return } }
        if (g.type === 'catch') { g.x = Math.max(38, Math.min(562, g.x + g.direction * 340 * Math.sqrt(speed) * dt)); if (g.spawn <= 0) { g.items.push({ x: 25 + Math.random() * 550, y: -20 }); g.spawn = .65 / Math.sqrt(speed) } for (const o of g.items) { const previousY = o.y; o.y += 125 * speed * dt; if (previousY <= 322 && o.y >= 278 && Math.abs(o.x - g.x) < 48) { o.y = 400; g.score++ } else if (o.y > 330) { o.y = 400; g.missed++ } } g.items = g.items.filter(o => o.y < 390); if (g.missed >= 5) { endGame('¡Has recogido un montón de energía!'); return } }
        drawGame(); frame = requestAnimationFrame(stepGame)
    }
    function action() { if (!activeGame || gamePaused) return; if (activeGame.type === 'runner' && activeGame.y >= 245) activeGame.v = -510; if (activeGame.type === 'pipes') activeGame.v = -225; }
    function pauseGame() { if (!activeGame) return; gamePaused = !gamePaused; activeGame.direction = 0; $('game-pause').textContent = gamePaused ? 'Continuar' : 'Pausar'; cancelAnimationFrame(frame); drawGame(); if (!gamePaused) { lastFrame = performance.now(); frame = requestAnimationFrame(stepGame) } }
    let chosenGame = 'runner';
    async function startGame() {
        if (starting || activeGame) return; starting = true; renderArcade(); $('game-start').disabled = true;
        const begin = async () => { // Releer el saldo dentro del bloqueo evita gastar dos veces desde pestañas distintas.
            try { const raw = serverStorage.getItem(KEY); if (raw) { const latest = JSON.parse(raw); if (!Array.isArray(latest.rewards)) throw Error(); state.rewards = latest.rewards; state.spent = Number.isSafeInteger(latest.spent) && latest.spent >= 0 ? latest.spent : 0; state.records = latest.records || {}; restoreSubjects(latest.customSubjects); state.customSubjects = latest.customSubjects || []; refreshSubjectOptions(); state.tasks = latest.tasks; state.reminders = latest.reminders } }
            catch (e) { toast('No se pudo leer el saldo. No se ha iniciado la partida.'); return }
            if (storageBlocked || balance() < 1) { toast('Necesitas una estrella para comenzar.'); return } state.spent++; try { serverStorage.setItem(KEY, JSON.stringify(state)); await serverStorage.flush() } catch (e) { state.spent--; toast('No pudimos guardar el turno. No se ha cobrado la partida.'); return }
            activeGame = { type: chosenGame, time: 0, score: 0, y: chosenGame === 'runner' ? 245 : 170, v: 0, x: 300, direction: 0, items: [], spawn: 1, missed: 0 }; gamePaused = false; $('game-result').hidden = true; $('game-pause').disabled = false; $('game-pause').textContent = 'Pausar'; gameCanvas.focus(); lastFrame = performance.now(); frame = requestAnimationFrame(stepGame); render();
        };
        try { if (navigator.locks) await navigator.locks.request('smart-calendar-turn', begin); else await begin() } catch (e) { toast('No se pudo iniciar la partida. Inténtalo de nuevo.') } finally { starting = false; renderArcade(); $('game-start').disabled = !!activeGame || balance() < 1 }
    }
    function openGame(type) { chosenGame = type; $('game-title').textContent = games[type].icon + ' ' + games[type].name; $('game-hint').textContent = games[type].hint + ' Sin límite de tiempo: la velocidad aumenta progresivamente.'; $('game-result').hidden = false; $('game-result').textContent = 'Preparado: se descontará 1 estrella al pulsar Comenzar. Salir termina la partida sin devolver el turno.'; $('game-start').textContent = 'Comenzar · 1 estrella'; $('game-start').disabled = balance() < 1; $('game-pause').disabled = true; ctx.fillStyle = '#edf6ff'; ctx.fillRect(0, 0, 600, 340); ctx.fillStyle = '#3657cf'; ctx.textAlign = 'center'; ctx.font = 'bold 28px Trebuchet MS'; ctx.fillText('¡Tu próxima aventura te espera!', 300, 165); ctx.textAlign = 'left'; $('game-dialog').showModal() }
    function closeGame() { if (starting) return; if (activeGame) endGame('Partida terminada.'); $('game-dialog').close(); }
    Object.keys(games).forEach(k => $('play-' + k).onclick = () => openGame(k)); $('game-start').onclick = startGame; $('game-pause').onclick = pauseGame; $('game-close').onclick = closeGame;
    $('game-dialog').addEventListener('cancel', e => { e.preventDefault(); closeGame() });
    gameCanvas.addEventListener('pointerdown', e => { e.preventDefault(); gameCanvas.focus(); moveBasket(e); action() });
    function moveBasket(e) { if (activeGame?.type === 'catch' && !gamePaused) { const r = gameCanvas.getBoundingClientRect(); activeGame.x = Math.max(38, Math.min(562, (e.clientX - r.left) / r.width * 600)) } }
    gameCanvas.addEventListener('pointermove', moveBasket);
    gameCanvas.addEventListener('keydown', e => { if (['Space', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.code)) { e.preventDefault(); if (e.repeat && e.code === 'Space') return; if (activeGame?.type === 'catch' && !gamePaused) activeGame.direction = e.code === 'ArrowLeft' ? -1 : e.code === 'ArrowRight' ? 1 : 0; else if (e.code === 'Space' || e.code === 'ArrowUp') action() } });
    gameCanvas.addEventListener('keyup', e => { if (activeGame && ['ArrowLeft', 'ArrowRight'].includes(e.code)) activeGame.direction = 0 });
    window.addEventListener('blur', () => { if (activeGame && !gamePaused) pauseGame() }); document.addEventListener('visibilitychange', () => { if (document.hidden && activeGame && !gamePaused) pauseGame() });
    renderArcade();

    $('add-subject').onclick = () => { $('subject-form').reset(); $('subject-error').hidden = true; $('subject-dialog').showModal(); $('subject-name').focus() };
    $('cancel-subject').onclick = () => $('subject-dialog').close();
    function createSubject(name, color) { name = name.trim(); if (!name || name.length > 50) throw Error('Escribe un nombre de hasta 50 caracteres.'); if (!subjectPalette.some(item => item.color === color)) throw Error('Selecciona uno de los colores de la paleta.'); if (Object.values(subjects).some(s => s.name.normalize('NFKC').toLocaleLowerCase('es') === name.normalize('NFKC').toLocaleLowerCase('es'))) throw Error('Ya existe una materia con ese nombre.'); const id = 'custom-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); const subject = { id, name, color }; state.customSubjects.push(subject); subjects[id] = { name, color, icon: '' }; save(); refreshSubjectOptions(); render(); return id; }
    $('subject-form').addEventListener('submit', e => { e.preventDefault(); try { createSubject($('subject-name').value, document.querySelector('input[name="subject-palette"]:checked').value); $('subject-dialog').close(); toast('Materia creada. Ya puedes elegirla al crear o editar una tarea.') } catch (error) { $('subject-error').textContent = error.message; $('subject-error').hidden = false } });
    const pomodoroDurations = [25 * 60_000, 5 * 60_000];
    let pomodoroPhase = 0;
    let pomodoroRemaining = pomodoroDurations[0];
    let pomodoroDeadline = null;
    let pomodoroInterval;

    function renderPomodoro() {
        const seconds = Math.ceil(pomodoroRemaining / 1000);
        $('pomodoro-clock').textContent = String(Math.floor(seconds / 60)).padStart(2, '0')
            + ':' + String(seconds % 60).padStart(2, '0');
        const progress = 100 * (1 - pomodoroRemaining / pomodoroDurations[pomodoroPhase]);
        $('pomodoro-dial').style.setProperty('--timer-progress', progress + '%');
    }

    function stopPomodoro() {
        clearInterval(pomodoroInterval);
        pomodoroDeadline = null;
    }

    function preparePomodoro(phase, message) {
        stopPomodoro();
        pomodoroPhase = phase;
        pomodoroRemaining = pomodoroDurations[phase];
        $('pomodoro').dataset.phase = phase ? 'rest' : 'focus';
        $('pomodoro-phase').textContent = phase ? 'Descanso' : 'Concentración';
        $('pomodoro-message').textContent = message;
        $('pomodoro-toggle').textContent = phase ? 'Empezar descanso' : 'Empezar concentración';
        renderPomodoro();
    }

    function advancePomodoro() {
        preparePomodoro(1 - pomodoroPhase, pomodoroPhase
            ? 'Ya puedes empezar otra sesión de concentración.'
            : 'Es hora de descansar. Tómate 5 minutos para recargar energía.');
    }

    function tickPomodoro() {
        if (pomodoroDeadline === null) return;
        pomodoroRemaining = Math.max(0, pomodoroDeadline - Date.now());
        if (pomodoroRemaining === 0) {
            advancePomodoro();
            return;
        }
        renderPomodoro();
    }

    $('pomodoro-toggle').onclick = () => {
        if (pomodoroDeadline !== null) {
            tickPomodoro();
            if (pomodoroDeadline === null) return;
            stopPomodoro();
            $('pomodoro-phase').textContent = pomodoroPhase ? 'Descanso en pausa' : 'Concentración en pausa';
            $('pomodoro-message').textContent = 'Temporizador en pausa. Continúa cuando quieras.';
            $('pomodoro-toggle').textContent = 'Continuar';
            return;
        }
        pomodoroDeadline = Date.now() + pomodoroRemaining;
        pomodoroInterval = setInterval(tickPomodoro, 250);
        $('pomodoro-phase').textContent = pomodoroPhase ? 'Descanso' : 'Concentración';
        $('pomodoro-message').textContent = pomodoroPhase
            ? 'Estira las piernas o toma un poco de agua.'
            : 'Dedica este rato a una sola tarea.';
        $('pomodoro-toggle').textContent = 'Pausar';
    };
    $('pomodoro-next').onclick = advancePomodoro;
    $('pomodoro-reset').onclick = () => preparePomodoro(0, 'Elige una tarea. Tienes 25 minutos para avanzar a tu ritmo.');
    document.addEventListener('visibilitychange', tickPomodoro);

    window.arcadeReady = true;
    document.body.hidden = false;
})().catch(error => { document.body.hidden = false; document.querySelector("main").textContent = "No se pudo iniciar la agenda. Recarga la página."; console.error(error) });