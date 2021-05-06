export const TS_IMPORT_PATHS = {
    WSDL_CLIENT: '@adamriese/soap-client/lib/wsdl.client',
    WSDL_DECORATORS: '@adamriese/soap-client/lib/wsdl.decorators',
    WSDL_TYPES: '@adamriese/soap-client/lib/wsdl.types',
    CORE: '@adamriese/core',
};
export default class Templates {
    static serviceHeaderTemplate(body) {
        return `import { BaseSoapService, IArSoapOptions } from '${TS_IMPORT_PATHS.WSDL_CLIENT}';
import { IOptions } from 'soap';
import * as path from 'path';
import { PartialDeep } from 'type-fest';


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
    inputData: PartialDeep<I${body.methodName}Input>,
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
      options,
      extraHeaders);
  }`;
    }
}
//# sourceMappingURL=template.js.map
