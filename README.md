# nodejs-mongo-migration

The file contains code for creating a new migration, running a specific migration and all non-executed migrations.

‘npm run migrate -- --n=BI-1243’ command will generate a new file in migrations folder with boilerplate code, i.e up and down functions. The file will be named in ‘BI-1234-yearmonthdayhourminute.js’ format.

'npm run migrate -- --file=”BI-1234-202212261749”' command will migrate this file.

'npm run migrate' command without any parameters will run up functions of all files that were not executed before. Migrations that have been created first are run first. Executed migrations are recorded in migration_logs collection.

‘npm run migrate -- --d --file=BI-1234-202212261749’ downs or perform undo on the migration. It then removes the migration from migration_logs collection.
