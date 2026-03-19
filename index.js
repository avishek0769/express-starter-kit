import inquirer from "inquirer";
import ora from "ora";
import { exec, execSync } from "child_process";
import fs from "fs";
import fsExtra from "fs-extra";

async function init() {
    const p1 = exec("npm init -y");
    p1.on("exit", () => {
        const packageJsonFileContent = JSON.parse(
            fs.readFileSync("package.json", { encoding: "utf8" }),
        );
        packageJsonFileContent.type = "module";
        packageJsonFileContent.scripts = {
            dev: "node --watch index.js",
        };
        fs.writeFileSync(
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
            validate: function (input) {
                console.log(input);
                return true;
            },
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
            : "prisma @prisma/client @prisma/adapter-pg pg";
    const fileUploads =
        answers.fileUpload == "cloudinary"
            ? "multer cloudinary"
            : answers.fileUpload == "s3"
              ? "multer s3"
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

        const codeGenerationSpinner = ora("Generating code...").start();

        await fsExtra.copy("../template/base/", "./").catch((err) => {
            console.error("Error copying files:", err);
            codeGenerationSpinner.fail("Code generation failed");
        });

        if (answers.auth == "jwt") {
            fs.unlink("./controllers/example.controller.js", () => {});
            fs.unlink("./routers/example.route.js", () => {});
            fs.unlink("./middlewares/example.middleware.js", () => {});
            fs.unlink("./app.js", () => {});
            fs.unlink("./index.js", () => {});

            if (answers.database == "nosql") {
                const templateRoot = "../template/auth/jwt/mongo";

                fsExtra.copy(
                    `${templateRoot}/user.controller.js`,
                    "./controllers/user.controller.js",
                );
                fsExtra.copy(
                    `${templateRoot}/user.model.js`,
                    "./models/user.model.js",
                );
                fsExtra.copy(
                    `${templateRoot}/user.route.js`,
                    "./routers/user.route.js",
                );
                fsExtra.copy(
                    `${templateRoot}/auth.middleware.js`,
                    "./middlewares/auth.middleware.js",
                );
                fsExtra.copy(`${templateRoot}/app.js`, "./app.js");
                fsExtra.copy(`${templateRoot}/index.js`, "./index.js");
                fsExtra.copy(
                    `${templateRoot}/connectDB.js`,
                    "./utils/connectDB.js",
                );
                fs.readFile(
                    `${templateRoot}/.env`,
                    { encoding: "utf8" },
                    (_, data) => {
                        fs.appendFile(".env", `\n${data}`, () => {});
                    },
                );
            } else if (answers.database == "sql") {
                const templateRoot = "../template/auth/jwt/postgres";
                const p = exec(
                    "npx prisma init --datasource-provider postgresql --output ../generated/prisma",
                );

                p.on("exit", (code) => {
                    if (code !== 0) {
                        console.log("Error initializing prisma: ", code);
                    }
                    fsExtra.copy(
                        `${templateRoot}/user.controller.js`,
                        "./controllers/user.controller.js",
                    );
                    fsExtra.copy(
                        `${templateRoot}/user.route.js`,
                        "./routers/user.route.js",
                    );
                    fsExtra.copy(
                        `${templateRoot}/auth.middleware.js`,
                        "./middlewares/auth.middleware.js",
                    );
                    fsExtra.copy(
                        `${templateRoot}/prisma/schema.prisma`,
                        "./prisma/schema.prisma",
                    );
                    fsExtra.copy(`${templateRoot}/app.js`, "./app.js");
                    fsExtra.copy(`${templateRoot}/index.js`, "./index.js");
                    fsExtra.copy(
                        `${templateRoot}/connectDB.js`,
                        "./utils/connectDB.js",
                    );
                    fsExtra.copy(
                        `${templateRoot}/prismaClient.js`,
                        "./utils/prismaClient.js",
                    );
                    fs.readFile(
                        `${templateRoot}/.env`,
                        { encoding: "utf8" },
                        (_, data) => {
                            fs.appendFile(".env", `\n${data}`, () => {});
                        },
                    );
                    execSync("npx prisma generate");
                    codeGenerationSpinner.succeed("Code generation done");
                });
            }
        } else if (answers.auth == "clerk") {
            fs.unlink("./controllers/app.js", () => {});
            fsExtra.copy("../template/auth/clerk/app.js", "./app.js");
            fs.readFile(
                "../template/auth/clerk/.env",
                { encoding: "utf8" },
                (_, data) => {
                    fs.appendFile(".env", `\n${data}`, () => {});
                },
            );

            codeGenerationSpinner.succeed("Code generation done");
        }
    });
}

init();
