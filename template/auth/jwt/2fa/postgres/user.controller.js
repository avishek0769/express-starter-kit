import prisma from "../utils/prismaClient.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import redis from "../utils/redis.js";
import { Resend } from "resend";
import crypto from "crypto";
import bcrypt from "bcrypt";

const resend = new Resend(process.env.RESEND_API_KEY);

const AccessOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 1000,
};

const RefreshOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
};

const hashPassword = async (password) => {
    return await bcrypt.hash(password, 10);
};

const isPasswordCorrect = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

const generateAccessToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            username: user.username,
            fullname: user.fullname,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
        },
    );
};

const generateRefreshToken = (userId) => {
    return jwt.sign(
        {
            id: userId,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
        },
    );
};

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new ApiError(404, "User not found");

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user.id);

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(
            500,
            "Something went wrong while generating Access & Refresh tokens",
        );
    }
};

const sendVerificationCode = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = email?.toLowerCase();

    if (!normalizedEmail) {
        throw new ApiError(400, "Email is required");
    }

    const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
    });

    if (!existingUser) {
        await prisma.user.create({
            data: {
                email: normalizedEmail,
            },
        });
    } else if (existingUser.isVerified) {
        throw new ApiError(401, "User with this email already exists");
    }

    const code = crypto.randomInt(10000, 99999);
    await redis.set(normalizedEmail, code, "EX", 3 * 60);

    await resend.emails.send({
        from: "SpotMe <onboarding@avishekadhikary.tech>",
        to: normalizedEmail,
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
    const normalizedEmail = email?.toLowerCase();

    const storedCode = await redis.get(normalizedEmail);

    if (Number(code) !== Number(storedCode)) {
        throw new ApiError(400, "Invalid verification code");
    }

    const user = await prisma.user.update({
        where: { email: normalizedEmail },
        data: { isVerified: true },
        select: {
            id: true,
            fullname: true,
            username: true,
            email: true,
            isVerified: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    await redis.del(normalizedEmail);

    res.status(200).json(
        new ApiResponse(200, user, "Email verified successfully !!"),
    );
});

const userRegister = asyncHandler(async (req, res) => {
    const { fullname, username, email, password } = req.body;
    const normalizedEmail = email?.toLowerCase();
    const normalizedUsername = username?.toLowerCase();

    if (
        [fullname, normalizedUsername, normalizedEmail, password].some(
            (field) => !field || field.trim() === "",
        )
    ) {
        throw new ApiError(400, "All fields are required");
    }

    const existingUsernameUser = await prisma.user.findFirst({
        where: {
            username: normalizedUsername,
            email: { not: normalizedEmail },
        },
    });

    if (existingUsernameUser) {
        throw new ApiError(409, "User with this username already exists");
    }

    const verifiedUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
    });

    if (!verifiedUser || !verifiedUser.isVerified) {
        throw new ApiError(400, "Email not verified");
    }

    if (verifiedUser.password) {
        throw new ApiError(409, "User with this email already exists");
    }

    const hashedPassword = await hashPassword(password);

    const createdUser = await prisma.user.update({
        where: { email: normalizedEmail },
        data: {
            fullname,
            username: normalizedUsername,
            password: hashedPassword,
        },
    });

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
        createdUser.id,
    );

    const registeredUser = await prisma.user.update({
        where: { id: createdUser.id },
        data: { refreshToken },
        select: {
            id: true,
            fullname: true,
            username: true,
            email: true,
            isVerified: true,
            createdAt: true,
            updatedAt: true,
        },
    });

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

    const user = await prisma.user.findFirst({
        where: {
            isVerified: true,
            OR: [
                { username: username?.toLowerCase() },
                { email: email?.toLowerCase() },
            ],
        },
    });

    if (!user) {
        throw new ApiError(404, "Username or email does not exist");
    }

    if (!password) throw new ApiError(400, "Password is required");
    if (!user.password) throw new ApiError(400, "User registration incomplete");

    const isPasswordValid = await isPasswordCorrect(password, user.password);
    if (!isPasswordValid) throw new ApiError(401, "Password is incorrect !");

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
        user.id,
    );

    const loggedInUser = await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
        select: {
            id: true,
            fullname: true,
            username: true,
            email: true,
            isVerified: true,
        },
    });

    res.status(200)
        .cookie("accessToken", accessToken, AccessOptions)
        .cookie("refreshToken", refreshToken, RefreshOptions)
        .json(
            new ApiResponse(
                200,
                loggedInUser,
                "User Logged in successfully !!",
            ),
        );
});

const userLogOut = asyncHandler(async (req, res) => {
    await prisma.user.update({
        where: { id: req.user.id },
        data: { refreshToken: null },
    });

    res.status(200)
        .clearCookie("accessToken", AccessOptions)
        .clearCookie("refreshToken", RefreshOptions)
        .json(new ApiResponse(200, {}, "User Logged out Successfully"));
});

const refreshAuthTokens = asyncHandler(async (req, res) => {
    const incomingToken =
        req.cookies?.refreshToken ||
        req.header("Authorization")?.replace("Bearer ", "");

    if (!incomingToken) throw new ApiError(401, "No Refresh Token found");

    try {
        const decodedToken = jwt.verify(
            incomingToken,
            process.env.REFRESH_TOKEN_SECRET,
        );

        const user = await prisma.user.findUnique({
            where: { id: decodedToken.id },
        });

        if (!user) throw new ApiError(401, "Unauthorised access");

        if (user.refreshToken !== incomingToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }

        const { accessToken, refreshToken } =
            await generateAccessAndRefreshTokens(user.id);

        const safeUser = await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken },
            select: {
                id: true,
                fullname: true,
                username: true,
                email: true,
                isVerified: true,
            },
        });

        res.status(200)
            .cookie("accessToken", accessToken, AccessOptions)
            .cookie("refreshToken", refreshToken, RefreshOptions)
            .json(
                new ApiResponse(
                    200,
                    safeUser,
                    "Access Token refreshed !",
                ),
            );
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
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
    const normalizedEmail = email?.toLowerCase();

    const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
    });

    if (!user) {
        throw new ApiError(404, "User with this email does not exist");
    }

    const code = crypto.randomInt(10000, 99999);
    await redis.set(normalizedEmail, code, "EX", 3 * 60);

    await resend.emails.send({
        from: "SpotMe <onboarding@avishekadhikary.tech>",
        to: normalizedEmail,
        subject: "SpotMe - Password Reset Code",
        html: `<p>Your password reset code is: <strong>${code}</strong></p>`,
    });

    res.status(200).json(
        new ApiResponse(200, { emailSent: true }, "Reset code sent successfully !!"),
    );
});

const resetPassword = asyncHandler(async (req, res) => {
    const { email, code, password } = req.body;
    const normalizedEmail = email?.toLowerCase();

    const storedCode = await redis.get(normalizedEmail);
    if (Number(code) !== Number(storedCode)) {
        throw new ApiError(400, "Invalid verification code");
    }

    const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
    });

    if (!user) {
        throw new ApiError(404, "User with this email does not exist");
    }

    const hashedPassword = await hashPassword(password);

    await prisma.user.update({
        where: { email: normalizedEmail },
        data: { password: hashedPassword },
    });

    await redis.del(normalizedEmail);

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
