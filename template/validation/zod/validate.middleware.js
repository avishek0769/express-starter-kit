import { ApiError } from "../utils/ApiError.js";

const validate = (schema) => (req, res, next) => {
    try {
        const parsed = schema.parse(req.body);
        req.validatedData = parsed;
        next();
    }
    catch (error) {
        throw new ApiError(400, JSON.parse(error.message).map((err) => err.message).join(", "));
    }
};

export { validate };