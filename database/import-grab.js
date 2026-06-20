const fs = require("fs");
const csv = require("csv-parser");
const sqlite3 = require("sqlite3").verbose();

const db =
new sqlite3.Database(
"./database/database.db"
);

db.run(
"DELETE FROM products"
);

fs.createReadStream(
"./grab.csv"
)
.pipe(csv())
.on("data", row => {

db.run(
    `
    INSERT INTO products
    (
        grab_item_id,
        name,
        price,
        category,
        description,
        image_url,
        active
    )
    VALUES
    (?,?,?,?,?,?,?)
    `,
    [
        row["*ItemID"],
        row["*ItemName"],
        row["*Price"],
        row["*CategoryName"],
        row["Description"],
        row["Photo1"],
        row["*AvailableStatus"] === "AVAILABLE"
            ? 1
            : 0
    ]
);

})
.on("end", () => {

console.log(
    "Import Complete"
);

db.close();

});
