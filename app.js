const express = require("express");
const session = require("express-session");
const QRCode = require("qrcode");

const app = express();
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const quickSales = [];

loadEnvFile();

app.set("trust proxy", true);

app.set("view engine", "ejs");

app.locals.formatBangkokDateTime = formatBangkokDateTime;

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

app.get("/admin/order-links",requireAdmin,(req,res)=>{


renderOrderLinks(
    req,
    res,
    "",
    ""
);


});

app.post("/admin/order-links/rotate",requireAdmin,(req,res)=>{


const type =
    req.body.type || "";

try{

    rotateOrderLink(type);

    renderOrderLinks(
        req,
        res,
        "",
        `Rotated ${type} link.`
    );

}catch(error){

    console.error(error);

    renderOrderLinks(
        req,
        res,
        "Cannot rotate link.",
        ""
    );

}


});

app.post("/admin/order-links/online-toggle",requireAdmin,(req,res)=>{


const enabled =
    req.body.enabled === "true";

try{

    setOnlineOrderLinkEnabled(enabled);

    renderOrderLinks(
        req,
        res,
        "",
        enabled ? "Online orders enabled." : "Online orders disabled."
    );

}catch(error){

    console.error(error);

    renderOrderLinks(
        req,
        res,
        "Cannot update online ordering.",
        ""
    );

}


});

app.post("/admin/order-links/notify",requireAdmin,async (req,res)=>{


try{

    await sendOrderLinksDiscordNotification(
        buildOrderLinkViewModel(req)
    );

    renderOrderLinks(
        req,
        res,
        "",
        "Sent links to Discord."
    );

}catch(error){

    console.error(error);

    renderOrderLinks(
        req,
        res,
        "Cannot send links to Discord.",
        ""
    );

}


});

app.get("/admin/order-links/:type/qr.png",requireAdmin,async (req,res)=>{


try{

    const links =
        buildOrderLinkViewModel(req);

    const link =
        links[req.params.type]?.url;

    if(!link){

        return res.status(404).send("Link not found");

    }

    const png =
        await QRCode.toBuffer(
            link,
            {
                type: "png",
                width: 720,
                margin: 2,
                errorCorrectionLevel: "M"
            }
        );

    res.setHeader("Content-Type","image/png");
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="${req.params.type}-order-link.png"`
    );
    res.send(png);

}catch(error){

    console.error(error);
    res.status(500).send("Cannot generate QR");

}


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
    customerLocation,
    customerMapLink,
    foodNote,
    riderNote,
    orderGate
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

const gate =
    validateOrderGate(orderGate);

if(!gate.ok){

    return res.status(403).json({
        error: gate.message,
        code: gate.code
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
    await buildCustomerLocationData(
        customerLocation,
        customerMapLink
    );

const noteData = {
    foodNote: cleanOrderNote(foodNote),
    riderNote: cleanOrderNote(riderNote)
};

const savedOrderText =
    appendOrderLinks(
        appendServerNoteLines(
            orderText || "",
            noteData
        ),
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
            channel: gate.source === "booth" ? "booth" : "online",
            source: gate.source,
            status,
            items,
            itemsText: buildItemsText(items),
            ...noteData,
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
            source: gate.source,
            items,
            total,
            orderText: savedOrderText,
            imageUrl: publicImageUrl,
            trackingUrl,
            ...noteData,
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
        name: "Food note",
        value: order.foodNote || "-",
        inline: false
    },
    {
        name: "Rider note",
        value: order.riderNote || "-",
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

const parts =
    getBangkokDateParts(new Date());

const datePart =
    [
        parts.year.slice(-2),
        parts.month,
        parts.day
    ].join("");

const timePart =
    [
        parts.hour,
        parts.minute
    ].join("");

const randomPart =
    Math.floor(100 + Math.random() * 900);

return `WEB-${datePart}-${timePart}-${randomPart}`;

}

function getBangkokDateParts(date){

const parts =
    new Intl.DateTimeFormat(
        "en-GB",
        {
            timeZone: "Asia/Bangkok",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }
    ).formatToParts(date);

return Object.fromEntries(
    parts
        .filter((part)=>part.type !== "literal")
        .map((part)=>[part.type,part.value])
);

}

function formatBangkokDateTime(value){

if(!value){

    return "";

}

return new Intl.DateTimeFormat(
    "th-TH",
    {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    }
).format(new Date(value));

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

function cleanOrderNote(value){

return String(value || "")
    .replace(/\r\n/g,"\n")
    .replace(/\r/g,"\n")
    .trim()
    .slice(0,500);

}

function appendServerNoteLines(orderText,noteData){

const lines = [
    orderText
];

if(
    noteData.foodNote &&
    !orderText.includes(noteData.foodNote)
){

    lines.push(`Food note: ${noteData.foodNote}`);

}

if(
    noteData.riderNote &&
    !orderText.includes(noteData.riderNote)
){

    lines.push(`Rider note: ${noteData.riderNote}`);

}

return lines.filter(Boolean).join("\n");

}

async function buildCustomerLocationData(customerLocation,customerMapLink){

const baseData = {
    customerLat: "",
    customerLng: "",
    customerMapUrl: "",
    straightDistanceKm: "",
    routeDistanceKm: "",
    routeDurationMin: ""
};

const parsedMapLocation =
    customerLocation ||
    await resolveGoogleMapsLocation(customerMapLink);

if(!parsedMapLocation){

    return baseData;

}

const customerLat =
    Number(parsedMapLocation.lat);

const customerLng =
    Number(parsedMapLocation.lng);

if(
    !isValidLatLng(customerLat,customerLng)
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

async function resolveGoogleMapsLocation(value){

const input =
    String(value || "").trim();

if(!input){

    return null;

}

const directLocation =
    parseGoogleMapsLatLng(input);

if(directLocation){

    return directLocation;

}

let parsedUrl;

try{

    parsedUrl = new URL(input);

}catch(error){

    return null;

}

if(!isAllowedGoogleMapsHost(parsedUrl.hostname)){

    return null;

}

try{

    const controller =
        new AbortController();

    const timeout =
        setTimeout(()=>{
            controller.abort();
        },3000);

    try{

        const response =
            await fetch(
                parsedUrl.toString(),
                {
                    method: "GET",
                    redirect: "follow",
                    signal: controller.signal
                }
            );

        return parseGoogleMapsLatLng(response.url);

    }finally{

        clearTimeout(timeout);

    }

}catch(error){

    console.error("GOOGLE MAPS LOCATION PARSE FAILED",error.message);
    return null;

}

}

function isAllowedGoogleMapsHost(hostname){

const host =
    String(hostname || "").toLowerCase();

return (
    host === "maps.app.goo.gl" ||
    host === "goo.gl" ||
    host === "maps.google.com" ||
    host === "www.google.com" ||
    host.endsWith(".google.com")
);

}

function parseGoogleMapsLatLng(value){

const text =
    String(value || "");

let decodedText =
    text;

try{

    decodedText =
        decodeURIComponent(text);

}catch(error){

    decodedText =
        text;

}

const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]query=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/
];

for(const pattern of patterns){

    const match =
        decodedText.match(pattern);

    if(match){

        const location = {
            lat: Number(match[1]),
            lng: Number(match[2])
        };

        if(isValidLatLng(location.lat,location.lng)){

            return location;

        }

    }

}

return null;

}

function isValidLatLng(lat,lng){

return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
);

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

function renderOrderLinks(req,res,error,success){

res.render(
    "admin-order-links",
    {
        links: buildOrderLinkViewModel(req),
        error,
        success
    }
);

}

function buildOrderLinkViewModel(req){

const data =
    ensureOrderLinks();

const baseUrl =
    getAppBaseUrl(req);

return {
    booth: {
        ...data.booth,
        url: `${baseUrl}/dashboard?source=booth&t=${data.booth.token}`,
        qrUrl: "/admin/order-links/booth/qr.png"
    },
    online: {
        ...data.online,
        url: `${baseUrl}/dashboard?source=online&t=${data.online.token}`,
        qrUrl: "/admin/order-links/online/qr.png"
    }
};

}

function ensureOrderLinks(){

const todayKey =
    getBangkokDateKey(new Date());

let data =
    readOrderLinksFile();

if(!data){

    data = {
        booth: createOrderLinkEntry(todayKey),
        online: {
            ...createOrderLinkEntry(todayKey),
            enabled: true
        }
    };

    writeOrderLinksFile(data);
    return data;

}

let changed =
    false;

if(!data.booth?.token){

    data.booth = createOrderLinkEntry(todayKey);
    changed = true;

}

if(data.booth.autoDate !== todayKey){

    data.booth = createOrderLinkEntry(todayKey);
    changed = true;

}

if(!data.online?.token){

    data.online = {
        ...createOrderLinkEntry(todayKey),
        enabled: true
    };
    changed = true;

}

if(typeof data.online.enabled !== "boolean"){

    data.online.enabled = true;
    changed = true;

}

if(changed){

    writeOrderLinksFile(data);

}

return data;

}

function createOrderLinkEntry(autoDate){

const now =
    new Date().toISOString();

return {
    token: createOrderGateToken(),
    autoDate,
    rotatedAt: now
};

}

function rotateOrderLink(type){

if(!["booth","online"].includes(type)){

    throw new Error("Invalid link type");

}

const data =
    ensureOrderLinks();

const entry =
    createOrderLinkEntry(getBangkokDateKey(new Date()));

if(type === "online"){

    entry.enabled = data.online.enabled !== false;

}

data[type] = entry;

writeOrderLinksFile(data);

return data;

}

function setOnlineOrderLinkEnabled(enabled){

const data =
    ensureOrderLinks();

data.online.enabled = enabled;

writeOrderLinksFile(data);

return data;

}

function validateOrderGate(orderGate){

const source =
    String(orderGate?.source || "").trim();

const token =
    String(orderGate?.token || "").trim();

if(!source || !token){

    return {
        ok: false,
        code: "missing_order_link",
        message: "Please open the order link from the shop again."
    };

}

const data =
    ensureOrderLinks();

if(source === "booth"){

    return {
        ok: token === data.booth.token,
        source,
        code: token === data.booth.token ? "" : "invalid_order_link",
        message: "Please scan the shop QR code again."
    };

}

if(source === "online"){

    if(data.online.enabled === false){

        return {
            ok: false,
            source,
            code: "online_orders_disabled",
            message: "Online ordering is closed right now."
        };

    }

    return {
        ok: token === data.online.token,
        source,
        code: token === data.online.token ? "" : "invalid_order_link",
        message: "Please open the order link from the shop again."
    };

}

return {
    ok: false,
    code: "invalid_order_source",
    message: "Please open the order link from the shop again."
};

}

function getOrderLinksPath(){

return path.join(__dirname,"generated","order-links.json");

}

function readOrderLinksFile(){

const filePath =
    getOrderLinksPath();

if(!fs.existsSync(filePath)){

    return null;

}

try{

    return JSON.parse(fs.readFileSync(filePath,"utf8"));

}catch(error){

    console.error("ORDER LINKS READ FAILED",error.message);
    return null;

}

}

function writeOrderLinksFile(data){

const filePath =
    getOrderLinksPath();

fs.mkdirSync(
    path.dirname(filePath),
    {
        recursive: true
    }
);

fs.writeFileSync(
    filePath,
    JSON.stringify(data,null,2)
);

}

function createOrderGateToken(){

return crypto.randomBytes(12).toString("hex");

}

function getBangkokDateKey(date){

const parts =
    getBangkokDateParts(date);

return `${parts.year}-${parts.month}-${parts.day}`;

}

async function sendOrderLinksDiscordNotification(links){

if(!process.env.DISCORD_WEBHOOK_URL){

    throw new Error("Missing DISCORD_WEBHOOK_URL");

}

const response =
    await fetch(
        process.env.DISCORD_WEBHOOK_URL,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: "Order Links",
                content: [
                    "**Order links**",
                    `Booth QR: ${links.booth.url}`,
                    `Online: ${links.online.enabled ? links.online.url : "disabled"}`
                ].join("\n"),
                embeds: [
                    {
                        title: "Current Order Links",
                        color: 14790035,
                        fields: [
                            {
                                name: "Booth QR",
                                value: links.booth.url,
                                inline: false
                            },
                            {
                                name: "Online",
                                value: links.online.enabled ?
                                    links.online.url :
                                    "Disabled",
                                inline: false
                            }
                        ],
                        timestamp: new Date().toISOString()
                    }
                ]
            })
        }
    );

if(!response.ok){

    throw new Error(`Discord responded ${response.status}`);

}

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
