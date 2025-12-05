/**
 * Urara.TS
 * Version: Any
 *
 * NOTE: Family letters are now served dynamically from API Gateway,
 * not from static files. The urara/ directory no longer contains letters.
 * Letters are stored in DynamoDB with markdown content and served via
 * the /letters route using letters-service.ts.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import chalk from 'chalk';
import chokidar from 'chokidar';
const config = {
    catch: ['ENOENT', 'EEXIST'],
    extensions: {
        images: ['jpg', 'png', 'webp', 'avif'],
        posts: ['md'],
        server: ['js'],
    },
    images: [''],
};
const check = (ext) => (config.extensions.posts.includes(ext) || config.extensions.server.includes(ext) ? 'frontend/routes' : 'static');
function log(color, msg, dest) {
    return console.log(chalk.dim(`${new Date().toLocaleTimeString()} `)
        + chalk.magentaBright.bold('[urara] ')
        + chalk[color](`${msg} `)
        + chalk.dim(dest ?? ''));
}
function error(err) {
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
}
function cpFile(src, { dest = path.join(check(path.parse(src).ext.slice(1)), src.slice(6)), stat = 'copy' } = {}) {
    return config.extensions.images.includes(path.parse(src).ext.slice(1))
        ? fs
            .copyFile(src, path.join('frontend/static', src.slice(6)))
            .then(() => fs.copyFile(src, path.join('static', src.slice(6))))
            .then(() => log('green', `${stat} file`, dest))
            .catch(error)
        : fs
            .copyFile(src, dest)
            .then(() => log('green', `${stat} file`, dest))
            .catch(error);
}
function rmFile(src, { dest = path.join(check(path.parse(src).ext.slice(1)), src.slice(6)) } = {}) {
    return config.extensions.images.includes(path.parse(src).ext.slice(1))
        ? fs
            .rm(path.join('frontend/static', src.slice(6)))
            .then(() => fs.rm(path.join('static', src.slice(6))))
            .then(() => log('yellow', 'remove file', dest))
            .catch(error)
        : fs
            .rm(dest)
            .then(() => log('yellow', 'remove file', dest))
            .catch(error);
}
function mkDir(src, { dest = [path.join('frontend/routes', src.slice(6)), path.join('static', src.slice(6)), path.join('frontend/static', src.slice(6))], } = {}) {
    dest.forEach(path => fs
        .mkdir(path)
        .then(() => log('green', 'make dir', path))
        .catch(error));
}
function cpDir(src) {
    return fs.readdir(src, { withFileTypes: true }).then(files => files.forEach((file) => {
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
}
function rmDir(src, { dest = [path.join('frontend/routes', src.slice(6)), path.join('static', src.slice(6)), path.join('frontend/static', src.slice(6))], } = {}) {
    dest.forEach(path => fs
        .rm(path, { force: true, recursive: true })
        .then(() => log('yellow', 'remove dir', path))
        .catch(error));
}
function cleanDir(src) {
    return fs.readdir(src, { withFileTypes: true }).then((files) => {
        files.forEach((file) => {
            const dest = path.join(src, file.name);
            file.isDirectory()
                ? rmDir(dest)
                : file.name.startsWith('.')
                    ? log('cyan', 'ignore file', dest)
                    : rmFile(dest);
        });
    });
}
function build() {
    mkDir('static', { dest: ['static'] });
    mkDir('frontend/static', { dest: ['frontend/static'] });
    cpDir('urara');
}
function clean() {
    cleanDir('urara');
    rmDir('static', { dest: ['static'] });
    rmDir('frontend/static', { dest: ['frontend/static'] });
}
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
