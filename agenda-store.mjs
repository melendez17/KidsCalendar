const defaultSubjects = [
    ['math', 'Matemáticas', '#e9edff'], ['language', 'Lengua', '#fff0d3'],
    ['science', 'Ciencias', '#e7f3e2'], ['art', 'Arte', '#ffebe5'],
    ['english', 'Inglés', '#ede6fa']
];

export function openAgendaStore(db) {
    function transaction(work, mode = 'IMMEDIATE') {
        db.exec('BEGIN ' + mode);
        try {
            const result = work();
            db.exec('COMMIT');
            return result;
        } catch (error) {
            db.exec('ROLLBACK');
            throw error;
        }
    }

    function writeRows(userId, state) {
        for (const table of ['tasks', 'subjects', 'rewards', 'game_records']) {
            db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
        }
        const subject = db.prepare('INSERT INTO subjects VALUES (?, ?, ?, ?, ?)');
        for (const [id, name, color] of defaultSubjects) subject.run(userId, id, name, color, 0);
        for (const { id, name, color } of state.customSubjects) subject.run(userId, id, name, color, 1);
        const task = db.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const t of state.tasks) {
            task.run(userId, t.id, t.subject, t.title, t.description ?? null, t.due,
                t.priority, Number(t.done), t.completedAt ?? null, t.notifiedDue ?? null);
        }
        const reward = db.prepare('INSERT INTO rewards VALUES (?, ?, ?)');
        for (const { id, at } of state.rewards) reward.run(userId, id, at);
        const record = db.prepare('INSERT INTO game_records VALUES (?, ?, ?)');
        for (const game of ['runner', 'pipes', 'catch']) {
            if (state.records[game] !== undefined) record.run(userId, game, state.records[game]);
        }
    }

    transaction(() => {
        const legacy = db.prepare("SELECT name FROM pragma_table_info('agendas') WHERE name = 'payload'").get();
        if (legacy) db.exec('ALTER TABLE agendas RENAME TO legacy_agendas');
        db.exec(`
            CREATE TABLE IF NOT EXISTS agendas (
                user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                revision INTEGER NOT NULL DEFAULT 0,
                spent INTEGER NOT NULL DEFAULT 0 CHECK (spent >= 0),
                reminders INTEGER NOT NULL DEFAULT 0 CHECK (reminders IN (0, 1))
            );
            CREATE TABLE IF NOT EXISTS subjects (
                user_id TEXT NOT NULL REFERENCES agendas(user_id) ON DELETE CASCADE,
                id TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL,
                custom INTEGER NOT NULL CHECK (custom IN (0, 1)),
                PRIMARY KEY (user_id, id)
            );
            CREATE TABLE IF NOT EXISTS tasks (
                user_id TEXT NOT NULL, id TEXT NOT NULL, subject_id TEXT NOT NULL,
                title TEXT NOT NULL, description TEXT, due TEXT NOT NULL,
                priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
                done INTEGER NOT NULL CHECK (done IN (0, 1)),
                completed_at TEXT, notified_due TEXT,
                PRIMARY KEY (user_id, id),
                FOREIGN KEY (user_id, subject_id) REFERENCES subjects(user_id, id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS rewards (
                user_id TEXT NOT NULL REFERENCES agendas(user_id) ON DELETE CASCADE,
                task_id TEXT NOT NULL, earned_at TEXT NOT NULL,
                PRIMARY KEY (user_id, task_id)
            );
            CREATE TABLE IF NOT EXISTS game_records (
                user_id TEXT NOT NULL REFERENCES agendas(user_id) ON DELETE CASCADE,
                game TEXT NOT NULL CHECK (game IN ('runner', 'pipes', 'catch')),
                score INTEGER NOT NULL CHECK (score >= 0),
                PRIMARY KEY (user_id, game)
            );
        `);
        if (!legacy) return;
        const insert = db.prepare('INSERT INTO agendas VALUES (?, ?, ?, ?)');
        for (const row of db.prepare('SELECT * FROM legacy_agendas').iterate()) {
            const state = JSON.parse(row.payload);
            insert.run(row.user_id, row.revision, state.spent, Number(state.reminders));
            writeRows(row.user_id, state);
        }
        db.exec('DROP TABLE legacy_agendas');
    });

    return {
        create(userId) {
            db.prepare('INSERT INTO agendas(user_id) VALUES (?)').run(userId);
            const insert = db.prepare('INSERT INTO subjects VALUES (?, ?, ?, ?, 0)');
            for (const [id, name, color] of defaultSubjects) insert.run(userId, id, name, color);
        },
        read(userId) {
            return transaction(() => {
                const { revision, spent, reminders } = db.prepare('SELECT revision, spent, reminders FROM agendas WHERE user_id = ?').get(userId);
                const tasks = db.prepare(`
                    SELECT id, subject_id AS subject, title, description, due, priority,
                           done, completed_at AS completedAt, notified_due AS notifiedDue
                    FROM tasks WHERE user_id = ? ORDER BY rowid
                `).all(userId).map(({ description, done, ...task }) => ({
                    ...task, done: Boolean(done), ...(description === null ? {} : { description })
                }));
                const customSubjects = db.prepare('SELECT id, name, color FROM subjects WHERE user_id = ? AND custom = 1 ORDER BY rowid').all(userId);
                const rewards = db.prepare('SELECT task_id AS id, earned_at AS at FROM rewards WHERE user_id = ? ORDER BY rowid').all(userId);
                const records = Object.fromEntries(db.prepare('SELECT game, score FROM game_records WHERE user_id = ?').all(userId).map(({ game, score }) => [game, score]));
                return { revision, state: { tasks, customSubjects, rewards, records, spent, reminders: Boolean(reminders) } };
            }, 'DEFERRED');
        },
        save(userId, revision, state) {
            return transaction(() => {
                const { changes } = db.prepare(`
                    UPDATE agendas SET revision = revision + 1, spent = ?, reminders = ?
                    WHERE user_id = ? AND revision = ?
                `).run(state.spent, Number(state.reminders), userId, revision);
                if (!changes) return false;
                writeRows(userId, state);
                return true;
            });
        }
    };
}
