#!/usr/bin/env node
'use strict';
import { rename, writeFile } from 'fs';
import * as minimist from 'minimist';
import * as mkdirp from 'mkdirp';
import * as path from 'path';

import { IInterfaceOptions, mergeTypedWsdl, outputTypedWsdl, wsdl2ts } from './wsdl-to-ts';

interface IConfigObject {
  outdir: string;
  files: string[];
}

const opts: IInterfaceOptions = {};
const config: IConfigObject = {
  outdir: './wsdl',
  files: [],
};

const args = minimist(process.argv.slice(2));

if (args.help) {
  // TODO
}

if (args.version) {
  /* tslint:disable:no-var-requires */
  const pack = require('../package.json');
  console.log('%s %s', 'wsdl-to-ts', pack.version);
  process.exit(0);
  throw new Error('Exited');
}

if (args.outdir || args.outDir) {
  config.outdir = args.outdir || args.outDir;
}
let wsdlImportBasePath: string = '';

if (args.wsdlImportBasePath || args.wsdlImportBasePath) {
  wsdlImportBasePath = path.resolve(args.wsdlImportBasePath || args.wsdlImportBasePath);
}
if (args.hasOwnProperty('quote')) {
  if (args.quote === 'false' || args.quote === 'disable' || args.quote === '0') {
    opts.quoteProperties = false;
  } else if (args.quote === 'true' || args.quote === '1' || !args.quote) {
    opts.quoteProperties = true;
  }
}
if (args.forceNamespaceOnInputRoot) {
  opts.forceNamespaceOnInputRoot = args.forceNamespaceOnInputRoot;
}
if (args._) {
  config.files.push.apply(config.files, args._);
}

if (config.files.length === 0) {
  console.error('No files given');
  process.exit(1);
  throw new Error('No files');
}

function mkdirpp(dir: string, mode?: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    mkdirp(dir, mode || 0o755, (err, made) => {
      if (err) {
        reject(err);
      } else {
        resolve(made);
      }
    });
  });
}

Promise.all(config.files.map((a) => wsdl2ts(a, opts)))
  .then((xs) => mergeTypedWsdl.apply(undefined, xs))
  .then((a) => outputTypedWsdl(a, { wsdlImportBasePath, forceNamespaceOnInputRoot: opts.forceNamespaceOnInputRoot }))
  .then((xs: Array<{ file: string; data: string[] }>) => {
    return Promise.all(
      xs.map((x) => {
        // console.log("-- %s --", x.file);
        // console.log("%s", x.data.join("\n\n"));
        const file = config.outdir + '/' + x.file;
        const dir = file.replace(/\/[^/]+$/, '');
        return mkdirpp(dir).then(() => {
          return new Promise((resolve, reject) => {
            const tsfile = file + '.ts.tmp';
            const fileData: string[] = [];
            fileData.push('/* eslint-disable max-len, @typescript-eslint/no-empty-interface */');

            fileData.push(x.data.join('\n\n'));
            fileData.push('');
            writeFile(tsfile, fileData.join('\n'), (err) => {
              if (err) {
                reject(err);
              } else {
                resolve(tsfile);
              }
            });
          });
        });
      }),
    );
  })
  .then((files: string[]) =>
    Promise.all(
      files.map((file) => {
        return new Promise((resolve, reject) => {
          const realFile = file.replace(/\.[^.]+$/, '');
          rename(file, realFile, (err) => {
            if (err) {
              reject(err);
            } else {
              resolve(realFile);
            }
          });
        });
      }),
    ),
  )
  .catch((err) => {
    console.error(err);
    process.exitCode = 3;
  });
