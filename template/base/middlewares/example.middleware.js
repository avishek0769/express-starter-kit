import { ApiError } from "../utils/ApiError.js"

const exampleMiddleware = async (req, res, next) => {
    try {
        
        next()
    }
    catch (error) {
        if(error instanceof ApiError) next(error);
        else next(new ApiError(452, "Error message !"))
    }
}