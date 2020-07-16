"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
import * as path from 'path';
import { ArApiLogger, RecursivePartial } from '${exports.TS_IMPORT_PATHS.CORE}';


export class ${body.serviceName} extends BaseSoapService {

public static readonly serviceName = "${body.serviceName}";
public static readonly defaultEndpoint = "${body.defaultEndpoint}";
constructor() {
    super();
}

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
    inputData: RecursivePartial<I${body.methodName}Input>,
    logger: ArApiLogger,
    options?: object,
    extraHeaders?: object
  ): Promise<{
    result: I${body.methodName}Output;
    rawResponse: string;
    soapHeader: { [k: string]: any };
    rawRequest: string;
  }> {
    return await this.executeSoapMethod<I${body.methodName}Input, I${body.methodName}Output>(
      I${body.methodName}Input,
      "${body.methodName}",
      inputData,
      logger,
      options,
      extraHeaders);
  }`;
    }
}
exports.default = Templates;
//# sourceMappingURL=template.js.map