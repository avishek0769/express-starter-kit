export const authMiddleware = (req, res, next) => {
    const { userId } = req.auth || {};

    if (!userId) {
        return res.redirect(`${process.env.FRONTEND_HOST}/sign-in`);
    }

    next();
};
