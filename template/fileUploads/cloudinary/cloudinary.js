import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloud = async (localFilePath, folderPath) => {
    try {
        if (!localFilePath) return null;
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
            folder: folderPath,
        });

        console.log("File Uploaded on Cloud!!");
        return response;
    } 
    catch (error) {
        console.log("File not uploaded.", error.message);
        return null;
    }
    finally {
        await fs.unlink(localFilePath);
    }
};

export { uploadOnCloud };
