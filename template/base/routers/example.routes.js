import { Router } from "express";
import { exampleController } from "../controllers/example.controller.js";

const exampleRouter = Router();

exampleRouter.route("/").get(exampleController);

export default exampleRouter;
