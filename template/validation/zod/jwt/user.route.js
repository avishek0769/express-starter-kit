import { Router } from "express";
import { verifyStrictJWT } from "../middlewares/auth.middleware.js";
import {
    userLogIn,
    userLogOut,
    userRegister,
    refreshAccessToken,
} from "../controllers/user.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { registerUserSchema, loginUserSchema } from "../schemas/user.schema.js";

const userRouter = Router();

userRouter.route("/register").post(validate(registerUserSchema), userRegister);
userRouter.route("/login").post(validate(loginUserSchema), userLogIn);
userRouter.route("/logout").get(verifyStrictJWT, userLogOut);
userRouter.route("/refresh-accessToken").patch(refreshAccessToken);

export default userRouter;
