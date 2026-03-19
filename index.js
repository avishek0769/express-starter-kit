import inquirer from "inquirer";
import ora from "ora";
import { exec } from "child_process";
import fs from "fs";

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
            choices: ["None", "Zod"],
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
            choices: ["None", "Redis", "Valkey"],
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
            type: "confirm",
            message: "Do you want file uploads handling using multer ?",
            name: "multer",
            default: true,
        },
    ]);

    const spinner = ora("Installing necessary packages...").start();

    const jwt = answers.auth.toLowerCase() == "jwt" ? "jsonwebtoken cookie-parser" : "";
    const zod = answers.validation.toLowerCase() == "zod" ? "zod" : "";
    const db = answers.database.toLowerCase() == "nosql"
            ? "mongoose"
            : "prisma @prisma/client @prisma/adapter-pg pg";
    const multer = answers.multer ? "multer" : "";

    const p2 = exec(
        `npm install express dotenv cors ${jwt} ${zod} ${db} ioredis ${multer}`,
    );

    p2.on("exit", (code) => {
        if (code === 0) {
            spinner.succeed("Installation done");
        } else {
            spinner.fail(`Process exited with code ${code}`);
        }
    });
}

init();
