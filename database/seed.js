const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./database/database.db");

const products = [
    "ลูกชิ้นหมู",
    "ลูกชิ้นเนื้อ",
    "ไส้กรอก",
    "น้ำ"
];

products.forEach(name => {

    db.run(
        `
        INSERT INTO products(name)
        VALUES(?)
        `,
        [name]
    );

});

db.close();

console.log("Seed Complete");