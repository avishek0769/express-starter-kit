import { Router } from "express";
import { exampleController } from "../controllers/example.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { userSchema } from "../schemas/user.schema.js";

const exampleRouter = Router();

exampleRouter.route("/").get(validate(userSchema), exampleController);

export default exampleRouter;
