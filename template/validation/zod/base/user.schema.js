import { z } from "zod";

const userSchema = z.object({
    fullname: z.string().min(3, "Name must be at least 3 chars"),
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Password must be at least 6 chars"),
});

const moreSchema = z.object({});

export { userSchema, moreSchema };
