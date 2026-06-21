const fs = require("fs");
const path = require("path");

function createOrderStorage({ dataDir, getStatusText }){
    const ordersDir =
        path.join(dataDir,"orders");

    function ensure(){
        fs.mkdirSync(
            ordersDir,
            {
                recursive: true
            }
        );
    }

    function getOrderPath(orderNumber){
        return path.join(
            ordersDir,
            `${sanitizeOrderNumber(orderNumber)}.json`
        );
    }

    return {
        ensure,

        getOrdersDir(){
            return ordersDir;
        },

        exists(orderNumber){
            return fs.existsSync(getOrderPath(orderNumber));
        },

        read(orderNumber){
            return JSON.parse(
                fs.readFileSync(
                    getOrderPath(orderNumber),
                    "utf8"
                )
            );
        },

        write(orderNumber,order){
            ensure();

            fs.writeFileSync(
                getOrderPath(orderNumber),
                JSON.stringify(order,null,2)
            );
        },

        writeImage(fileName,buffer){
            ensure();

            fs.writeFileSync(
                path.join(ordersDir,fileName),
                buffer
            );
        },

        listOnlineOrders(){
            ensure();

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
                            statusText: getStatusText(order.status)
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
    };
}

function sanitizeOrderNumber(orderNumber){
    return String(orderNumber || "").replace(/[^a-zA-Z0-9-]/g,"");
}

module.exports = {
    createOrderStorage,
    sanitizeOrderNumber
};
