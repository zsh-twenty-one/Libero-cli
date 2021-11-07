const { version } = require("./constans");
const path = require("path");

// 第一步：解析用户的命令

const program = require("commander");

program
  .command("create")
  .alias("c")
  .description("创建")
  .action(() => {
    // create 的逻辑
    require(path.resolve(__dirname, "create"))(process.argv[3]);
  });

program.version(version).parse(process.argv);
