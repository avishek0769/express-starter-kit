import Redis from "ioredis";

const valkey = new Redis();

valkey.on("connect", () => {
    console.log("Valkey connected");
});

valkey.on("error", (err) => {
    console.error("Valkey error:", err);
});

export default valkey;
