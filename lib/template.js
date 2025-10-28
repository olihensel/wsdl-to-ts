"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TS_IMPORT_PATHS = void 0;
exports.TS_IMPORT_PATHS = {
    WSDL_CLIENT: '@adamriese/soap-client/lib/wsdl.client',
    WSDL_DECORATORS: '@adamriese/soap-client/lib/wsdl.decorators',
    WSDL_TYPES: '@adamriese/soap-client/lib/wsdl.types',
    CORE: '@adamriese/core',
};
class Templates {
    static serviceHeaderTemplate(body) {
        return `import { BaseSoapService, IArSoapOptions } from '${exports.TS_IMPORT_PATHS.WSDL_CLIENT}';
import { IOptions } from 'soap';
import * as path from 'node:path';
import { PartialDeep } from 'type-fest';


export class ${body.serviceName} extends BaseSoapService {

static readonly serviceName = "${body.serviceName}";
static readonly defaultEndpoint = "${body.defaultEndpoint}";

async initializeClientAsync(
    wsdlBasePath: string,
    endpoint: string,
    options: IOptions & IArSoapOptions,
  ): Promise<void> {
    return this.createClientWithWsdlPathAsync( path.join(wsdlBasePath, "${body.wsdlLocation}"), endpoint, options);
}
  `;
    }
    static serviceImportTemplate(body) {
        return `import { I${body.methodName}Input, I${body.methodName}Output } from "${body.relativeTypesPath}";`;
    }
    static serviceMethodTemplate(body) {
        return `  async ${body.methodName}Async(
    inputData: PartialDeep<I${body.methodName}Input>,
    options?: object,
    extraHeaders?: object
  ): Promise<{
    result: I${body.methodName}Output;
    rawResponse: string;
    soapHeader: { [k: string]: string };
    rawRequest: string;
  }> {
    return await this.executeSoapMethod<I${body.methodName}Input, I${body.methodName}Output>(
      I${body.methodName}Input,
      "${body.methodName}",
      inputData,
      options,
      extraHeaders);
  }`;
    }
}
exports.default = Templates;
//# sourceMappingURL=template.js.map