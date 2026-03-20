import { z } from "zod";

const registerUserSchema = z.object({
    fullname: z.string().min(3, "Name must be at least 3 chars"),
    username: z.string().min(3, "Username must be at least 3 chars"),
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Password must be at least 6 chars"),
});

const loginUserSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 chars").optional(),
    email: z.string().email("Invalid email").optional(),
    password: z.string().min(6, "Password must be at least 6 chars"),
});

export { registerUserSchema, loginUserSchema };
