const axios = require("axios");
const inquirer = require("inquirer");
let downloadGitRepo = require("download-git-repo");
const Metalsmith = require("metalsmith"); // 遍历文件夹，需不需要渲染
let ncp = require("ncp");
let { render } = require("consolidate").ejs;

const { downloadDirectory } = require("./constans");

/** 不需要下载的包 */
const ora = require("ora");
const fs = require("fs");
const { promisify } = require("util");
const path = require("path");

/** 将非primise方式转换为promise方式 */
downloadGitRepo = promisify(downloadGitRepo);
ncp = promisify(ncp);

/** 获取模板信息 */
const getOrganizationInfo = () => {
  return axios.request("http://api.github.com/orgs/libero-cli-1/repos");
};

/** 获取模板对应的版本信息 */
const getReportyVersionInfo = (...args) => {
  const [temp] = args;
  return axios.request(`http://api.github.com/repos/libero-cli-1/${temp}/tags`);
};

/** 封装loading */
const waitFnLoading = async (fn, message, ...args) => {
  const loading = ora(message);
  loading.start();
  let data;
  try {
    data = await fn(...args);
  } finally {
    loading.succeed();
  }
  return data;
};

const download = async (repo, tag) => {
  let api = `libero-cli-1/${repo}`;
  if (tag) {
    api += `#${tag}`; // 拼上版本号
  }
  const dest = `${downloadDirectory}/${repo}`; // 本地临时路径
  await waitFnLoading(
    () => downloadGitRepo(api, dest),
    "download template begin ..."
  ); // 下载开始

  // 将存放目录返回
  return dest;
};
module.exports = async (projectName) => {
  // 1、选择模板
  const { data: organizationData } = await waitFnLoading(
    getOrganizationInfo,
    "download template ..."
  );
  const nameary = organizationData.map((v) => v.name);
  const { repo } = await inquirer.prompt({
    name: "repo",
    type: "list",
    default: nameary[1],
    message: "please select the best for you !",
    choices: nameary,
  });

  // 2、选择模板后，选择该模板的版本号

  const { data: versionData } = await waitFnLoading(
    getReportyVersionInfo,
    "loading versions ...",
    repo
  );
  const versionNameAry = versionData.map((v) => v.name);
  const { tag } = await inquirer.prompt({
    name: "tag",
    type: "list",
    message: "请选择你中意的版本！",
    choices: versionNameAry,
  });

  /** 下载模板 */

  /**
   * 1、将下载的模板放到临时目录
   *    download-git-repo 下载仓库的包，但它不是promise调用方式，
   *    所以用 util 包的 promisify 工具将它转为promise的使用方式
   */

  const dest = await download(repo, tag);

  /**
   * 方式一：拿到了下载的模板，然后拷贝到当前目录下 ncp包可实现
   *
   * 方式二：复杂的，需要模板渲染，渲染后再拷贝
   */

  if (!fs.existsSync(path.join(dest, "ask.js"))) {
    // 方式一
    await ncp(dest, path.resolve(projectName));
  } else {
    // 方式二
    /**
     * 把github上的项目下载下来，如果有ask文件，那摩就是一个复炸的模板，
     * 我们就需要用户选择，选择后编译模板
     * metalsmith 包,
     * ejs 模板语法
     * consolidate 合并 （统一了所有模板引擎）
     */
    new Promise((resolve, reject) => {
      Metalsmith(__dirname)
        .source(dest)
        .destination(path.resolve(projectName))
        .use(async (files, metal, done) => {
          const askResult = require(path.join(dest, "ask.js"));
          let obj = await inquirer.prompt(askResult);
          const meta = metal.metadata(); // 每一个use里面的 metal.metaData()都是一个
          Object.assign(meta, obj);
          delete files["ask.js"]; // 配置读完了就删除
          done();
        })
        .use(async (files, metal, done) => {
          const editorObj = metal.metadata();
          // 根据用户的输入下载模模板
          Reflect.ownKeys(files).forEach(async (file) => {
            if (file.includes(".js") || file.includes(".json")) {
              let content = files[file].contents.toString(); // 文件对应的类容 10 进制
              if (content.includes("<%")) {
                content = await render(content, editorObj);
                files[file].contents = Buffer.from(content);
                // 将拿到的带 ’<%‘的模板通过metal.metaData()渠道的类容进行拼装为一个完整文件类容
              }
            }
          });
          done();
        })
        .build((err) => {
          if (err) {
            reject();
          } else {
            resolve();
          }
        });
    });
  }
};
