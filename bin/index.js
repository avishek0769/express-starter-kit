#!/usr/bin/env node
import inquirer from "inquirer";
import ora from "ora";
import { exec, execSync } from "child_process";
import fs from "fs/promises";
import fsExtra from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_BASE = path.join(__dirname, "../template");

const tp = (...segments) => path.join(TEMPLATE_BASE, ...segments);

async function init() {
    const p1 = exec("npm init -y");
    p1.on("exit", async () => {
        const packageJsonFileContent = JSON.parse(
            await fs.readFile("package.json", { encoding: "utf8" }),
        );
        packageJsonFileContent.type = "module";
        packageJsonFileContent.scripts = {
            dev: "node --watch index.js",
        };
        await fs.writeFile(
            "package.json",
            JSON.stringify(packageJsonFileContent),
        );
        p1.kill();
    });

    const answers = await inquirer.prompt([
        {
            type: "select",
            message: "Choose authentication type -",
            name: "auth",
            choices: [
                { name: "None", value: "none" },
                { name: "Custom JWT-based Auth", value: "jwt" },
                { name: "Clerk", value: "clerk" },
            ],
        },
        {
            type: "select",
            message: "Choose validation library -",
            name: "validation",
            choices: [
                { name: "None", value: "none" },
                { name: "Zod", value: "zod" },
            ],
        },
        {
            type: "select",
            message: "Choose database integration -",
            name: "database",
            choices: [
                { name: "None", value: "none" },
                { name: "MongoDB (Mongoose)", value: "nosql" },
                { name: "PostgreSQL (Prisma)", value: "sql" },
            ],
        },
        {
            type: "select",
            message:
                "Choose in-memory database integration (client - ioredis) -",
            name: "inMemoryDb",
            choices: [
                { name: "None", value: "none" },
                { name: "Redis", value: "redis" },
                { name: "Valkey", value: "valkey" },
            ],
        },
        {
            type: "confirm",
            message: "Generate docker-compose for selected DBs ?",
            name: "docker",
            when: (answers) =>
                answers.database != "none" || answers.inMemoryDb != "none",
            default: true,
        },
        {
            type: "select",
            message: "File uploads handling -",
            name: "fileUpload",
            choices: [
                { name: "None", value: "none" },
                { name: "Multer + Cloudinary", value: "cloudinary" },
                { name: "Multer + AWS S3", value: "s3" },
            ],
        },
    ]);

    const installationSpinner = ora("Installing necessary packages...").start();

    const jwt =
        answers.auth == "jwt"
            ? "jsonwebtoken cookie-parser bcrypt"
            : answers.auth == "clerk"
              ? "@clerk/express"
              : "";
    const zod = answers.validation == "zod" ? "zod" : "";
    const db =
        answers.database == "nosql"
            ? "mongoose"
            : "prisma @prisma/client @prisma/adapter-pg pg @prisma/client-runtime-utils";
    const fileUploads =
        answers.fileUpload == "cloudinary"
            ? "multer cloudinary"
            : answers.fileUpload == "s3"
              ? "multer @aws-sdk/client-s3 mime-types"
              : "";

    const p2 = exec(
        `npm install express dotenv cors ${jwt} ${zod} ${db} ioredis ${fileUploads}`,
    );

    p2.on("exit", async (code) => {
        if (code === 0) {
            installationSpinner.succeed("Installation done");
        } else {
            installationSpinner.fail(`Process exited with code ${code}`);
        }

        const codeGenerationSpinner = ora("Setting up codebase...").start();

        await fsExtra.copy(tp("base"), "./").catch((err) => {
            console.error("Error copying files:", err);
            codeGenerationSpinner.fail("Codebase setup failed");
            process.exit(1);
        });

        if (answers.auth == "jwt") {
            await fs.unlink("./controllers/example.controller.js");
            await fs.unlink("./routers/example.route.js");
            await fs.unlink("./middlewares/example.middleware.js");
            await fs.unlink("./app.js");
            await fs.unlink("./index.js");

            if (answers.database == "nosql") {
                const templateRoot = tp("auth", "jwt", "mongo");

                await fsExtra.copy(
                    `${templateRoot}/user.controller.js`,
                    "./controllers/user.controller.js",
                );
                await fsExtra.copy(
                    `${templateRoot}/user.model.js`,
                    "./models/user.model.js",
                );
                await fsExtra.copy(
                    `${templateRoot}/user.route.js`,
                    "./routers/user.route.js",
                );
                await fsExtra.copy(
                    `${templateRoot}/auth.middleware.js`,
                    "./middlewares/auth.middleware.js",
                );
                await fsExtra.copy(`${templateRoot}/app.js`, "./app.js");
                await fsExtra.copy(`${templateRoot}/index.js`, "./index.js");
                await fsExtra.copy(
                    `${templateRoot}/connectDB.js`,
                    "./utils/connectDB.js",
                );
                const envData = await fs.readFile(
                    path.join(templateRoot, ".env"),
                    { encoding: "utf8" },
                );
                await fs.appendFile(".env", `\n${envData}`);
            } else if (answers.database == "sql") {
                const templateRoot = tp("auth", "jwt", "postgres");
                await new Promise((resolve, reject) => {
                    const p = exec(
                        "npx prisma init --datasource-provider postgresql --output ../generated/prisma",
                    );

                    p.on("exit", async (code) => {
                        if (code !== 0) {
                            console.log("Error initializing prisma: ", code);
                        }
                        await fsExtra.copy(
                            `${templateRoot}/user.controller.js`,
                            "./controllers/user.controller.js",
                        );
                        await fsExtra.copy(
                            `${templateRoot}/user.route.js`,
                            "./routers/user.route.js",
                        );
                        await fsExtra.copy(
                            `${templateRoot}/auth.middleware.js`,
                            "./middlewares/auth.middleware.js",
                        );
                        await fsExtra.copy(
                            `${templateRoot}/prisma/schema.prisma`,
                            "./prisma/schema.prisma",
                        );
                        await fsExtra.copy(
                            `${templateRoot}/app.js`,
                            "./app.js",
                        );
                        await fsExtra.copy(
                            `${templateRoot}/index.js`,
                            "./index.js",
                        );
                        await fsExtra.copy(
                            `${templateRoot}/connectDB.js`,
                            "./utils/connectDB.js",
                        );
                        await fsExtra.copy(
                            `${templateRoot}/prismaClient.js`,
                            "./utils/prismaClient.js",
                        );
                        const envData = await fs.readFile(
                            path.join(templateRoot, ".env"),
                            { encoding: "utf8" },
                        );
                        await fs.appendFile(".env", `\n${envData}`);

                        execSync("npx prisma generate");
                        resolve();
                    });
                });
            }

            if (answers.validation == "zod") {
                const templateRoot = tp("validation", "zod", "jwt");
                await fs.unlink("./controllers/user.controller.js");
                await fs.unlink("./routers/user.route.js");

                if (answers.database == "nosql") {
                    await fsExtra.copy(
                        `${templateRoot}/user.controller.m.js`,
                        "./controllers/user.controller.js",
                    );
                } else if (answers.database == "sql") {
                    await fsExtra.copy(
                        `${templateRoot}/user.controller.p.js`,
                        "./controllers/user.controller.js",
                    );
                }

                await fsExtra.copy(
                    `${templateRoot}/user.schema.js`,
                    "./schemas/user.schema.js",
                );
                await fsExtra.copy(
                    `${templateRoot}/user.route.js`,
                    "./routers/user.route.js",
                );
            }
        } else if (answers.auth == "clerk") {
            const templateRoot = tp("auth", "clerk");

            await fs.unlink("./app.js");
            await fsExtra.copy(`${templateRoot}/app.js`, "./app.js");
            await fsExtra.copy(`${templateRoot}/auth.middleware.js`, "./middlewares/auth.middleware.js");
            const envData = await fs.readFile(path.join(templateRoot, ".env"), {
                encoding: "utf8",
            });
            await fs.appendFile(".env", `\n${envData}`);
        }

        if (answers.auth == "none" || answers.auth == "clerk") {
            if (answers.database == "nosql") {
                const templateRoot = tp("database", "mongodb");

                await fsExtra.copy(
                    `${templateRoot}/connectDB.js`,
                    "./utils/connectDB.js",
                );
                await fsExtra.copy(
                    `${templateRoot}/index.js`,
                    "./index.js",
                );
                await fsExtra.copy(
                    `${templateRoot}/example.model.js`,
                    "./models/example.model.js",
                );
                const envData = await fs.readFile(
                    path.join(templateRoot, ".env"),
                    {
                        encoding: "utf8",
                    },
                );
                await fs.appendFile(".env", `\n${envData}`);
            } else if (answers.database == "sql") {
                const templateRoot = tp("database", "postgres");
                const p = exec(
                    "npx prisma init --datasource-provider postgresql --output ../generated/prisma",
                );

                p.on("exit", async (code) => {
                    await fsExtra.copy(
                        `${templateRoot}/connectDB.js`,
                        "./utils/connectDB.js",
                    );
                    await fsExtra.copy(
                        `${templateRoot}/index.js`,
                        "./index.js",
                    );
                    await fsExtra.copy(
                        `${templateRoot}/prismaClient.js`,
                        "./utils/prismaClient.js",
                    );
                    execSync("npx prisma generate");
                });
            }
        }

        if (answers.inMemoryDb == "redis") {
            const templateRoot = tp("in_memory", "redis");
            await fsExtra.copy(`${templateRoot}/redis.js`, "./utils/redis.js");
        } else if (answers.inMemoryDb == "valkey") {
            const templateRoot = tp("in_memory", "valkey");
            await fsExtra.copy(
                `${templateRoot}/valkey.js`,
                "./utils/valkey.js",
            );
        }

        if (answers.fileUpload == "cloudinary") {
            const templateRoot = tp("fileUploads");

            await fs.mkdir("./temp")
            await fsExtra.copy(
                `${templateRoot}/multer.middleware.js`,
                "./middlewares/multer.middleware.js",
            );
            await fsExtra.copy(
                `${templateRoot}/cloudinary/cloudinary.js`,
                "./utils/cloudinary.js",
            );
            const envData = await fs.readFile(
                path.join(templateRoot, "cloudinary", ".env"),
                { encoding: "utf8" },
            );
            await fs.appendFile(".env", `\n${envData}`);
        } else if (answers.fileUpload == "s3") {
            const templateRoot = tp("fileUploads");

            await fs.mkdir("./temp")
            await fsExtra.copy(
                `${templateRoot}/multer.middleware.js`,
                "./middlewares/multer.middleware.js",
            );
            await fsExtra.copy(
                `${templateRoot}/aws/uploadS3.js`,
                "./utils/uploadS3.js",
            );
            const envData = await fs.readFile(
                path.join(templateRoot, "aws", ".env"),
                { encoding: "utf8" },
            );
            await fs.appendFile(".env", `\n${envData}`);
        }

        if (answers.docker) {
            const volumesToDeclare = [];
            let dockerComposeContent = "services:\n";

            if (answers.database === "nosql") {
                volumesToDeclare.push("mongodb_data");
                dockerComposeContent +=
                    '  mongodb:\n    image: mongo:latest\n    container_name: mongodb\n    ports:\n      - "27017:27017"\n    volumes:\n      - mongodb_data:/data/db\n';
            } else if (answers.database === "sql") {
                volumesToDeclare.push("postgres_data");
                dockerComposeContent +=
                    '  postgres:\n    image: postgres:latest\n    container_name: postgres\n    environment:\n      POSTGRES_USER: postgres\n      POSTGRES_PASSWORD: password\n      POSTGRES_DB: mydb\n    ports:\n      - "5432:5432"\n    volumes:\n      - postgres_data:/var/lib/postgresql/data\n';
                dockerComposeContent +=
                    '  pgadmin:\n    image: dpage/pgadmin4\n    restart: always\n    environment:\n      PGADMIN_DEFAULT_EMAIL: admin@example.com\n      PGADMIN_DEFAULT_PASSWORD: admin_password\n    ports:\n      - "8080:80"\n    depends_on:\n      - postgres\n';
            }

            if (answers.inMemoryDb === "redis") {
                volumesToDeclare.push("redis_data");
                dockerComposeContent +=
                    '  redis-stack:\n    image: redis/redis-stack:latest\n    container_name: redis-stack\n    ports:\n      - "6379:6379"\n      - "8001:8001"\n    volumes:\n      - redis_data:/var/lib/redis\n';
            } else if (answers.inMemoryDb === "valkey") {
                volumesToDeclare.push("valkey_data");
                dockerComposeContent +=
                    '  valkey:\n    image: valkey/valkey:latest\n    container_name: valkey\n    ports:\n      - "7379:7379"\n    volumes:\n      - valkey_data:/var/lib/valkey\n';
            }

            if (volumesToDeclare.length > 0) {
                dockerComposeContent +=
                    "\nvolumes:\n" +
                    volumesToDeclare.map((vol) => `  ${vol}:`).join("\n");
            }

            await fs.writeFile("./docker-compose.yml", dockerComposeContent);
        }

        if (answers.validation == "zod") {
            const templateRoot = tp("validation", "zod", "base");
            await fsExtra.copy(
                `${templateRoot}/validate.middleware.js`,
                "./middlewares/validate.middleware.js",
            );

            if (answers.auth == "none" || answers.auth == "clerk") {
                await fs.unlink("./routers/example.route.js");
                await fsExtra.copy(
                    `${templateRoot}/example.route.js`,
                    "./routers/example.route.js",
                );
                await fsExtra.copy(
                    `${templateRoot}/user.schema.js`,
                    "./schemas/user.schema.js",
                );
            }
        }

        codeGenerationSpinner.succeed("Codebase setup done");
    });
}

init();
