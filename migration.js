const mongodb = require("mongodb");
const MongoClient = mongodb.MongoClient;

const connect = async () => {
  let path = "../../config/env/local.json";
  if(process.argv.find((f) => f.includes("--production"))) {
    path = "../../config/env/production.json";
  }

  let config = require(path);
  let url = `${config.database.mongodb.uri}:${config.database.mongodb.port}/${config.database.mongodb.dbname}`;

  const client = await MongoClient.connect(url);
  return {db: client.db(), client};
}

const alreadyRun = (file, client) => {
  console.log("\nMigration already run for", file);
};

const addLogs = async (migration_logs, file) => {
  await migration_logs.insertOne({
    name: file,
    created_at: new Date()
  });
};

const currentTime = () => {
  var now = new Date();
  var strDateTime = [
    [
      now.getFullYear(),
      AddZero(now.getMonth() + 1),
      AddZero(now.getDate())
    ].join(""),
    [AddZero(now.getHours()), AddZero(now.getMinutes())].join("")
  ].join("");
  return strDateTime;
};

const AddZero = (num) => {
  return num >= 0 && num < 10 ? "0" + num : num + "";
};

const createFile = () => {
  var fs = require("fs");

  let fileName = process.argv
    .find((f) => f.includes("--n"))
    .replace(" ", "")
    .replace("--n=", "")
    .replace(".js");

  const files = fs.readdirSync("./migrations");

  for (let file of files) {
    if (file.startsWith(fileName)) {
      console.log(`File with ticket ${fileName} already exists`);
      return;
    }
  }

  fileName = `${fileName}-${currentTime()}.js`;
  const fileContent = `module.exports = {
    up(db) {
      return db.collection("settings").insert({
        field_name: "setting_name",
        field_value: "setting_value",
        is_deleted: false,
        deleted_by: "",
        created_at: new Date(),
        comments: "some comments",
        is_confidential: true
      });
    },
  
    down(db, client) {
      db.getCollection("settings").remove({
        field_name: "setting_name"
      });
    }
  };`;

  fs.appendFile(`./migrations/${fileName}`, fileContent, function (err) {
    if (err) throw err;

    console.log(`Created migration ${fileName}`);
  });
};

const createDirectory = () => {
  const fs = require("fs");
  if (!fs.existsSync("./migrations")) {
    fs.mkdirSync("./migrations");
  }
};

const sortFiles = (unsortedFiles, fs) => {
  return unsortedFiles
    .map((fileName) => ({
      name: fileName,
      time: fs.statSync(`./migrations/${fileName}`).mtime.getTime()
    }))
    .sort((a, b) => a.time - b.time)
    .map((f) => f.name);
}

const alreadyExists = async (migration_logs, file) => {
  const log = await migration_logs.findOne({ name: file });
  return log != null && log != undefined;
}

const runUpMigration = async () => {
  const {db, client} = await connect();
  const migration_logs = db.collection("migration_logs");

  const fileParameter = process.argv.find((f) => f.includes("--file"));

  if (fileParameter) {
    const file = fileParameter
      .replace(" ", "")
      .replace("--file=", "")
      .replace(".js", "");
    if (file) {
      let migration;
      try {
        migration = require(`../../migrations/${file}`);
      } catch (error) {
        if (error.code == "MODULE_NOT_FOUND") {
          console.log(`\nfile ${file} not found.`);
        } else {
          console.log(error);
        }
        await client.close();
        return;
      }

      const log = await alreadyExists(migration_logs, file);
      if (!log) {
        await migration.up(db);
        await addLogs(migration_logs, file);
        console.log("Success");
      } else {
        alreadyRun(file);
      }
      await client.close();
    }
  } else {
    const fs = require("fs");
    const unsortedFiles = fs.readdirSync("./migrations");
    const sortedFiles = sortFiles(unsortedFiles, fs);

    const results = [];
    for (let i = 0; i < sortedFiles.length; i++) {
      let file = sortedFiles[i].replace(".js", "");
      const log = await alreadyExists(migration_logs, file);
      if (!log) {
        let migration = require(`../../migrations/${file}`);
        const response = migration.up(db);
        results.push(response);
        await addLogs(migration_logs, file);
      } else {
        alreadyRun(file);
      }
    }

    await Promise.all(results);
    console.log("Success");
    await client.close();
  }
};

const runDownMigration = async () => {
  const {db, client} = await connect();

  const fs = require("fs");
  const unsortedFiles = fs.readdirSync("./migrations");
  const sortedFiles = sortFiles(unsortedFiles, fs);

  const results = [];
  for (let i = 0; i < sortedFiles.length; i++) {
    let file = sortedFiles[i].replace(".js", "");
    let migration = require(`../../migrations/${file}`);
    const response = migration.down(db);
    results.push(response);
  }

  await Promise.all(results);
  console.log("Success");
  await client.close();
};

const main = async () => {
  createDirectory();
  if (process.argv.find((f) => f.includes("--n"))) {
    createFile();
  }
  else if(process.argv.find((f) => f.includes("--d")))  {
    await runDownMigration();
  }
  else {
    await runUpMigration();
  }
};

main();