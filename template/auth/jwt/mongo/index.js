import "dotenv/config";
import connectDB from "./utils/connectDB.js"
import { app } from "./app.js"

connectDB()
.then(()=>{
    app.on("error", (error)=>{
        console.log("Server issue: ", error);
    })

    app.listen(process.env.PORT, ()=>{
        console.log("Server running at: ", process.env.PORT);
    })
})
.catch((error)=>{
    console.log("DATABASE connection Failed: ", error);
})