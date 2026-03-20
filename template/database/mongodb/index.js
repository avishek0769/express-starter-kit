import "dotenv/config";
import { app } from "./app.js";
import connectDB from "./utils/connectDB.js";

connectDB().then(() => {
    app.on("error", (error) => {
        console.log("Server issue: ", error);
    });

    app.listen(process.env.PORT, () => {
        console.log("Server running at: ", process.env.PORT);
    });
});
