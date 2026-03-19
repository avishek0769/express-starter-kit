import inquirer from "inquirer";
import ora from "ora";
import { exec } from "child_process";
import fs from "fs";
import fsExtra from "fs-extra";

/*
Steps of script execution --
1. Init npm package, and set - "type": "module"
2. 
*/

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
                { name: "Zod", value: "zod" }
            ]
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
                { name: "Valkey", value: "valkey" }
            ],
        },
        {
            type: "confirm",
            message: "Generate docker-compose for selected DBs ?",
            name: "docker",
            when: (answers) => answers.database != "none" || answers.inMemoryDb != "none",
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

    const jwt = answers.auth == "jwt" ? "jsonwebtoken cookie-parser" : "";
    const zod = answers.validation == "zod" ? "zod" : "";
    const db = answers.database == "nosql"
            ? "mongoose"
            : "prisma @prisma/client @prisma/adapter-pg pg";
    const fileUploads = answers.fileUpload == "cloudinary"
            ? "multer cloudinary"
            : answers.fileUpload == "s3"
              ? "multer s3"
              : "";

    const p2 = exec(
        `npm install express dotenv cors ${jwt} ${zod} ${db} ioredis ${fileUploads}`,
    );

    p2.on("exit", (code) => {
        if (code === 0) {
            installationSpinner.succeed("Installation done");
        } else {
            installationSpinner.fail(`Process exited with code ${code}`);
        }

        const codeGenerationSpinner = ora("Generating code...").start();

        fsExtra.copy("../template/base/", "./")
        .then(() => {
            
        })
        .catch((err) => {
            console.error("Error copying files:", err);
            codeGenerationSpinner.fail("Code generation failed");
        })
        .finally(() => {
            codeGenerationSpinner.succeed("Code generation done");
        });
    });
}

init();
