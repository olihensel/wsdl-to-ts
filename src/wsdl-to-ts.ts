import * as soap from 'soap';
import * as _ from 'lodash';
import Templates, { TS_IMPORT_PATHS } from './template';
import * as path from 'path';
import safeStringify from 'fast-safe-stringify';
import { parse, stringify } from 'flatted';

// import { diffLines } from "diff";

export const nsEnums: { [k: string]: boolean } = {};

interface ITwoDown<T> {
  [k: string]: { [k: string]: T };
}

interface IInterfaceObject {
  [key: string]: string | IInterfaceObject;
}

export interface IInterfaceOptions {
  quoteProperties?: boolean;
  forceNamespaceOnInputRoot?: string;
}

export interface ITypedWsdl {
  client: soap.Client | null;
  files: ITwoDown<string>;
  methods: ITwoDown<{ [k: string]: string }>;
  types: ITwoDown<{ [k: string]: string }>;
  namespaces: ITwoDown<{ [k: string]: { [k: string]: string } }>;
  soapNamespaces: string[];
  endpoint: string;
}

export class TypeCollector {
  public readonly registered: {
    [k: string]: { namespace: string; object: string };
  };
  public readonly collected: {
    [k: string]: { namespace: string; object: string };
  };

  public soapNamespaces: string[] = [];
  constructor(public readonly ns: string) {
    this.registered = {};
    this.collected = {};
  }

  public registerCollected() {
    for (const k of Object.keys(this.collected)) {
      if (this.collected[k]) {
        this.registered[k] = this.collected[k];
      } else {
        delete this.registered[k];
      }
      delete this.collected[k];
    }
    return this;
  }
}
interface IInterfaceElementObj {
  [k: string]: string | IInterfaceElementObj;
}
interface IInterfaceObj {
  keys: IInterfaceElementObj;
  namespace: string;
}

function wsdlTypeToInterfaceObj(
  obj: IInterfaceObject,
  parentName: string,
  typeCollector: TypeCollector,
): IInterfaceObj {
  const output: IInterfaceObj = {
    keys: {},
    namespace: /* obj.targetNSAlias === "tns" ? "" :*/ obj.targetNamespace as string,
  };
  for (const key of Object.keys(obj)) {
    if (key === 'targetNSAlias' || key === 'targetNamespace' /*|| key === 'type'*/) {
      continue;
    }
    const isArray = key.endsWith('[]');
    const propertyName = isArray ? key.substring(0, key.length - 2) : key;
    const collectedTypeName = parentName ? `${parentName}_${propertyName}` : propertyName;
    const v = obj[key];

    if (v === key) {
      // somehow there can be nested circular objects?!
      continue;
    }
    const t = typeof v;
    if (t === 'string') {
      const vstr = v as string;
      const [typeName, superTypeClass, typeData] = vstr.indexOf('|') === -1 ? [vstr, vstr, undefined] : vstr.split('|');

      if (
        obj.targetNamespace &&
        typeCollector &&
        typeof obj.targetNamespace === 'string' &&
        typeCollector.soapNamespaces.indexOf(obj.targetNamespace as string) < 0
        /* &&
        typeof obj.targetNSAlias === "string" &&
        typeCollector.soapNamespaces.indexOf(obj.targetNSAlias as string) < 0 &&
        obj.targetNSAlias !== "tns"
        */
      ) {
        typeCollector.soapNamespaces.push(obj.targetNamespace);
      }
      const typeFullName = obj.targetNamespace ? obj.targetNamespace + '#' + typeName : typeName;
      let typeClass = superTypeClass === 'integer' ? 'number' : superTypeClass;
      if (nsEnums[typeFullName] || typeData) {
        const filter = nsEnums[typeFullName]
          ? () => true
          : (x: string) =>
              x !== 'length' &&
              x !== 'pattern' &&
              x !== 'maxLength' &&
              x !== 'minLength' &&
              x !== 'minInclusive' &&
              x !== 'maxInclusive' &&
              x !== 'maxInclusive' &&
              x !== 'maxExclusive' &&
              x !== 'fractionDigits' &&
              x !== 'totalDigits' &&
              x !== 'whiteSpace';
        const tdsplit = typeData.split(',').filter(filter);
        if (tdsplit.length) {
          typeClass = '"' + tdsplit.join('" | "') + '"';
        }
      }
      if (isArray) {
        if (/^[A-Za-z0-9.]+$/.test(typeClass)) {
          typeClass += '[]';
        } else {
          typeClass = 'Array<' + typeClass + '>';
        }
      }
      output.keys[propertyName] = '/** ' + typeFullName + '(' + typeData + ') */ ' + typeClass + ';';
    } else {
      const parentSegments = parentName.split('_');
      if (
        propertyName === parentSegments.pop() &&
        propertyName === parentSegments.pop() &&
        propertyName === parentSegments.pop()
      ) {
        // we are at least three levels into recursion
        output.keys[propertyName] = '/** RECURSION! ' + parentName + '(' + 'unknown' + ') */ ' + 'anyType' + ';';
      } else {
        const to = wsdlTypeToInterfaceObj(v as IInterfaceObject, `${parentName}_${propertyName}`, typeCollector);
        let tr: { [k: string]: any } | string;
        if (isArray) {
          let s = wsdlTypeToInterfaceString(to.keys);
          if (typeCollector && typeCollector.ns) {
            if (
              typeCollector.registered.hasOwnProperty(collectedTypeName) &&
              typeCollector.registered[collectedTypeName] &&
              typeCollector.registered[collectedTypeName].object === s
            ) {
              s = typeCollector.ns + '.I' + collectedTypeName + ';';
            } else if (
              typeCollector.collected.hasOwnProperty(collectedTypeName) &&
              typeCollector.collected[collectedTypeName]
            ) {
              if (typeCollector.collected[collectedTypeName].object !== s) {
                typeCollector.collected[collectedTypeName] = null;
              }
            } else {
              typeCollector.collected[collectedTypeName] = {
                object: s,
                namespace: to.namespace,
              };
            }
          }
          s = s.replace(/\n/g, '\n    ');

          if (s.startsWith('/**')) {
            const i = s.indexOf('*/') + 2;
            s = s.substring(0, i) + ' Array<' + s.substring(i).trim().replace(/;$/, '') + '>;';
          } else {
            s = s.trim().replace(/;$/, '');
            if (/^[A-Za-z0-9.]+$/.test(s)) {
              s += '[];';
            } else {
              s = 'Array<' + s + '>;';
            }
          }

          tr = s;
        } else {
          tr = to.keys;
          if (typeCollector && typeCollector.ns) {
            const ss = wsdlTypeToInterfaceString(to.keys);
            if (
              typeCollector.registered.hasOwnProperty(collectedTypeName) &&
              typeCollector.registered[collectedTypeName] &&
              typeCollector.registered[collectedTypeName].object === ss
            ) {
              tr = typeCollector.ns + '.I' + collectedTypeName + ';';
            } else if (
              typeCollector.collected.hasOwnProperty(collectedTypeName) &&
              typeCollector.collected[collectedTypeName]
            ) {
              if (typeCollector.collected[collectedTypeName].object !== ss) {
                typeCollector.collected[collectedTypeName] = null;
              }
            } else {
              typeCollector.collected[collectedTypeName] = {
                object: ss,
                namespace: to.namespace,
              };
            }
          } else {
            console.log(typeCollector);
          }
        }
        output.keys[propertyName] = tr;
      }
    }
  }
  // console.log("wsdlTypeToInterfaceObj:", r);
  return output;
}
const knownTypes: string[] = [];
function wsdlTypeToInterfaceString(d: { [k: string]: any }, opts: IInterfaceOptions = {}): string {
  const r: string[] = [];
  let orderCounter = 0;

  for (const k of Object.keys(d)) {
    const t = typeof d[k];
    let propertyName: string = k;
    if (opts.quoteProperties || (opts.quoteProperties === undefined && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(k))) {
      propertyName = safeStringify(k);
    }

    let type = '';
    if (t === 'string') {
      const v = d[k];
      type = v;
      if (v.startsWith('/**')) {
        const i = v.indexOf('*/') + 2;
        r.push(v.substring(0, i));
        /*
                let fullType = v.substring(4, v.indexOf('#')-3);
                fullType = fullType.replace(/:/g, '');
                if (p.indexOf("\"") === 0) {
                  p = `"${fullType}:${p.substring(1)}`;
                } else {
                  p = safeStringify(`${fullType}:${p}`);
                }
                */
        // for types like "xsd:string" only the "string" part is used
        const rawtype = v.substring(i).trim();
        const colon = rawtype.indexOf(':');
        if (colon !== -1) {
          type = rawtype.substring(colon + 1);
        } else {
          type = rawtype;
        }
        if (type.endsWith('>;')) {
          type = type.substring(0, type.length - 2) + ';';
        }
        knownTypes.push(type);
      }
      // r.push(propertyName + ": " + type);
    } else {
      type = wsdlTypeToInterfaceString(d[k], opts).replace(/\n/g, '\n    ') + ';';
    }
    let shortenedType = type;
    if (shortenedType.endsWith(';')) {
      shortenedType = shortenedType.substring(0, shortenedType.length - 1);
    }
    if (shortenedType.startsWith('Array<') && shortenedType.endsWith('>')) {
      shortenedType = shortenedType.substring(6).substring(0, shortenedType.length - 7);
    }
    if (shortenedType.includes('.') && !shortenedType.startsWith('{')) {
      r.push(`@Type(() => ${shortenedType})`);
    }
    r.push(`@XmlOrder(${orderCounter++})`);
    r.push(propertyName + '?: ' + type);
  }
  if (r.length === 0) {
    return '{}';
  }
  return '{\n    ' + r.join('\n    ') + '\n}';
}
function wsdlTypeToInterface(
  obj: { [k: string]: any },
  parentName: string,
  typeCollector: TypeCollector,
  opts?: IInterfaceOptions,
): string {
  const interfaceObj = wsdlTypeToInterfaceObj(obj, parentName, typeCollector);

  return wsdlTypeToInterfaceString(interfaceObj.keys, opts);
}

export function wsdl2ts(wsdlUri: string, opts?: IInterfaceOptions): Promise<ITypedWsdl> {
  return new Promise<soap.Client>((resolve, reject) => {
    soap.createClient(wsdlUri, {}, (err, client) => {
      if (err) {
        reject(err);
      } else {
        resolve(client);
      }
    });
  }).then((client) => {
    const output: ITypedWsdl = {
      client,
      files: {},
      methods: {},
      namespaces: {},
      types: {},
      soapNamespaces: [],
      endpoint: '',
    };
    const description = client.describe();
    console.log('DESCRIPTION:', stringify(description));

    const describedServices = (client as any).wsdl.services;
    const describedService = describedServices[Object.keys(describedServices)[0]];
    const describecPorts = describedService.ports;
    const describedPort = describecPorts[Object.keys(describecPorts)[0]];
    output.endpoint = describedPort.location;

    for (const service of Object.keys(description)) {
      for (const port of Object.keys(description[service])) {
        const collector = new TypeCollector(port + 'Types');
        // console.log("-- %s.%s", service, port);

        if (!output.types[service]) {
          output.types[service] = {};
          output.methods[service] = {};
          output.files[service] = {};
          output.namespaces[service] = {};
        }
        if (!output.types[service][port]) {
          output.types[service][port] = {};
          output.methods[service][port] = {};
          output.files[service][port] = service + '/' + port;
          output.namespaces[service][port] = {};
        }

        for (let maxi = 0; maxi < 32; maxi++) {
          for (const method of Object.keys(description[service][port])) {
            // console.log("---- %s", method);

            wsdlTypeToInterface(description[service][port][method].input || {}, method + 'Input', collector, opts);
            wsdlTypeToInterface(description[service][port][method].output || {}, method + 'Output', collector, opts);
          }

          const reg = cloneObj(collector.registered);
          collector.registerCollected();
          const regKeys0: string[] = Object.keys(collector.registered);
          const regKeys1: string[] = Object.keys(reg);
          if (regKeys0.length === regKeys1.length) {
            let noChange = true;
            for (const rk of regKeys0) {
              if (safeStringify(collector.registered[rk]) !== safeStringify(reg[rk])) {
                noChange = false;
                break;
              }
            }
            if (noChange) {
              break;
            }
          }
          if (maxi === 31) {
            console.warn('wsdl-to-ts: Aborted nested interface changes');
          }
        }

        output.soapNamespaces = collector.soapNamespaces;
        const collectedKeys: string[] = Object.keys(collector.registered);
        if (collectedKeys.length) {
          const ns: { [k: string]: string } = (output.namespaces[service][port][collector.ns] = {});
          for (const k of collectedKeys) {
            const obj = collector.registered[k];
            let fullstring = '';
            if (obj.namespace) {
              fullstring += `@XmlNamespace("${obj.namespace}")\n`;
            }
            fullstring += 'export class I' + k + ' extends ArBaseSoapNode ' + obj.object;
            ns[k] = fullstring;
          }
        }

        for (const method of Object.keys(description[service][port])) {
          const inputType = wsdlTypeToInterface(
            description[service][port][method].input || {},
            method + 'Input',
            collector,
            opts,
          );
          output.types[service][port]['I' + method + 'Input'] = inputType;
          output.types[service][port]['I' + method + 'Output'] = wsdlTypeToInterface(
            description[service][port][method].output || {},
            method + 'Output',
            collector,
            opts,
          );
          /*
          output.methods[service][port][method] =
            "(input: I" +
            method +
            "Input, " +
            "cb: (err: any | null," +
            " result: I" +
            method +
            "Output," +
            " raw: string, " +
            " soapHeader: {[k: string]: any; }) => any, " +
            "options?: any, " +
            "extraHeaders?: any" +
            ") => void";
            */
          output.methods[service][port][method + 'Async'] =
            '(input: I' +
            method +
            'Input, options?: any, extraHeaders?: any) => Promise<{result: I' +
            method +
            'Output, rawResponse: string, soapHeader: {[k: string]: any; }, rawRequest: string}>';
        }
      }
    }

    return output;
  });
}

function cloneObj<T extends { [k: string]: any }>(a: T): T {
  const b: T = {} as any;
  for (const k of Object.keys(a)) {
    const t = typeof a[k];
    (b as any)[k] = t === 'object' ? (Array.isArray(a[k]) ? a[k].slice() : cloneObj(a[k])) : a[k];
  }
  return b;
}

export function mergeTypedWsdl(a: ITypedWsdl, ...bs: ITypedWsdl[]): ITypedWsdl {
  const x: ITypedWsdl = {
    client: a.client,
    files: cloneObj(a.files),
    methods: cloneObj(a.methods),
    namespaces: cloneObj(a.namespaces),
    types: cloneObj(a.types),
    soapNamespaces: a.soapNamespaces,
    endpoint: a.endpoint,
  };
  for (const b of bs) {
    for (const service of Object.keys(b.files)) {
      if (!x.files.hasOwnProperty(service)) {
        x.files[service] = cloneObj(b.files[service]);
        x.methods[service] = cloneObj(b.methods[service]);
        x.types[service] = cloneObj(b.types[service]);
        x.namespaces[service] = cloneObj(b.namespaces[service]);
      } else {
        for (const port of Object.keys(b.files[service])) {
          if (!x.files[service].hasOwnProperty(port)) {
            x.files[service][port] = b.files[service][port];
            x.methods[service][port] = cloneObj(b.methods[service][port]);
            x.types[service][port] = cloneObj(b.types[service][port]);
            x.namespaces[service][port] = cloneObj(b.namespaces[service][port]);
          } else {
            x.files[service][port] = b.files[service][port];
            for (const method of Object.keys(b.methods[service][port])) {
              x.methods[service][port][method] = b.methods[service][port][method];
            }
            for (const type of Object.keys(b.types[service][port])) {
              x.types[service][port][type] = b.types[service][port][type];
            }
            for (const ns of Object.keys(b.namespaces[service][port])) {
              if (!x.namespaces[service][port].hasOwnProperty(ns)) {
                x.namespaces[service][port][ns] = cloneObj(b.namespaces[service][port][ns]);
              } else {
                for (const nsi of Object.keys(b.namespaces[service][port][ns])) {
                  x.namespaces[service][port][ns][nsi] = b.namespaces[service][port][ns][nsi];
                }
              }
            }
          }
        }
      }
    }
  }
  return x;
}

export function outputTypedWsdl(
  a: ITypedWsdl,
  outputConfig: { wsdlImportBasePath: string; forceNamespaceOnInputRoot?: string },
): Array<{ file: string; data: string[] }> {
  const r: Array<{ file: string; data: string[] }> = [];

  for (const service of Object.keys(a.files)) {
    for (const port of Object.keys(a.files[service])) {
      const fileName = a.files[service][port].replace('Soap', '');
      const interfaceFile: { file: string; data: string[] } = {
        file: fileName + 'Types',
        data: [],
      };
      const serviceFile: { file: string; data: string[] } = {
        file: fileName,
        data: [],
      };
      const relativeTypesPath = path
        .relative(
          fileName,
          fileName + 'Types',
          // FIXME
        )
        .substring(1);
      // @ts-ignore (not my fault. Oli wants it. 🦄)
      const absoluteWsdl = path.resolve(a.client.wsdl.uri);
      const absoluteServiceFile = path.resolve(fileName) + '/workaround';
      const relativeWsdl = path.relative(
        outputConfig.wsdlImportBasePath ? outputConfig.wsdlImportBasePath : absoluteServiceFile,
        absoluteWsdl,
      );

      const types = _.uniq(knownTypes)
        .map((u) => u.replace(';', ''))
        // .map(u => (u.endsWith(">") ? u.substring(0, u.length - 1) : u))
        .filter((e) => e !== 'string' && e !== 'number' && e !== 'boolean' && !e.includes('"'));
      types.push('ArBaseSoapNode');
      interfaceFile.data.push(`import { ${types.join(', ')} } from "${TS_IMPORT_PATHS.WSDL_TYPES}";`);
      interfaceFile.data.push(`import { XmlNamespace, XmlOrder } from "${TS_IMPORT_PATHS.WSDL_DECORATORS}";`);
      interfaceFile.data.push(`import { Type } from "class-transformer";`);

      interfaceFile.data.push(
        `export const ${interfaceFile.file.substring(
          interfaceFile.file.lastIndexOf('/') + 1,
        )}Namespaces: string[] = ${safeStringify(a.soapNamespaces, null, 4)};`,
      );
      if (a.namespaces[service] && a.namespaces[service][port]) {
        for (const ns of Object.keys(a.namespaces[service][port])) {
          const ms: string[] = [];
          for (const nsi of Object.keys(a.namespaces[service][port][ns])) {
            ms.push(a.namespaces[service][port][ns][nsi].replace(/\n/g, '\n    '));
          }
          if (ms.length) {
            interfaceFile.data.push('export namespace ' + ns + ' {\n    ' + ms.join('\n    ') + '\n}');
          }
        }
      }
      if (a.types[service] && a.types[service][port]) {
        for (const type of Object.keys(a.types[service][port])) {
          if (type.endsWith('Input') && outputConfig.forceNamespaceOnInputRoot) {
            interfaceFile.data.push(`@XmlNamespace("${outputConfig.forceNamespaceOnInputRoot}", true)`);
          }
          interfaceFile.data.push('export class ' + type + ' extends ArBaseSoapNode ' + a.types[service][port][type]);
        }
      }
      if (a.methods[service] && a.methods[service][port]) {
        const ms: string[] = [];

        serviceFile.data.push(
          Templates.serviceHeaderTemplate({
            relativeTypesPath,
            serviceName: service,
            defaultEndpoint: a.endpoint,
            wsdlLocation: relativeWsdl,
          }),
        );

        for (const method of Object.keys(a.methods[service][port])) {
          const templateObj = {
            methodName: method.replace('Async', ''),
            serviceName: service,
            relativeTypesPath,
          };
          ms.push(method + ': ' + a.methods[service][port][method] + ';');
          serviceFile.data.unshift(Templates.serviceImportTemplate(templateObj));
          serviceFile.data.push(Templates.serviceMethodTemplate(templateObj));
        }
        serviceFile.data.push('}');

        if (ms.length) {
          interfaceFile.data.push('export interface I' + port + 'Soap {\n    ' + ms.join('\n    ') + '\n}');
        }
      }
      r.push(interfaceFile);
      r.push(serviceFile);
    }
  }
  return r;
}
