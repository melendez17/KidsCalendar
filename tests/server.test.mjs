import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

test('Registro, sesiones, aislamiento, conflictos y persistencia SQLite', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'smart-calendar-'));
    const port = 34000 + Math.floor(Math.random() * 20000);
    const base = `http://localhost:${port}`;
    let child;

    async function launch() {
        child = spawn(
            process.execPath,
            [fileURLToPath(new URL('../server.mjs', import.meta.url))],
            {
                env: {
                    ...process.env,
                    PORT: String(port),
                    APP_ORIGIN: base,
                    DB_PATH: join(directory, 'test.sqlite')
                },
                stdio: ['ignore', 'pipe', 'pipe']
            }
        );
        await Promise.race([
            once(child.stdout, 'data'),
            once(child, 'exit').then(() => {
                throw Error('El servidor no inició');
            })
        ]);
    }

    async function stop() {
        const exit = once(child, 'exit');
        child.kill();
        await exit;
    }

    async function request(path, { method = 'GET', cookie, data, origin = base } = {}) {
        const headers = {};
        if (cookie) headers.Cookie = cookie;
        if (method !== 'GET') {
            headers.Origin = origin;
            headers['Content-Type'] = 'application/json';
        }
        const response = await fetch(base + path, {
            method,
            headers,
            body: data === undefined ? undefined : JSON.stringify(data),
            redirect: 'manual'
        });
        const text = await response.text();
        return {
            status: response.status,
            cookie: response.headers.get('set-cookie')?.split(';')[0],
            headers: response.headers,
            data: text.startsWith('{') ? JSON.parse(text) : text
        };
    }

    try {
        await launch();
        assert.equal((await request('/')).status, 200);
        assert.equal((await request('/dashboard')).status, 302);
        assert.equal((await request('/api/state')).status, 401);
        assert.equal((await request('/data/calendar.sqlite')).status, 404);
        for (const page of ['/registro', '/login']) {
            const response = await request(page);
            assert.equal(response.status, 200);
            assert.match(response.data, /<script\b[^>]*src="\/auth\.js"[^>]*>/);
        }
        for (const [path, type] of [['/auth.js', 'text/javascript'], ['/js/dashboard.js', 'text/javascript'], ['/styles/dashboard.css', 'text/css']]) {
            const response = await request(path);
            assert.equal(response.status, 200, path);
            assert(response.headers.get('content-type').startsWith(type), path);
        }

        const registration = {
            name: 'Familia Uno',
            email: 'uno@example.test',
            password: 'Una frase privada 123',
            consent: true
        };
        const a = await request('/api/register', { method: 'POST', data: registration });
        assert.equal(a.status, 201);
        assert(a.headers.get('set-cookie').includes('HttpOnly'));
        assert.equal(
            (await request('/api/register', { method: 'POST', data: registration })).status,
            409
        );

        assert.equal(
            (
                await request('/api/login', {
                    method: 'POST',
                    data: { email: registration.email, password: 'equivocada' }
                })
            ).status,
            401
        );

        const b = await request('/api/register', {
            method: 'POST',
            data: { ...registration, name: 'Familia Dos', email: 'dos@example.test' }
        });
        assert.equal(b.status, 201);

        const initial = await request('/api/state', { cookie: a.cookie });
        assert.deepEqual(initial.data.state.tasks, []);

        const state = {
            ...initial.data.state,
            tasks: [
                {
                    id: 'task-a',
                    title: 'Leer',
                    description: 'Capítulo 3',
                    subject: 'math',
                    priority: 'medium',
                    done: true,
                    due: new Date().toISOString()
                }
            ],
            rewards: [{ id: 'task-a', at: new Date().toISOString() }],
            spent: 1
        };

        assert.equal(
            (await request('/api/state', { method: 'PUT', cookie: a.cookie, data: { state, revision: 0 } })).status,
            200
        );
        assert.equal(
            (await request('/api/state', { method: 'PUT', cookie: a.cookie, data: { state, revision: 0 } })).status,
            409
        );
        assert.equal(
            (
                await request('/api/state', {
                    method: 'PUT',
                    cookie: a.cookie,
                    data: { state, revision: 1 },
                    origin: 'https://otro.example'
                })
            ).status,
            403
        );
        assert.equal(
            (
                await request('/api/state', {
                    method: 'PUT',
                    cookie: a.cookie,
                    data: { state: { ...state, spent: -1 }, revision: 1 }
                })
            ).status,
            400
        );

        assert.deepEqual((await request('/api/state', { cookie: b.cookie })).data.state.tasks, []);
        assert.equal(
            (await request('/api/state', { cookie: a.cookie })).data.state.tasks[0].description,
            'Capítulo 3'
        );

        await stop();
        await launch();
        assert.equal((await request('/api/state', { cookie: a.cookie })).data.state.spent, 1);

        assert.equal(
            (await request('/api/logout', { method: 'POST', cookie: a.cookie, data: {} })).status,
            200
        );
        assert.equal((await request('/api/state', { cookie: a.cookie })).status, 401);

        const login = await request('/api/login', {
            method: 'POST',
            data: { email: registration.email, password: registration.password }
        });
        assert.equal(login.status, 200);
        assert.equal((await request('/dashboard', { cookie: login.cookie })).status, 200);
        assert.equal(
            (await request('/api/state', { cookie: login.cookie })).data.state.tasks[0].title,
            'Leer'
        );
    } finally {
        if (child?.exitCode === null) await stop();
        await rm(directory, { recursive: true, force: true });
    }
});
