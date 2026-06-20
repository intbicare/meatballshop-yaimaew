const express = require("express");
const session = require("express-session");

const app = express();
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const quickSales = [];

loadEnvFile();

app.set("trust proxy", true);

app.set("view engine", "ejs");

app.use(
session({
secret: process.env.SESSION_SECRET || "dev-session-secret",
resave: false,
saveUninitialized: false,
cookie: {
httpOnly: true,
sameSite: "lax",
secure: process.env.NODE_ENV === "production"
}
})
);

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

app.get("/admin/login",(req,res)=>{


res.render(
    "admin-login",
    {
        error: ""
    }
);


});

app.post("/admin/login",(req,res)=>{


const password =
    req.body.password || "";

if(
    process.env.ADMIN_PASSWORD &&
    password === process.env.ADMIN_PASSWORD
){

    req.session.adminAuthed = true;

    return res.redirect(
        "/admin/quick-sale"
    );

}

res.status(401).render(
    "admin-login",
    {
        error: "Invalid password"
    }
);


});

app.post("/admin/logout",(req,res)=>{


req.session.destroy(()=>{

    res.redirect(
        "/admin/login"
    );

});


});

app.get("/admin/orders",requireAdmin,(req,res)=>{


try{

    res.render(
        "admin-orders",
        {
            orders: getOnlineOrders(),
            statuses: getOnlineOrderStatuses(),
            error: "",
            success: ""
        }
    );

}catch(error){

    console.error(error);

    res.status(500).render(
        "admin-orders",
        {
            orders: [],
            statuses: getOnlineOrderStatuses(),
            error: "Cannot load online orders.",
            success: ""
        }
    );

}


});

app.post("/admin/orders/status",requireAdmin,(req,res)=>{


const orderNumber =
    req.body.orderNumber || "";

const status =
    req.body.status || "";

try{

    updateOnlineOrderStatus(orderNumber,status);

    res.render(
        "admin-orders",
        {
            orders: getOnlineOrders(),
            statuses: getOnlineOrderStatuses(),
            error: "",
            success: `Updated ${orderNumber}`
        }
    );

}catch(error){

    console.error(error);

    res.status(400).render(
        "admin-orders",
        {
            orders: getOnlineOrders(),
            statuses: getOnlineOrderStatuses(),
            error: "Cannot update order status.",
            success: ""
        }
    );

}


});

app.get("/admin/quick-sale",requireAdmin,async (req,res)=>{


try{

    const sales =
        await getTodayQuickSales();

    res.render(
        "admin-quick-sale",
        {
            sales,
            summary: summarizeQuickSales(sales),
            error: "",
            success: ""
        }
    );

}catch(error){

    console.error(error);

    res.status(500).render(
        "admin-quick-sale",
        {
            sales: [],
            summary: emptyQuickSaleSummary(),
            error: "Cannot load quick sale orders.",
            success: ""
        }
    );

}


});

app.post("/admin/quick-sale",requireAdmin,async (req,res)=>{


const amount =
    Number(req.body.amount);

const paymentMethod =
    req.body.paymentMethod === "cash" ? "cash" : "qr";

if(
    !Number.isFinite(amount) ||
    amount <= 0
){

    return renderQuickSaleWithMessage(
        res,
        "Amount must be more than 0.",
        ""
    );

}

try{

    await appendQuickSale({
        amount,
        paymentMethod
    });

    return renderQuickSaleWithMessage(
        res,
        "",
        `Added sale: ฿${amount}`
    );

}catch(error){

    console.error(error);

    return renderQuickSaleWithMessage(
        res,
        "Cannot notify Discord. Sale was not saved.",
        ""
    );

}


});

app.post("/admin/quick-sale//cancel",requireAdmin,async (req,res)=>{


try{

    await cancelQuickSale(
        req.body.orderNumber || ""
    );

    return renderQuickSaleWithMessage(
        res,
        "",
        "Sale cancelled."
    );

}catch(error){

    console.error(error);

    return renderQuickSaleWithMessage(
        res,
        "Cannot cancel sale.",
        ""
    );

}


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

app.get("/track/",(req,res)=>{


res.status(404).render(
    "track",
    {
        order: null,
        error: "Tracking link is missing an order number."
    }
);


});

app.get("/track/:orderNumber",(req,res)=>{


const safeOrderNumber =
    String(req.params.orderNumber || "").replace(/[^a-zA-Z0-9-]/g,"");

const token =
    String(req.query.t || "");

const orderPath =
    path.join(__dirname,"generated","orders",`${safeOrderNumber}.json`);

if(
    !safeOrderNumber ||
    !token ||
    !fs.existsSync(orderPath)
){

    return res.status(404).render(
        "track",
        {
            order: null,
            error: "Order not found."
        }
    );

}

try{

    const savedOrder =
        JSON.parse(fs.readFileSync(orderPath,"utf8"));

    if(savedOrder.trackingToken !== token){

        return res.status(403).render(
            "track",
            {
                order: null,
                error: "Tracking link is not valid."
            }
        );

    }

    return res.render(
        "track",
        {
            order: getCustomerSafeOrder(savedOrder),
            error: ""
        }
    );

}catch(error){

    console.error(error);

    return res.status(500).render(
        "track",
        {
            order: null,
            error: "Cannot load order."
        }
    );

}


});

app.post("/api/orders",async (req,res)=>{


const {
    orderNumber: submittedOrderNumber,
    items,
    total,
    slipImage,
    orderText,
    customerLocation
} = req.body;

if(
    !Array.isArray(items) ||
    items.length === 0 ||
    !slipImage
){

    return res.status(400).json({
        error: "Invalid order"
    });

}

const orderNumber =
    getWebOrderNumber(submittedOrderNumber);

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

const status =
    "pending_payment";

const trackingToken =
    createTrackingToken();

const trackingUrl =
    `${getAppBaseUrl(req)}/track/${safeOrderNumber}?t=${trackingToken}`;

const locationData =
    await buildCustomerLocationData(customerLocation);

const savedOrderText =
    appendOrderLinks(
        orderText || "",
        trackingUrl,
        locationData
    );

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
            createdAt,
            orderNumber,
            channel: "online",
            status,
            items,
            itemsText: buildItemsText(items),
            total,
            trackingToken,
            trackingUrl,
            updatedAt: createdAt,
            imageUrl: `/orders/${imageFile}`,
            orderText: savedOrderText,
            ...locationData
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
            status,
            items,
            total,
            orderText: savedOrderText,
            imageUrl: publicImageUrl,
            trackingUrl,
            ...locationData
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
    status,
    trackingUrl,
    customerLat: locationData.customerLat,
    customerLng: locationData.customerLng,
    customerMapUrl: locationData.customerMapUrl,
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
        `Tracking: ${order.trackingUrl}`,
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
                        fields: buildDiscordOrderFields(order).concat([
                            {
                                name: "Total",
                                value: `฿${order.total}`,
                                inline: true
                            }
                        ]),
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

function buildDiscordOrderFields(order){

return [
    {
        name: "Status",
        value: order.status || "pending_payment",
        inline: true
    },
    {
        name: "Tracking",
        value: order.trackingUrl || "-",
        inline: false
    },
    {
        name: "Customer map",
        value: order.customerMapUrl || "-",
        inline: false
    },
    {
        name: "Customer lat,lng",
        value: order.customerLat && order.customerLng ?
            `${order.customerLat},${order.customerLng}` :
            "-",
        inline: false
    },
    {
        name: "Straight distance",
        value: order.straightDistanceKm ?
            `${order.straightDistanceKm} km` :
            "-",
        inline: true
    },
    {
        name: "Route distance",
        value: order.routeDistanceKm ?
            `${order.routeDistanceKm} km` :
            "-",
        inline: true
    },
    {
        name: "Route time",
        value: order.routeDurationMin ?
            `${order.routeDurationMin} min` :
            "-",
        inline: true
    }
];

}

function createWebOrderNumber(){

const now =
    new Date();

const datePart =
    [
        String(now.getFullYear()).slice(-2),
        String(now.getMonth() + 1).padStart(2,"0"),
        String(now.getDate()).padStart(2,"0")
    ].join("");

const timePart =
    [
        String(now.getHours()).padStart(2,"0"),
        String(now.getMinutes()).padStart(2,"0")
    ].join("");

const randomPart =
    Math.floor(100 + Math.random() * 900);

return `WEB-${datePart}-${timePart}-${randomPart}`;

}

function getWebOrderNumber(value){

const orderNumber =
    String(value || "").trim();

if(/^WEB-\d{6}-\d{4}-\d{3}$/.test(orderNumber)){

    return orderNumber;

}

return createWebOrderNumber();

}

function createTrackingToken(){

return crypto.randomBytes(18).toString("hex");

}

function getAppBaseUrl(req){

return (
    process.env.APP_BASE_URL ||
    `${req.protocol}://${req.get("host")}`
).replace(/\/$/,"");

}

function buildItemsText(items){

return items.map((item)=>{

    return `${item.name} x${item.qty} = ${item.lineTotal}`;

}).join("\n");

}

function appendOrderLinks(orderText,trackingUrl,locationData){

return [
    orderText,
    trackingUrl ? `Tracking: ${trackingUrl}` : "",
    locationData.customerLat && locationData.customerLng ?
        `Customer lat,lng: ${locationData.customerLat},${locationData.customerLng}` :
        "",
    locationData.customerMapUrl ? `Customer map: ${locationData.customerMapUrl}` : ""
].filter(Boolean).join("\n");

}

async function buildCustomerLocationData(customerLocation){

const baseData = {
    customerLat: "",
    customerLng: "",
    customerMapUrl: "",
    straightDistanceKm: "",
    routeDistanceKm: "",
    routeDurationMin: ""
};

if(!customerLocation){

    return baseData;

}

const customerLat =
    Number(customerLocation.lat);

const customerLng =
    Number(customerLocation.lng);

if(
    !Number.isFinite(customerLat) ||
    !Number.isFinite(customerLng)
){

    return baseData;

}

const shopLat =
    Number(process.env.SHOP_LAT || 13.7426371);

const shopLng =
    Number(process.env.SHOP_LNG || 100.3520867);

const locationData = {
    ...baseData,
    customerLat,
    customerLng,
    customerMapUrl: `https://maps.google.com/?q=${customerLat},${customerLng}`,
    straightDistanceKm: roundDistance(
        getHaversineDistanceKm(
            shopLat,
            shopLng,
            customerLat,
            customerLng
        )
    )
};

try{

    const routeData =
        await getOsrmRouteDistance({
            shopLat,
            shopLng,
            customerLat,
            customerLng
        });

    return {
        ...locationData,
        ...routeData
    };

}catch(error){

    console.error("OSRM ROUTE FAILED",error.message);
    return locationData;

}

}

async function getOsrmRouteDistance({
    shopLat,
    shopLng,
    customerLat,
    customerLng
}){

const osrmBaseUrl =
    (process.env.OSRM_BASE_URL || "https://router.project-osrm.org")
        .replace(/\/$/,"");

const url =
    `${osrmBaseUrl}/route/v1/driving/${shopLng},${shopLat};${customerLng},${customerLat}?overview=false`;

const response =
    await fetch(url);

if(!response.ok){

    throw new Error(`OSRM responded ${response.status}`);

}

const data =
    await response.json();

const route =
    data.routes?.[0];

if(!route){

    throw new Error("OSRM route missing");

}

return {
    routeDistanceKm: roundDistance(route.distance / 1000),
    routeDurationMin: Math.round(route.duration / 60)
};

}

function getHaversineDistanceKm(lat1,lng1,lat2,lng2){

const earthRadiusKm =
    6371;

const dLat =
    toRadians(lat2 - lat1);

const dLng =
    toRadians(lng2 - lng1);

const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
    Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

return earthRadiusKm * 2 * Math.atan2(
    Math.sqrt(a),
    Math.sqrt(1 - a)
);

}

function toRadians(value){

return value * Math.PI / 180;

}

function roundDistance(value){

return Math.round(value * 100) / 100;

}

function getCustomerSafeOrder(order){

return {
    orderNumber: order.orderNumber,
    status: order.status,
    statusText: getThaiStatusText(order.status),
    total: order.total,
    itemsText: order.itemsText,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
};

}

function getThaiStatusText(status){

return {
    pending_payment: "รอร้านเช็กยอดชำระ",
    paid: "จ่ายแล้ว / ร้านกำลังทำออเดอร์",
    amount_issue: "ยอดชำระไม่ตรง",
    done: "เสร็จแล้ว รับสินค้าได้",
    cancelled: "ออเดอร์ถูกยกเลิก"
}[status] || status;

}

function getOnlineOrderStatuses(){

return [
    "pending_payment",
    "paid",
    "amount_issue",
    "done",
    "cancelled"
].map((status)=>({
    value: status,
    label: getThaiStatusText(status)
}));

}

function getOrdersDir(){

return path.join(__dirname,"generated","orders");

}

function getOnlineOrders(){

const ordersDir =
    getOrdersDir();

if(!fs.existsSync(ordersDir)){

    return [];

}

return fs.readdirSync(ordersDir)
    .filter((file)=>{
        return /^WEB-\d{6}-\d{4}-\d{3}\.json$/.test(file);
    })
    .map((file)=>{
        try{

            const order =
                JSON.parse(
                    fs.readFileSync(
                        path.join(ordersDir,file),
                        "utf8"
                    )
                );

            return {
                ...order,
                statusText: getThaiStatusText(order.status)
            };

        }catch(error){

            console.error("ORDER READ FAILED",file,error.message);
            return null;

        }
    })
    .filter(Boolean)
    .sort((a,b)=>{
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

}

function updateOnlineOrderStatus(orderNumber,status){

if(!getOnlineOrderStatuses().some((item)=>item.value === status)){

    throw new Error("Invalid status");

}

const safeOrderNumber =
    String(orderNumber || "").replace(/[^a-zA-Z0-9-]/g,"");

if(!/^WEB-\d{6}-\d{4}-\d{3}$/.test(safeOrderNumber)){

    throw new Error("Invalid order number");

}

const orderPath =
    path.join(getOrdersDir(),`${safeOrderNumber}.json`);

if(!fs.existsSync(orderPath)){

    throw new Error("Order not found");

}

const order =
    JSON.parse(fs.readFileSync(orderPath,"utf8"));

order.status = status;
order.updatedAt = new Date().toISOString();

fs.writeFileSync(
    orderPath,
    JSON.stringify(order,null,2)
);

return order;

}

function requireAdmin(req,res,next){

if(req.session.adminAuthed){

    return next();

}

res.redirect(
    "/admin/login"
);

}

async function renderQuickSaleWithMessage(res,error,success){

const sales =
    await getTodayQuickSales();

res.render(
    "admin-quick-sale",
    {
        sales,
        summary: summarizeQuickSales(sales),
        error,
        success
    }
);

}

function createQuickSaleOrderNumber(){

const now =
    new Date();

const datePart =
    [
        String(now.getFullYear()).slice(-2),
        String(now.getMonth() + 1).padStart(2,"0"),
        String(now.getDate()).padStart(2,"0")
    ].join("");

const timePart =
    [
        String(now.getHours()).padStart(2,"0"),
        String(now.getMinutes()).padStart(2,"0")
    ].join("");

const randomPart =
    Math.floor(100 + Math.random() * 900);

return `QS-${datePart}-${timePart}-${randomPart}`;

}

async function appendQuickSale({ amount, paymentMethod }){

const now =
    new Date().toISOString();

const sale = {
    createdAt: now,
    orderNumber: createQuickSaleOrderNumber(),
    channel: "quick_sale",
    total: amount,
    paymentMethod,
    status: "paid",
    itemsText: "Quick sale",
    updatedAt: now
};

await sendQuickSaleDiscordNotification(
    sale,
    "created"
);

quickSales.push(sale);

return sale;

}

async function getTodayQuickSales(){

const todayKey =
    getLocalDateKey(new Date());

return quickSales
    .filter((sale)=>{
        return (
            sale.channel === "quick_sale" &&
            getLocalDateKey(new Date(sale.createdAt)) === todayKey
        );
    })
    .sort((a,b)=>{
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

}

async function cancelQuickSale(orderNumber){

if(!orderNumber){

    throw new Error("Missing orderNumber");

}

const sale =
    quickSales.find((entry)=>{
        return entry.orderNumber === orderNumber;
    });

if(!sale){

    throw new Error("Order not found");

}

const updatedSale = {
    ...sale,
    status: "cancelled",
    updatedAt: new Date().toISOString()
};

await sendQuickSaleDiscordNotification(
    updatedSale,
    "cancelled"
);

sale.status = updatedSale.status;
sale.updatedAt = updatedSale.updatedAt;

return sale;

}

async function sendQuickSaleDiscordNotification(sale,action){

if(!process.env.DISCORD_WEBHOOK_URL){

    throw new Error("Missing DISCORD_WEBHOOK_URL");

}

const isCancelled =
    action === "cancelled";

const response =
    await fetch(
        process.env.DISCORD_WEBHOOK_URL,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: "Quick Sale",
                content: [
                    isCancelled ? "Quick sale cancelled" : "Quick sale paid",
                    `Order: ${sale.orderNumber}`,
                    `Total: THB ${sale.total}`,
                    `Payment: ${sale.paymentMethod.toUpperCase()}`
                ].join("\n"),
                embeds: [
                    {
                        title: isCancelled ?
                            `Cancelled ${sale.orderNumber}` :
                            `Paid ${sale.orderNumber}`,
                        color: isCancelled ? 11739920 : 14790035,
                        fields: [
                            {
                                name: "Total",
                                value: `THB ${sale.total}`,
                                inline: true
                            },
                            {
                                name: "Payment",
                                value: sale.paymentMethod.toUpperCase(),
                                inline: true
                            },
                            {
                                name: "Status",
                                value: sale.status,
                                inline: true
                            }
                        ],
                        timestamp: sale.updatedAt || sale.createdAt
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

function summarizeQuickSales(sales){

return sales.reduce((summary,sale)=>{

    if(sale.status === "cancelled"){

        summary.cancelledTotal += sale.total;
        summary.cancelledCount += 1;
        return summary;

    }

    summary.totalSales += sale.total;
    summary.orderCount += 1;

    if(sale.paymentMethod === "cash"){

        summary.cashTotal += sale.total;

    }else{

        summary.qrTotal += sale.total;

    }

    return summary;

},emptyQuickSaleSummary());

}

function emptyQuickSaleSummary(){

return {
    totalSales: 0,
    qrTotal: 0,
    cashTotal: 0,
    orderCount: 0,
    cancelledTotal: 0,
    cancelledCount: 0
};

}

function getLocalDateKey(date){

return new Intl.DateTimeFormat(
    "en-CA",
    {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }
).format(date);

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
