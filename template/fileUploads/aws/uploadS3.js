import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs/promises";
import path from "path";
import mimeType from "mime-types";

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const uploadOnS3 = async (localFilePath, folderPath = "") => {
    try {
        if (!localFilePath) return null;

        const fileContent = await fs.readFile(localFilePath);
        const fileName = path.basename(localFilePath);

        const key = folderPath ? `${folderPath}/${fileName}` : fileName;

        const command = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: key,
            Body: fileContent,
            ContentType: mimeType.lookup(localFilePath),
        });

        await s3.send(command);

        const fileUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

        console.log("File uploaded to S3!");

        return {
            key,
            url: fileUrl,
        };
    }
    catch (error) {
        console.log("S3 upload failed:", error.message);
        return null;
    }
    finally {
        await fs.unlink(localFilePath);
    }
};

export { uploadOnS3 };
