import inquirer from 'inquirer';
import ora from 'ora';


async function init() {
    const answers = await inquirer.prompt([
        {
            type: "confirm",
            message: "Do you want MVC structure?",
            name: "mvc",
        },
        {
            type: "confirm",
            message: "Do you want Auth?",
            name: "auth",
        }
    ])
    
    for (const key of Object.keys(answers)) {   
        if (answers[key]) {
            const spinner = ora(`Installing ${key}...`).start();
            await new Promise((resolve, reject) => {
                setTimeout(() => {
                    spinner.succeed(`${key.toUpperCase()} installed successfully!`);
                    resolve();
                }, 2000);
            });
        }
    }
}

init();