import { Schema, model } from "mongoose";

const exampleSchema = new Schema({
    name: {
        type: String,
        required: true,
    }
}, { timestamps: true });

const Model = model("Model", exampleSchema);

export default Model;