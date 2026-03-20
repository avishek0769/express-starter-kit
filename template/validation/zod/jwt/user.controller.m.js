import User from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";

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

const userRegister = asyncHandler(async (req, res) => {
    const { fullname, username, email, password } = req.body;

    const user = await User.create({
        fullname: fullname,
        username: username.toLowerCase(),
        password,
        email,
    });

    let createdUser = await User.findById(user._id).select(
        "-password -refreshToken",
    );
    if (!createdUser)
        throw new ApiError(500, "Something went wrong while registering");

    return res
        .status(200)
        .json(
            new ApiResponse(
                201,
                createdUser,
                "User Registered Successfully !!",
            ),
        );
});

const userLogIn = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;

    const user = await User.findOne({
        $or: [{ username }, { email }],
    });
    if (!user) {
        throw new ApiError(404, "Username or email does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) throw new ApiError(401, "Password is incorrect !");

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
        user._id,
    );
    const loggedInUser = await User.findByIdAndUpdate(
        user._id,
        { refreshToken },
        { new: true },
    ).select("-password -refreshToken");

    res.status(201)
        .cookie("accessToken", accessToken, AccessOptions)
        .cookie("refreshToken", refreshToken, RefreshOptions)
        .json(
            new ApiResponse(
                201,
                {
                    user: loggedInUser,
                    accessToken: accessToken,
                    refreshToken: refreshToken,
                },
                "User Logged in successfully !!",
            ),
        );
});

const userLogOut = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        { $set: { refreshToken: "" } },
        { new: true },
    );
    res.status(200)
        .clearCookie("accessToken", AccessOptions)
        .clearCookie("refreshToken", RefreshOptions)
        .json(new ApiResponse(200, {}, "User Loogged out Successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingToken =
        req.cookies?.refreshToken ||
        req.headers("Authorization").replace("Bearer ", "");
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

    const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id);

    res.status(200)
        .cookie("accessToken", accessToken, AccessOptions)
        .json(
            new ApiResponse(
                200,
                { user, accessToken, refreshToken: newRefreshToken },
                "Access Token refreshed !",
            ),
        );
});

export { userRegister, userLogIn, userLogOut, refreshAccessToken };
