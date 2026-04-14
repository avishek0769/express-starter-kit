import User from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import redis from "../utils/redis.js";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

const AccessOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 1000, // 1 hour
};

const RefreshOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(
            500,
            "Some thing went wrong while generating Access & Refresh tokens",
        );
    }
};

const sendVerificationCode = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
        await User.create({ email });
    } else if (user.isVerified) {
        throw new ApiError(401, "User with this email already exists");
    }

    const code = crypto.randomInt(10000, 99999); // Sync code
    await redis.set(email, code, "EX", 3 * 60);

    await resend.emails.send({
        from: "SpotMe <onboarding@avishekadhikary.tech>",
        to: email,
        subject: "SpotMe - Email Verification Code",
        html: `<p>Your verification code is: <strong>${code}</strong></p>`,
    });

    res.status(200).json(
        new ApiResponse(
            200,
            { emailSent: true },
            "Verification code sent to email successfully !!",
        ),
    );
});

const verifyEmail = asyncHandler(async (req, res) => {
    const { email, code } = req.body;
    const storedCode = await redis.get(email);

    if (Number(code) != storedCode) {
        throw new ApiError(400, "Invalid verification code");
    }

    const user = await User.findOneAndUpdate(
        { email },
        { isVerified: true },
        { returnDocument: "after" },
    );

    await redis.del(email);

    res.status(200).json(
        new ApiResponse(
            200,
            { ...user._doc },
            "Email verified successfully !!",
        ),
    );
});

const userRegister = asyncHandler(async (req, res) => {
    const { fullname, username, email, password } = req.body;

    if (
        [fullname, username, email, password].some(
            (field) => field?.trim() === "",
        )
    ) {
        throw new ApiError(400, "All fields are required");
    }

    let createdUser = await User.findOne({ email, isVerified: true });
    if (!createdUser)
        throw new ApiError(500, "Something went wrong while registering");

    createdUser.fullname = fullname;
    createdUser.username = username;
    createdUser.password = password;
    await createdUser.save();

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
        createdUser._id,
    );
    createdUser.refreshToken = refreshToken;
    await createdUser.save({ validateBeforeSave: false });

    const registeredUser = await User.findById(createdUser._id).select(
        "-password -refreshToken",
    );

    return res
        .status(201)
        .cookie("accessToken", accessToken, AccessOptions)
        .cookie("refreshToken", refreshToken, RefreshOptions)
        .json(
            new ApiResponse(
                201,
                registeredUser,
                "User Registered Successfully !!",
            ),
        );
});

const userLogIn = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;
    if (!(username || email)) {
        throw new ApiError(404, "Username or email is required");
    }

    const user = await User.findOne({
        $or: [{ username }, { email }],
    });
    if (!user) {
        throw new ApiError(404, "Username or email does not exist");
    }

    if (!password) throw new ApiError(404, "Password is required");

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) throw new ApiError(401, "Password is incorrect !");

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
        user._id,
    );
    const loggedInUser = await User.findByIdAndUpdate(
        user._id,
        { refreshToken },
        { returnDocument: "after" },
    ).select("-password -refreshToken");

    res.status(201)
        .cookie("accessToken", accessToken, AccessOptions)
        .cookie("refreshToken", refreshToken, RefreshOptions)
        .json(
            new ApiResponse(
                201,
                loggedInUser,
                "User Logged in successfully !!",
            ),
        );
});

const userLogOut = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        { $set: { refreshToken: "" } },
        { returnDocument: "after" },
    );
    res.status(200)
        .clearCookie("accessToken", AccessOptions)
        .clearCookie("refreshToken", RefreshOptions)
        .json(new ApiResponse(200, {}, "User Loogged out Successfully"));
});

const refreshAuthTokens = asyncHandler(async (req, res) => {
    const incomingToken =
        req.cookies?.refreshToken ||
        req.header("Authorization")?.replace("Bearer ", "");
    if (!incomingToken) throw new ApiError(401, "No Refresh Token found");

    const decodedToken = jwt.verify(
        incomingToken,
        process.env.REFRESH_TOKEN_SECRET,
    );

    const user = await User.findById(decodedToken._id).select("-password ");
    if (!user) throw new ApiError(401, "Unauthorised access");

    if (user.refreshToken != incomingToken)
        throw new ApiError(
            401,
            "Unauthorised access -> Refresh token did not match",
        );

    const { accessToken, refreshToken } =
        await generateAccessAndRefreshTokens(user._id);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    res.status(200)
        .cookie("accessToken", accessToken, AccessOptions)
        .cookie("refreshToken", refreshToken, RefreshOptions)
        .json(
            new ApiResponse(
                200,
                { ...user._doc },
                "Access Token refreshed !",
            ),
        );
});

const currentUserProfile = asyncHandler(async (req, res) => {
    const user = req.user;
    res.status(200).json(
        new ApiResponse(
            200,
            user,
            "Current user profile fetched successfully !",
        ),
    );
});

const sendResetCode = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(404, "User with this email does not exist");
    }

    const code = crypto.randomInt(10000, 99999);
    await redis.set(email, code, "EX", 3 * 60);

    await resend.emails.send({
        from: "SpotMe <onboarding@avishekadhikary.tech>",
        to: email,
        subject: "SpotMe - Password Reset Code",
        html: `<p>Your password reset code is: <strong>${code}</strong></p>`,
    });

    res.status(200).json(
        new ApiResponse(
            200,
            { emailSent: true },
            "Reset code sent successfully !!",
        ),
    );
});

const resetPassword = asyncHandler(async (req, res) => {
    const { email, code, password } = req.body;

    const storedCode = await redis.get(email);
    if (Number(code) !== Number(storedCode)) {
        throw new ApiError(400, "Invalid verification code");
    }

    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(404, "User with this email does not exist");
    }

    user.password = password;
    await user.save();

    await redis.del(email);

    res.status(200).json(
        new ApiResponse(200, { reset: true }, "Password reset successfully !!"),
    );
});

export {
    sendVerificationCode,
    verifyEmail,
    userRegister,
    userLogIn,
    userLogOut,
    refreshAuthTokens,
    resetPassword,
    sendResetCode,
    currentUserProfile,
};