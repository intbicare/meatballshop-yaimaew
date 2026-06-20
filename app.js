const express = require("express");

const app = express();
const path = require("path");
const fs = require("fs");

loadEnvFile();

app.set("trust proxy", true);

app.set("view engine", "ejs");

app.use(
express.urlencoded({
extended: true
})
);

app.use(express.json({
limit: "10mb"
}));

app.use("/orders", express.static(path.join(__dirname, "generated", "orders")));

app.get("/qr/:amount",async (req,res)=>{


const amount =
    Number(req.params.amount);

if(
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 5000
){

    return res.status(400).send(
        "Invalid amount"
    );

}

try{

    const qrResponse =
        await fetch(
            `https://promptpay.io/0651167368/${amount}.png`
        );

    if(!qrResponse.ok){

        return res.status(502).send(
            "Cannot load QR"
        );

    }

    const qrBuffer =
        Buffer.from(
            await qrResponse.arrayBuffer()
        );

    res.setHeader(
        "Content-Type",
        "image/png"
    );

    res.setHeader(
        "Cache-Control",
        "public, max-age=86400"
    );

    res.send(qrBuffer);

}catch(error){

    console.log(error);

    res.status(502).send(
        "Cannot load QR"
    );

}


});

app.get("/",(req,res)=>{


res.redirect("/dashboard");


});

app.get("/meatballshop-yaimaew",(req,res)=>{


res.redirect("/dashboard");


});

app.get(
"/dashboard",
(req,res)=>{


    fs.readFile(
        path.join(__dirname,"database","products.json"),
        "utf8",
        (err,data)=>{

            if(err){

                console.log(err);

                return res.status(500).send(
                    "Cannot load products"
                );

            }

            const products =
                JSON.parse(data);

            res.render(
                "dashboard",
                {
                    products
                }
            );

        }
    );

}


);

app.post("/api/orders",async (req,res)=>{


const {
    orderNumber,
    items,
    total,
    slipImage,
    orderText
} = req.body;

if(
    !orderNumber ||
    !Array.isArray(items) ||
    items.length === 0 ||
    !slipImage
){

    return res.status(400).json({
        error: "Invalid order"
    });

}

const safeOrderNumber =
    String(orderNumber).replace(/[^a-zA-Z0-9-]/g,"");

const ordersDir =
    path.join(__dirname,"generated","orders");

fs.mkdirSync(
    ordersDir,
    {
        recursive: true
    }
);

const createdAt =
    new Date().toISOString();

const pngBase64 =
    String(slipImage).replace(/^data:image\/png;base64,/,"");

const imageFile =
    `${safeOrderNumber}.png`;

const jsonFile =
    `${safeOrderNumber}.json`;

fs.writeFileSync(
    path.join(ordersDir,imageFile),
    Buffer.from(pngBase64,"base64")
);

fs.writeFileSync(
    path.join(ordersDir,jsonFile),
    JSON.stringify(
        {
            orderNumber,
            items,
            total,
            createdAt,
            imageUrl: `/orders/${imageFile}`,
            orderText: orderText || ""
        },
        null,
        2
    )
);

const publicImageUrl =
    `${req.protocol}://${req.get("host")}/orders/${imageFile}`;

let discordNotified = false;

if(process.env.DISCORD_WEBHOOK_URL){

    try{

        await sendDiscordOrderNotification({
            orderNumber,
            items,
            total,
            orderText,
            imageUrl: publicImageUrl
        });

        discordNotified = true;

    }catch(error){

        console.error(
            "DISCORD WEBHOOK FAILED",
            orderNumber,
            error.message
        );

    }

}

res.json({
    ok: true,
    orderNumber,
    imageUrl: `/orders/${imageFile}`,
    jsonUrl: `/orders/${jsonFile}`,
    discordNotified
});


});

const port =
    process.env.PORT || 3000;

app.listen(
port,
()=>{


    console.log(
        `POS RUNNING ON ${port}`
    );

}


);

async function sendDiscordOrderNotification(order){

const itemLines =
    order.items.map((item)=>{

        return `- ${item.name} x${item.qty} = ฿${item.lineTotal}`;

    }).join("\n");

const content =
    order.orderText ||
    [
        `New order: ${order.orderNumber}`,
        itemLines,
        `Total: ฿${order.total}`,
        order.imageUrl
    ].join("\n");

const response =
    await fetch(
        process.env.DISCORD_WEBHOOK_URL,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: "Meatball Order",
                content,
                embeds: [
                    {
                        title: `Order ${order.orderNumber}`,
                        description: itemLines,
                        color: 15872536,
                        fields: [
                            {
                                name: "Total",
                                value: `฿${order.total}`,
                                inline: true
                            }
                        ],
                        image: {
                            url: order.imageUrl
                        }
                    }
                ]
            })
        }
    );

if(!response.ok){

    throw new Error(
        `Discord responded ${response.status}`
    );

}

}

function loadEnvFile(){

const envPath =
    path.join(__dirname,".env");

if(!fs.existsSync(envPath)){

    return;

}

const lines =
    fs.readFileSync(envPath,"utf8")
        .split(/\r?\n/);

lines.forEach((line)=>{

    const trimmed =
        line.trim();

    if(
        !trimmed ||
        trimmed.startsWith("#")
    ){

        return;

    }

    const equalIndex =
        trimmed.indexOf("=");

    if(equalIndex === -1){

        return;

    }

    const key =
        trimmed.slice(0,equalIndex).trim();

    const value =
        trimmed.slice(equalIndex + 1).trim();

    if(
        key &&
        process.env[key] === undefined
    ){

        process.env[key] =
            value.replace(/^["']|["']$/g,"");

    }

});

}
