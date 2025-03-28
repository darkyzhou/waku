import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
const filePathToOsPath = (filePath)=>path.sep === '/' ? filePath : filePath.replace(/\//g, '\\');
export const createReadStream = (filePath)=>fs.createReadStream(filePathToOsPath(filePath));
export const createWriteStream = (filePath)=>fs.createWriteStream(filePathToOsPath(filePath));
export const existsSync = (filePath)=>fs.existsSync(filePathToOsPath(filePath));
export const copyFile = (filePath1, filePath2)=>fsPromises.copyFile(filePathToOsPath(filePath1), filePathToOsPath(filePath2));
export const rename = (filePath1, filePath2)=>fsPromises.rename(filePathToOsPath(filePath1), filePathToOsPath(filePath2));
export const mkdir = (filePath, options)=>fsPromises.mkdir(filePathToOsPath(filePath), options);
export const readFile = (filePath, options)=>fsPromises.readFile(filePathToOsPath(filePath), options);
export const writeFile = (filePath, content)=>fsPromises.writeFile(filePathToOsPath(filePath), content);
export const appendFile = (filePath, content)=>fsPromises.appendFile(filePathToOsPath(filePath), content);
export const stat = (filePath)=>fsPromises.stat(filePathToOsPath(filePath));
export const unlink = (filePath)=>fsPromises.unlink(filePathToOsPath(filePath));
export const readdir = (filePath, options)=>fsPromises.readdir(filePathToOsPath(filePath), options);

//# sourceMappingURL=node-fs.js.map