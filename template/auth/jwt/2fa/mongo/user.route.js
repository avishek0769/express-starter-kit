import { Router } from "express";
import { verifyStrictJWT } from "../middlewares/auth.middleware.js";
import {
    userLogIn,
    userLogOut,
    userRegister,
    refreshAuthTokens,
    sendVerificationCode,
    verifyEmail,
    currentUserProfile,
    sendResetCode,
    resetPassword,
} from "../controllers/user.controller.js";

const userRouter = Router();

userRouter.route("/send-verification-code").post(sendVerificationCode);
userRouter.route("/verify-email").post(verifyEmail);
userRouter.route("/register").post(userRegister);
userRouter.route("/login").post(userLogIn);
userRouter.route("/logout").get(verifyStrictJWT, userLogOut);
userRouter.route("/refresh-auth-tokens").patch(refreshAuthTokens);
userRouter.route("/current").get(verifyStrictJWT, currentUserProfile);
userRouter.route("/send-reset-code").post(sendResetCode);
userRouter.route("/reset-password").patch(resetPassword);

export default userRouter;