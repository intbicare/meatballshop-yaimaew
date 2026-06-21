const fs = require("fs");
const path = require("path");

function createOrderLinkStorage({ dataDir }){
    const filePath =
        path.join(dataDir,"order-links.json");

    return {
        read(){
            if(!fs.existsSync(filePath)){
                return null;
            }

            try{
                return JSON.parse(fs.readFileSync(filePath,"utf8"));
            }catch(error){
                console.error("ORDER LINKS READ FAILED",error.message);
                return null;
            }
        },

        write(data){
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
    };
}

module.exports = {
    createOrderLinkStorage
};
