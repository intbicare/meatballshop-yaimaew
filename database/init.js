const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./database/database.db");

db.serialize(() => {

    db.run(` CREATE TABLE products ( id INTEGER PRIMARY KEY AUTOINCREMENT, grab_item_id TEXT, name TEXT, price REAL, category TEXT, description TEXT, image_url TEXT, active INTEGER DEFAULT 1 ) `);
        db.run(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT,
            order_no TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            product_id INTEGER,
            qty INTEGER
        )
    `);
    });

db.close();

console.log("Database Ready");