const path = require("path");

function getConfig(req){
    return {
        adminPassword: process.env.ADMIN_PASSWORD || "",
        appBaseUrl: getAppBaseUrl(req),
        dataDir: getDataDir(),
        discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
        isProduction: process.env.NODE_ENV === "production",
        osrmBaseUrl: process.env.OSRM_BASE_URL || "https://router.project-osrm.org",
        port: process.env.PORT || 3000,
        sessionSecret: process.env.SESSION_SECRET || "dev-session-secret",
        shopLat: Number(process.env.SHOP_LAT || 13.7426371),
        shopLng: Number(process.env.SHOP_LNG || 100.3520867)
    };
}

function getDataDir(){
    return process.env.DATA_DIR ?
        path.resolve(process.env.DATA_DIR) :
        path.join(__dirname,"..","generated");
}

function getAppBaseUrl(req){
    const baseUrl =
        process.env.APP_BASE_URL ||
        (req ? `${req.protocol}://${req.get("host")}` : "");

    return baseUrl.replace(/\/$/,"");
}

module.exports = {
    getAppBaseUrl,
    getConfig,
    getDataDir
};
