/**
 * @desc 存放用户额一些常量
 */

const { version } = require("../package.json");

// 存放模板临时存放目录
const downloadDirectory = `${
  process.env[process.platform === "win32" ? "USERPROFILE" : "HOME"]
}/.template`;

module.exports = {
  version,
  downloadDirectory,
};
