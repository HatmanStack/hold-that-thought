/**
 * Urara.TS
 * Version: Any
 */
import chalk from 'chalk';
import chokidar from 'chokidar';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
const config = {
    catch: ['ENOENT', 'EEXIST'],
    extensions: {
        images: ['jpg', 'png', 'webp', 'avif'],
        posts: ['md'],
        server: ['js'],
    },
    images: [''],
};
const check = (ext) => (config.extensions.posts.includes(ext) || config.extensions.server.includes(ext) ? 'src/routes' : 'static');
const log = (color, msg, dest) => 
// eslint-disable-next-line no-console
console.log(chalk.dim(`${new Date().toLocaleTimeString()} `)
    + chalk.magentaBright.bold('[urara] ')
    + chalk[color](`${msg} `)
    + chalk.dim(dest ?? ''));
const error = (err) => {
    if (config.catch.includes(err.code)) {
        // eslint-disable-next-line no-console
        console.log(chalk.dim(`${new Date().toLocaleTimeString()} `)
            + chalk.redBright.bold('[urara] ')
            + chalk.red('error ')
            + chalk.dim(err.message));
    }
    else {
        throw err;
    }
};
const cpFile = (src, { dest = path.join(check(path.parse(src).ext.slice(1)), src.slice(6)), stat = 'copy' } = {}) => config.extensions.images.includes(path.parse(src).ext.slice(1))
    ? fs
        .copyFile(src, path.join('src/static', src.slice(6)))
        .then(() => fs.copyFile(src, path.join('static', src.slice(6))))
        .then(() => log('green', `${stat} file`, dest))
        .catch(error)
    : fs
        .copyFile(src, dest)
        .then(() => log('green', `${stat} file`, dest))
        .catch(error);
const rmFile = (src, { dest = path.join(check(path.parse(src).ext.slice(1)), src.slice(6)) } = {}) => config.extensions.images.includes(path.parse(src).ext.slice(1))
    ? fs
        .rm(path.join('src/static', src.slice(6)))
        .then(() => fs.rm(path.join('static', src.slice(6))))
        .then(() => log('yellow', 'remove file', dest))
        .catch(error)
    : fs
        .rm(dest)
        .then(() => log('yellow', 'remove file', dest))
        .catch(error);
const mkDir = (src, { dest = [path.join('src/routes', src.slice(6)), path.join('static', src.slice(6)), path.join('src/static', src.slice(6))], } = {}) => {
    dest.forEach(path => fs
        .mkdir(path)
        .then(() => log('green', 'make dir', path))
        .catch(error));
};
const cpDir = (src) => fs.readdir(src, { withFileTypes: true }).then(files => files.forEach((file) => {
    const dest = path.join(src, file.name);
    if (file.isDirectory()) {
        mkDir(dest);
        cpDir(dest);
    }
    else if (file.name.startsWith('.')) {
        log('cyan', 'ignore file', dest);
    }
    else {
        cpFile(dest);
    }
}));
const rmDir = (src, { dest = [path.join('src/routes', src.slice(6)), path.join('static', src.slice(6)), path.join('src/static', src.slice(6))], } = {}) => {
    dest.forEach(path => fs
        .rm(path, { force: true, recursive: true })
        .then(() => log('yellow', 'remove dir', path))
        .catch(error));
};
const cleanDir = (src) => fs.readdir(src, { withFileTypes: true }).then((files) => {
    files.forEach((file) => {
        const dest = path.join(src, file.name);
        // eslint-disable-next-line ts/no-unused-expressions
        file.isDirectory()
            ? rmDir(dest)
            : file.name.startsWith('.')
                ? log('cyan', 'ignore file', dest)
                : rmFile(dest);
    });
});
const build = () => {
    mkDir('static', { dest: ['static'] });
    mkDir('src/static', { dest: ['src/static'] });
    cpDir('urara');
};
const clean = () => {
    cleanDir('urara');
    rmDir('static', { dest: ['static'] });
    rmDir('src/static', { dest: ['src/static'] });
};
switch (process.argv[2]) {
    case 'watch':
        {
            const watcher = chokidar.watch('urara', {
                ignored: (file) => path.basename(file).startsWith('.'),
            });
            watcher
                .on('add', file => cpFile(file))
                .on('change', file => cpFile(file, { stat: 'update' }))
                .on('unlink', file => rmFile(file))
                .on('addDir', dir => mkDir(dir))
                .on('unlinkDir', dir => rmDir(dir))
                .on('error', error => log('red', 'error', error))
                .on('ready', () => log('cyan', 'copy complete. ready for changes'));
            process
                .on('SIGINT', () => {
                log('red', 'sigint');
                clean();
                watcher?.close();
            })
                .on('SIGTERM', () => {
                log('red', 'sigterm');
                watcher?.close();
            })
                .on('exit', () => {
                log('red', 'exit');
            });
        }
        break;
    case 'build':
        build();
        break;
    case 'clean':
        clean();
        break;
    default:
        log('red', 'error', 'invalid arguments');
        break;
}
