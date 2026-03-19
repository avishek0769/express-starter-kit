import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/Apiresponse.js";


const exampleController = asyncHandler(async (req, res) => {
        
    res.status(200).json(
        new ApiResponse(
            200,
            { message: "Hello from example route!" },
            "Success",
        ),
    );
});

export { exampleController };
