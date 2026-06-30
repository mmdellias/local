const path = require('path');

let db = null;
let isPostgres = false;

async function initDb() {
  if (process.env.DATABASE_URL) {
    isPostgres = true;
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT DEFAULT '',
        role TEXT DEFAULT '',
        status TEXT DEFAULT 'offline',
        photo TEXT DEFAULT ''
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        category TEXT DEFAULT '',
        dueDate TEXT DEFAULT '',
        assigneeId TEXT DEFAULT '',
        col TEXT NOT NULL DEFAULT 'todo',
        createdAt TEXT NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#10b981'
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT DEFAULT '',
        size REAL DEFAULT 0,
        sizeLabel TEXT DEFAULT '',
        data TEXT DEFAULT '',
        folderId TEXT DEFAULT '',
        date TEXT NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        timestamp TEXT NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    db = pool;
  } else {
    const initSqlJs = require('sql.js');
    const fs = require('fs');
    const DB_PATH = path.join(__dirname, 'data.db');

    const SQL = await initSqlJs();
    try {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } catch {
      db = new SQL.Database();
    }

    db.run(`CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT DEFAULT '',
      role TEXT DEFAULT '', status TEXT DEFAULT 'offline', photo TEXT DEFAULT ''
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '',
      category TEXT DEFAULT '', dueDate TEXT DEFAULT '', assigneeId TEXT DEFAULT '',
      col TEXT NOT NULL DEFAULT 'todo', createdAt TEXT NOT NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT DEFAULT '#10b981'
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT DEFAULT '',
      size REAL DEFAULT 0, sizeLabel TEXT DEFAULT '', data TEXT DEFAULT '',
      folderId TEXT DEFAULT '', date TEXT NOT NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY, text TEXT NOT NULL, type TEXT DEFAULT 'info',
      timestamp TEXT NOT NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL
    )`);
  }
}

function toSqlite(sql) {
  return sql.replace(/\$(\d+)/g, () => '?');
}

async function all(sql, params) {
  if (isPostgres) {
    const result = await db.query(sql, params || []);
    return result.rows;
  }
  const stmt = db.prepare(toSqlite(sql));
  if (params && params.length > 0) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

async function get(sql, params) {
  const rows = await all(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

async function run(sql, params) {
  if (isPostgres) {
    await db.query(sql, params || []);
  } else {
    db.run(toSqlite(sql), params || []);
    saveSqlite();
  }
}

function saveSqlite() {
  if (!isPostgres) {
    const fs = require('fs');
    const data = db.export();
    fs.writeFileSync(path.join(__dirname, 'data.db'), Buffer.from(data));
  }
}

module.exports = { initDb, all, get, run, isPostgres };
